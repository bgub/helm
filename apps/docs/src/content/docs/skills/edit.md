---
title: "edit"
description: Built-in file editing skill reference.
---

The `edit` skill provides file editing operations — replace text, insert lines, remove lines, and apply batch edits. Import it from `bevel` and register it with `.use()`:

```ts
import { createBevel, edit } from "bevel";

const agent = createBevel().use(edit());
```

## Operations

### `edit.replace`

Replace occurrences of a string in a file.

```ts
const { count } = await agent.edit.replace("src/config.ts", "localhost", "0.0.0.0");
// Replace all occurrences:
const { count: total } = await agent.edit.replace(
  "src/config.ts", "http://", "https://", { all: true }
);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path |
| `old` | `string` | String to find |
| `new_` | `string` | Replacement string |
| `opts` | `{ all?: boolean }` | Optional — replace all occurrences (default: first only) |

**Returns:** `Promise<{ count: number }>` — number of replacements made

**Default permission:** `"ask"`
**Tags:** `edit`, `replace`, `substitute`, `find`, `change`, `sed`

### `edit.insert`

Insert text at a line number (1-indexed).

```ts
await agent.edit.insert("src/index.ts", 1, "// Generated file — do not edit");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path |
| `line` | `number` | Line number to insert before (1-indexed) |
| `content` | `string` | Text to insert |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `edit`, `insert`, `add`, `line`, `append`

### `edit.removeLines`

Remove lines from start to end inclusive (1-indexed).

```ts
await agent.edit.removeLines("src/index.ts", 5, 10);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path |
| `start` | `number` | First line to remove (1-indexed) |
| `end` | `number` | Last line to remove (1-indexed, inclusive) |

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `edit`, `remove`, `delete`, `lines`, `cut`

### `edit.apply`

Apply multiple edits atomically. Edits are sorted by line number and applied bottom-up to preserve line numbers.

```ts
await agent.edit.apply("src/index.ts", [
  { type: "insert", line: 1, content: "// header" },
  { type: "remove", start: 10, end: 12 },
  { type: "replace", start: 20, end: 20, content: "const x = 42;" },
]);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | File path |
| `edits` | `EditOp[]` | Array of edit operations |

**Edit operations:**

```ts
type EditOp =
  | { type: "insert"; line: number; content: string }
  | { type: "remove"; start: number; end: number }
  | { type: "replace"; start: number; end: number; content: string };
```

**Returns:** `Promise<void>`

**Default permission:** `"ask"`
**Tags:** `edit`, `batch`, `multi`, `atomic`, `apply`, `patch`
