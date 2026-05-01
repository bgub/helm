import type { HelmSession } from "../helm-client.ts";

/**
 * Tool definition shape compatible with Vercel AI SDK's `tool()`.
 * We define this inline to avoid requiring `ai` as a dependency.
 */
export interface AiSdkTool {
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export type AiSdkToolMode = "search-execute" | "direct";

/**
 * Generate AI SDK-compatible tool definitions from a Helm session.
 *
 * Two modes:
 * - "search-execute" (default): Two tools (search + execute) matching the demo pattern.
 *   Best for keeping context small with many operations.
 * - "direct": One tool per operation. Better type safety but uses more context.
 */
export function aiSdkTools(
  session: HelmSession,
  mode: AiSdkToolMode = "search-execute",
): Record<string, AiSdkTool> {
  if (mode === "direct") {
    return directTools(session);
  }
  return searchExecuteTools(session);
}

function searchExecuteTools(session: HelmSession): Record<string, AiSdkTool> {
  return {
    search: {
      description:
        "Search for available helm operations by keyword. Use short keywords like 'list', 'read', 'file', 'git', 'grep'. Returns matching operations with qualifiedName, description, and signature.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Short keyword to search for, e.g. 'list', 'read', 'git', 'grep'",
          },
        },
        required: ["query"],
      },
      execute: async ({ query }) => {
        return session.search(query as string);
      },
    },
    execute: {
      description:
        "Execute JavaScript code with the helm agent API available as `agent`. Use `await` for agent calls. Return the value to show.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "JavaScript code to execute. `agent` is available in scope. Use `await` and `return`.",
          },
        },
        required: ["code"],
      },
      execute: async ({ code }) => {
        return session.execute(code as string);
      },
    },
  };
}

function directTools(session: HelmSession): Record<string, AiSdkTool> {
  const tools: Record<string, AiSdkTool> = {};

  for (const skill of session.skills) {
    tools[skill.qualifiedName] = {
      description: `${skill.description}${skill.signature ? ` — ${skill.signature}` : ""}`,
      parameters: {
        type: "object",
        properties: {
          args: {
            type: "array",
            description: `Arguments for ${skill.qualifiedName}. ${skill.signature ?? ""}`,
          },
        },
        required: ["args"],
      },
      execute: async ({ args }) => {
        return session.call(
          skill.qualifiedName,
          ...((args as unknown[]) ?? []),
        );
      },
    };
  }

  return tools;
}
