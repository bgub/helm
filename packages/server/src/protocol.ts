import type { Permission, PermissionPolicy, SearchResult } from "@bgub/helm";

// ── Trace entries ──────────────────────────────────────────────

export interface TraceEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  operation: string;
  args: unknown[];
  result?: unknown;
  error?: string;
  durationMs: number;
  permission: Permission;
  approvalRequired: boolean;
  approvalGranted?: boolean;
}

// ── Client → Server messages ───────────────────────────────────

export type ClientMessage =
  | { type: "search"; id: string; query: string }
  | { type: "call"; id: string; qualifiedName: string; args: unknown[] }
  | { type: "execute"; id: string; code: string }
  | { type: "update-permissions"; permissions: PermissionPolicy }
  | {
      type: "approval-response";
      approvalId: string;
      approved: boolean;
    };

// ── Server → Client messages ───────────────────────────────────

export type ServerMessage =
  | { type: "connected"; sessionId: string; skills: SearchResult[] }
  | { type: "search-result"; id: string; results: SearchResult[] }
  | { type: "call-result"; id: string; value: unknown }
  | {
      type: "call-error";
      id: string;
      error: { message: string; code?: string };
    }
  | {
      type: "approval-request";
      approvalId: string;
      operation: string;
      args: unknown[];
    }
  | { type: "permissions-updated" }
  | { type: "trace"; entry: TraceEntry };

// ── Server configuration ───────────────────────────────────────

export interface HelmServerConfig {
  skills: import("@bgub/helm").Skill[];
  defaultPermissions?: PermissionPolicy;
  defaultPermission?: Permission;
  sandbox?: boolean;
  sandboxTimeout?: number;
  port?: number;
  dashboard?: boolean;
}

// ── Session info (exposed via REST API) ────────────────────────

export interface SessionInfo {
  id: string;
  createdAt: number;
  traceCount: number;
  permissions: PermissionPolicy;
}

// ── SSE event types ────────────────────────────────────────────

export type ServerEvent =
  | { type: "session-created"; session: SessionInfo }
  | { type: "session-closed"; sessionId: string }
  | { type: "trace"; entry: TraceEntry };
