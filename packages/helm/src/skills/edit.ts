import * as nodeFs from "node:fs/promises";
import { defineSkill } from "../define-skill.ts";

export type EditOp =
  | { type: "insert"; line: number; content: string }
  | { type: "remove"; start: number; end: number }
  | { type: "replace"; start: number; end: number; content: string };

export const edit = () =>
  defineSkill({
    name: "edit",
    description:
      "File editing operations — replace text, insert lines, remove lines, apply batch edits",
    operations: {
      replace: {
        description: "Replace occurrences of a string in a file",
        signature:
          "(path: string, old: string, new_: string, opts?: { all?: boolean }) => Promise<{ count: number }>",
        defaultPermission: "ask" as const,
        tags: ["edit", "replace", "substitute", "find", "change", "sed"],
        handler: async (
          path: string,
          old: string,
          new_: string,
          opts?: { all?: boolean },
        ): Promise<{ count: number }> => {
          const content = await nodeFs.readFile(path, "utf-8");
          let count = 0;
          let result: string;

          if (opts?.all) {
            let current = content;
            while (current.includes(old)) {
              current = current.replace(old, new_);
              count++;
            }
            result = current;
          } else {
            if (content.includes(old)) {
              result = content.replace(old, new_);
              count = 1;
            } else {
              result = content;
            }
          }

          if (count > 0) {
            await nodeFs.writeFile(path, result, "utf-8");
          }
          return { count };
        },
      },
      insert: {
        description: "Insert text at a line number (1-indexed)",
        signature:
          "(path: string, line: number, content: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["edit", "insert", "add", "line", "append"],
        handler: async (
          path: string,
          line: number,
          content: string,
        ): Promise<void> => {
          const file = await nodeFs.readFile(path, "utf-8");
          const lines = file.split("\n");
          const index = Math.max(0, Math.min(line - 1, lines.length));
          lines.splice(index, 0, content);
          await nodeFs.writeFile(path, lines.join("\n"), "utf-8");
        },
      },
      removeLines: {
        description: "Remove lines from start to end inclusive (1-indexed)",
        signature:
          "(path: string, start: number, end: number) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["edit", "remove", "delete", "lines", "cut"],
        handler: async (
          path: string,
          start: number,
          end: number,
        ): Promise<void> => {
          const file = await nodeFs.readFile(path, "utf-8");
          const lines = file.split("\n");
          const s = Math.max(0, start - 1);
          const e = Math.min(lines.length, end);
          lines.splice(s, e - s);
          await nodeFs.writeFile(path, lines.join("\n"), "utf-8");
        },
      },
      apply: {
        description:
          "Apply multiple edits atomically (sorted by line, applied bottom-up to preserve line numbers)",
        signature: "(path: string, edits: EditOp[]) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["edit", "batch", "multi", "atomic", "apply", "patch"],
        handler: async (path: string, edits: EditOp[]): Promise<void> => {
          const file = await nodeFs.readFile(path, "utf-8");
          const lines = file.split("\n");

          // Sort edits by line number descending so bottom-up application preserves indices
          const sorted = [...edits].sort((a, b) => {
            const lineA = a.type === "insert" ? a.line : a.start;
            const lineB = b.type === "insert" ? b.line : b.start;
            return lineB - lineA;
          });

          for (const op of sorted) {
            if (op.type === "insert") {
              const index = Math.max(0, Math.min(op.line - 1, lines.length));
              lines.splice(index, 0, op.content);
            } else if (op.type === "remove") {
              const s = Math.max(0, op.start - 1);
              const e = Math.min(lines.length, op.end);
              lines.splice(s, e - s);
            } else if (op.type === "replace") {
              const s = Math.max(0, op.start - 1);
              const e = Math.min(lines.length, op.end);
              lines.splice(s, e - s, op.content);
            }
          }

          await nodeFs.writeFile(path, lines.join("\n"), "utf-8");
        },
      },
    },
  });
