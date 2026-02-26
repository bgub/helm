import * as nodeFs from "node:fs/promises";
import * as os from "node:os";
import * as nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHelm } from "../../src/create-helm.ts";
import { grep } from "../../src/skills/grep.ts";

describe("grep skill", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await nodeFs.mkdtemp(
      nodePath.join(os.tmpdir(), "helm-grep-test-"),
    );
  });

  afterEach(async () => {
    await nodeFs.rm(tmpDir, { recursive: true, force: true });
  });

  const agent = () =>
    createHelm({ permissions: { "grep.*": "allow" } }).use(
      grep({ cwd: tmpDir }),
    );

  it("finds matches in files", async () => {
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "hello.txt"),
      "hello world\ngoodbye world",
      "utf-8",
    );

    const result = await agent().grep.search("hello");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].line).toBe(1);
    expect(result.matches[0].text).toBe("hello world");
  });

  it("searches recursively", async () => {
    await nodeFs.mkdir(nodePath.join(tmpDir, "sub"));
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "sub", "deep.txt"),
      "deep match here",
      "utf-8",
    );

    const result = await agent().grep.search("deep");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toContain("deep.txt");
  });

  it("filters by glob", async () => {
    await nodeFs.writeFile(nodePath.join(tmpDir, "a.ts"), "match ts", "utf-8");
    await nodeFs.writeFile(nodePath.join(tmpDir, "b.js"), "match js", "utf-8");

    const result = await agent().grep.search("match", { glob: "*.ts" });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toContain("a.ts");
  });

  it("supports case-insensitive search", async () => {
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "test.txt"),
      "Hello World",
      "utf-8",
    );

    const sensitive = await agent().grep.search("hello");
    expect(sensitive.matches).toHaveLength(0);

    const insensitive = await agent().grep.search("hello", {
      ignoreCase: true,
    });
    expect(insensitive.matches).toHaveLength(1);
  });

  it("respects maxResults", async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `match ${i}`).join("\n");
    await nodeFs.writeFile(nodePath.join(tmpDir, "many.txt"), lines, "utf-8");

    const result = await agent().grep.search("match", { maxResults: 5 });
    expect(result.matches).toHaveLength(5);
  });

  it("includes context lines", async () => {
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "ctx.txt"),
      "before\ntarget\nafter",
      "utf-8",
    );

    const result = await agent().grep.search("target", { contextLines: 1 });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].context?.before).toEqual(["before"]);
    expect(result.matches[0].context?.after).toEqual(["after"]);
  });

  it("skips node_modules", async () => {
    await nodeFs.mkdir(nodePath.join(tmpDir, "node_modules"));
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "node_modules", "dep.js"),
      "hidden match",
      "utf-8",
    );
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "src.js"),
      "visible match",
      "utf-8",
    );

    const result = await agent().grep.search("match");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toContain("src.js");
  });

  it("skips binary files", async () => {
    const buf = Buffer.alloc(100);
    buf[50] = 0; // null byte marks it as binary
    await nodeFs.writeFile(nodePath.join(tmpDir, "binary.bin"), buf);
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "text.txt"),
      "findme",
      "utf-8",
    );

    const result = await agent().grep.search("findme");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toContain("text.txt");
  });

  it("returns column position", async () => {
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "col.txt"),
      "abc def ghi",
      "utf-8",
    );

    const result = await agent().grep.search("def");
    expect(result.matches[0].column).toBe(5);
  });

  it("respects .gitignore patterns", async () => {
    await nodeFs.writeFile(
      nodePath.join(tmpDir, ".gitignore"),
      "ignored_dir\n*.log\n",
      "utf-8",
    );
    await nodeFs.mkdir(nodePath.join(tmpDir, "ignored_dir"));
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "ignored_dir", "file.txt"),
      "hidden match",
      "utf-8",
    );
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "app.log"),
      "log match",
      "utf-8",
    );
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "visible.txt"),
      "visible match",
      "utf-8",
    );

    const result = await agent().grep.search("match");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toContain("visible.txt");
  });

  it("uses path option to search subdirectory", async () => {
    await nodeFs.mkdir(nodePath.join(tmpDir, "sub"));
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "root.txt"),
      "match root",
      "utf-8",
    );
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "sub", "nested.txt"),
      "match nested",
      "utf-8",
    );

    const result = await agent().grep.search("match", {
      path: nodePath.join(tmpDir, "sub"),
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toContain("nested.txt");
  });

  it("returns no matches when nothing found", async () => {
    await nodeFs.writeFile(
      nodePath.join(tmpDir, "empty.txt"),
      "nothing here",
      "utf-8",
    );

    const result = await agent().grep.search("xyz_not_found");
    expect(result.matches).toEqual([]);
  });
});
