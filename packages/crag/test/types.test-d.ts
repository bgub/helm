import { describe, expectTypeOf, it } from "vitest";
import { createCrag } from "../src/create-crag.ts";
import { defineSkill } from "../src/define-skill.ts";
import type { DirEntry } from "../src/skills/fs.ts";
import { fs } from "../src/skills/fs.ts";

describe("defineSkill type inference", () => {
  it("preserves literal skill name", () => {
    const skill = defineSkill({
      name: "myskill",
      description: "test",
      operations: {
        op: {
          description: "op",
          handler: () => 42,
        },
      },
    });

    expectTypeOf(skill.name).toEqualTypeOf<"myskill">();
  });

  it("preserves handler signatures", () => {
    const skill = defineSkill({
      name: "math",
      description: "math ops",
      operations: {
        add: {
          description: "add two numbers",
          handler: (a: number, b: number): number => a + b,
        },
      },
    });

    expectTypeOf(skill.operations.add.handler).toEqualTypeOf<
      (a: number, b: number) => number
    >();
  });
});

describe("CragInstance type inference", () => {
  it("exposes skill namespace after .use()", () => {
    const skill = defineSkill({
      name: "demo",
      description: "demo",
      operations: {
        hello: {
          description: "hello",
          defaultPermission: "allow",
          handler: (name: string) => `hi ${name}`,
        },
      },
    });

    const agent = createCrag().use(skill);

    expectTypeOf(agent.demo.hello).toEqualTypeOf<(name: string) => string>();
  });

  it("accumulates types across multiple .use() calls", () => {
    const skill1 = defineSkill({
      name: "alpha",
      description: "alpha",
      operations: {
        one: { description: "one", handler: () => 1 },
      },
    });
    const skill2 = defineSkill({
      name: "beta",
      description: "beta",
      operations: {
        two: { description: "two", handler: () => "two" },
      },
    });

    const agent = createCrag().use(skill1).use(skill2);

    expectTypeOf(agent.alpha.one).toEqualTypeOf<() => number>();
    expectTypeOf(agent.beta.two).toEqualTypeOf<() => string>();
  });

  it("types the fs skill correctly", () => {
    const agent = createCrag().use(fs());

    expectTypeOf(agent.fs.read).toEqualTypeOf<
      (path: string) => Promise<{ content: string }>
    >();
    expectTypeOf(agent.fs.write).toEqualTypeOf<
      (path: string, content: string) => Promise<void>
    >();
    expectTypeOf(agent.fs.list).toEqualTypeOf<
      (
        path: string,
        opts?: { glob?: string },
      ) => Promise<{ entries: DirEntry[] }>
    >();
    expectTypeOf(agent.fs.mkdir).toEqualTypeOf<
      (path: string) => Promise<void>
    >();
    expectTypeOf(agent.fs.exists).toEqualTypeOf<
      (path: string) => Promise<boolean>
    >();
    expectTypeOf(agent.fs.remove).toEqualTypeOf<
      (path: string) => Promise<void>
    >();
  });

  it("has use, search, and call methods", () => {
    const agent = createCrag();

    expectTypeOf(agent.use).toBeFunction();
    expectTypeOf(agent.search).toBeFunction();
    expectTypeOf(agent.call).toBeFunction();
  });
});
