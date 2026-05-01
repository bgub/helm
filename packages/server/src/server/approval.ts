import { Deferred, Effect } from "effect";

interface PendingApproval {
  id: string;
  operation: string;
  args: unknown[];
  deferred: Deferred.Deferred<boolean>;
}

let nextApprovalId = 1;

/**
 * Manages pending approval requests for a session.
 * Uses Effect Deferred to block tool execution until the client responds.
 */
export class ApprovalChannel {
  private pending = new Map<string, PendingApproval>();
  private onRequest?: (
    approvalId: string,
    operation: string,
    args: unknown[],
  ) => void;

  /**
   * Register a callback that fires when a new approval request is created.
   * The WebSocket handler uses this to send the request to the client.
   */
  setRequestHandler(
    handler: (approvalId: string, operation: string, args: unknown[]) => void,
  ): void {
    this.onRequest = handler;
  }

  /**
   * Request approval for an operation.
   * Returns a promise that resolves when the client responds.
   * Called by helm's onPermissionRequest callback.
   */
  request(operation: string, args: unknown[]): Promise<boolean> {
    const id = `a_${nextApprovalId++}`;
    const deferred = Effect.runSync(Deferred.make<boolean>());

    this.pending.set(id, { id, operation, args, deferred });
    this.onRequest?.(id, operation, args);

    return Effect.runPromise(Deferred.await(deferred));
  }

  /**
   * Respond to a pending approval request.
   * Called when the client sends an approval-response message.
   */
  respond(approvalId: string, approved: boolean): boolean {
    const entry = this.pending.get(approvalId);
    if (!entry) return false;

    this.pending.delete(approvalId);
    Effect.runSync(Deferred.succeed(entry.deferred, approved));
    return true;
  }

  /**
   * Deny all pending approvals (e.g., on session close).
   */
  denyAll(): void {
    for (const entry of this.pending.values()) {
      Effect.runSync(Deferred.succeed(entry.deferred, false));
    }
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}
