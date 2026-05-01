import type { Permission } from "@bgub/helm";
import { Context, Layer } from "effect";
import type { TraceEntry } from "../protocol.ts";

// ── Service interface ─────────────────────────────────────────

export type TraceListener = (entry: TraceEntry) => void;

export interface TraceStoreService {
  readonly record: (
    session: { traces: TraceEntry[] },
    entry: TraceEntry,
  ) => void;
  readonly query: (
    session: { traces: TraceEntry[] },
    opts?: { limit?: number; offset?: number },
  ) => TraceEntry[];
  readonly subscribe: (listener: TraceListener) => () => void;
}

// ── Context.Tag + Layer ───────────────────────────────────────

export class TraceStore extends Context.Tag("@helm/TraceStore")<
  TraceStore,
  TraceStoreService
>() {
  static readonly live = Layer.sync(TraceStore, () => makeTraceStore());
}

export function makeTraceStore(): TraceStoreService {
  const listeners = new Set<TraceListener>();

  return TraceStore.of({
    record(session, entry) {
      session.traces.push(entry);
      for (const listener of listeners) {
        listener(entry);
      }
    },

    query(session, opts) {
      const { limit = 100, offset = 0 } = opts ?? {};
      return session.traces.slice(offset, offset + limit);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

// ── Trace wrapper ─────────────────────────────────────────────

export async function traceCall<T>(
  store: TraceStoreService,
  session: { id: string; traces: TraceEntry[] },
  operation: string,
  args: unknown[],
  permission: Permission,
  approvalRequired: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const id = `t_${nextTraceId++}`;
  const start = performance.now();

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    store.record(session, {
      id,
      sessionId: session.id,
      timestamp: Date.now(),
      operation,
      args,
      result,
      durationMs,
      permission,
      approvalRequired,
      approvalGranted: approvalRequired ? true : undefined,
    });
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : String(error);
    store.record(session, {
      id,
      sessionId: session.id,
      timestamp: Date.now(),
      operation,
      args,
      error: message,
      durationMs,
      permission,
      approvalRequired,
      approvalGranted: approvalRequired ? false : undefined,
    });
    throw error;
  }
}

let nextTraceId = 1;
