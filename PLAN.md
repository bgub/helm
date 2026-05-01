# `@bgub/helm-server` — Implementation Plan

## Overview

A new package in the monorepo (`packages/server`) that provides:
1. **An Effect.ts WebSocket server** that manages sessions, runs helm tools, handles permissions with live updates
2. **A client SDK** that connects to the server and exposes adapters for AI SDK, OpenAI, etc.
3. **A dashboard** served at `/dashboard` for traces, live sessions, and permission management
4. **SES sandboxing** ported from the demo for safe code execution

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Client App (React, Next.js, CLI, etc.)                         │
│                                                                 │
│  import { HelmClient } from "@bgub/helm-server/client"          │
│  const session = await HelmClient.connect("ws://localhost:3001") │
│  const tools = session.aiSdkTools()  // or .mcpTools()          │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│  Helm Server                                                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Session Mgr  │  │ Trace Store  │  │ Approval Channels    │  │
│  │ (Effect Ref) │  │ (Effect Ref) │  │ (Effect Deferred)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │  Per-Session State                                        │  │
│  │  - HelmInstance (createHelm + skills)                     │  │
│  │  - PermissionPolicy (live-updatable via Effect Ref)       │  │
│  │  - Sandbox worker (optional SES child process)            │  │
│  │  - Trace log                                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  HTTP (Hono)                                              │  │
│  │  GET  /dashboard          — web UI                        │  │
│  │  GET  /api/sessions       — list sessions                 │  │
│  │  GET  /api/sessions/:id   — session details + traces      │  │
│  │  GET  /api/events         — SSE stream for live updates   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## WebSocket Protocol

```typescript
// Client → Server
type ClientMessage =
  | { type: "search"; id: string; query: string }
  | { type: "call"; id: string; qualifiedName: string; args: unknown[] }
  | { type: "execute"; id: string; code: string }              // run JS in SES sandbox
  | { type: "update-permissions"; permissions: PermissionPolicy }
  | { type: "approval-response"; approvalId: string; approved: boolean }

// Server → Client
type ServerMessage =
  | { type: "connected"; sessionId: string; skills: SearchResult[] }
  | { type: "search-result"; id: string; results: SearchResult[] }
  | { type: "call-result"; id: string; value: unknown }
  | { type: "call-error"; id: string; error: { message: string; code?: string } }
  | { type: "approval-request"; approvalId: string; operation: string; args: unknown[] }
  | { type: "permissions-updated" }
  | { type: "trace"; entry: TraceEntry }

// Trace entry (recorded for every tool call)
interface TraceEntry {
  id: string
  sessionId: string
  timestamp: number
  operation: string
  args: unknown[]
  result?: unknown
  error?: string
  durationMs: number
  permission: Permission
  approvalRequired: boolean
  approvalGranted?: boolean
}
```

Two tool execution modes:
- **`call`**: Client specifies exact operation + args. Server calls `agent.git.status()` directly.
- **`execute`**: Client sends arbitrary JS code. Server runs it in SES sandbox with `agent` proxy (same as demo).

## File Structure

```
packages/server/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Server exports: HelmServer, types
│   ├── client.ts                   # Client entry: HelmClient, adapters
│   │
│   ├── protocol.ts                 # Shared message types (ClientMessage, ServerMessage, TraceEntry)
│   │
│   ├── server/
│   │   ├── helm-server.ts          # HelmServer class — main entry point
│   │   ├── session.ts              # Session lifecycle, Effect Ref for permissions
│   │   ├── trace-store.ts          # In-memory trace storage + query
│   │   ├── approval.ts             # Approval channels using Effect Deferred
│   │   ├── ws-handler.ts           # WebSocket message handling per connection
│   │   ├── sandbox.ts              # SES sandbox (ported from demo)
│   │   ├── sandbox-worker.mjs      # Worker process (ported from demo)
│   │   └── routes.ts               # Hono routes: /api/*, /dashboard
│   │
│   ├── client/
│   │   ├── helm-client.ts          # HelmClient — WebSocket client
│   │   └── adapters/
│   │       ├── ai-sdk.ts           # Vercel AI SDK tool adapter
│   │       └── openai.ts           # OpenAI function calling adapter
│   │
│   └── dashboard/
│       ├── index.html              # Dashboard shell
│       ├── sessions.html           # Sessions list view
│       └── trace.html              # Trace viewer for a session
│
└── test/
    ├── server.test.ts
    ├── client.test.ts
    ├── session.test.ts
    └── protocol.test.ts
```

