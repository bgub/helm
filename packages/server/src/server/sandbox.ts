import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 30_000;

// Resolve the worker file relative to this module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "sandbox-worker.mjs");

interface AgentCallMessage {
  type: "agent-call";
  callId: string;
  method: string;
  args: unknown[];
}

interface ResultMessage {
  type: "result";
  id: string;
  value?: unknown;
  error?: string;
}

interface ReadyMessage {
  type: "ready";
}

type WorkerMessage = AgentCallMessage | ResultMessage | ReadyMessage;

/**
 * Walk a dotted method path on the agent object and return the function.
 */
function walkAgent(agent: unknown, method: string): unknown {
  const parts = method.split(".");
  let current: unknown = agent;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Evaluate JavaScript code in a sandboxed SES compartment.
 * The `agent` object is available in scope via a Proxy that routes
 * calls back to this process via IPC.
 */
export async function evaluate(
  code: string,
  agent: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [WORKER_PATH], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    let timer: ReturnType<typeof setTimeout>;
    const evalId = "1";

    function resetTimeout() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        child.kill();
        reject(new Error("Sandbox evaluation timed out"));
      }, timeoutMs);
    }

    function cleanup() {
      clearTimeout(timer);
      child.kill();
    }

    child.on("error", (err) => {
      cleanup();
      reject(err);
    });

    child.on("exit", (exitCode) => {
      clearTimeout(timer);
      if (exitCode !== null && exitCode !== 0) {
        reject(new Error(`Sandbox worker exited with code ${exitCode}`));
      }
    });

    child.on("message", async (msg: WorkerMessage) => {
      if (msg.type === "ready") {
        resetTimeout();
        child.send({ type: "evaluate", id: evalId, code });
        return;
      }

      if (msg.type === "agent-call") {
        resetTimeout();
        try {
          const fn = walkAgent(agent, msg.method);
          if (typeof fn !== "function") {
            child.send({
              type: "agent-response",
              callId: msg.callId,
              error: `${msg.method} is not a function`,
            });
            return;
          }
          const result = await (fn as (...args: unknown[]) => unknown)(
            ...msg.args,
          );
          resetTimeout();
          child.send({
            type: "agent-response",
            callId: msg.callId,
            value: result,
          });
        } catch (e) {
          resetTimeout();
          child.send({
            type: "agent-response",
            callId: msg.callId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      if (msg.type === "result") {
        cleanup();
        if (msg.error !== undefined) {
          resolve({ error: msg.error });
        } else {
          resolve(msg.value);
        }
      }
    });

    resetTimeout();
  });
}
