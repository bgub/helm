---
title: Permissions
description: How helm resolves and enforces operation permissions.
---

## Permission levels

Every operation resolves to one of three permission levels:

| Level | Behavior |
|-------|----------|
| `"allow"` | Operation runs immediately |
| `"ask"` | `onPermissionRequest` callback is invoked; operation runs only if it returns `true` |
| `"deny"` | Operation throws `PermissionDeniedError` |

## Resolution order

Permissions are resolved using a first-match strategy:

1. **Exact match** in the policy — `"fs.readFile": "allow"`
2. **Wildcard match** — `"fs.*": "ask"`
3. **Operation default** — set by the skill author via `defaultPermission`
4. **Global default** — the `defaultPermission` option passed to `createHelm()` (defaults to `"ask"`)

```ts
const agent = createHelm({
  permissions: {
    "fs.readFile": "allow",  // exact match
    "fs.*": "ask",           // wildcard
    "shell.*": "deny",       // wildcard deny
  },
  defaultPermission: "ask",  // global fallback
});
```

## Permission callback

When an operation resolves to `"ask"`, the `onPermissionRequest` callback is called with the qualified name and the arguments:

```ts
const agent = createHelm({
  onPermissionRequest: async (operation, args) => {
    console.log(`${operation} requested with args:`, args);
    return true; // return false to deny
  },
});
```

If no callback is provided and an operation resolves to `"ask"`, a `PermissionDeniedError` is thrown.

## Error handling

When an operation is denied (either by policy or by the callback), a `PermissionDeniedError` is thrown:

```ts
import { PermissionDeniedError } from "@bgub/helm";

try {
  await agent.fs.rm("./important-file.txt");
} catch (err) {
  if (err instanceof PermissionDeniedError) {
    console.log("Operation was denied:", err.message);
  }
}
```
