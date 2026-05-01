import type { HelmSession } from "../helm-client.ts";

/**
 * OpenAI function calling definition shape.
 */
export interface OpenAiFunctionDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/**
 * Generate OpenAI-compatible function definitions from a Helm session.
 * Returns an array of tool definitions for use with chat completions.
 */
export function openaiTools(_session: HelmSession): OpenAiFunctionDef[] {
  return [
    {
      type: "function",
      function: {
        name: "helm_search",
        description:
          "Search for available helm operations by keyword. Use short keywords like 'list', 'read', 'file', 'git', 'grep'.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Short keyword to search for",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "helm_execute",
        description:
          "Execute JavaScript code with the helm agent API available as `agent`. Use `await` for agent calls.",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to execute with `agent` in scope",
            },
          },
          required: ["code"],
        },
      },
    },
  ];
}

/**
 * Handle an OpenAI function call result by routing it to the Helm session.
 */
export async function handleOpenAiToolCall(
  session: HelmSession,
  functionName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (functionName) {
    case "helm_search":
      return session.search(args.query as string);
    case "helm_execute":
      return session.execute(args.code as string);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
