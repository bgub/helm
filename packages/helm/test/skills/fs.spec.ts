import * as nodeFs from "node:fs/promises";
import * as os from "node:os";
import * as nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHelm } from "../../src/create-helm.ts";
import { fs } from "../../src/skills/fs.ts";

describe("fs skill", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await nodeFs.mkdtemp(nodePath.join(os.tmpdir(), "helm-fs-test-"));
  });

  afterEach(async () => {
    await nodeFs.rm(tmpDir, { recursive: true, force: true });
  });

  const agent = () =>
    createHelm({ permissions: { "fs.*": "allow" } }).use(fs());

  it("reads a file", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "hello world", "utf-8");

    const result = await agent().fs.readFile(filePath);
    expect(result).toEqual({ content: "hello world" });
  });

  it("writes a file", async () => {
    const filePath = nodePath.join(tmpDir, "out.txt");
    await agent().fs.writeFile(filePath, "written content");

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("written content");
  });

  it("lists directory entries", async () => {
    await nodeFs.writeFile(nodePath.join(tmpDir, "a.txt"), "a");
    await nodeFs.writeFile(nodePath.join(tmpDir, "b.ts"), "b");
    await nodeFs.mkdir(nodePath.join(tmpDir, "sub"));

    const result = await agent().fs.readdir(tmpDir);
    expect(result.entries).toHaveLength(3);

    const names = result.entries.map((e) => e.name).sort();
    expect(names).toEqual(["a.txt", "b.ts", "sub"]);

    const sub = result.entries.find((e) => e.name === "sub");
    expect(sub?.isDirectory).toBe(true);
    expect(sub?.isFile).toBe(false);
  });

  it("lists with glob filter", async () => {
    await nodeFs.writeFile(nodePath.join(tmpDir, "a.txt"), "a");
    await nodeFs.writeFile(nodePath.join(tmpDir, "b.ts"), "b");

    const result = await agent().fs.readdir(tmpDir, { glob: "*.txt" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe("a.txt");
  });

  it("creates a directory recursively", async () => {
    const dirPath = nodePath.join(tmpDir, "a", "b", "c");
    await agent().fs.mkdir(dirPath);

    const stat = await nodeFs.stat(dirPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it("is a no-op if directory already exists", async () => {
    const dirPath = nodePath.join(tmpDir, "existing");
    await nodeFs.mkdir(dirPath);
    await expect(agent().fs.mkdir(dirPath)).resolves.toBeUndefined();
  });

  it("stats a file", async () => {
    const filePath = nodePath.join(tmpDir, "stat-me.txt");
    await nodeFs.writeFile(filePath, "hello");

    const result = await agent().fs.stat(filePath);
    expect(result.size).toBe(5);
    expect(result.isFile).toBe(true);
    expect(result.isDirectory).toBe(false);
    expect(result.modified).toBeTruthy();
    expect(result.created).toBeTruthy();
  });

  it("stats a directory", async () => {
    const dirPath = nodePath.join(tmpDir, "stat-dir");
    await nodeFs.mkdir(dirPath);

    const result = await agent().fs.stat(dirPath);
    expect(result.isFile).toBe(false);
    expect(result.isDirectory).toBe(true);
  });

  it("stat throws for non-existent path", async () => {
    await expect(
      agent().fs.stat(nodePath.join(tmpDir, "nope")),
    ).rejects.toThrow();
  });

  it("removes a file", async () => {
    const filePath = nodePath.join(tmpDir, "to-remove.txt");
    await nodeFs.writeFile(filePath, "gone soon");

    await agent().fs.rm(filePath);

    await expect(nodeFs.access(filePath)).rejects.toThrow();
  });

  it("renames a file", async () => {
    const oldPath = nodePath.join(tmpDir, "old.txt");
    const newPath = nodePath.join(tmpDir, "new.txt");
    await nodeFs.writeFile(oldPath, "moveme");

    await agent().fs.rename(oldPath, newPath);

    await expect(nodeFs.access(oldPath)).rejects.toThrow();
    const content = await nodeFs.readFile(newPath, "utf-8");
    expect(content).toBe("moveme");
  });

  it("returns current working directory", async () => {
    const result = await agent().fs.cwd();
    expect(result).toBe(process.cwd());
  });
});
