// Permission levels
export type Permission = "allow" | "ask" | "deny";

// Operation definition (what skill authors write)
export interface OperationDef<
  // biome-ignore lint/suspicious/noExplicitAny: handler signatures are user-defined
  H extends (...args: any[]) => any = (...args: any[]) => any,
> {
  description: string;
  signature?: string;
  tags?: string[];
  defaultPermission?: Permission;
  handler: H;
}

// Skill definition (input to defineSkill)
export interface SkillConfig<
  Name extends string,
  Ops extends Record<string, OperationDef>,
> {
  name: Name;
  description: string;
  operations: Ops;
}

// Skill object (output of defineSkill)
export interface Skill<
  Name extends string = string,
  Ops extends Record<string, OperationDef> = Record<string, OperationDef>,
> {
  name: Name;
  description: string;
  operations: Ops;
}

// Extract handler signatures from a skill's operations
export type BoundOperations<Ops extends Record<string, OperationDef>> = {
  [K in keyof Ops]: Ops[K]["handler"];
};

// Permission policy map
export type PermissionPolicy = Record<string, Permission>;

// Options for createBevel
export interface BevelOptions {
  permissions?: PermissionPolicy;
  onPermissionRequest?: (
    operation: string,
    args: unknown[],
  ) => Promise<boolean> | boolean;
  defaultPermission?: Permission;
}

// Search result
export interface SearchResult {
  skill: string;
  operation: string;
  qualifiedName: string;
  description: string;
  signature?: string;
  tags: string[];
  permission: Permission;
}

// Maps skill registry to bound operation namespaces
type BoundSkills<S extends Record<string, Record<string, OperationDef>>> = {
  [K in keyof S]: BoundOperations<S[K]>;
};

// The BevelInstance type — framework methods + accumulated skill namespaces
export type BevelInstance<
  // biome-ignore lint/complexity/noBannedTypes: empty default represents no skills registered
  S extends Record<string, Record<string, OperationDef>> = {},
> = BoundSkills<S> & {
  use<Name extends string, Ops extends Record<string, OperationDef>>(
    skill: Skill<Name, Ops>,
  ): BevelInstance<S & Record<Name, Ops>>;
  search(query: string): SearchResult[];
};
