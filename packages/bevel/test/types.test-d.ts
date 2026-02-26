import { describe, expectTypeOf, it } from "vitest";
import { createBevel } from "../src/create-bevel.ts";
import { defineSkill } from "../src/define-skill.ts";
import type { DirEntry, StatResult } from "../src/skills/fs.ts";
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

describe("BevelInstance type inference", () => {
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

    const agent = createBevel().use(skill);

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

    const agent = createBevel().use(skill1).use(skill2);

    expectTypeOf(agent.alpha.one).toEqualTypeOf<() => number>();
    expectTypeOf(agent.beta.two).toEqualTypeOf<() => string>();
  });

  it("types the fs skill correctly", () => {
    const agent = createBevel().use(fs());

    expectTypeOf(agent.fs.readFile).toEqualTypeOf<
      (path: string) => Promise<{ content: string }>
    >();
    expectTypeOf(agent.fs.writeFile).toEqualTypeOf<
      (path: string, content: string) => Promise<void>
    >();
    expectTypeOf(agent.fs.readdir).toEqualTypeOf<
      (
        path: string,
        opts?: { glob?: string },
      ) => Promise<{ entries: DirEntry[] }>
    >();
    expectTypeOf(agent.fs.mkdir).toEqualTypeOf<
      (path: string) => Promise<void>
    >();
    expectTypeOf(agent.fs.stat).toEqualTypeOf<
      (path: string) => Promise<StatResult>
    >();
    expectTypeOf(agent.fs.rm).toEqualTypeOf<(path: string) => Promise<void>>();
    expectTypeOf(agent.fs.rename).toEqualTypeOf<
      (oldPath: string, newPath: string) => Promise<void>
    >();
    expectTypeOf(agent.fs.cwd).toEqualTypeOf<() => Promise<string>>();
  });

  it("has use, search, and call methods", () => {
    const agent = createBevel();

    expectTypeOf(agent.use).toBeFunction();
    expectTypeOf(agent.search).toBeFunction();
    expectTypeOf(agent.call).toBeFunction();
  });
});
