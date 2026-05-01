import { defineSkill } from "@bgub/helm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/protocol.ts";
import { HelmServer } from "../src/server/helm-server.ts";

// A simple test skill
const testSkill = defineSkill({
  name: "math",
  description: "Math operations",
  operations: {
    add: {
      description: "Add two numbers",
      signature: "(a: number, b: number) => number",
      tags: ["math", "add"],
      defaultPermission: "allow" as const,
      handler: (a: number, b: number) => a + b,
    },
    multiply: {
      description: "Multiply two numbers",
      signature: "(a: number, b: number) => number",
      tags: ["math", "multiply"],
      defaultPermission: "allow" as const,
      handler: (a: number, b: number) => a * b,
    },
    dangerous: {
      description: "A dangerous operation",
      signature: "() => string",
      tags: ["danger"],
      defaultPermission: "ask" as const,
      handler: () => "done",
    },
  },
});

const PORT = 9876;

/**
 * Connect to the server and wait for the "connected" message.
 * Returns both the WebSocket and the connected message.
 * This avoids race conditions where the message arrives before the listener.
 */
function connectAndWait(): Promise<{
  ws: WebSocket;
  connected: Extract<ServerMessage, { type: "connected" }>;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.on("error", reject);
    ws.on("message", function handler(data) {
      const msg = JSON.parse(String(data)) as ServerMessage;
      if (msg.type === "connected") {
        ws.off("message", handler);
        resolve({
          ws,
          connected: msg as Extract<ServerMessage, { type: "connected" }>,
        });
      }
    });
  });
}

function sendAndReceive(
  ws: WebSocket,
  msg: ClientMessage,
): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const id = "id" in msg ? msg.id : "";
    const handler = (data: WebSocket.Data) => {
      const parsed = JSON.parse(String(data)) as ServerMessage;
      if ("id" in parsed && parsed.id === id) {
        ws.off("message", handler);
        resolve(parsed);
      }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify(msg));
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const handler = (data: WebSocket.Data) => {
      const parsed = JSON.parse(String(data)) as ServerMessage;
      if (predicate(parsed)) {
        ws.off("message", handler);
        resolve(parsed);
      }
    };
    ws.on("message", handler);
  });
}

describe("HelmServer", () => {
  let server: HelmServer;

  beforeAll(async () => {
    server = HelmServer.create({
      skills: [testSkill],
      defaultPermissions: {},
      defaultPermission: "allow",
      port: PORT,
      dashboard: true,
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    await server.listen();
  });

  afterAll(async () => {
    await server.close();
    vi.restoreAllMocks();
  });

  it("sends connected message with skills on WebSocket connect", async () => {
    const { ws, connected } = await connectAndWait();

    expect(connected.sessionId).toMatch(/^s_/);
    expect(connected.skills.length).toBeGreaterThan(0);
    expect(connected.skills.some((s) => s.qualifiedName === "math.add")).toBe(
      true,
    );

    ws.close();
  });

  it("handles search requests", async () => {
    const { ws } = await connectAndWait();

    const result = await sendAndReceive(ws, {
      type: "search",
      id: "s1",
      query: "add",
    });

    expect(result.type).toBe("search-result");
    if (result.type === "search-result") {
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].qualifiedName).toBe("math.add");
    }

    ws.close();
  });

  it("handles call requests", async () => {
    const { ws } = await connectAndWait();

    const result = await sendAndReceive(ws, {
      type: "call",
      id: "c1",
      qualifiedName: "math.add",
      args: [3, 4],
    });

    expect(result.type).toBe("call-result");
    if (result.type === "call-result") {
      expect(result.value).toBe(7);
    }

    ws.close();
  });

  it("returns error for unknown operations", async () => {
    const { ws } = await connectAndWait();

    const result = await sendAndReceive(ws, {
      type: "call",
      id: "c2",
      qualifiedName: "math.nonexistent",
      args: [],
    });

    expect(result.type).toBe("call-error");
    if (result.type === "call-error") {
      expect(result.error.code).toBe("NOT_FOUND");
    }

    ws.close();
  });

  it("handles approval flow", async () => {
    const approvalServer = HelmServer.create({
      skills: [testSkill],
      defaultPermissions: { "math.dangerous": "ask" },
      defaultPermission: "allow",
      port: PORT + 1,
      dashboard: false,
    });
    await approvalServer.listen();

    try {
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const w = new WebSocket(`ws://localhost:${PORT + 1}`);
        w.on("error", reject);
        w.on("message", function handler(data) {
          const msg = JSON.parse(String(data)) as ServerMessage;
          if (msg.type === "connected") {
            w.off("message", handler);
            resolve(w);
          }
        });
      });

      // Set up listeners BEFORE sending the call
      const approvalPromise = waitForMessage(
        ws,
        (m) => m.type === "approval-request",
      );

      // Start the call — it will trigger an approval request
      const callPromise = sendAndReceive(ws, {
        type: "call",
        id: "c3",
        qualifiedName: "math.dangerous",
        args: [],
      });

      // Wait for the approval request
      const approvalReq = await approvalPromise;
      expect(approvalReq.type).toBe("approval-request");

      // Approve it
      if (approvalReq.type === "approval-request") {
        ws.send(
          JSON.stringify({
            type: "approval-response",
            approvalId: approvalReq.approvalId,
            approved: true,
          }),
        );
      }

      // The call should now complete
      const result = await callPromise;
      expect(result.type).toBe("call-result");
      if (result.type === "call-result") {
        expect(result.value).toBe("done");
      }

      ws.close();
    } finally {
      await approvalServer.close();
    }
  });

  it("handles permission updates", async () => {
    const { ws } = await connectAndWait();

    const updatePromise = waitForMessage(
      ws,
      (m) => m.type === "permissions-updated",
    );

    ws.send(
      JSON.stringify({
        type: "update-permissions",
        permissions: { "math.add": "deny" },
      }),
    );

    const result = await updatePromise;
    expect(result.type).toBe("permissions-updated");

    // Now calling math.add should fail
    const callResult = await sendAndReceive(ws, {
      type: "call",
      id: "c4",
      qualifiedName: "math.add",
      args: [1, 2],
    });

    expect(callResult.type).toBe("call-error");
    if (callResult.type === "call-error") {
      expect(callResult.error.code).toBe("PERMISSION_DENIED");
    }

    ws.close();
  });

  it("serves dashboard HTML", async () => {
    const res = await fetch(`http://localhost:${PORT}/dashboard`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Helm Dashboard");
  });

  it("serves sessions API", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/sessions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("tracks sessions", async () => {
    const { ws } = await connectAndWait();

    expect(server.sessions.length).toBeGreaterThan(0);

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
