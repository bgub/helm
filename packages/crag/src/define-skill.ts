import type { OperationDef, Skill, SkillConfig } from "./types.ts";

export function defineSkill<
  const Name extends string,
  const Ops extends Record<string, OperationDef>,
>(config: SkillConfig<Name, Ops>): Skill<Name, Ops> {
  return config;
}
