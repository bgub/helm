import type { PermissionPolicy, SearchResult } from "@bgub/helm";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../protocol.ts";

export interface HelmClientOptions {
  /** Called when the server requests approval for an operation */
  onApprovalRequest?: (info: {
    approvalId: string;
    operation: string;
    args: unknown[];
  }) => Promise<boolean> | boolean;
}

export interface HelmSession {
  /** The session ID assigned by the server */
  readonly sessionId: string;
  /** Available skills/operations discovered at connection time */
  readonly skills: SearchResult[];

  /** Call a specific operation by qualified name (e.g. "git.status") */
  call(qualifiedName: string, ...args: unknown[]): Promise<unknown>;
  /** Execute arbitrary JS code in the server's SES sandbox */
  execute(code: string): Promise<unknown>;
  /** Search for available operations */
  search(query: string): Promise<SearchResult[]>;
  /** Update the session's permission policy on the server */
  updatePermissions(permissions: PermissionPolicy): Promise<void>;
  /** Register an approval request handler */
  onApprovalRequest(
    handler: (info: {
      approvalId: string;
      operation: string;
      args: unknown[];
    }) => Promise<boolean> | boolean,
  ): void;
  /** Close the session and WebSocket connection */
  close(): void;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

let nextRequestId = 1;

/**
 * Connect to a Helm server and return a session handle.
 */
export async function connect(
  url: string,
  options: HelmClientOptions = {},
): Promise<HelmSession> {
  return new Promise((resolveConnect, rejectConnect) => {
    const ws = new WebSocket(url);
    const pending = new Map<string, PendingRequest>();
    let sessionId = "";
    let skills: SearchResult[] = [];
    let approvalHandler = options.onApprovalRequest;

    function send(msg: ClientMessage): void {
      ws.send(JSON.stringify(msg));
    }

    ws.on("message", (data) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(data)) as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "connected": {
          sessionId = msg.sessionId;
          skills = msg.skills;
          resolveConnect(session);
          break;
        }

        case "search-result": {
          const req = pending.get(msg.id);
          if (req) {
            pending.delete(msg.id);
            req.resolve(msg.results);
          }
          break;
        }

        case "call-result": {
          const req = pending.get(msg.id);
          if (req) {
            pending.delete(msg.id);
            req.resolve(msg.value);
          }
          break;
        }

        case "call-error": {
          const req = pending.get(msg.id);
          if (req) {
            pending.delete(msg.id);
            req.reject(new Error(msg.error.message));
          }
          break;
        }

        case "permissions-updated": {
          // ACK — nothing to resolve specifically
          break;
        }

        case "approval-request": {
          if (approvalHandler) {
            Promise.resolve(
              approvalHandler({
                approvalId: msg.approvalId,
                operation: msg.operation,
                args: msg.args,
              }),
            ).then((approved) => {
              send({
                type: "approval-response",
                approvalId: msg.approvalId,
                approved,
              });
            });
          } else {
            // No handler — deny by default
            send({
              type: "approval-response",
              approvalId: msg.approvalId,
              approved: false,
            });
          }
          break;
        }

        case "trace": {
          // Traces are informational — clients can subscribe if needed
          break;
        }
      }
    });

    ws.on("error", (err) => {
      rejectConnect(err);
      // Reject all pending requests
      for (const req of pending.values()) {
        req.reject(err instanceof Error ? err : new Error(String(err)));
      }
      pending.clear();
    });

    ws.on("close", () => {
      for (const req of pending.values()) {
        req.reject(new Error("Connection closed"));
      }
      pending.clear();
    });

    function makeRequest(msg: ClientMessage): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const id = "id" in msg ? msg.id : "";
        pending.set(id, { resolve, reject });
        send(msg);
      });
    }

    const session: HelmSession = {
      get sessionId() {
        return sessionId;
      },
      get skills() {
        return skills;
      },

      async call(qualifiedName: string, ...args: unknown[]): Promise<unknown> {
        const id = `r_${nextRequestId++}`;
        return makeRequest({ type: "call", id, qualifiedName, args });
      },

      async execute(code: string): Promise<unknown> {
        const id = `r_${nextRequestId++}`;
        return makeRequest({ type: "execute", id, code });
      },

      async search(query: string): Promise<SearchResult[]> {
        const id = `r_${nextRequestId++}`;
        return makeRequest({
          type: "search",
          id,
          query,
        }) as Promise<SearchResult[]>;
      },

      async updatePermissions(permissions: PermissionPolicy): Promise<void> {
        send({ type: "update-permissions", permissions });
      },

      onApprovalRequest(handler) {
        approvalHandler = handler;
      },

      close() {
        ws.close();
      },
    };
  });
}
