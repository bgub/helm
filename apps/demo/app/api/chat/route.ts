import {
  convertToModelMessages,
  gateway,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { createCrag, fs } from "crag";
import { z } from "zod";

const agent = createCrag({ defaultPermission: "allow" }).use(fs());

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gateway("anthropic/claude-sonnet-4-20250514"),
    system: `You are a helpful assistant with access to the local filesystem through crag, a typed tool framework.

You have two tools: search and execute.

## search
Use search to discover available operations. The search uses keyword matching against operation names, descriptions, and tags. Use short, specific keywords — e.g. "list", "read", "write", "remove", "exists". Do NOT use long natural-language queries; they will return no results.

## execute
Use execute to call an operation by its qualifiedName (e.g. "fs.list", "fs.read"). Pass arguments as an array matching the operation's signature.

## Workflow
1. Search with a short keyword to find relevant operations.
2. Read the signature in the search result to understand the arguments.
3. Execute with the qualifiedName and correct args.

Be concise in your responses.`,
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
          "Execute a crag operation by its qualified name (e.g. 'fs.read', 'fs.list').",
        inputSchema: z.object({
          qualifiedName: z
            .string()
            .describe("The qualified name of the operation, e.g. 'fs.list'"),
          args: z
            .array(z.unknown())
            .describe("Arguments to pass to the operation"),
        }),
        execute: async ({ qualifiedName, args }) => {
          try {
            const [skill, op] = qualifiedName.split(".");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const skillNs = (agent as any)[skill] as
              | Record<string, Function>
              | undefined;
            if (!skillNs?.[op]) {
              return { error: `Unknown operation: ${qualifiedName}` };
            }
            const result = await skillNs[op](...args);
            return result;
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
