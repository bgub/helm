---
title: "fs"
description: Built-in file system skill reference.
---

The `fs` skill provides file system operations. Import it from `bevel` and register it with `.use()`:

```ts
import { createBevel, fs } from "bevel";

const agent = createBevel().use(fs());
```

## Operations

### `fs.readFile`

Read a file and return its content as a string.

```ts
const { content } = await agent.fs.readFile(path);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path to read |

**Returns:** `Promise<{ content: string }>`

**Default permission:** `"allow"`
**Tags:** `file`, `read`

### `fs.writeFile`

Write content to a file, creating it if it doesn't exist.

```ts
await agent.fs.writeFile(path, content);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path to write |
| `content` | `string` | Content to write |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `file`, `write`

### `fs.readdir`

List entries in a directory, with optional glob filtering.

```ts
const { entries } = await agent.fs.readdir(path);
const { entries: tsFiles } = await agent.fs.readdir(path, { glob: "*.ts" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Directory path |
| `opts` | `{ glob?: string }` | Optional glob pattern to filter entries |

**Returns:** `Promise<{ entries: DirEntry[] }>`

```ts
interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}
```

**Default permission:** `"allow"`
**Tags:** `directory`, `list`

### `fs.mkdir`

Create a directory, including any parent directories.

```ts
await agent.fs.mkdir(path);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Directory path to create |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `directory`, `create`, `mkdir`

### `fs.stat`

Get file or directory metadata — size, type, timestamps.

```ts
const info = await agent.fs.stat(path);
// { size, isFile, isDirectory, modified, created }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to stat |

**Returns:** `Promise<StatResult>`

```ts
interface StatResult {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  modified: string;
  created: string;
}
```

**Default permission:** `"allow"`
**Tags:** `file`, `stat`, `info`, `metadata`

### `fs.rm`

Remove a file or directory (recursive).

```ts
await agent.fs.rm(path);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to remove |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `file`, `delete`, `remove`, `rm`

### `fs.rename`

Rename or move a file or directory.

```ts
await agent.fs.rename("old-name.ts", "new-name.ts");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `oldPath` | `string` | Current path |
| `newPath` | `string` | New path |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `file`, `rename`, `move`, `mv`

### `fs.cwd`

Get the current working directory.

```ts
const path = await agent.fs.cwd();
```

**Returns:** `Promise<string>`

**Default permission:** `"allow"`
**Tags:** `directory`, `cwd`, `pwd`
