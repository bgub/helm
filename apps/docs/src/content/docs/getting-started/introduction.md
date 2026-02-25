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
const { staged, unstaged } = await agent.git.status();
```

Instead of agents shelling out and parsing strings, they import and call typed functions:

```ts
import { createCrag, fs } from "crag";

const agent = createCrag({
  permissions: {
    "fs.read": "allow",
    "fs.write": "ask",
    "fs.remove": "deny",
  },
}).use(fs());

const { content } = await agent.fs.read("./package.json");
```

## Key features

- **Typed everything.** Inputs, outputs, errors. The types _are_ the docs.
- **Builder pattern.** `.use()` chains accumulate skills; TypeScript infers the full type at each step.
- **Permissions are first-class.** Every operation has a permission level (`allow`, `ask`, `deny`). Policies are set per-skill or per-operation.
- **Search the registry.** A single `search(query)` lets agents discover operations without loading the full skill set into context.
- **Extensible.** Define custom skills that get types, search, and permissions for free.
- **MCP-compatible.** The framework can expose itself as an MCP server with two tools (`search` + `call`), keeping context usage minimal regardless of how many skills are registered.
