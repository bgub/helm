---
title: Search
description: How agents discover operations through search.
---

## Overview

The `search()` method lets agents discover available operations by text query, without needing the full skill set loaded into context. This is the key to keeping context usage minimal.

```ts
const results = agent.search("read file");
```

## Search results

Each result is a `SearchResult` object:

```ts
interface SearchResult {
  skill: string;              // e.g. "fs"
  operation: string;          // e.g. "readFile"
  qualifiedName: string;      // e.g. "fs.readFile"
  description: string;        // operation description
  signature?: string;         // call signature, e.g. "(path: string) => Promise<{ content: string }>"
  tags: string[];             // operation tags
  permission: Permission;     // resolved permission level
}
```

## Scoring

Results are ranked by a score based on where the query matches:

| Match location | Score |
|---------------|-------|
| Exact qualified name | 100 |
| Qualified name contains query | 80 |
| Operation name contains query | 70 |
| Skill name contains query | 60 |
| Description contains query | 40 |
| Tag match | 30 |

Results with a score of 0 (no match) are filtered out.

## Using search results

After discovering operations via search, agents call them directly through the typed namespace:

```ts
const results = agent.search("file read");
// results[0].qualifiedName === "fs.readFile"

const { content } = await agent.fs.readFile("./package.json");
```
