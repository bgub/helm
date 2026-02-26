---
title: Core Concepts
description: Skills, operations, the builder pattern, and the search+call flow.
---

## Skills

A **skill** is a named group of related operations. For example, the built-in `fs` skill groups file system operations like `readFile`, `writeFile`, `readdir`, `stat`, and `rm`.

Each skill has:
- A unique **name** (e.g. `"fs"`)
- A **description** for search and discovery
- A map of **operations**

## Operations

An **operation** is a single typed function within a skill. Each operation has:
- A **description** — used for search ranking
- **Tags** — additional keywords for search
- A **default permission** — `"allow"`, `"ask"`, or `"deny"`
- A **handler** — the actual function that runs

Operations are called through their skill namespace:

```ts
await agent.fs.readFile("./file.txt");
//         ^^ skill
//            ^^^^^^^^ operation
```

## Builder pattern

`createHelm()` returns a builder. Each `.use()` call registers a skill and returns a new instance with the skill's types merged in:

```ts
const agent = createHelm()
  .use(fs())       // agent now has agent.fs.*
  .use(git())      // agent now has agent.fs.* + agent.git.*
  .use(grep())     // agent now has agent.fs.* + agent.git.* + agent.grep.*
```

TypeScript infers the full type at each step — no codegen, no `Proxy`.

## Qualified names

Every operation has a **qualified name** in the form `skill.operation`:

- `fs.readFile`
- `fs.writeFile`
- `git.status`
- `grep.search`

Qualified names are used for permissions, search results, and dynamic calling.

## Search + call

The `search()` method lets agents discover operations by query:

```ts
const results = agent.search("read file");
```

Results are ranked by relevance (exact name match > partial name > description > tags) and include the qualified name, description, tags, and resolved permission level.

After discovering the right operation, agents call it directly through the typed namespace:

```ts
const results = agent.search("read file");
// results[0].qualifiedName === "fs.readFile"

const { content } = await agent.fs.readFile("./package.json");
```
