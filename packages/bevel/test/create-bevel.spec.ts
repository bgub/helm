import { describe, expect, it, vi } from "vitest";
import { createBevel } from "../src/create-bevel.ts";
import { defineSkill } from "../src/define-skill.ts";
import { PermissionDeniedError } from "../src/permissions.ts";

const testSkill = defineSkill({
  name: "test",
  description: "A test skill",
  operations: {
    greet: {
      description: "Says hello",
      defaultPermission: "allow",
      tags: ["greeting"],
      handler: (name: string) => `hello ${name}`,
    },
    secret: {
      description: "A secret operation",
      defaultPermission: "deny",
      handler: () => "secret",
    },
    askable: {
      description: "Requires permission",
      handler: () => "asked",
    },
  },
});

describe("createBevel", () => {
  it("creates an instance", () => {
    const agent = createBevel();
    expect(agent).toBeDefined();
    expect(typeof agent.use).toBe("function");
    expect(typeof agent.search).toBe("function");
  });

  it("registers a skill with .use()", () => {
    const agent = createBevel().use(testSkill);
    expect(agent.test).toBeDefined();
    expect(typeof agent.test.greet).toBe("function");
  });

  it("chains .use() calls", () => {
    const other = defineSkill({
      name: "other",
      description: "Another skill",
      operations: {
        ping: {
          description: "Ping",
          defaultPermission: "allow",
          handler: () => "pong",
        },
      },
    });

    const agent = createBevel({ defaultPermission: "allow" })
      .use(testSkill)
      .use(other);

    expect(agent.test).toBeDefined();
    expect(agent.other).toBeDefined();
  });
});

describe("operation calls", () => {
  it("calls an allowed operation directly", async () => {
    const agent = createBevel().use(testSkill);
    const result = await agent.test.greet("world");
    expect(result).toBe("hello world");
  });

  it("throws PermissionDeniedError for denied operations", async () => {
    const agent = createBevel().use(testSkill);
    await expect(agent.test.secret()).rejects.toThrow(PermissionDeniedError);
  });

  it("calls onPermissionRequest for ask permission", async () => {
    const onPermissionRequest = vi.fn().mockResolvedValue(true);
    const agent = createBevel({
      defaultPermission: "ask",
      onPermissionRequest,
    }).use(testSkill);

    const result = await agent.test.askable();
    expect(result).toBe("asked");
    expect(onPermissionRequest).toHaveBeenCalledWith("test.askable", []);
  });

  it("throws when onPermissionRequest returns false", async () => {
    const agent = createBevel({
      defaultPermission: "ask",
      onPermissionRequest: () => false,
    }).use(testSkill);

    await expect(agent.test.askable()).rejects.toThrow(PermissionDeniedError);
  });

  it("throws when no onPermissionRequest for ask permission", async () => {
    const agent = createBevel({ defaultPermission: "ask" }).use(testSkill);
    await expect(agent.test.askable()).rejects.toThrow(PermissionDeniedError);
  });
});

describe(".search()", () => {
  it("searches registered operations", () => {
    const agent = createBevel().use(testSkill);
    const results = agent.search("greet");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].qualifiedName).toBe("test.greet");
  });

  it("returns empty for no matches", () => {
    const agent = createBevel().use(testSkill);
    const results = agent.search("nonexistent_xyz");
    expect(results).toEqual([]);
  });
});

describe("permission policy", () => {
  it("overrides operation default with policy", async () => {
    const agent = createBevel({
      permissions: { "test.secret": "allow" },
    }).use(testSkill);

    const result = await agent.test.secret();
    expect(result).toBe("secret");
  });

  it("wildcard policy applies to all ops in a skill", async () => {
    const agent = createBevel({
      permissions: { "test.*": "allow" },
    }).use(testSkill);

    const result = await agent.test.secret();
    expect(result).toBe("secret");
  });
});
