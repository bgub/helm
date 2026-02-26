---
title: Introduction
description: What crag is and why it exists.
---

## The problem

AI agents today interact with the system by shelling out and parsing strings:

```ts
const output = bash("git status --porcelain");
const files = parseGitStatus(output); // hope the format doesn't change
```

This means no type safety, no structured errors, and no way to control what operations an agent is allowed to perform.

## The solution

crag gives agents typed functions with structured inputs and outputs:

```ts
import { createCrag, fs, git, grep } from "crag";

const agent = createCrag({
  permissions: {
    "fs.readFile": "allow",
    "fs.writeFile": "ask",
    "fs.rm": "deny",
    "git.*": "allow",
  },
}).use(fs()).use(git()).use(grep());
```

Instead of parsing strings, agents call typed functions and get structured data back:

```ts
// Git status with typed fields — no string parsing
const { staged, unstaged, branch } = await agent.git.status();

// Search files with regex — returns file, line, column
const { matches } = await agent.grep.search("TODO", { glob: "*.ts" });

// Read and write files
const { content } = await agent.fs.readFile("./package.json");
await agent.fs.writeFile("./output.json", JSON.stringify(data));
```

## Built-in skills

crag ships with six built-in skills covering common agent workflows:

| Skill | Description | Example |
|-------|-------------|---------|
| [**fs**](/skills/fs/) | File system — read, write, stat, mkdir, rm, rename | `agent.fs.readFile(path)` |
| [**git**](/skills/git/) | Git — status, diff, log, show, add, commit, branches | `agent.git.status()` |
| [**grep**](/skills/grep/) | Search — recursive regex search across files | `agent.grep.search("pattern")` |
| [**edit**](/skills/edit/) | Editing — replace text, insert/remove lines, batch edits | `agent.edit.replace(path, old, new)` |
| [**shell**](/skills/shell/) | Shell — run commands with structured output | `agent.shell.dangerousExec("cmd")` |
| [**http**](/skills/http/) | HTTP — fetch URLs, parse JSON responses | `agent.http.fetch(url)` |

## Key features

- **Typed everything.** Inputs, outputs, errors. The types _are_ the docs.
- **Builder pattern.** `.use()` chains accumulate skills; TypeScript infers the full type at each step.
- **Permissions are first-class.** Every operation has a permission level (`allow`, `ask`, `deny`). Policies are set per-skill or per-operation.
- **Search the registry.** A single `search(query)` lets agents discover operations without loading the full skill set into context.
- **Extensible.** Define custom skills that get types, search, and permissions for free.
- **MCP-compatible.** The framework can expose itself as an MCP server with two tools (`search` + `call`), keeping context usage minimal regardless of how many skills are registered.
