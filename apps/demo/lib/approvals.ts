interface PendingApproval {
  id: string;
  operation: string;
  args: unknown[];
  resolve: (approved: boolean) => void;
}

interface ApprovalState {
  pending: Map<string, PendingApproval>;
  nextId: number;
}

const KEY = "__helm_approval_state__" as const;

function getState(): ApprovalState {
  const g = globalThis as unknown as Record<string, ApprovalState | undefined>;
  if (!g[KEY]) {
    g[KEY] = { pending: new Map(), nextId: 1 };
  }
  return g[KEY];
}

export function requestApproval(
  operation: string,
  args: unknown[],
): { id: string; approved: Promise<boolean> } {
  const state = getState();
  const id = String(state.nextId++);
  const approved = new Promise<boolean>((resolve) => {
    state.pending.set(id, { id, operation, args, resolve });
  });
  return { id, approved };
}

export function respondToApproval(id: string, approved: boolean): boolean {
  const state = getState();
  const entry = state.pending.get(id);
  if (!entry) return false;
  state.pending.delete(id);
  entry.resolve(approved);
  return true;
}
