/**
 * Global map of pending approval resolvers.
 * Keyed by approval ID from the helm-server protocol.
 */

const KEY = "__helm_approval_state__" as const;

interface ApprovalState {
  pending: Map<string, (approved: boolean) => void>;
}

function getState(): ApprovalState {
  const g = globalThis as unknown as Record<string, ApprovalState | undefined>;
  if (!g[KEY]) {
    g[KEY] = { pending: new Map() };
  }
  return g[KEY];
}

/**
 * Register a pending approval. Returns a promise that resolves
 * when respondToApproval is called with the matching ID.
 */
export function waitForApproval(approvalId: string): Promise<boolean> {
  const state = getState();
  return new Promise<boolean>((resolve) => {
    state.pending.set(approvalId, resolve);
  });
}

/**
 * Resolve a pending approval (called from the approvals API route).
 */
export function respondToApproval(id: string, approved: boolean): boolean {
  const state = getState();
  const resolve = state.pending.get(id);
  if (!resolve) return false;
  state.pending.delete(id);
  resolve(approved);
  return true;
}
