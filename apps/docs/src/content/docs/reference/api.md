---
title: API Reference
description: Complete reference for all crag exports.
---

## Functions

### `createCrag(options?)`

Create a new crag instance.

```ts
import { createCrag } from "crag";

const agent = createCrag({
  permissions: { "fs.read": "allow" },
  defaultPermission: "ask",
  onPermissionRequest: async (op, args) => true,
});
```

**Parameters:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `permissions` | `PermissionPolicy` | `{}` | Permission overrides by qualified name or wildcard |
| `defaultPermission` | `Permission` | `"ask"` | Global fallback permission |
| `onPermissionRequest` | `(operation: string, args: unknown[]) => Promise<boolean> \| boolean` | `undefined` | Called when permission is `"ask"` |

**Returns:** `CragInstance`

### `defineSkill(config)`

Define a custom skill with full type inference.

```ts
import { defineSkill } from "crag";

const mySkill = defineSkill({
  name: "mySkill",
  description: "My custom skill",
  operations: { /* ... */ },
});
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique skill name |
| `description` | `string` | Human-readable description |
| `operations` | `Record<string, OperationDef>` | Map of operation definitions |

**Returns:** `Skill<Name, Ops>`

### `resolvePermission(qualifiedName, operationDefault, policy, globalDefault)`

Resolve the permission level for an operation. Used internally, but exported for advanced use cases.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `qualifiedName` | `string` | e.g. `"fs.read"` |
| `operationDefault` | `Permission \| undefined` | The operation's default |
| `policy` | `PermissionPolicy` | The permission policy map |
| `globalDefault` | `Permission` | The global fallback |

**Returns:** `Permission`

### `fs()`

Create the built-in file system skill. See the [fs skill reference](/skills/fs/) for details.

```ts
import { fs } from "crag";
const agent = createCrag().use(fs());
```

## Instance methods

### `agent.use(skill)`

Register a skill and return a new instance with the skill's types merged in.

```ts
const agent = createCrag().use(fs()).use(weather);
```

### `agent.search(query)`

Search for operations matching a text query. Returns results ranked by relevance.

```ts
const results = agent.search("read file");
// SearchResult[]
```

## Types

### `Permission`

```ts
type Permission = "allow" | "ask" | "deny";
```

### `PermissionPolicy`

```ts
type PermissionPolicy = Record<string, Permission>;
```

### `CragOptions`

```ts
interface CragOptions {
  permissions?: PermissionPolicy;
  onPermissionRequest?: (operation: string, args: unknown[]) => Promise<boolean> | boolean;
  defaultPermission?: Permission;
}
```

### `OperationDef<H>`

```ts
interface OperationDef<H extends (...args: any[]) => any> {
  description: string;
  signature?: string;
  tags?: string[];
  defaultPermission?: Permission;
  handler: H;
}
```

### `SkillConfig<Name, Ops>`

```ts
interface SkillConfig<Name extends string, Ops extends Record<string, OperationDef>> {
  name: Name;
  description: string;
  operations: Ops;
}
```

### `Skill<Name, Ops>`

```ts
interface Skill<Name extends string, Ops extends Record<string, OperationDef>> {
  name: Name;
  description: string;
  operations: Ops;
}
```

### `SearchResult`

```ts
interface SearchResult {
  skill: string;
  operation: string;
  qualifiedName: string;
  description: string;
  signature?: string;
  tags: string[];
  permission: Permission;
}
```

### `BoundOperations<Ops>`

```ts
type BoundOperations<Ops extends Record<string, OperationDef>> = {
  [K in keyof Ops]: Ops[K]["handler"];
};
```

### `CragInstance<S>`

```ts
type CragInstance<S> = BoundSkills<S> & {
  use<Name extends string, Ops extends Record<string, OperationDef>>(
    skill: Skill<Name, Ops>,
  ): CragInstance<S & Record<Name, Ops>>;
  search(query: string): SearchResult[];
};
```

### `DirEntry`

```ts
interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}
```

### `PermissionDeniedError`

```ts
class PermissionDeniedError extends Error {
  constructor(qualifiedName: string);
}
```
