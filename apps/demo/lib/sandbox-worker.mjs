import "ses";

lockdown({
  errorTaming: "unsafe",
  overrideTaming: "moderate",
  consoleTaming: "unsafe",
  stackFiltering: "verbose",
});

// Pending agent call promises: callId -> { resolve, reject }
const pendingCalls = new Map();
let nextCallId = 1;

/**
 * Build a recursive Proxy that accumulates property paths and, on function
 * call, sends an IPC message to the parent and returns a Promise.
 */
function makeProxyAgent(path = []) {
  return new Proxy(() => {}, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      return makeProxyAgent([...path, prop]);
    },
    apply(_target, _thisArg, args) {
      const callId = String(nextCallId++);
      const method = path.join(".");
      return new Promise((resolve, reject) => {
        pendingCalls.set(callId, { resolve, reject });
        process.send({ type: "agent-call", callId, method, args });
      });
    },
  });
}

// Handle messages from parent
process.on("message", async (msg) => {
  if (msg.type === "agent-response") {
    const pending = pendingCalls.get(msg.callId);
    if (!pending) return;
    pendingCalls.delete(msg.callId);
    if (msg.error !== undefined) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.value);
    }
    return;
  }

  if (msg.type === "evaluate") {
    const { id, code } = msg;
    try {
      const compartment = new Compartment({
        globals: {
          agent: makeProxyAgent(),
          console: {
            log: (...a) => a,
            error: (...a) => a,
          },
        },
        __options__: true,
      });
      const wrapped = `(async () => {\n${code}\n})()`;
      const result = await compartment.evaluate(wrapped);
      process.send({ type: "result", id, value: result ?? { ok: true } });
    } catch (e) {
      process.send({
        type: "result",
        id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
});

// Signal ready
process.send({ type: "ready" });
