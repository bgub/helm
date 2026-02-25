"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

function ToolCall({
  name,
  input,
  output,
  state,
}: {
  name: string;
  input: unknown;
  output: unknown;
  state: string;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const isDone = state === "output-available";
  const isError =
    isDone && typeof output === "object" && output !== null && "error" in output;

  return (
    <div
      style={{
        margin: "0.25rem 0",
        border: "1px solid #e2e2e2",
        borderRadius: 8,
        overflow: "hidden",
        fontSize: "0.8125rem",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          padding: "0.5rem 0.75rem",
          background: isDone ? (isError ? "#fef2f2" : "#f0fdf4") : "#fffbeb",
          border: "none",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "0.8125rem",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isDone ? (isError ? "#ef4444" : "#22c55e") : "#eab308",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ color: "#666" }}>
          ({formatArgs(input)})
        </span>
        <span style={{ marginLeft: "auto", color: "#999", fontSize: "0.75rem" }}>
          {collapsed ? "+" : "\u2212"}
        </span>
      </button>
      {!collapsed && (
        <pre
          style={{
            margin: 0,
            padding: "0.5rem 0.75rem",
            background: "#fafafa",
            borderTop: "1px solid #e2e2e2",
            overflow: "auto",
            fontSize: "0.75rem",
            lineHeight: 1.5,
          }}
        >
          {isDone
            ? JSON.stringify(output, null, 2)
            : state === "input-available"
              ? "Running..."
              : "Calling..."}
        </pre>
      )}
    </div>
  );
}

function formatArgs(input: unknown): string {
  if (typeof input !== "object" || input === null) return String(input);
  const entries = Object.entries(input as Record<string, unknown>);
  return entries
    .map(([, v]) =>
      typeof v === "string"
        ? `"${v.length > 40 ? v.slice(0, 40) + "..." : v}"`
        : JSON.stringify(v),
    )
    .join(", ");
}

export default function Chat() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isActive = status === "streaming" || status === "submitted";

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#666",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "1.5rem",
        }}
      >
        crag demo
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              padding: "0.75rem",
              borderRadius: 8,
              background: message.role === "user" ? "#f5f5f5" : "transparent",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.375rem",
              }}
            >
              {message.role === "user" ? "You" : "Assistant"}
            </div>
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p
                    key={i}
                    style={{
                      whiteSpace: "pre-wrap",
                      margin: "0.125rem 0",
                      lineHeight: 1.6,
                    }}
                  >
                    {part.text}
                  </p>
                );
              }
              if (
                part.type === "tool-search" ||
                part.type === "tool-execute"
              ) {
                return (
                  <ToolCall
                    key={i}
                    name={part.type.replace("tool-", "")}
                    input={part.input}
                    output={"output" in part ? part.output : null}
                    state={part.state}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}
        {isActive && messages.at(-1)?.role !== "assistant" && (
          <div style={{ padding: "0.75rem", color: "#999" }}>Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "1rem",
          position: "sticky",
          bottom: "1rem",
          background: "white",
          padding: "0.5rem 0",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isActive}
          placeholder="Ask something..."
          style={{
            flex: 1,
            padding: "0.625rem 0.75rem",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: "0.9375rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isActive || !input.trim()}
          style={{
            padding: "0.625rem 1rem",
            borderRadius: 8,
            border: "none",
            background: isActive || !input.trim() ? "#e5e5e5" : "#111",
            color: isActive || !input.trim() ? "#999" : "white",
            fontWeight: 500,
            cursor: isActive || !input.trim() ? "default" : "pointer",
            fontSize: "0.9375rem",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
