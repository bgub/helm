import { describe, expect, it } from "vitest";
import { search } from "../src/search.ts";
import type { Skill } from "../src/types.ts";

function makeRegistry(skills: Skill[]) {
  const registry = new Map<string, { skill: Skill }>();
  for (const skill of skills) {
    registry.set(skill.name, { skill });
  }
  return registry;
}

const gitSkill: Skill = {
  name: "git",
  description: "Git operations",
  operations: {
    status: {
      description: "Show the working tree status",
      tags: ["vcs", "info"],
      defaultPermission: "allow",
      handler: () => {},
    },
    push: {
      description: "Push commits to remote",
      tags: ["vcs", "write"],
      defaultPermission: "ask",
      handler: () => {},
    },
    log: {
      description: "Show commit logs",
      tags: ["vcs", "info"],
      handler: () => {},
    },
  },
};

const fsSkill: Skill = {
  name: "fs",
  description: "File system operations",
  operations: {
    readFile: {
      description: "Read a file",
      tags: ["file", "read"],
      defaultPermission: "allow",
      handler: () => {},
    },
    writeFile: {
      description: "Write a file",
      tags: ["file", "write"],
      defaultPermission: "ask",
      handler: () => {},
    },
  },
};

describe("search", () => {
  const registry = makeRegistry([gitSkill, fsSkill]);

  it("finds exact qualified name match", () => {
    const results = search("git.status", registry, {}, "ask");
    expect(results[0].qualifiedName).toBe("git.status");
  });

  it("matches partial qualified name", () => {
    const results = search("git", registry, {}, "ask");
    expect(results.every((r) => r.skill === "git")).toBe(true);
    expect(results.length).toBe(3);
  });

  it("matches by description", () => {
    const results = search("commit", registry, {}, "ask");
    expect(results.some((r) => r.qualifiedName === "git.push")).toBe(true);
    expect(results.some((r) => r.qualifiedName === "git.log")).toBe(true);
  });

  it("matches by tag", () => {
    const results = search("vcs", registry, {}, "ask");
    expect(results.every((r) => r.skill === "git")).toBe(true);
  });

  it("returns empty array for no matches", () => {
    const results = search("nonexistent_xyz", registry, {}, "ask");
    expect(results).toEqual([]);
  });

  it("is case-insensitive", () => {
    const results = search("GIT.STATUS", registry, {}, "ask");
    expect(results[0].qualifiedName).toBe("git.status");
  });

  it("resolves permissions from policy", () => {
    const results = search("git.push", registry, { "git.push": "deny" }, "ask");
    expect(results[0].permission).toBe("deny");
  });

  it("ranks exact name match higher than description match", () => {
    const results = search("readFile", registry, {}, "ask");
    expect(results[0].qualifiedName).toBe("fs.readFile");
  });

  it("passes signature through to search results", () => {
    const skillWithSig: Skill = {
      name: "math",
      description: "Math operations",
      operations: {
        add: {
          description: "Add two numbers",
          signature: "(a: number, b: number) => number",
          handler: () => {},
        },
        sub: {
          description: "Subtract two numbers",
          handler: () => {},
        },
      },
    };
    const reg = makeRegistry([skillWithSig]);
    const results = search("math", reg, {}, "ask");
    const add = results.find((r) => r.operation === "add");
    const sub = results.find((r) => r.operation === "sub");
    expect(add?.signature).toBe("(a: number, b: number) => number");
    expect(sub?.signature).toBeUndefined();
  });
});
