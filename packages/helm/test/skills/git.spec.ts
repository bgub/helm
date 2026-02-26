import * as childProcess from "node:child_process";
import * as nodeFs from "node:fs/promises";
import * as os from "node:os";
import * as nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHelm } from "../../src/create-helm.ts";
import { git } from "../../src/skills/git.ts";

function execGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.execFile("git", args, { cwd }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.toString());
    });
  });
}

describe("git skill", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await nodeFs.mkdtemp(nodePath.join(os.tmpdir(), "helm-git-test-"));
    await execGit(["init"], tmpDir);
    await execGit(["config", "user.email", "test@test.com"], tmpDir);
    await execGit(["config", "user.name", "Test"], tmpDir);
    // Create initial commit so we have a branch
    await nodeFs.writeFile(nodePath.join(tmpDir, "init.txt"), "init", "utf-8");
    await execGit(["add", "."], tmpDir);
    await execGit(["commit", "-m", "initial"], tmpDir);
  });

  afterEach(async () => {
    await nodeFs.rm(tmpDir, { recursive: true, force: true });
  });

  const agent = () =>
    createHelm({ permissions: { "git.*": "allow" } }).use(git({ cwd: tmpDir }));

  describe("status", () => {
    it("reports clean status", async () => {
      const result = await agent().git.status();
      expect(result.branch).toBeTruthy();
      expect(result.staged).toEqual([]);
      expect(result.unstaged).toEqual([]);
      expect(result.untracked).toEqual([]);
    });

    it("reports untracked files", async () => {
      await nodeFs.writeFile(nodePath.join(tmpDir, "new.txt"), "new", "utf-8");
      const result = await agent().git.status();
      expect(result.untracked).toContain("new.txt");
    });

    it("reports staged files", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "staged.txt"),
        "staged",
        "utf-8",
      );
      await execGit(["add", "staged.txt"], tmpDir);

      const result = await agent().git.status();
      expect(result.staged).toHaveLength(1);
      expect(result.staged[0].path).toBe("staged.txt");
      expect(result.staged[0].status).toBe("added");
    });

    it("reports unstaged modifications", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "init.txt"),
        "modified",
        "utf-8",
      );
      const result = await agent().git.status();
      expect(result.unstaged).toHaveLength(1);
      expect(result.unstaged[0].status).toBe("modified");
    });

    it("reports staged deletions", async () => {
      await execGit(["rm", "init.txt"], tmpDir);
      const result = await agent().git.status();
      expect(result.staged).toHaveLength(1);
      expect(result.staged[0].status).toBe("deleted");
    });

    it("reports staged renames", async () => {
      await execGit(["mv", "init.txt", "renamed.txt"], tmpDir);
      const result = await agent().git.status();
      expect(result.staged.some((f) => f.status === "renamed")).toBe(true);
      expect(result.staged.some((f) => f.oldPath === "init.txt")).toBe(true);
    });
  });

  describe("diff", () => {
    it("shows unstaged diff", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "init.txt"),
        "modified content\n",
        "utf-8",
      );

      const result = await agent().git.diff();
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe("init.txt");
      expect(result.files[0].additions).toBeGreaterThanOrEqual(1);
    });

    it("shows staged diff", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "init.txt"),
        "staged content\n",
        "utf-8",
      );
      await execGit(["add", "init.txt"], tmpDir);

      const result = await agent().git.diff({ staged: true });
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe("init.txt");
    });

    it("shows diff against a ref", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "new.txt"),
        "new file\n",
        "utf-8",
      );
      await execGit(["add", "."], tmpDir);
      await execGit(["commit", "-m", "add new"], tmpDir);

      const result = await agent().git.diff({ ref: "HEAD~1" });
      expect(result.files.some((f) => f.path === "new.txt")).toBe(true);
    });

    it("returns empty for clean repo", async () => {
      const result = await agent().git.diff();
      expect(result.files).toEqual([]);
    });
  });

  describe("log", () => {
    it("returns commits", async () => {
      const result = await agent().git.log();
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].message).toBe("initial");
      expect(result.commits[0].hash).toBeTruthy();
      expect(result.commits[0].shortHash).toBeTruthy();
      expect(result.commits[0].author).toBe("Test");
      expect(result.commits[0].email).toBe("test@test.com");
    });

    it("respects limit", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "second.txt"),
        "second",
        "utf-8",
      );
      await execGit(["add", "."], tmpDir);
      await execGit(["commit", "-m", "second commit"], tmpDir);

      const result = await agent().git.log({ limit: 1 });
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].message).toBe("second commit");
    });
  });

  describe("show", () => {
    it("shows file content at HEAD", async () => {
      const result = await agent().git.show("HEAD", { path: "init.txt" });
      expect(result.content).toBe("init");
    });

    it("shows commit without path", async () => {
      const result = await agent().git.show("HEAD");
      expect(result.content).toContain("initial");
    });
  });

  describe("add", () => {
    it("stages files", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "to-add.txt"),
        "add me",
        "utf-8",
      );
      await agent().git.add(["to-add.txt"]);

      const status = await agent().git.status();
      expect(status.staged.some((f) => f.path === "to-add.txt")).toBe(true);
    });
  });

  describe("commit", () => {
    it("creates a commit and returns hash", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "commit-me.txt"),
        "data",
        "utf-8",
      );
      await execGit(["add", "commit-me.txt"], tmpDir);

      const result = await agent().git.commit("test commit");
      expect(result.hash).toBeTruthy();
      expect(result.hash.length).toBeGreaterThanOrEqual(7);

      const log = await agent().git.log({ limit: 1 });
      expect(log.commits[0].message).toBe("test commit");
    });
  });

  describe("branchList", () => {
    it("lists branches with current marker", async () => {
      const result = await agent().git.branchList();
      expect(result.branches.length).toBeGreaterThanOrEqual(1);
      expect(result.current).toBeTruthy();
      expect(
        result.branches.some((b) => b.current && b.name === result.current),
      ).toBe(true);
    });
  });

  describe("branchCreate", () => {
    it("creates a new branch", async () => {
      await agent().git.branchCreate("feature-test");

      const result = await agent().git.branchList();
      expect(result.branches.some((b) => b.name === "feature-test")).toBe(true);
    });

    it("creates a branch at a specific start point", async () => {
      await nodeFs.writeFile(
        nodePath.join(tmpDir, "second.txt"),
        "second",
        "utf-8",
      );
      await execGit(["add", "."], tmpDir);
      await execGit(["commit", "-m", "second"], tmpDir);

      await agent().git.branchCreate("from-first", {
        startPoint: "HEAD~1",
      });
      await agent().git.checkout("from-first");

      const log = await agent().git.log({ limit: 1 });
      expect(log.commits[0].message).toBe("initial");
    });
  });

  describe("checkout", () => {
    it("switches to a branch", async () => {
      await agent().git.branchCreate("switch-target");
      await agent().git.checkout("switch-target");

      const status = await agent().git.status();
      expect(status.branch).toBe("switch-target");
    });
  });
});
