---
title: "http"
description: Built-in HTTP client skill reference.
---

The `http` skill provides an HTTP client using Node's built-in `fetch`. No external dependencies. Import it from `helm` and register it with `.use()`:

```ts
import { createHelm, http } from "@bgub/helm";

const agent = createHelm().use(http());
```

## Operations

### `http.fetch`

Make an HTTP request and return the response.

```ts
const { status, body } = await agent.http.fetch("https://example.com");
const { body: html } = await agent.http.fetch("https://api.example.com/data", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: "value" }),
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Request URL |
| `opts` | `RequestOptions` | Optional request configuration |

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `method` | `string` | HTTP method (default `"GET"`) |
| `headers` | `Record<string, string>` | Request headers |
| `body` | `string` | Request body |
| `timeout` | `number` | Timeout in milliseconds |

**Returns:** `Promise<HttpResponse>`

```ts
interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}
```

**Default permission:** `"ask"`
**Tags:** `http`, `request`, `fetch`, `web`, `api`, `url`, `get`, `post`

### `http.json`

Fetch a URL and parse the response as JSON.

```ts
const { data, status } = await agent.http.json("https://api.example.com/users");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Request URL |
| `opts` | `RequestOptions` | Optional request configuration (same as `fetch`) |

**Returns:** `Promise<JsonResponse>`

```ts
interface JsonResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}
```

**Default permission:** `"ask"`
**Tags:** `http`, `json`, `api`, `fetch`, `rest`, `data`
