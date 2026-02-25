import "../../../lib/ses-init";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  gateway,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { createCrag, fs, type Permission } from "crag";
import { z } from "zod";
import { requestApproval } from "../../../lib/approvals";

const SYSTEM_PROMPT = `You are a helpful assistant with access to the local filesystem through crag, a typed tool framework.

You have two tools: search and execute.

## search
Use search to discover available operations. The search uses keyword matching against operation names, descriptions, and tags. Use short, specific keywords — e.g. "list", "read", "write", "remove", "exists". Do NOT use long natural-language queries; they will return no results.

## execute
Use execute to run JavaScript code with the crag agent API available as \`agent\`.

Write async JS code using the agent API:
- \`await agent.fs.read(path)\` — read a file
- \`await agent.fs.list(dir)\` — list a directory
- \`await agent.fs.write(path, content)\` — write a file
- \`await agent.fs.mkdir(path)\` — create a directory
- \`await agent.fs.exists(path)\` — check if a path exists
- Use \`await\` for all agent calls
- Return the value you want to show to the user

Example:
\`\`\`js
const files = await agent.fs.list(".");
return files;
\`\`\`

## Workflow
1. Search with a short keyword to find relevant operations.
2. Read the signature in the search result to understand the arguments.
3. Execute JS code using the agent API with the correct method calls.

Some operations may require user approval. If an operation is denied, you will see a PermissionDeniedError.

Be concise in your responses.`;

export async function POST(req: Request) {
  const {
    messages,
    permissions,
  }: { messages: UIMessage[]; permissions?: Record<string, Permission> } =
    await req.json();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Tracks the current tool call ID so onPermissionRequest can tie
      // approval requests to the specific execute call that triggered them.
      // Safe because tool calls execute sequentially.
      let activeToolCallId = "";

      const agent = createCrag({
        permissions: permissions ?? {},
        defaultPermission: "allow",
        onPermissionRequest: (operation, args) => {
          const { id, approved } = requestApproval(
            operation,
            args as unknown[],
          );
          writer.write({
            type: "data-approval-request",
            data: { id, operation, args, toolCallId: activeToolCallId },
          });
          return approved;
        },
      }).use(fs());

      const result = streamText({
        model: gateway("minimax/minimax-m2.5"),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(10),
        tools: {
          search: tool({
            description:
              "Search for available crag operations by keyword. Use short keywords like 'list', 'read', 'file'. Returns matching operations with qualifiedName, description, and signature.",
            inputSchema: z.object({
              query: z
                .string()
                .describe(
                  "Short keyword to search for, e.g. 'list', 'read', 'write'",
                ),
            }),
            execute: async ({ query }) => agent.search(query),
          }),
          execute: tool({
            description:
              "Execute JavaScript code with the crag agent API available as `agent`. Use `await` for agent calls. Return the value to show.",
            inputSchema: z.object({
              code: z
                .string()
                .describe(
                  "JavaScript code to execute. `agent` is available in scope. Use `await` and `return`.",
                ),
            }),
            execute: async ({ code }, { toolCallId }) => {
              activeToolCallId = toolCallId;
              const compartment = new Compartment({
                globals: {
                  agent,
                  console: {
                    log: (...a: unknown[]) => a,
                    error: (...a: unknown[]) => a,
                  },
                },
                __options__: true,
              });
              const wrapped = `(async () => {\n${code}\n})()`;
              try {
                const result = await compartment.evaluate(wrapped);
                return result ?? { ok: true };
              } catch (e) {
                return { error: e instanceof Error ? e.message : String(e) };
              }
            },
          }),
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
