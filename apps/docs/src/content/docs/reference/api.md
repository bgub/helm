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
  permissions: { "fs.readFile": "allow" },
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
| `qualifiedName` | `string` | e.g. `"fs.readFile"` |
| `operationDefault` | `Permission \| undefined` | The operation's default |
| `policy` | `PermissionPolicy` | The permission policy map |
| `globalDefault` | `Permission` | The global fallback |

**Returns:** `Permission`

## Built-in skills

### `fs()`

File system operations. See the [fs skill reference](/skills/fs/).

```ts
import { fs } from "crag";
const agent = createCrag().use(fs());
```

### `git(opts?)`

Git operations. Takes optional `{ cwd?: string }`. See the [git skill reference](/skills/git/).

```ts
import { git } from "crag";
const agent = createCrag().use(git({ cwd: "/repo" }));
```

### `grep(opts?)`

Recursive file search. Takes optional `{ cwd?: string }`. See the [grep skill reference](/skills/grep/).

```ts
import { grep } from "crag";
const agent = createCrag().use(grep());
```

### `edit()`

File editing operations. See the [edit skill reference](/skills/edit/).

```ts
import { edit } from "crag";
const agent = createCrag().use(edit());
```

### `shell(opts?)`

Shell command execution. Takes optional `{ cwd?, env?, timeout? }`. See the [shell skill reference](/skills/shell/).

```ts
import { shell } from "crag";
const agent = createCrag().use(shell());
```

### `http()`

HTTP client. See the [http skill reference](/skills/http/).

```ts
import { http } from "crag";
const agent = createCrag().use(http());
```

## Instance methods

### `agent.use(skill)`

Register a skill and return a new instance with the skill's types merged in.

```ts
const agent = createCrag().use(fs()).use(git()).use(grep());
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

### `StatResult`

```ts
interface StatResult {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  modified: string;
  created: string;
}
```

### `GitStatus`

```ts
interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
}
```

### `FileChange`

```ts
interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  oldPath?: string;
}
```

### `DiffFile`

```ts
interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
}
```

### `Commit`

```ts
interface Commit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}
```

### `Branch`

```ts
interface Branch {
  name: string;
  current: boolean;
}
```

### `GrepMatch`

```ts
interface GrepMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  context?: { before: string[]; after: string[] };
}
```

### `GrepOptions`

```ts
interface GrepOptions {
  path?: string;
  glob?: string;
  maxResults?: number;
  contextLines?: number;
  ignoreCase?: boolean;
}
```

### `EditOp`

```ts
type EditOp =
  | { type: "insert"; line: number; content: string }
  | { type: "remove"; start: number; end: number }
  | { type: "replace"; start: number; end: number; content: string };
```

### `ExecResult`

```ts
interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

### `ShellExecOptions`

```ts
interface ShellExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdin?: string;
}
```

### `HttpResponse`

```ts
interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}
```

### `JsonResponse`

```ts
interface JsonResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}
```

### `RequestOptions`

```ts
interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}
```

### `PermissionDeniedError`

```ts
class PermissionDeniedError extends Error {
  constructor(qualifiedName: string);
}
```