## Package Exports

```json
{
  "name": "@bgub/helm-server",
  "exports": {
    ".": { "import": "./dist/index.mjs", "types": "./dist/index.d.mts" },
    "./client": { "import": "./dist/client.mjs", "types": "./dist/client.d.mts" }
  }
}
```

Server usage:
```typescript
import { HelmServer } from "@bgub/helm-server"
import { git, fs, grep, edit, shell } from "@bgub/helm"

const server = HelmServer.create({
  skills: [git(), fs(), grep(), edit(), shell()],
  defaultPermissions: {
    "fs.read*": "allow",
    "fs.write*": "ask",
    "shell.*": "deny",
  },
  sandbox: true,              // enable SES sandboxing (default: false)
  port: 3001,
  dashboard: true,            // serve dashboard at /dashboard (default: true)
})

await server.listen()
// Helm Server listening on ws://localhost:3001
// Dashboard: http://localhost:3001/dashboard
```

Client usage:
```typescript
import { HelmClient } from "@bgub/helm-server/client"

const session = await HelmClient.connect("ws://localhost:3001")

// Direct tool calls
const status = await session.call("git.status")

// Search
const results = await session.search("file read")

// Update permissions live
session.updatePermissions({ "shell.*": "allow" })

// Handle approval requests
session.onApprovalRequest(async ({ operation, args }) => {
  return confirm(`Allow ${operation}?`)
})

// AI SDK integration
import { streamText } from "ai"
const tools = session.aiSdkTools()
// Returns tools compatible with Vercel AI SDK streamText()

// Cleanup
session.close()
```

---

## Implementation Phases

### Phase 1: Package scaffolding + protocol types

**Files to create:**
- `packages/server/package.json` — deps: `effect`, `@effect/platform`, `hono`, `ws`, `@bgub/helm`
- `packages/server/tsconfig.json` — extends root, ESM
- `packages/server/tsdown.config.ts` — two entry points: `index.ts`, `client.ts`
- `packages/server/vitest.config.ts` — same pattern as core package
- `packages/server/src/protocol.ts` — all message types, TraceEntry, SessionConfig

No functional code yet, just types and build infrastructure.

### Phase 2: Core server — sessions + WebSocket

**`src/server/session.ts`** — Session management with Effect:
- `Session` type: id, helmInstance, permissionRef (Effect `Ref`), traces, sandbox worker
- `SessionManager`: create/destroy/get/list sessions
- Each session creates a `createHelm()` instance with the configured skills
- `onPermissionRequest` wired to approval channel (Phase 4)
- Permission updates: modify the Ref, rebuild helm instance with new policy

**`src/server/ws-handler.ts`** — WebSocket message loop:
- Parse incoming `ClientMessage`
- Route to session: search → `session.helm.search()`, call → walk agent + invoke
- Send `ServerMessage` responses
- Handle `update-permissions` by updating session's permission Ref

**`src/server/helm-server.ts`** — Main server class:
- Creates Hono HTTP server
- Upgrades WebSocket connections (using `ws` library)
- Wires WebSocket handler to session manager
- `listen()` starts the server (returns Effect that manages lifecycle)

**`src/index.ts`** — Export `HelmServer` + types

### Phase 3: Trace collection

**`src/server/trace-store.ts`** — In-memory trace store:
- Wrap every tool call to record: operation, args, result/error, duration, permission status
- Store per-session trace arrays
- Query API: filter by session, operation, time range
- Emit trace entries to connected WebSocket clients (via `trace` message)

Integration: wrap the bound operations in `session.ts` with tracing middleware before passing to the helm instance.

### Phase 4: Approval channel

**`src/server/approval.ts`** — Approval handling with Effect Deferred:
- When a tool call hits "ask" permission, create an `Effect.Deferred<boolean>`
- Send `approval-request` to the client via WebSocket
- Await the Deferred (blocks tool execution)
- Client sends `approval-response` → complete the Deferred
- Timeout: configurable, defaults to 60s (deny on timeout)

This replaces the demo's global Map approach with Effect's structured concurrency primitives.

