import { edit, fs, git, grep, shell } from "@bgub/helm";
import { connect } from "./src/client.ts";
import { HelmServer } from "./src/index.ts";

// ── Start the server ───────────────────────────────────────────

const server = HelmServer.create({
  skills: [fs(), git(), grep(), edit(), shell()],
  defaultPermissions: {
    "fs.readFile": "allow",
    "fs.readdir": "allow",
    "fs.stat": "allow",
    "fs.cwd": "allow",
    "fs.writeFile": "ask",
    "git.status": "allow",
    "git.diff": "allow",
    "git.log": "allow",
    "grep.search": "allow",
    "shell.*": "deny",
  },
  defaultPermission: "ask",
  port: 3001,
  dashboard: true,
});

await server.listen();

// ── Connect as a client ────────────────────────────────────────

const session = await connect("ws://localhost:3001", {
  onApprovalRequest: async ({ operation, args }) => {
    console.log(
      `\n  [APPROVAL] ${operation}(${JSON.stringify(args).slice(0, 80)})`,
    );
    console.log("  Auto-approving for demo...\n");
    return true;
  },
});

console.log(`\n  Connected as session: ${session.sessionId}`);
console.log(`  Available operations: ${session.skills.length}\n`);

// ── Try some operations ────────────────────────────────────────

// Search
const results = await session.search("git");
console.log(
  "  Search 'git':",
  results.map((r) => r.qualifiedName),
);

// Call tools directly
const cwd = await session.call("fs.cwd");
console.log("  cwd:", cwd);

const status = await session.call("git.status");
console.log("  git status:", JSON.stringify(status, null, 2).slice(0, 200));

const entries = await session.call("fs.readdir", ".");
console.log(
  "  readdir:",
  (entries as { entries: { name: string }[] }).entries
    .map((e) => e.name)
    .slice(0, 10),
);

// This will trigger approval (permission is "ask")
const writeResult = await session.call(
  "fs.writeFile",
  "/tmp/helm-test.txt",
  "hello from helm-server!",
);
console.log("  writeFile:", writeResult);

// This will be denied (permission is "deny")
try {
  await session.call("shell.dangerousExec", "echo hi");
} catch (e) {
  console.log("  shell (denied):", (e as Error).message);
}

// Update permissions live
session.updatePermissions({ "shell.dangerousExec": "allow" });
await new Promise((r) => setTimeout(r, 100)); // wait for update to propagate

const shellResult = await session.call("shell.dangerousExec", "echo hi");
console.log("  shell (after update):", shellResult);

// ── Dashboard info ─────────────────────────────────────────────

console.log("\n  Dashboard: http://localhost:3001/dashboard");
console.log("  Press Ctrl+C to stop.\n");
