import { defineSkill } from "../define-skill.ts";

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export interface JsonResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export const http = () =>
  defineSkill({
    name: "http",
    description: "HTTP client for making web requests and fetching data",
    operations: {
      fetch: {
        description: "Make an HTTP request and return the response",
        signature:
          "(url: string, opts?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }) => Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string }>",
        defaultPermission: "ask" as const,
        tags: ["http", "request", "fetch", "web", "api", "url", "get", "post"],
        handler: async (
          url: string,
          opts?: RequestOptions,
        ): Promise<HttpResponse> => {
          const controller = new AbortController();
          const timeoutId = opts?.timeout
            ? setTimeout(() => controller.abort(), opts.timeout)
            : undefined;

          try {
            const response = await fetch(url, {
              method: opts?.method ?? "GET",
              headers: opts?.headers,
              body: opts?.body,
              signal: controller.signal,
            });

            return {
              status: response.status,
              statusText: response.statusText,
              headers: headersToRecord(response.headers),
              body: await response.text(),
            };
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        },
      },
      json: {
        description: "Fetch a URL and parse the response as JSON",
        signature:
          "(url: string, opts?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }) => Promise<{ status: number; statusText: string; headers: Record<string, string>; data: unknown }>",
        defaultPermission: "ask" as const,
        tags: ["http", "json", "api", "fetch", "rest", "data"],
        handler: async (
          url: string,
          opts?: RequestOptions,
        ): Promise<JsonResponse> => {
          const controller = new AbortController();
          const timeoutId = opts?.timeout
            ? setTimeout(() => controller.abort(), opts.timeout)
            : undefined;

          try {
            const response = await fetch(url, {
              method: opts?.method ?? "GET",
              headers: opts?.headers,
              body: opts?.body,
              signal: controller.signal,
            });

            return {
              status: response.status,
              statusText: response.statusText,
              headers: headersToRecord(response.headers),
              data: await response.json(),
            };
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        },
      },
    },
  });
