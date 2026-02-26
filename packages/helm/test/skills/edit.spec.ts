import * as nodeFs from "node:fs/promises";
import * as os from "node:os";
import * as nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHelm } from "../../src/create-helm.ts";
import { edit } from "../../src/skills/edit.ts";

describe("edit skill", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await nodeFs.mkdtemp(
      nodePath.join(os.tmpdir(), "helm-edit-test-"),
    );
  });

  afterEach(async () => {
    await nodeFs.rm(tmpDir, { recursive: true, force: true });
  });

  const agent = () =>
    createHelm({ permissions: { "edit.*": "allow" } }).use(edit());

  it("replaces first occurrence by default", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "foo bar foo baz", "utf-8");

    const result = await agent().edit.replace(filePath, "foo", "qux");
    expect(result).toEqual({ count: 1 });

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("qux bar foo baz");
  });

  it("replaces all occurrences with all: true", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "foo bar foo baz foo", "utf-8");

    const result = await agent().edit.replace(filePath, "foo", "qux", {
      all: true,
    });
    expect(result).toEqual({ count: 3 });

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("qux bar qux baz qux");
  });

  it("returns count 0 when no match found", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "hello world", "utf-8");

    const result = await agent().edit.replace(filePath, "xyz", "abc");
    expect(result).toEqual({ count: 0 });

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  it("inserts text at a line number", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "line1\nline2\nline3", "utf-8");

    await agent().edit.insert(filePath, 2, "inserted");

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("line1\ninserted\nline2\nline3");
  });

  it("inserts at line 1 (beginning of file)", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "line1\nline2", "utf-8");

    await agent().edit.insert(filePath, 1, "header");

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("header\nline1\nline2");
  });

  it("removes lines (inclusive, 1-indexed)", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "a\nb\nc\nd\ne", "utf-8");

    await agent().edit.removeLines(filePath, 2, 4);

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("a\ne");
  });

  it("applies batch edits atomically bottom-up", async () => {
    const filePath = nodePath.join(tmpDir, "test.txt");
    await nodeFs.writeFile(filePath, "a\nb\nc\nd\ne", "utf-8");

    await agent().edit.apply(filePath, [
      { type: "insert", line: 2, content: "X" },
      { type: "remove", start: 4, end: 4 },
      { type: "replace", start: 5, end: 5, content: "E!" },
    ]);

    const content = await nodeFs.readFile(filePath, "utf-8");
    expect(content).toBe("a\nX\nb\nc\nE!");
  });
});
