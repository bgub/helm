import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBevel } from "../../src/create-bevel.ts";
import { http } from "../../src/skills/http.ts";

describe("http skill", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/text") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("hello text");
      } else if (req.url === "/json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "hello json" }));
      } else if (req.url === "/echo") {
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              method: req.method,
              headers: req.headers,
              body,
            }),
          );
        });
      } else if (req.url === "/status/404") {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
      } else {
        res.writeHead(200);
        res.end("ok");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address();
    if (addr && typeof addr === "object") {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  const agent = () =>
    createBevel({ permissions: { "http.*": "allow" } }).use(http());

  it("fetches text response", async () => {
    const result = await agent().http.fetch(`${baseUrl}/text`);
    expect(result.status).toBe(200);
    expect(result.body).toBe("hello text");
    expect(result.headers["content-type"]).toBe("text/plain");
  });

  it("fetches and parses JSON", async () => {
    const result = await agent().http.json(`${baseUrl}/json`);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: "hello json" });
  });

  it("sends POST with body", async () => {
    const result = await agent().http.json(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });
    expect(result.status).toBe(200);
    expect((result.data as { method: string }).method).toBe("POST");
    expect((result.data as { body: string }).body).toBe('{"key":"value"}');
  });

  it("handles non-200 status codes", async () => {
    const result = await agent().http.fetch(`${baseUrl}/status/404`);
    expect(result.status).toBe(404);
    expect(result.body).toBe("not found");
  });

  it("includes response headers", async () => {
    const result = await agent().http.fetch(`${baseUrl}/json`);
    expect(result.headers["content-type"]).toBe("application/json");
  });

  it("supports timeout option on request", async () => {
    const result = await agent().http.fetch(`${baseUrl}/text`, {
      timeout: 5000,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe("hello text");
  });

  it("supports timeout option on json", async () => {
    const result = await agent().http.json(`${baseUrl}/json`, {
      timeout: 5000,
    });
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: "hello json" });
  });
});