### Phase 5: SES sandbox

**`src/server/sandbox.ts`** — Port from `apps/demo/lib/sandbox.ts`:
- Same child process + IPC architecture
- Worker receives `execute` messages, runs in SES Compartment
- Agent calls proxied back to parent via IPC
- Parent routes to helm instance, returns results

**`src/server/sandbox-worker.mjs`** — Port from `apps/demo/lib/sandbox-worker.mjs`:
- Identical to demo, with minor cleanup
- `lockdown()` + `Compartment` with agent Proxy

Changes from demo:
- Worker path resolution (no Next.js dependency)
- Configurable timeout (not hardcoded 30s)
- Better error serialization

### Phase 6: Client SDK

**`src/client/helm-client.ts`** — WebSocket client:
- `HelmClient.connect(url, opts?)` — returns `HelmSession`
- `HelmSession` API:
  - `call(qualifiedName, ...args)` → Promise (sends `call` msg, awaits `call-result`)
  - `execute(code)` → Promise (sends `execute` msg, awaits result)
  - `search(query)` → Promise<SearchResult[]>
  - `updatePermissions(policy)` → sends `update-permissions`
  - `onApprovalRequest(handler)` → registers callback for approval requests
  - `close()` → close WebSocket
- Internal: Map of pending request IDs → Promise resolvers
- Auto-reconnect with configurable backoff

**`src/client/adapters/ai-sdk.ts`** — Vercel AI SDK adapter:
- `session.aiSdkTools()` returns tools compatible with `streamText()`:
  - Mode 1 (search+execute): Two tools matching demo pattern
  - Mode 2 (direct): One tool per operation with typed zod schemas
- Each tool's `execute` calls `session.call()` or `session.execute()` over WebSocket

**`src/client/adapters/openai.ts`** — OpenAI adapter:
- `session.openaiTools()` returns function definitions for OpenAI chat completions
- Same two modes as AI SDK adapter

**`src/client.ts`** — Export `HelmClient` + adapters

### Phase 7: Dashboard

**REST API routes** (in `src/server/routes.ts`):
- `GET /api/sessions` — list active sessions (id, createdAt, traceCount)
- `GET /api/sessions/:id` — session detail + recent traces
- `GET /api/sessions/:id/traces` — full trace list with pagination
- `GET /api/events` — SSE stream: new sessions, new traces, session close

**Dashboard UI** (in `src/dashboard/`):
- Simple HTML + Tailwind (CDN) + vanilla JS
- `index.html`: sessions list, auto-updates via SSE
- Click session → trace viewer: chronological list of tool calls with expandable args/results
- Each trace entry shows: timestamp, operation, duration, permission, approval status, result/error
- No build step — served as static files by Hono

### Phase 8: Tests + integration

- `test/protocol.test.ts` — message serialization/validation
- `test/session.test.ts` — session lifecycle, permission updates, trace recording
- `test/server.test.ts` — full server: connect, call tools, receive results
- `test/client.test.ts` — client API, reconnection, adapter output shapes
- Integration test: start server, connect client, run AI SDK tools against it

---

## Dependencies

```
effect           — structured concurrency, Ref, Deferred, fiber management
hono             — lightweight HTTP server (dashboard, REST API, SSE)
ws               — WebSocket server
ses              — SES lockdown + Compartment (for sandbox mode)
@bgub/helm       — core framework (workspace dependency)
zod              — schema definitions for AI SDK tool adapter
```

Dev dependencies: same as core package (vitest, tsdown, typescript, @types/node) plus `@types/ws`.

## Open Questions

1. **Effect Ref vs mutable policy**: The current `createHelm()` takes a static policy object. To support live permission updates, we either (a) recreate the helm instance on each policy change, or (b) modify `createHelm` in the core package to accept a getter/Ref. Option (a) is simpler and doesn't require core changes. Start with (a), optimize later if needed.

2. **Direct `call` mode type safety**: When calling `session.call("git.status")`, the client doesn't have compile-time type info about the return type. We could generate a typed client from the server's skill config, but that's a v2 concern. For now, `call` returns `unknown` and the AI SDK adapter handles the typing.

3. **Dashboard scope**: The plan includes a minimal dashboard (session list + trace viewer). More advanced features (policy editor, session replay, alerts) are v2.
