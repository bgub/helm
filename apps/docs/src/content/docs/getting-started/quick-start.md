---
title: Quick Start
description: Get up and running with crag in minutes.
---

## Create an agent

Import `createCrag` and built-in skills, then chain `.use()` to register them:

```ts
import { createCrag, fs, git, grep } from "crag";

const agent = createCrag({
  permissions: {
    "fs.readFile": "allow",
    "fs.writeFile": "ask",
    "fs.rm": "deny",
    "git.*": "allow",
  },
  onPermissionRequest: async (operation, args) => {
    console.log(`${operation} requested with args:`, args);
    return true; // or false to deny
  },
}).use(fs()).use(git()).use(grep());
```

## Call operations

Every operation is fully typed — inputs, outputs, and errors:

```ts
// Read a file
const { content } = await agent.fs.readFile("./package.json");

// List directory entries
const { entries } = await agent.fs.readdir("./src", { glob: "*.ts" });

// Get file metadata
const info = await agent.fs.stat("./README.md");

// Check git status
const { staged, unstaged, branch } = await agent.git.status();

// Search files for a pattern
const { matches } = await agent.grep.search("TODO", { glob: "*.ts" });
```

## Search for operations

Agents can discover available operations without knowing what's registered:

```ts
const results = agent.search("file read");
// [{ qualifiedName: "fs.readFile", description: "Read a file...", ... }]
```

Then call the operation directly:

```ts
const { content } = await agent.fs.readFile("./package.json");
```
