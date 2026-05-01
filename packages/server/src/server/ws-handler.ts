import type { WebSocket } from "ws";
import type {
  ClientMessage,
  HelmServerConfig,
  ServerMessage,
} from "../protocol.ts";
import { ApprovalChannel } from "./approval.ts";
import type { Session, SessionManagerService } from "./session.ts";
import { type TraceStoreService, traceCall } from "./trace-store.ts";

/**
 * Walk a dotted path like "git.status" on the helm instance
 * and return the bound function.
 */
function walkAgent(
  agent: unknown,
  method: string,
): ((...args: unknown[]) => unknown) | undefined {
  const parts = method.split(".");
  let current: unknown = agent;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "function"
    ? (current as (...args: unknown[]) => unknown)
    : undefined;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export interface WsHandlerDeps {
  sessionManager: SessionManagerService;
  traceStore: TraceStoreService;
  config: HelmServerConfig;
  onSessionCreated?: (session: Session) => void;
  onSessionClosed?: (sessionId: string) => void;
}

/**
 * Handle a new WebSocket connection.
 * Creates a session, wires up the approval channel, and processes messages.
 */
export function handleConnection(ws: WebSocket, deps: WsHandlerDeps): void {
  const { sessionManager, traceStore, config } = deps;

  const approval = new ApprovalChannel();

  const session = sessionManager.create({
    skills: config.skills,
    defaultPermissions: config.defaultPermissions ?? {},
    defaultPermission: config.defaultPermission ?? "ask",
    onApprovalRequest: (operation, args) => approval.request(operation, args),
  });

  // Wire approval requests to WebSocket
  approval.setRequestHandler((approvalId, operation, args) => {
    send(ws, { type: "approval-request", approvalId, operation, args });
  });

  // Send initial connection message with available skills
  const skills = session.helm.search("");
  send(ws, { type: "connected", sessionId: session.id, skills });

  deps.onSessionCreated?.(session);

  ws.on("message", async (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data)) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "search": {
        const results = session.helm.search(msg.query);
        send(ws, { type: "search-result", id: msg.id, results });
        break;
      }

      case "call": {
        const fn = walkAgent(session.helm, msg.qualifiedName);
        if (!fn) {
          send(ws, {
            type: "call-error",
            id: msg.id,
            error: {
              message: `Unknown operation: ${msg.qualifiedName}`,
              code: "NOT_FOUND",
            },
          });
          break;
        }

        try {
          const value = await traceCall(
            traceStore,
            session,
            msg.qualifiedName,
            msg.args,
            "allow", // permission is checked inside helm's bound ops
            false,
            () => fn(...msg.args) as Promise<unknown>,
          );
          send(ws, { type: "call-result", id: msg.id, value });
        } catch (error) {
          send(ws, {
            type: "call-error",
            id: msg.id,
            error: {
              message: error instanceof Error ? error.message : String(error),
              code:
                error instanceof Error && error.name === "PermissionDeniedError"
                  ? "PERMISSION_DENIED"
                  : undefined,
            },
          });
        }
        break;
      }

      case "execute": {
        // Sandbox execution — delegated to sandbox module if enabled.
        // For now, fall through to direct eval with the agent in scope.
        try {
          const { evaluate } = await import("./sandbox.ts");
          const value = await evaluate(msg.code, session.helm);
          send(ws, { type: "call-result", id: msg.id, value });
        } catch (error) {
          send(ws, {
            type: "call-error",
            id: msg.id,
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
        break;
      }

      case "update-permissions": {
        const { updateSessionPermissions } = await import("./session.ts");
        updateSessionPermissions(session, msg.permissions, {
          skills: config.skills,
          defaultPermission: config.defaultPermission ?? "ask",
        });
        send(ws, { type: "permissions-updated" });
        break;
      }

      case "approval-response": {
        approval.respond(msg.approvalId, msg.approved);
        break;
      }
    }
  });

  ws.on("close", () => {
    approval.denyAll();
    sessionManager.destroy(session.id);
    deps.onSessionClosed?.(session.id);
  });

  ws.on("error", () => {
    approval.denyAll();
    sessionManager.destroy(session.id);
    deps.onSessionClosed?.(session.id);
  });
}
