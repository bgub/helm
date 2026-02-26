# bevel

A typed TypeScript framework for AI agents to use instead of the shell. Agents discover and call typed functions instead of parsing CLI stdout.

## Project goals

### Core idea

Instead of agents shelling out (`bash("git status")`) and parsing strings, they import and call typed functions with structured inputs and outputs:

```ts
const agent = createBevel()
  .use(git())
  .use(fs())
  .use(vercel({ token: process.env.VERCEL_TOKEN }))

agent.git.status()            // -> { staged: FileChange[], unstaged: FileChange[], ... }
agent.vercel.dns.create(...)  // -> { id: string, type: "A", ... }
```

### Design principles

- **Typed everything.** Inputs, outputs, errors. No string parsing. The types _are_ the docs.
- **Builder pattern for composition.** `.use()` chains accumulate skills; TypeScript infers the full type at each step. No codegen, no Proxy.
- **Search over the registry.** A single `search(query)` function lets agents discover available operations without loading the full skill set into context.
- **Permissions are first-class.** Every operation has a permission level. Hosts define policies per-skill or per-operation:
  ```ts
  createBevel({
    permissions: {
      "git.status": "allow",
      "git.push": "ask",
      "fs.read": "allow",
      "fs.write": "ask",
      "fs.delete": "deny",
    }
  })
  ```
  This is a must-have, not a nice-to-have. It's a core advantage over shell-based tool use where the only policy is "allow bash: yes/no."
- **Built-in skills for common agent work.** git, fs, grep, file editing — the things agents do every day ship as first-party skills.
- **Extensible with custom skills.** Third-party or user-defined skills register the same way built-ins do. They get types, search, and permissions for free.
- **MCP-compatible surface.** The framework can expose itself as an MCP server with two tools (`search` + `call`), keeping context usage minimal regardless of how many skills are registered.

### Non-goals (for now)

- Sandboxed code execution / eval
- Browser runtime support
- Being a full agent framework — bevel is a tool library, not an orchestrator

## Tech stack

- TypeScript, ESM-only
- pnpm for package management
- Vitest for testing
- Biome for linting/formatting
- tsdown for builds

## Commands

- `pnpm lint` — lint and format check
- `pnpm test` — run tests with coverage
- `pnpm build` — build with tsdown

## Dev workflow

- The user runs `pnpm dev` in a separate terminal. Don't run build/dev commands to verify changes — just make the edits.
