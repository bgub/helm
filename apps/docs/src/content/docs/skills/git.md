---
title: "git"
description: Built-in Git skill reference.
---

The `git` skill provides typed Git operations. Import it from `bevel` and register it with `.use()`:

```ts
import { createBevel, git } from "bevel";

const agent = createBevel().use(git());
// or with a custom working directory:
const agent2 = createBevel().use(git({ cwd: "/path/to/repo" }));
```

## Operations

### `git.status`

Get repository status with branch info and file changes.

```ts
const status = await agent.git.status();
// { branch, upstream?, ahead, behind, staged, unstaged, untracked }
```

**Returns:** `Promise<GitStatus>`

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

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  oldPath?: string;
}
```

**Default permission:** `"allow"`
**Tags:** `git`, `status`, `changes`, `staged`, `unstaged`, `branch`

### `git.diff`

Show file changes with additions/deletions counts.

```ts
const { files } = await agent.git.diff();
const { files: staged } = await agent.git.diff({ staged: true });
const { files: vsRef } = await agent.git.diff({ ref: "HEAD~3" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `opts` | `{ staged?: boolean; ref?: string }` | Optional — show staged changes or diff against a ref |

**Returns:** `Promise<{ files: DiffFile[] }>`

```ts
interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
}
```

**Default permission:** `"allow"`
**Tags:** `git`, `diff`, `changes`, `delta`, `compare`

### `git.log`

Show commit history.

```ts
const { commits } = await agent.git.log({ limit: 5 });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `opts` | `{ limit?: number; ref?: string }` | Optional — limit results (default 10), start from ref |

**Returns:** `Promise<{ commits: Commit[] }>`

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

**Default permission:** `"allow"`
**Tags:** `git`, `log`, `history`, `commits`, `recent`

### `git.show`

Show content of a commit or file at a ref.

```ts
const { content } = await agent.git.show("HEAD", { path: "README.md" });
const { content: commitInfo } = await agent.git.show("abc123");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | `string` | Commit hash, branch name, or tag |
| `opts` | `{ path?: string }` | Optional — show a specific file at that ref |

**Returns:** `Promise<{ content: string }>`

**Default permission:** `"allow"`
**Tags:** `git`, `show`, `content`, `ref`, `commit`, `file`, `blob`

### `git.add`

Stage files for commit.

```ts
await agent.git.add(["src/index.ts", "README.md"]);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `paths` | `string[]` | File paths to stage |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `git`, `add`, `stage`, `track`

### `git.commit`

Create a commit with the given message.

```ts
const { hash } = await agent.git.commit("fix: resolve login bug");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string` | Commit message |

**Returns:** `Promise<{ hash: string }>`

**Default permission:** `"ask"`
**Tags:** `git`, `commit`, `save`, `snapshot`

### `git.branchList`

List branches and identify the current one.

```ts
const { branches, current } = await agent.git.branchList();
```

**Returns:** `Promise<{ branches: Branch[]; current: string }>`

```ts
interface Branch {
  name: string;
  current: boolean;
}
```

**Default permission:** `"allow"`
**Tags:** `git`, `branch`, `list`, `branches`

### `git.branchCreate`

Create a new branch.

```ts
await agent.git.branchCreate("feature/new-thing");
await agent.git.branchCreate("hotfix", { startPoint: "main" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Branch name |
| `opts` | `{ startPoint?: string }` | Optional — create from a specific ref |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `git`, `branch`, `create`, `new`

### `git.checkout`

Switch branches or restore working tree files.

```ts
await agent.git.checkout("main");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | `string` | Branch name or ref to check out |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `git`, `checkout`, `switch`, `branch`, `restore`
