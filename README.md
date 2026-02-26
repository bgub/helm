<h1 align="center" style="text-align: center; width: fit-content; margin-left: auto; margin-right: auto;">bevel</h1>

<p align="center">
  <a href="https://github.com/bgub/bevel/actions">CI</a>
  ·
  <a href="https://github.com/bgub/bevel/releases">Releases</a>
  ·
  <a href="https://github.com/bgub/bevel/issues">Issues</a>
</p>

<span align="center">

[![npm](https://img.shields.io/npm/v/bevel?logo=npm&label=npm)](https://www.npmjs.com/package/bevel)
[![CI](https://github.com/bgub/bevel/actions/workflows/ci.yml/badge.svg)](https://github.com/bgub/bevel/actions)
[![Codecov](https://codecov.io/github/bgub/bevel/branch/main/graph/badge.svg)](https://codecov.io/github/bgub/bevel)

</span>

A typed TypeScript framework for AI agents. Call typed functions instead of parsing CLI stdout.

## Install

```bash
npm install bevel
```

## Quick start

```ts
import { createBevel, fs } from "bevel";

const agent = createBevel({
  permissions: {
    "fs.read": "allow",
    "fs.write": "ask",
    "fs.remove": "deny",
  },
  // operation is a qualified name like "fs.write"; args are the call arguments
  onPermissionRequest: async (operation, args) => {
    console.log(`${operation} requested with args:`, args);
    return true; // or false to deny
  },
}).use(fs());

// Typed inputs and outputs — no string parsing
const { content } = await agent.fs.read("./package.json");
const { entries } = await agent.fs.list("./src", { glob: "*.ts" });
```

## Why bevel?

Agents today shell out and parse strings. That means no type safety, no structured errors, and no way to control what operations are allowed.

bevel gives agents typed functions with structured inputs and outputs:

```ts
// Instead of this:
const output = bash("git status --porcelain");
const files = parseGitStatus(output); // hope the format doesn't change

// Agents do this:
const { staged, unstaged } = await agent.git.status();
```

## Features

- **Typed everything.** Inputs, outputs, errors. The types _are_ the docs.
- **Builder pattern.** `.use()` chains accumulate skills; TypeScript infers the full type at each step.
- **Permissions are first-class.** Every operation has a permission level (`allow`, `ask`, `deny`). Policies are set per-skill or per-operation.
- **Search the registry.** A single `search(query)` lets agents discover operations without loading the full skill set into context.
- **Extensible.** Define custom skills that get types, search, and permissions for free.

## Defining custom skills

```ts
import { defineSkill } from "bevel";

const weather = defineSkill({
  name: "weather",
  description: "Weather forecast operations",
  operations: {
    forecast: {
      description: "Get the forecast for a city",
      signature: "(city: string) => Promise<{ temp: number; sky: string }>",
      defaultPermission: "allow",
      tags: ["weather", "read"],
      handler: async (city: string): Promise<{ temp: number; sky: string }> => {
        // call your weather API here
        return { temp: 72, sky: "sunny" };
      },
    },
  },
});

const agent = createBevel().use(weather);
const { temp, sky } = await agent.weather.forecast("Seattle");
```

## Permissions

Resolution order (first match wins):

1. Exact match in policy — `"git.status": "allow"`
2. Wildcard match — `"git.*": "ask"`
3. Operation's own default — set by the skill author
4. Global default — `defaultPermission` option (defaults to `"ask"`)

```ts
const agent = createBevel({
  permissions: {
    "fs.read": "allow",
    "fs.*": "ask",
    "dangerous.*": "deny",
  },
  defaultPermission: "ask",
  // Called when an operation's resolved permission is "ask".
  // operation: qualified name like "fs.write"
  // args: the arguments passed to the operation, e.g. ["./out.txt", "hello"]
  onPermissionRequest: async (operation, args) => {
    console.log(`${operation} requested with args:`, args);
    return true; // return false to deny
  },
});
```

## Search

Agents can discover operations without knowing what's available upfront:

```ts
const results = agent.search("file read");
// [{
//   qualifiedName: "fs.read",
//   description: "Read a file and return its content as a string",
//   signature: "(path: string) => Promise<{ content: string }>",
//   ...
// }]

// The agent now knows exactly what to call:
const { content } = await agent.fs.read("./package.json");
```

## Packages

| Package | Description |
|---------|-------------|
| [`bevel`](./packages/bevel) | Core library |
| [`@bevel/docs`](./apps/docs) | Documentation site |

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm test        # run all tests
pnpm lint        # biome check
```

## License

MIT © [bgub](https://github.com/bgub)
