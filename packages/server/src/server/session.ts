import {
  createHelm,
  type HelmInstance,
  type Permission,
  type PermissionPolicy,
  type Skill,
} from "@bgub/helm";
import { Context, Layer } from "effect";

// ── Session types ─────────────────────────────────────────────

export interface Session {
  id: string;
  createdAt: number;
  permissions: PermissionPolicy;
  helm: HelmInstance;
  traces: import("../protocol.ts").TraceEntry[];
  onApprovalRequest: (
    operation: string,
    args: unknown[],
  ) => Promise<boolean> | boolean;
}

export interface SessionConfig {
  skills: Skill[];
  defaultPermissions: PermissionPolicy;
  defaultPermission: Permission;
  onApprovalRequest: (
    operation: string,
    args: unknown[],
  ) => Promise<boolean> | boolean;
}

// ── Helm builder ──────────────────────────────────────────────

function buildHelm(config: SessionConfig): HelmInstance {
  let instance = createHelm({
    permissions: config.defaultPermissions,
    defaultPermission: config.defaultPermission,
    onPermissionRequest: config.onApprovalRequest,
  }) as HelmInstance;

  for (const skill of config.skills) {
    instance = instance.use(skill);
  }

  return instance;
}

// ── Service interface ─────────────────────────────────────────

export interface SessionManagerService {
  readonly create: (config: SessionConfig) => Session;
  readonly get: (id: string) => Session | undefined;
  readonly destroy: (id: string) => boolean;
  readonly list: () => readonly Session[];
}

// ── Context.Tag + Layer ───────────────────────────────────────

export class SessionManager extends Context.Tag("@helm/SessionManager")<
  SessionManager,
  SessionManagerService
>() {
  static readonly live = Layer.sync(SessionManager, () => makeSessionManager());
}

export function makeSessionManager(): SessionManagerService {
  const sessions = new Map<string, Session>();
  let nextId = 1;

  return SessionManager.of({
    create(config) {
      const id = `s_${nextId++}`;
      const helm = buildHelm(config);
      const session: Session = {
        id,
        createdAt: Date.now(),
        permissions: config.defaultPermissions,
        helm,
        traces: [],
        onApprovalRequest: config.onApprovalRequest,
      };
      sessions.set(id, session);
      return session;
    },

    get: (id) => sessions.get(id),
    destroy: (id) => sessions.delete(id),
    list: () => Array.from(sessions.values()),
  });
}

// ── Permission updates ────────────────────────────────────────

export function updateSessionPermissions(
  session: Session,
  permissions: PermissionPolicy,
  config: Omit<SessionConfig, "defaultPermissions" | "onApprovalRequest">,
): void {
  session.permissions = permissions;
  session.helm = buildHelm({
    ...config,
    defaultPermissions: permissions,
    onApprovalRequest: session.onApprovalRequest,
  });
}
