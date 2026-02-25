---
title: "fs"
description: Built-in file system skill reference.
---

The `fs` skill provides file system operations. Import it from `crag` and register it with `.use()`:

```ts
import { createCrag, fs } from "crag";

const agent = createCrag().use(fs());
```

## Operations

### `fs.read`

Read a file and return its content as a string.

```ts
const { content } = await agent.fs.read(path);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path to read |

**Returns:** `Promise<{ content: string }>`

**Default permission:** `"allow"`
**Tags:** `file`, `read`

### `fs.write`

Write content to a file.

```ts
await agent.fs.write(path, content);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path to write |
| `content` | `string` | Content to write |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `file`, `write`

### `fs.list`

List entries in a directory, with optional glob filtering.

```ts
const { entries } = await agent.fs.list(path, opts?);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Directory path |
| `opts` | `{ glob?: string }` | Optional glob pattern to filter entries |

**Returns:** `Promise<{ entries: DirEntry[] }>`

Each `DirEntry` has the following shape:

```ts
interface DirEntry {
  name: string;        // entry name
  path: string;        // full path
  isFile: boolean;     // true if regular file
  isDirectory: boolean; // true if directory
}
```

**Default permission:** `"allow"`
**Tags:** `directory`, `list`

### `fs.exists`

Check whether a file or directory exists.

```ts
const exists = await agent.fs.exists(path);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to check |

**Returns:** `Promise<boolean>`

**Default permission:** `"allow"`
**Tags:** `file`, `check`

### `fs.remove`

Remove a file or directory (recursive).

```ts
await agent.fs.remove(path);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | Path to remove |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `file`, `delete`
