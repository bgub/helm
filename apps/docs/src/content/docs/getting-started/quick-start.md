---
title: Quick Start
description: Get up and running with crag in minutes.
---

## Create an agent

Import `createCrag` and a built-in skill, then chain `.use()` to register it:

```ts
import { createCrag, fs } from "crag";

const agent = createCrag({
  permissions: {
    "fs.read": "allow",
    "fs.write": "ask",
    "fs.remove": "deny",
  },
  onPermissionRequest: async (operation, args) => {
    console.log(`${operation} requested with args:`, args);
    return true; // or false to deny
  },
}).use(fs());
```

## Call operations

Every operation is fully typed — inputs, outputs, and errors:

```ts
// Read a file
const { content } = await agent.fs.read("./package.json");

// List directory entries
const { entries } = await agent.fs.list("./src", { glob: "*.ts" });

// Check if a file exists
const exists = await agent.fs.exists("./README.md");
```

## Search for operations

Agents can discover available operations without knowing what's registered:

```ts
const results = agent.search("file read");
// [{ qualifiedName: "fs.read", description: "Read a file...", ... }]
```

Then call the operation directly:

```ts
const { content } = await agent.fs.read("./package.json");
```
