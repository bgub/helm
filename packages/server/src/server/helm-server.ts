import type { ServerResponse } from "node:http";
import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import type { HelmServerConfig, SessionInfo } from "../protocol.ts";
import { broadcastSSE, handleRequest } from "./routes.ts";
import { makeSessionManager, type SessionManagerService } from "./session.ts";
import { makeTraceStore, type TraceStoreService } from "./trace-store.ts";
import { handleConnection, type WsHandlerDeps } from "./ws-handler.ts";

export class HelmServer {
  private readonly sessionManager: SessionManagerService;
  private readonly traceStore: TraceStoreService;
  private readonly config: HelmServerConfig;
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private sseClients = new Set<ServerResponse>();
  private boundPort: number | null = null;

  private constructor(config: HelmServerConfig) {
    this.config = config;
    this.sessionManager = makeSessionManager();
    this.traceStore = makeTraceStore();

    // Broadcast traces to SSE clients
    this.traceStore.subscribe((entry) => {
      broadcastSSE(this.sseClients, { type: "trace", entry });
    });
  }

  static create(config: HelmServerConfig): HelmServer {
    return new HelmServer(config);
  }

  async listen(): Promise<void> {
    const preferredPort = this.config.port ?? 3001;

    this.httpServer = createServer((req, res) => {
      // Skip WebSocket upgrade requests
      if (req.headers.upgrade) return;

      handleRequest(
        req,
        res,
        this.sessionManager,
        this.traceStore,
        this.sseClients,
      );
    });

    const deps: WsHandlerDeps = {
      sessionManager: this.sessionManager,
      traceStore: this.traceStore,
      config: this.config,
      onSessionCreated: (session) => {
        broadcastSSE(this.sseClients, {
          type: "session-created",
          session: {
            id: session.id,
            createdAt: session.createdAt,
            traceCount: 0,
            permissions: {},
          },
        });
      },
      onSessionClosed: (sessionId) => {
        broadcastSSE(this.sseClients, {
          type: "session-closed",
          sessionId,
        });
      },
    };

    const port = await tryListen(this.httpServer, preferredPort);
    this.boundPort = port;

    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on("connection", (ws) => {
      handleConnection(ws, deps);
    });

    const dashboard =
      this.config.dashboard !== false
        ? `\n  Dashboard: http://localhost:${port}/dashboard`
        : "";

    console.log(
      `  Helm Server listening on ws://localhost:${port}${dashboard}\n` +
        `  Skills: ${this.config.skills.map((s) => s.name).join(", ")} (${this.config.skills.length} skills)`,
    );
  }

  async close(): Promise<void> {
    // Close all SSE clients
    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();

    // Close all WebSocket connections
    if (this.wss) {
      for (const ws of this.wss.clients) {
        ws.close();
      }
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer?.close(() => {
          this.httpServer = null;
          resolve();
        });
      });
    }
  }

  get sessions(): SessionInfo[] {
    return this.sessionManager.list().map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      traceCount: s.traces.length,
      permissions: {},
    }));
  }

  get port(): number {
    return this.boundPort ?? this.config.port ?? 3001;
  }
}

/**
 * Try to listen on `port`. If it's in use, try the next port up,
 * up to 10 attempts in the 3001–3010 range.
 */
function tryListen(
  server: Server,
  port: number,
  maxAttempts = 10,
): Promise<number> {
  let attempts = 0;

  function attempt(p: number): Promise<number> {
    attempts++;
    return new Promise<number>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && attempts < maxAttempts) {
          server.close(() => resolve(attempt(p + 1)));
        } else {
          reject(err);
        }
      };
      server.once("error", onError);
      server.listen(p, () => {
        server.removeListener("error", onError);
        resolve(p);
      });
    });
  }

  return attempt(port);
}
