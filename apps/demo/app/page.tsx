"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import { Streamdown } from "streamdown";

type Permission = "allow" | "ask" | "deny";

interface SkillInfo {
  skill: string;
  operation: string;
  qualifiedName: string;
  description: string;
  signature?: string;
  tags: string[];
  permission: Permission;
}

// ── Icons ──────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatArgs(input: unknown): string {
  if (typeof input !== "object" || input === null) return String(input);
  const entries = Object.entries(input as Record<string, unknown>);
  return entries
    .map(([, v]) =>
      typeof v === "string"
        ? `"${v.length > 40 ? `${v.slice(0, 40)}...` : v}"`
        : JSON.stringify(v),
    )
    .join(", ");
}

function formatCode(input: unknown): string {
  if (typeof input === "object" && input !== null && "code" in input) {
    return (input as { code: string }).code;
  }
  return JSON.stringify(input, null, 2);
}

function HighlightedCode({ code: source }: { code: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(source, {
      lang: "ts",
      theme: "github-light",
      structure: "inline",
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <pre
      style={{
        margin: 0,
        padding: "0.75rem 0.875rem",
        background: "#f8f8f8",
        overflow: "auto",
        fontSize: "0.75rem",
        lineHeight: 1.6,
        fontFamily: MONO,
      }}
    >
      {html ? (
        <code
          // biome-ignore lint: innerHTML is from shiki, not user input
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        source
      )}
    </pre>
  );
}

const PERM_COLORS: Record<Permission, string> = {
  allow: "#10a37f",
  ask: "#f59e0b",
  deny: "#ef4444",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// ── Sub-components ──────────────────────────────────────────────────────

interface PendingApprovalInfo {
  id: string;
  operation: string;
  args: unknown[];
  toolCallId: string;
}

function ApprovalBanner({
  approval,
  onRespond,
}: {
  approval: PendingApprovalInfo;
  onRespond: (id: string, approved: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "0.5rem",
        padding: "0.5rem 0.875rem",
        background: "#fffbeb",
        borderTop: "1px solid #e5e5e5",
      }}
    >
      <button
        type="button"
        onClick={() => onRespond(approval.id, true)}
        style={{
          padding: "2px 10px",
          fontSize: "0.6875rem",
          fontWeight: 600,
          fontFamily: "inherit",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          backgroundColor: PERM_COLORS.allow,
          color: "#fff",
        }}
      >
        Allow
      </button>
      <button
        type="button"
        onClick={() => onRespond(approval.id, false)}
        style={{
          padding: "2px 10px",
          fontSize: "0.6875rem",
          fontWeight: 600,
          fontFamily: "inherit",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          backgroundColor: PERM_COLORS.deny,
          color: "#fff",
        }}
      >
        Deny
      </button>
    </div>
  );
}

function ToolCall({
  name,
  input,
  output,
  state,
  pendingApproval,
  onApprovalResponse,
}: {
  name: string;
  input: unknown;
  output: unknown;
  state: string;
  pendingApproval: PendingApprovalInfo | null;
  onApprovalResponse: (id: string, approved: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const isDone = state === "output-available";
  const isError =
    isDone &&
    typeof output === "object" &&
    output !== null &&
    "error" in output;
  const isWaiting = !isDone && pendingApproval !== null;
  const isExecute =
    name === "execute" &&
    typeof input === "object" &&
    input !== null &&
    "code" in input;

  const chevron = (
    <span
      style={{
        marginLeft: "auto",
        color: "#999",
        fontSize: "0.75rem",
        transition: "transform 0.2s",
        transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
        display: "inline-block",
      }}
    >
      &#x25BE;
    </span>
  );

  const waitingBadge = isWaiting && (
    <span
      style={{ fontSize: "0.6875rem", color: "#92400e", fontWeight: 500 }}
    >
      Awaiting approval
    </span>
  );

  const resultContent = isDone
    ? JSON.stringify(output, null, 2)
    : isWaiting
      ? "Awaiting approval..."
      : state === "input-available"
        ? "Running..."
        : "Calling...";

  return (
    <div
      style={{
        margin: "0.5rem 0",
        border: `1px solid ${isWaiting ? "#fbbf24" : "#e5e5e5"}`,
        borderRadius: 12,
        overflow: "hidden",
        fontSize: "0.8125rem",
      }}
    >
      {/* Header */}
      {isExecute ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 0.875rem",
            color: "#0d0d0d",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isDone
                ? isError
                  ? "#ef4444"
                  : "#10a37f"
                : "#f59e0b",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontFamily: MONO }}>execute</span>
          {waitingBadge}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            width: "100%",
            padding: "0.625rem 0.875rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.8125rem",
            textAlign: "left",
            color: "#0d0d0d",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isDone
                ? isError
                  ? "#ef4444"
                  : "#10a37f"
                : "#f59e0b",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontFamily: MONO }}>
            {isWaiting ? pendingApproval.operation : name}
          </span>
          <span style={{ color: "#666", fontFamily: MONO }}>
            {isWaiting
              ? `(${pendingApproval.args.map((a) => JSON.stringify(a)).join(", ")})`
              : `(${formatArgs(input)})`}
          </span>
          {waitingBadge}
          {chevron}
        </button>
      )}

      {/* Code body (execute only) */}
      {isExecute && (
        <div style={{ borderTop: "1px solid #e5e5e5" }}>
          <HighlightedCode code={formatCode(input)} />
        </div>
      )}

      {/* Approval banner */}
      {isWaiting && (
        <ApprovalBanner
          approval={pendingApproval}
          onRespond={onApprovalResponse}
        />
      )}

      {/* Result toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          padding: "0.5rem 0.875rem",
          background: "transparent",
          border: "none",
          borderTop: "1px solid #e5e5e5",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "0.75rem",
          textAlign: "left",
          color: "#999",
        }}
      >
        <span>Result</span>
        {chevron}
      </button>

      {/* Result content */}
      {!collapsed && (
        <pre
          style={{
            margin: 0,
            padding: "0.75rem 0.875rem",
            background: "#fafafa",
            borderTop: "1px solid #e5e5e5",
            overflow: "auto",
            fontSize: "0.75rem",
            lineHeight: 1.6,
            fontFamily: MONO,
            color: isError ? "#ef4444" : undefined,
          }}
        >
          {resultContent}
        </pre>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "0.25rem 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: "#acacbe",
            animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Permission segmented control ────────────────────────────────────────

function PermissionControl({
  value,
  onChange,
  disabled,
}: {
  value: Permission;
  onChange: (p: Permission) => void;
  disabled?: boolean;
}) {
  const options: Permission[] = ["allow", "ask", "deny"];
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid #e5e5e5",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: "2px 8px",
              fontSize: "0.6875rem",
              fontWeight: 500,
              fontFamily: "inherit",
              border: "none",
              cursor: "pointer",
              backgroundColor: active ? PERM_COLORS[opt] : "#fff",
              color: active ? "#fff" : "#666",
              transition: "all 0.15s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Skill toggle switch ─────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        backgroundColor: checked ? "#10a37f" : "#d9d9e3",
        cursor: "pointer",
        padding: 0,
        transition: "background-color 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

// ── Tools panel ─────────────────────────────────────────────────────────

function ToolsPanel({
  skills,
  permissions,
  onPermissionChange,
  onSkillToggle,
  onClose,
  overlay,
}: {
  skills: SkillInfo[];
  permissions: Record<string, Permission>;
  onPermissionChange: (qualifiedName: string, perm: Permission) => void;
  onSkillToggle: (skill: string, enabled: boolean) => void;
  onClose?: () => void;
  overlay?: boolean;
}) {
  const skillGroups = useMemo(() => {
    const groups = new Map<string, SkillInfo[]>();
    for (const s of skills) {
      const arr = groups.get(s.skill) ?? [];
      arr.push(s);
      groups.set(s.skill, arr);
    }
    return groups;
  }, [skills]);

  return (
    <div
      style={{
        width: overlay ? 300 : 280,
        height: "100dvh",
        borderLeft: overlay ? "none" : "1px solid #e5e5e5",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(overlay
          ? {
              position: "fixed",
              top: 0,
              right: 0,
              zIndex: 1001,
              animation: "slide-in-right 0.2s ease-out",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
            }
          : {}),
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1rem 0.75rem",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Tools</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#666",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Skill list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.5rem 0",
        }}
      >
        {skills.length === 0 && (
          <p
            style={{
              padding: "1rem",
              color: "#999",
              fontSize: "0.8125rem",
              textAlign: "center",
            }}
          >
            Loading skills...
          </p>
        )}

        {[...skillGroups.entries()].map(([skillName, ops]) => {
          const disabled = ops.every(
            (op) => (permissions[op.qualifiedName] ?? op.permission) === "deny",
          );
          return (
            <div key={skillName} style={{ padding: "0.5rem 1rem" }}>
              {/* Skill header + toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    fontFamily: MONO,
                  }}
                >
                  {skillName}
                </span>
                <Toggle
                  checked={!disabled}
                  onChange={(v) => onSkillToggle(skillName, v)}
                />
              </div>

              {/* Operations */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                  opacity: disabled ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {ops.map((op) => (
                  <div
                    key={op.qualifiedName}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontFamily: MONO,
                          color: "#333",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={op.description}
                      >
                        {op.operation}
                      </div>
                    </div>
                    <PermissionControl
                      value={permissions[op.qualifiedName] ?? op.permission}
                      onChange={(p) => onPermissionChange(op.qualifiedName, p)}
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main chat component ─────────────────────────────────────────────────

export default function Chat() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Skills & permissions state
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission>>(
    {},
  );
  const [toolsPanelOpen, setToolsPanelOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [lastRespondedId, setLastRespondedId] = useState<string | null>(null);

  const { messages, sendMessage, status } = useChat();

  const isActive = status === "streaming" || status === "submitted";

  // Derive pending approval from the message stream (no polling needed)
  const pendingApproval = useMemo((): PendingApprovalInfo | null => {
    const lastMsg = messages.at(-1);
    if (!lastMsg || lastMsg.role !== "assistant") return null;
    for (let i = lastMsg.parts.length - 1; i >= 0; i--) {
      const part = lastMsg.parts[i];
      if (part.type === "data-approval-request") {
        const info = (part as { data: PendingApprovalInfo }).data;
        return info.id === lastRespondedId ? null : info;
      }
    }
    return null;
  }, [messages, lastRespondedId]);

  // Fetch skills on mount
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data: SkillInfo[]) => setSkills(data))
      .catch(() => {});
  }, []);

  // Responsive breakpoint
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsWide(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, []);

  const handleSubmit = () => {
    if (input.trim() && !isActive) {
      sendMessage({ text: input }, { body: { permissions } });
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handlePermissionChange = (qualifiedName: string, perm: Permission) => {
    setPermissions((prev) => ({ ...prev, [qualifiedName]: perm }));
  };

  const handleSkillToggle = (skill: string, enabled: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const s of skills) {
        if (s.skill === skill) {
          next[s.qualifiedName] = enabled ? s.permission : "deny";
        }
      }
      return next;
    });
  };

  const handleApprovalResponse = async (id: string, approved: boolean) => {
    setLastRespondedId(id);
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
  };

  const showSidePanel = isWide && skills.length > 0;
  const showOverlayPanel = !isWide && toolsPanelOpen && skills.length > 0;

  // ── Chat area ───────────────────────────────────────────────────────

  const chatArea = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        minWidth: 0,
      }}
    >
      {/* Top bar (narrow only — settings button) */}
      {!isWide && skills.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0.5rem 0.75rem 0",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setToolsPanelOpen(true)}
            style={{
              background: "transparent",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              cursor: "pointer",
              color: "#666",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SettingsIcon />
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 768,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            flex: messages.length === 0 ? 1 : undefined,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 600,
                  color: "#0d0d0d",
                }}
              >
                crag
              </span>
            </div>
          )}

          {messages.map((message, mi) => {
            const isUser = message.role === "user";
            const isLastAssistant = !isUser && mi === messages.length - 1;
            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: isUser ? "75%" : "100%",
                    padding: isUser ? "0.625rem 1rem" : "0",
                    borderRadius: isUser ? 20 : 0,
                    backgroundColor: isUser ? "#f4f4f4" : "transparent",
                    lineHeight: 1.7,
                    fontSize: "0.9375rem",
                  }}
                >
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      if (isUser) {
                        return (
                          <p
                            key={i}
                            style={{
                              whiteSpace: "pre-wrap",
                              margin: i === 0 ? 0 : "0.75rem 0 0",
                              wordBreak: "break-word",
                            }}
                          >
                            {part.text}
                          </p>
                        );
                      }
                      return (
                        <Streamdown
                          key={i}
                          animated
                          isAnimating={isLastAssistant && isActive}
                        >
                          {part.text}
                        </Streamdown>
                      );
                    }
                    if (
                      part.type === "tool-search" ||
                      part.type === "tool-execute"
                    ) {
                      const tcPart = part as { toolCallId?: string };
                      return (
                        <ToolCall
                          key={i}
                          name={part.type.replace("tool-", "")}
                          input={part.input}
                          output={"output" in part ? part.output : null}
                          state={part.state}
                          pendingApproval={
                            pendingApproval?.toolCallId === tcPart.toolCallId
                              ? pendingApproval
                              : null
                          }
                          onApprovalResponse={handleApprovalResponse}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          })}

          {isActive && messages.at(-1)?.role !== "assistant" && (
            <div>
              <ThinkingDots />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "0 1rem 1.5rem",
          flexShrink: 0,
          maxWidth: 768 + 32,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            position: "relative",
            border: "1px solid #d9d9e3",
            borderRadius: 24,
            backgroundColor: "#f4f4f4",
            display: "flex",
            alignItems: "flex-end",
            padding: "0.375rem 0.5rem 0.375rem 0.75rem",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isActive}
            placeholder="Message crag..."
            rows={1}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "0.9375rem",
              lineHeight: 1.5,
              padding: "0.375rem 0.5rem",
              backgroundColor: "transparent",
              fontFamily: "inherit",
              color: "#0d0d0d",
              maxHeight: 200,
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isActive || !input.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              backgroundColor:
                isActive || !input.trim() ? "#d9d9e3" : "#0d0d0d",
              color: isActive || !input.trim() ? "#a1a1aa" : "#fff",
              cursor: isActive || !input.trim() ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background-color 0.15s",
              marginBottom: 2,
            }}
          >
            <SendIcon />
          </button>
        </div>
        <p
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "#9a9a9a",
            margin: "0.75rem 0 0",
          }}
        >
          crag can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );

  // ── Layout ──────────────────────────────────────────────────────────

  return (
    <>
      <div
        style={{
          display: showSidePanel ? "grid" : "flex",
          gridTemplateColumns: showSidePanel ? "1fr 280px" : undefined,
          flexDirection: showSidePanel ? undefined : "column",
          height: "100dvh",
        }}
      >
        {chatArea}
        {showSidePanel && (
          <ToolsPanel
            skills={skills}
            permissions={permissions}
            onPermissionChange={handlePermissionChange}
            onSkillToggle={handleSkillToggle}
          />
        )}
      </div>

      {/* Overlay for narrow viewports */}
      {showOverlayPanel && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setToolsPanelOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setToolsPanelOpen(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              zIndex: 1000,
              animation: "fade-in 0.2s ease-out",
            }}
          />
          <ToolsPanel
            skills={skills}
            permissions={permissions}
            onPermissionChange={handlePermissionChange}
            onSkillToggle={handleSkillToggle}
            onClose={() => setToolsPanelOpen(false)}
            overlay
          />
        </>
      )}
    </>
  );
}
