---
title: Custom Skills
description: How to define your own skills with full type inference.
---

## defineSkill

Use `defineSkill` to create a skill with fully inferred types:

```ts
import { defineSkill } from "@bgub/helm";

const weather = defineSkill({
  name: "weather",
  description: "Weather forecast operations",
  operations: {
    forecast: {
      description: "Get the forecast for a city",
      defaultPermission: "allow",
      tags: ["weather", "read"],
      handler: async (city: string): Promise<{ temp: number; sky: string }> => {
        // call your weather API here
        return { temp: 72, sky: "sunny" };
      },
    },
  },
});
```

The return type of `defineSkill` preserves the skill name, operation names, and handler signatures. When registered with `.use()`, TypeScript knows the exact shape:

```ts
const agent = createHelm().use(weather);

// Fully typed — city: string, returns { temp: number; sky: string }
const { temp, sky } = await agent.weather.forecast("Seattle");
```

## Operation definition

Each operation in the `operations` map has the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Human-readable description, used for search |
| `handler` | `(...args) => any` | Yes | The function that runs when the operation is called |
| `signature` | `string` | No | Call signature shown in search results, e.g. `"(path: string) => Promise<void>"` |
| `defaultPermission` | `"allow" \| "ask" \| "deny"` | No | Default permission level (falls back to global default) |
| `tags` | `string[]` | No | Additional keywords for search discovery |

## Multiple operations

A skill can have any number of operations:

```ts
const db = defineSkill({
  name: "db",
  description: "Database operations",
  operations: {
    query: {
      description: "Run a read-only SQL query",
      defaultPermission: "allow",
      tags: ["database", "read"],
      handler: async (sql: string) => {
        /* ... */
      },
    },
    execute: {
      description: "Run a write SQL statement",
      defaultPermission: "ask",
      tags: ["database", "write"],
      handler: async (sql: string) => {
        /* ... */
      },
    },
  },
});
```

## Registering custom skills

Custom skills are registered the same way as built-in skills:

```ts
const agent = createHelm({
  permissions: {
    "weather.forecast": "allow",
    "db.query": "allow",
    "db.execute": "ask",
  },
})
  .use(weather)
  .use(db);
```

They get types, search, and permissions for free.
