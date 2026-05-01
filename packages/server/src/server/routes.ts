import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerEvent, SessionInfo } from "../protocol.ts";
import type { SessionManagerService } from "./session.ts";
import type { TraceStoreService } from "./trace-store.ts";

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManagerService,
  traceStore: TraceStoreService,
  sseClients: Set<ServerResponse>,
): void {
  const url = new URL(req.url ?? "/", `http://localhost`);
  const path = url.pathname;

  // CORS headers for dashboard
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === "/api/sessions" && req.method === "GET") {
    const sessions: SessionInfo[] = sessionManager.list().map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      traceCount: s.traces.length,
      permissions: {},
    }));
    json(res, sessions);
    return;
  }

  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch && req.method === "GET") {
    const session = sessionManager.get(sessionMatch[1]);
    if (!session) {
      json(res, { error: "Session not found" }, 404);
      return;
    }
    const traces = traceStore.query(session, { limit: 50 });
    json(res, {
      id: session.id,
      createdAt: session.createdAt,
      traceCount: session.traces.length,
      traces,
    });
    return;
  }

  const tracesMatch = path.match(/^\/api\/sessions\/([^/]+)\/traces$/);
  if (tracesMatch && req.method === "GET") {
    const session = sessionManager.get(tracesMatch[1]);
    if (!session) {
      json(res, { error: "Session not found" }, 404);
      return;
    }
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const traces = traceStore.query(session, { limit, offset });
    json(res, { traces, total: session.traces.length });
    return;
  }

  if (path === "/api/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    sseClients.add(res);

    const keepAlive = setInterval(() => {
      res.write(": ping\n\n");
    }, 15_000);

    req.on("close", () => {
      sseClients.delete(res);
      clearInterval(keepAlive);
    });

    return;
  }

  if (path === "/dashboard" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(dashboardHTML);
    return;
  }

  // 404
  json(res, { error: "Not found" }, 404);
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function broadcastSSE(
  clients: Set<ServerResponse>,
  event: ServerEvent,
): void {
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(data);
  }
}

const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Helm Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; }
    .trace-row:hover { background-color: #f3f4f6; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <div class="max-w-6xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-2xl font-bold">Helm Dashboard</h1>
      <p class="text-gray-500 text-sm mt-1">Live session monitoring and traces</p>
    </header>

    <div class="grid grid-cols-3 gap-4 mb-8">
      <div class="bg-white rounded-lg border p-4">
        <div class="text-sm text-gray-500">Active Sessions</div>
        <div id="session-count" class="text-3xl font-bold mt-1">-</div>
      </div>
      <div class="bg-white rounded-lg border p-4">
        <div class="text-sm text-gray-500">Total Traces</div>
        <div id="trace-count" class="text-3xl font-bold mt-1">-</div>
      </div>
      <div class="bg-white rounded-lg border p-4">
        <div class="text-sm text-gray-500">Status</div>
        <div id="status" class="text-3xl font-bold mt-1 text-green-600">Live</div>
      </div>
    </div>

    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-3">Sessions</h2>
      <div id="sessions" class="space-y-2">
        <div class="text-gray-400 text-sm">Loading...</div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-3">Recent Traces</h2>
      <div id="traces" class="bg-white rounded-lg border divide-y">
        <div class="p-3 text-gray-400 text-sm">Waiting for traces...</div>
      </div>
    </section>
  </div>

  <script>
    const sessionsEl = document.getElementById('sessions');
    const tracesEl = document.getElementById('traces');
    const sessionCountEl = document.getElementById('session-count');
    const traceCountEl = document.getElementById('trace-count');
    const statusEl = document.getElementById('status');

    let traceEntries = [];

    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        const sessions = await res.json();
        sessionCountEl.textContent = sessions.length;

        if (sessions.length === 0) {
          sessionsEl.innerHTML = '<div class="text-gray-400 text-sm">No active sessions</div>';
          return;
        }

        sessionsEl.innerHTML = sessions.map(s =>
          '<div class="bg-white rounded-lg border p-3 flex justify-between items-center">' +
            '<div>' +
              '<span class="font-medium">' + s.id + '</span>' +
              '<span class="text-gray-400 text-sm ml-2">' + new Date(s.createdAt).toLocaleTimeString() + '</span>' +
            '</div>' +
            '<span class="text-sm text-gray-500">' + s.traceCount + ' traces</span>' +
          '</div>'
        ).join('');
      } catch {
        sessionsEl.innerHTML = '<div class="text-red-400 text-sm">Failed to load</div>';
      }
    }

    function renderTraces() {
      traceCountEl.textContent = traceEntries.length;
      if (traceEntries.length === 0) return;

      tracesEl.innerHTML = traceEntries.slice(-50).reverse().map(t => {
        const status = t.error ? 'text-red-600' : 'text-green-600';
        const icon = t.error ? 'ERR' : 'OK';
        return '<div class="trace-row p-3 flex justify-between items-center text-sm">' +
          '<div class="flex items-center gap-3">' +
            '<span class="' + status + ' font-bold text-xs">' + icon + '</span>' +
            '<span class="font-medium">' + t.operation + '</span>' +
            '<span class="text-gray-400">' + t.sessionId + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-4 text-gray-500">' +
            '<span>' + t.durationMs + 'ms</span>' +
            '<span>' + new Date(t.timestamp).toLocaleTimeString() + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    const evtSource = new EventSource('/api/events');
    evtSource.addEventListener('trace', (e) => {
      const data = JSON.parse(e.data);
      traceEntries.push(data.entry);
      renderTraces();
      loadSessions();
    });
    evtSource.onerror = () => {
      statusEl.textContent = 'Disconnected';
      statusEl.className = 'text-3xl font-bold mt-1 text-red-600';
    };
    evtSource.onopen = () => {
      statusEl.textContent = 'Live';
      statusEl.className = 'text-3xl font-bold mt-1 text-green-600';
    };

    loadSessions();
    setInterval(loadSessions, 5000);
  </script>
</body>
</html>`;
