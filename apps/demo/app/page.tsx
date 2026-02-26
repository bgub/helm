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
      aria-hidden="true"
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
      aria-hidden="true"
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
      aria-hidden="true"
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
    <pre className="m-0 px-3.5 py-3 bg-[#f8f8f8] overflow-auto text-xs leading-[1.6] font-mono">
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
    <div className="flex items-center justify-end gap-2 px-3.5 py-2 bg-amber-50 border-t border-neutral-200">
      <button
        type="button"
        onClick={() => onRespond(approval.id, true)}
        className="px-2.5 py-0.5 text-[0.6875rem] font-semibold rounded cursor-pointer bg-permit text-white"
      >
        Allow
      </button>
      <button
        type="button"
        onClick={() => onRespond(approval.id, false)}
        className="px-2.5 py-0.5 text-[0.6875rem] font-semibold rounded cursor-pointer bg-danger text-white"
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

  const dotColor = isDone ? (isError ? "bg-danger" : "bg-permit") : "bg-warn";

  const chevron = (
    <span
      className={`ml-auto text-[#999] text-xs transition-transform duration-200 inline-block ${
        collapsed ? "" : "rotate-180"
      }`}
    >
      &#x25BE;
    </span>
  );

  const waitingBadge = isWaiting && (
    <span className="text-[0.6875rem] text-amber-800 font-medium">
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
      className={`my-2 border rounded-xl overflow-hidden text-[0.8125rem] ${
        isWaiting ? "border-amber-400" : "border-neutral-200"
      }`}
    >
      {/* Header */}
      {isExecute ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 text-[#0d0d0d]">
          <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="font-semibold font-mono">execute</span>
          {waitingBadge}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full px-3.5 py-2.5 cursor-pointer text-[0.8125rem] text-left text-[#0d0d0d]"
        >
          <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="font-semibold font-mono">
            {isWaiting ? pendingApproval.operation : name}
          </span>
          <span className="text-[#666] font-mono">
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
        <div className="border-t border-neutral-200">
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
        className="flex items-center gap-2 w-full px-3.5 py-2 border-t border-neutral-200 cursor-pointer text-xs text-left text-[#999]"
      >
        <span>Result</span>
        {chevron}
      </button>

      {/* Result content */}
      {!collapsed && (
        <pre
          className={`m-0 px-3.5 py-3 bg-[#fafafa] border-t border-neutral-200 overflow-auto text-xs leading-[1.6] font-mono ${
            isError ? "text-danger" : ""
          }`}
        >
          {resultContent}
        </pre>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-[7px] rounded-full bg-[#acacbe] animate-[pulse-dot_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.2}s` }}
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
      className={`inline-flex rounded-md overflow-hidden border border-neutral-200 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2 py-0.5 text-[0.6875rem] font-medium cursor-pointer transition-all duration-150 ${
              active
                ? `text-white ${opt === "allow" ? "bg-permit" : opt === "ask" ? "bg-warn" : "bg-danger"}`
                : "bg-white text-[#666]"
            }`}
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
      className={`relative w-9 h-5 rounded-[10px] cursor-pointer p-0 transition-colors duration-200 shrink-0 ${
        checked ? "bg-permit" : "bg-[#d9d9e3]"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
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
      className={`h-dvh bg-white flex flex-col overflow-hidden ${
        overlay
          ? "w-[300px] fixed top-0 right-0 z-[1001] animate-[slide-in-right_0.2s_ease-out] shadow-[-4px_0_20px_rgba(0,0,0,0.1)]"
          : "w-[280px] border-l border-neutral-200"
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-neutral-200 flex items-center justify-between shrink-0">
        <span className="font-semibold text-[0.9375rem]">Tools</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[#666] p-1 flex items-center justify-center rounded-md"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Skill list */}
      <div className="flex-1 overflow-y-auto py-2">
        {skills.length === 0 && (
          <p className="p-4 text-[#999] text-[0.8125rem] text-center">
            Loading skills...
          </p>
        )}

        {[...skillGroups.entries()].map(([skillName, ops]) => {
          const disabled = ops.every(
            (op) => (permissions[op.qualifiedName] ?? op.permission) === "deny",
          );
          return (
            <div key={skillName} className="px-4 py-2">
              {/* Skill header + toggle */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-[0.8125rem] font-mono">
                  {skillName}
                </span>
                <Toggle
                  checked={!disabled}
                  onChange={(v) => onSkillToggle(skillName, v)}
                />
              </div>

              {/* Operations */}
              <div
                className={`flex flex-col gap-1.5 transition-opacity duration-200 ${
                  disabled ? "opacity-40" : ""
                }`}
              >
                {ops.map((op) => (
                  <div
                    key={op.qualifiedName}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div
                        className="text-xs font-mono text-[#333] truncate"
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

  // Auto-scroll on new messages / new parts
  const lastMessage = messages[messages.length - 1];
  const scrollTrigger = lastMessage
    ? `${lastMessage.id}-${lastMessage.parts.length}`
    : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollTrigger is intentionally derived to trigger scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [scrollTrigger]);

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
  const sendDisabled = isActive || !input.trim();

  // ── Chat area ───────────────────────────────────────────────────────

  const chatArea = (
    <div className="flex flex-col h-dvh min-w-0">
      {/* Top bar (narrow only — settings button) */}
      {!isWide && skills.length > 0 && (
        <div className="flex justify-end px-3 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setToolsPanelOpen(true)}
            className="border border-neutral-200 rounded-lg cursor-pointer text-[#666] px-2 py-1.5 flex items-center justify-center"
          >
            <SettingsIcon />
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6"
      >
        <div
          className={`max-w-3xl w-full mx-auto flex flex-col gap-6 ${
            messages.length === 0 ? "flex-1" : ""
          }`}
        >
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[1.375rem] font-semibold text-[#0d0d0d]">
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
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`leading-[1.7] text-[0.9375rem] ${
                    isUser
                      ? "max-w-[75%] px-4 py-2.5 rounded-[20px] bg-[#f4f4f4]"
                      : "w-full"
                  }`}
                >
                  {message.parts.map((part, i) => {
                    const key = `${message.id}-${i}`;
                    if (part.type === "text") {
                      if (isUser) {
                        return (
                          <p
                            key={key}
                            className={`whitespace-pre-wrap break-words ${
                              i === 0 ? "" : "mt-3"
                            }`}
                          >
                            {part.text}
                          </p>
                        );
                      }
                      return (
                        <Streamdown
                          key={key}
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
                          key={key}
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
      <div className="px-4 pb-6 shrink-0 max-w-[800px] w-full mx-auto">
        <div className="relative border border-[#d9d9e3] rounded-3xl bg-[#f4f4f4] flex items-end py-1.5 pr-2 pl-3">
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
            placeholder="Message crag..."
            rows={1}
            className="flex-1 border-none outline-none resize-none text-[0.9375rem] leading-normal px-2 py-1.5 bg-transparent text-[#0d0d0d] max-h-[200px]"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sendDisabled}
            className={`size-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 mb-0.5 ${
              sendDisabled
                ? "bg-[#d9d9e3] text-[#a1a1aa] cursor-default"
                : "bg-[#0d0d0d] text-white cursor-pointer"
            }`}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center text-xs text-[#9a9a9a] mt-3">
          crag can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );

  // ── Layout ──────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={`h-dvh ${
          showSidePanel ? "grid grid-cols-[1fr_280px]" : "flex flex-col"
        }`}
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
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern */}
          <div
            onClick={() => setToolsPanelOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setToolsPanelOpen(false);
            }}
            className="fixed inset-0 bg-black/30 z-[1000] animate-[fade-in_0.2s_ease-out]"
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
