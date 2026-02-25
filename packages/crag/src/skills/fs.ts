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
    description: "File system operations — read, write, list, check, remove",
    operations: {
      read: {
        description: "Read a file and return its content as a string",
        defaultPermission: "allow" as const,
        tags: ["file", "read"],
        handler: async (path: string): Promise<{ content: string }> => {
          const content = await nodeFs.readFile(path, "utf-8");
          return { content };
        },
      },
      write: {
        description: "Write content to a file",
        defaultPermission: "ask" as const,
        tags: ["file", "write"],
        handler: async (path: string, content: string): Promise<void> => {
          await nodeFs.writeFile(path, content, "utf-8");
        },
      },
      list: {
        description: "List entries in a directory",
        defaultPermission: "allow" as const,
        tags: ["directory", "list"],
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
      exists: {
        description: "Check whether a file or directory exists",
        defaultPermission: "allow" as const,
        tags: ["file", "check"],
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
        description: "Remove a file or directory",
        defaultPermission: "ask" as const,
        tags: ["file", "delete"],
        handler: async (path: string): Promise<void> => {
          await nodeFs.rm(path, { recursive: true });
        },
      },
    },
  });
