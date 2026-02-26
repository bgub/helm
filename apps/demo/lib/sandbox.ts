import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";

// Resolve worker at call time to avoid Turbopack static analysis.
// Uses process.cwd() (the demo app root) since Next.js bundles this file
// into .next/server/ where relative paths to the source .mjs would break.
function getWorkerPath(): string {
  return path.join(process.cwd(), "lib", "sandbox-worker.mjs");
}

const TIMEOUT_MS = 30_000;

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

// biome-ignore lint/suspicious/noExplicitAny: agent shape is dynamic
function walkAgent(agent: any, method: string): unknown {
  const parts = method.split(".");
  let current = agent;
  for (const part of parts) {
    current = current[part];
  }
  return current;
}

export async function evaluate(code: string, agent: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Use spawn instead of fork so Turbopack doesn't statically analyze the
    // worker path. The IPC channel is established via the stdio option.
    const child: ChildProcess = spawn(process.execPath, [getWorkerPath()], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    let timer: ReturnType<typeof setTimeout>;
    const evalId = "1";

    function resetTimeout() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        child.kill();
        reject(new Error("Sandbox evaluation timed out"));
      }, TIMEOUT_MS);
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
          const result = await fn(...msg.args);
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
