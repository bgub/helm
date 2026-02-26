import { describe, expect, it } from "vitest";
import { createBevel } from "../../src/create-bevel.ts";
import { shell } from "../../src/skills/shell.ts";

describe("shell skill", () => {
  const agent = () =>
    createBevel({ permissions: { "shell.*": "allow" } }).use(shell());

  it("executes a simple command", async () => {
    const result = await agent().shell.dangerousExec("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr", async () => {
    const result = await agent().shell.dangerousExec("echo err >&2");
    expect(result.stderr.trim()).toBe("err");
    expect(result.exitCode).toBe(0);
  });

  it("returns non-zero exit code on failure", async () => {
    const result = await agent().shell.dangerousExec("exit 42");
    expect(result.exitCode).toBe(42);
  });

  it("supports stdin", async () => {
    const result = await agent().shell.dangerousExec("cat", {
      stdin: "from stdin",
    });
    expect(result.stdout).toBe("from stdin");
  });

  it("supports pipes and shell features", async () => {
    const result = await agent().shell.dangerousExec(
      "echo 'a b c' | tr ' ' '\\n' | wc -l",
    );
    expect(result.stdout.trim()).toBe("3");
  });

  it("uses factory cwd option", async () => {
    const a = createBevel({ permissions: { "shell.*": "allow" } }).use(
      shell({ cwd: "/tmp" }),
    );
    const result = await a.shell.dangerousExec("pwd");
    expect(result.stdout.trim()).toBe("/tmp");
  });

  it("per-call cwd overrides factory cwd", async () => {
    const a = createBevel({ permissions: { "shell.*": "allow" } }).use(
      shell({ cwd: "/tmp" }),
    );
    const result = await a.shell.dangerousExec("pwd", { cwd: "/" });
    expect(result.stdout.trim()).toBe("/");
  });

  it("uses factory env option", async () => {
    const a = createBevel({ permissions: { "shell.*": "allow" } }).use(
      shell({ env: { CRAG_TEST_VAR: "from_factory" } }),
    );
    const result = await a.shell.dangerousExec("echo $CRAG_TEST_VAR");
    expect(result.stdout.trim()).toBe("from_factory");
  });

  it("merges per-call env with factory env", async () => {
    const a = createBevel({ permissions: { "shell.*": "allow" } }).use(
      shell({ env: { CRAG_A: "a" } }),
    );
    const result = await a.shell.dangerousExec("echo $CRAG_A $CRAG_B", {
      env: { CRAG_B: "b" },
    });
    expect(result.stdout.trim()).toBe("a b");
  });
});
