---
title: "shell"
description: Built-in shell execution skill reference.
---

The `shell` skill runs shell commands and returns structured output. Import it from `helm` and register it with `.use()`:

```ts
import { createHelm, shell } from "@bgub/helm";

const agent = createHelm().use(shell());
// or with defaults:
const agent2 = createHelm().use(shell({
  cwd: "/path/to/project",
  timeout: 30_000,
}));
```

:::caution
The shell skill executes arbitrary commands. Its single operation defaults to `"ask"` permission — every command requires approval unless explicitly overridden.
:::

## Operations

### `shell.dangerousExec`

Run a shell command.

```ts
const { stdout, stderr, exitCode } = await agent.shell.dangerousExec("ls -la");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | `string` | Shell command to execute (supports pipes, redirects, etc.) |
| `opts` | `ShellExecOptions` | Optional execution options |

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `cwd` | `string` | Working directory (overrides factory default) |
| `env` | `Record<string, string>` | Additional environment variables (merged with process env) |
| `timeout` | `number` | Timeout in milliseconds |
| `stdin` | `string` | Data to pipe to stdin |

**Returns:** `Promise<ExecResult>`

```ts
interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

**Default permission:** `"ask"`
**Tags:** `shell`, `exec`, `run`, `command`, `bash`, `process`
