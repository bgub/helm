import * as nodeFs from "node:fs/promises";
import * as nodePath from "node:path";
import { defineSkill } from "../define-skill.ts";

export interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface StatResult {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  modified: string;
  created: string;
}

export const fs = () =>
  defineSkill({
    name: "fs",
    description:
      "File system operations — readFile, writeFile, readdir, mkdir, stat, rm, rename, cwd",
    operations: {
      readFile: {
        description: "Read a file and return its content as a string",
        signature: "(path: string) => Promise<{ content: string }>",
        defaultPermission: "allow" as const,
        tags: ["file", "read", "cat", "open", "content", "text", "load"],
        handler: async (path: string): Promise<{ content: string }> => {
          const content = await nodeFs.readFile(path, "utf-8");
          return { content };
        },
      },
      writeFile: {
        description: "Write content to a file, creating it if it doesn't exist",
        signature: "(path: string, content: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["file", "write", "save", "create", "overwrite", "put", "output"],
        handler: async (path: string, content: string): Promise<void> => {
          await nodeFs.writeFile(path, content, "utf-8");
        },
      },
      readdir: {
        description: "List entries in a directory",
        signature:
          "(path: string, opts?: { glob?: string }) => Promise<{ entries: DirEntry[] }>",
        defaultPermission: "allow" as const,
        tags: ["directory", "list", "ls", "dir", "entries", "files", "browse"],
        handler: async (
          path: string,
          opts?: { glob?: string },
        ): Promise<{ entries: DirEntry[] }> => {
          const dirents = await nodeFs.readdir(path, { withFileTypes: true });
          let entries: DirEntry[] = dirents.map((d) => ({
            name: d.name,
            path: nodePath.join(path, d.name),
            isFile: d.isFile(),
            isDirectory: d.isDirectory(),
          }));

          if (opts?.glob) {
            const pattern = new RegExp(
              `^${opts.glob.replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
            );
            entries = entries.filter((e) => pattern.test(e.name));
          }

          return { entries };
        },
      },
      mkdir: {
        description: "Create a directory, including any parent directories",
        signature: "(path: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: [
          "directory",
          "create",
          "mkdir",
          "folder",
          "make",
          "new",
          "mkdirp",
        ],
        handler: async (path: string): Promise<void> => {
          await nodeFs.mkdir(path, { recursive: true });
        },
      },
      stat: {
        description: "Get file or directory metadata — size, type, timestamps",
        signature: "(path: string) => Promise<StatResult>",
        defaultPermission: "allow" as const,
        tags: ["file", "stat", "info", "metadata", "size", "exists", "check"],
        handler: async (path: string): Promise<StatResult> => {
          const s = await nodeFs.stat(path);
          return {
            size: s.size,
            isFile: s.isFile(),
            isDirectory: s.isDirectory(),
            modified: s.mtime.toISOString(),
            created: s.birthtime.toISOString(),
          };
        },
      },
      rm: {
        description: "Remove a file or directory recursively",
        signature: "(path: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["file", "delete", "remove", "rm", "unlink", "destroy", "clean"],
        handler: async (path: string): Promise<void> => {
          await nodeFs.rm(path, { recursive: true });
        },
      },
      rename: {
        description: "Rename or move a file or directory",
        signature: "(oldPath: string, newPath: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["file", "rename", "move", "mv"],
        handler: async (oldPath: string, newPath: string): Promise<void> => {
          await nodeFs.rename(oldPath, newPath);
        },
      },
      cwd: {
        description: "Get the current working directory",
        signature: "() => Promise<string>",
        defaultPermission: "allow" as const,
        tags: ["directory", "cwd", "pwd", "path", "current"],
        handler: async (): Promise<string> => {
          return process.cwd();
        },
      },
    },
  });
