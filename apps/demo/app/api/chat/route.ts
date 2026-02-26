import {
  createHelm,
  edit,
  fs,
  git,
  grep,
  http,
  type Permission,
  shell,
} from "@bgub/helm";
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
import { z } from "zod";
import { requestApproval } from "../../../lib/approvals";
import { evaluate } from "../../../lib/sandbox";

const SYSTEM_PROMPT = `You are a helpful assistant with access to the local system through helm, a typed tool framework.

You have two tools: search and execute.

## search
Use search to discover available operations. The search uses keyword matching against operation names, descriptions, and tags. Use short, specific keywords — e.g. "list", "read", "write", "git", "grep", "http". Do NOT use long natural-language queries; they will return no results.

## execute
Use execute to run JavaScript code with the helm agent API available as \`agent\`.

Write async JS code using the agent API. Available skills:

**fs** — file system:
- \`await agent.fs.readFile(path)\` — read a file
- \`await agent.fs.writeFile(path, content)\` — write a file
- \`await agent.fs.readdir(dir)\` — list a directory
- \`await agent.fs.mkdir(path)\` — create a directory
- \`await agent.fs.stat(path)\` — get file/dir metadata
- \`await agent.fs.rm(path)\` — remove a file or directory
- \`await agent.fs.rename(oldPath, newPath)\` — rename/move
- \`await agent.fs.cwd()\` — get current working directory

**git** — version control:
- \`await agent.git.status()\` — repo status
- \`await agent.git.diff()\` / \`agent.git.diff({ staged: true })\` — file changes
- \`await agent.git.log({ limit: 5 })\` — commit history
- \`await agent.git.show(ref, { path })\` — show file at ref
- \`await agent.git.add(paths)\` — stage files
- \`await agent.git.commit(message)\` — create commit
- \`await agent.git.branchList()\` — list branches
- \`await agent.git.branchCreate(name)\` — create branch
- \`await agent.git.checkout(ref)\` — switch branch

**grep** — search:
- \`await agent.grep.search(pattern, { glob, maxResults })\` — search files

**edit** — file editing:
- \`await agent.edit.replace(path, old, new)\` — replace text
- \`await agent.edit.insert(path, line, content)\` — insert at line
- \`await agent.edit.removeLines(path, start, end)\` — remove lines
- \`await agent.edit.apply(path, edits)\` — batch edits

**shell** — commands:
- \`await agent.shell.dangerousExec(command)\` — run shell command

**http** — web requests:
- \`await agent.http.fetch(url, opts)\` — HTTP request
- \`await agent.http.json(url, opts)\` — fetch and parse JSON

Use \`await\` for all agent calls. Return the value you want to show to the user.

Example:
\`\`\`js
const { staged, unstaged, branch } = await agent.git.status();
return { branch, staged: staged.length, unstaged: unstaged.length };
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

      const agent = createHelm({
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
      })
        .use(fs())
        .use(git())
        .use(grep())
        .use(edit())
        .use(shell())
        .use(http());

      const result = streamText({
        model: gateway("minimax/minimax-m2.5"),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(10),
        tools: {
          search: tool({
            description:
              "Search for available helm operations by keyword. Use short keywords like 'list', 'read', 'file', 'git', 'grep'. Returns matching operations with qualifiedName, description, and signature.",
            inputSchema: z.object({
              query: z
                .string()
                .describe(
                  "Short keyword to search for, e.g. 'list', 'read', 'git', 'grep'",
                ),
            }),
            execute: async ({ query }) => agent.search(query),
          }),
          execute: tool({
            description:
              "Execute JavaScript code with the helm agent API available as `agent`. Use `await` for agent calls. Return the value to show.",
            inputSchema: z.object({
              code: z
                .string()
                .describe(
                  "JavaScript code to execute. `agent` is available in scope. Use `await` and `return`.",
                ),
            }),
            execute: async ({ code }, { toolCallId }) => {
              activeToolCallId = toolCallId;
              try {
                return await evaluate(code, agent);
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
