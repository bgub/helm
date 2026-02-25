import * as nodeFs from "node:fs/promises";
import * as nodePath from "node:path";
import { defineSkill } from "../define-skill.ts";

export interface DirEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

export const fs = () =>
  defineSkill({
    name: "fs",
    description:
      "File system operations — read, write, list, mkdir, check, remove",
    operations: {
      read: {
        description: "Read a file and return its content as a string",
        signature: "(path: string) => Promise<{ content: string }>",
        defaultPermission: "allow" as const,
        tags: ["file", "read", "cat", "open", "content", "text", "load"],
        handler: async (path: string): Promise<{ content: string }> => {
          const content = await nodeFs.readFile(path, "utf-8");
          return { content };
        },
      },
      write: {
        description: "Write content to a file, creating it if it doesn't exist",
        signature: "(path: string, content: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["file", "write", "save", "create", "overwrite", "put", "output"],
        handler: async (path: string, content: string): Promise<void> => {
          await nodeFs.writeFile(path, content, "utf-8");
        },
      },
      list: {
        description: "List entries in a directory",
        signature:
          "(path: string, opts?: { glob?: string }) => Promise<{ entries: { name: string; path: string; isFile: boolean; isDirectory: boolean }[] }>",
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
      exists: {
        description: "Check whether a file or directory exists",
        signature: "(path: string) => Promise<boolean>",
        defaultPermission: "allow" as const,
        tags: ["file", "check", "exists", "stat", "test", "find", "access"],
        handler: async (path: string): Promise<boolean> => {
          try {
            await nodeFs.access(path);
            return true;
          } catch {
            return false;
          }
        },
      },
      remove: {
        description: "Remove a file or directory recursively",
        signature: "(path: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["file", "delete", "remove", "rm", "unlink", "destroy", "clean"],
        handler: async (path: string): Promise<void> => {
          await nodeFs.rm(path, { recursive: true });
        },
      },
    },
  });
