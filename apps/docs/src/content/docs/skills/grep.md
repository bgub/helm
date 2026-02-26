---
title: "grep"
description: Built-in search skill reference.
---

The `grep` skill provides recursive file content search with regex pattern matching. Pure Node.js implementation — no external dependencies. Import it from `bevel` and register it with `.use()`:

```ts
import { createBevel, grep } from "bevel";

const agent = createBevel().use(grep());
// or with a custom working directory:
const agent2 = createBevel().use(grep({ cwd: "/path/to/project" }));
```

## Operations

### `grep.search`

Search files recursively for a regex pattern.

```ts
const { matches } = await agent.grep.search("TODO");
const { matches: tsOnly } = await agent.grep.search("import", {
  glob: "*.ts",
  maxResults: 20,
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | `string` | Regex pattern to match |
| `opts` | `GrepOptions` | Optional search configuration |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | cwd | Directory to search |
| `glob` | `string` | — | Filter files by glob pattern |
| `maxResults` | `number` | `100` | Cap number of results |
| `contextLines` | `number` | `0` | Lines of context before/after each match |
| `ignoreCase` | `boolean` | `false` | Case-insensitive matching |

**Returns:** `Promise<{ matches: GrepMatch[] }>`

```ts
interface GrepMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  context?: { before: string[]; after: string[] };
}
```

**Behavior:**
- Skips `node_modules` and `.git` directories by default
- Respects `.gitignore` patterns if present
- Skips binary files (detected by null bytes in first 512 bytes)

**Default permission:** `"allow"`
**Tags:** `search`, `grep`, `find`, `regex`, `pattern`, `content`, `text`, `rg`
