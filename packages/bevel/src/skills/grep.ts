import * as nodeFs from "node:fs/promises";
import * as nodePath from "node:path";
import { defineSkill } from "../define-skill.ts";

export interface GrepOptions {
  path?: string;
  glob?: string;
  maxResults?: number;
  contextLines?: number;
  ignoreCase?: boolean;
}

export interface GrepMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  context?: { before: string[]; after: string[] };
}

const DEFAULT_SKIP = new Set(["node_modules", ".git"]);

function matchesGlob(name: string, glob: string): boolean {
  const pattern = new RegExp(
    `^${glob.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
  );
  return pattern.test(name);
}

function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function isIgnored(relativePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const clean = pattern.replace(/\/$/, "");
    const regex = new RegExp(
      `^${clean.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
    );
    const parts = relativePath.split(nodePath.sep);
    for (const part of parts) {
      if (regex.test(part)) return true;
    }
  }
  return false;
}

async function isBinary(filePath: string): Promise<boolean> {
  const handle = await nodeFs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buf, 0, 512, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } finally {
    await handle.close();
  }
}

async function collectFiles(
  dir: string,
  baseDir: string,
  gitignorePatterns: string[],
  glob: string | undefined,
): Promise<string[]> {
  const files: string[] = [];
  let entries: Awaited<ReturnType<typeof nodeFs.readdir>>;
  try {
    entries = await nodeFs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (DEFAULT_SKIP.has(entry.name)) continue;

    const fullPath = nodePath.join(dir, entry.name);
    const relative = nodePath.relative(baseDir, fullPath);

    if (isIgnored(relative, gitignorePatterns)) continue;

    if (entry.isDirectory()) {
      files.push(
        ...(await collectFiles(fullPath, baseDir, gitignorePatterns, glob)),
      );
    } else if (entry.isFile()) {
      if (glob && !matchesGlob(entry.name, glob)) continue;
      files.push(fullPath);
    }
  }
  return files;
}

export const grep = (opts?: { cwd?: string }) =>
  defineSkill({
    name: "grep",
    description: "Recursive file content search with regex pattern matching",
    operations: {
      search: {
        description: "Search files recursively for a regex pattern",
        signature:
          "(pattern: string, opts?: { path?: string; glob?: string; maxResults?: number; contextLines?: number; ignoreCase?: boolean }) => Promise<{ matches: GrepMatch[] }>",
        defaultPermission: "allow" as const,
        tags: [
          "search",
          "grep",
          "find",
          "regex",
          "pattern",
          "content",
          "text",
          "rg",
        ],
        handler: async (
          pattern: string,
          searchOpts?: GrepOptions,
        ): Promise<{ matches: GrepMatch[] }> => {
          const searchDir = searchOpts?.path ?? opts?.cwd ?? process.cwd();
          const maxResults = searchOpts?.maxResults ?? 100;
          const contextLines = searchOpts?.contextLines ?? 0;
          const flags = searchOpts?.ignoreCase ? "i" : "";
          const regex = new RegExp(pattern, flags);

          // Load .gitignore if present
          let gitignorePatterns: string[] = [];
          try {
            const gitignoreContent = await nodeFs.readFile(
              nodePath.join(searchDir, ".gitignore"),
              "utf-8",
            );
            gitignorePatterns = parseGitignore(gitignoreContent);
          } catch {
            // No .gitignore, continue
          }

          const files = await collectFiles(
            searchDir,
            searchDir,
            gitignorePatterns,
            searchOpts?.glob,
          );
          const matches: GrepMatch[] = [];

          for (const filePath of files) {
            if (matches.length >= maxResults) break;

            if (await isBinary(filePath)) continue;

            let content: string;
            try {
              content = await nodeFs.readFile(filePath, "utf-8");
            } catch {
              continue;
            }

            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (matches.length >= maxResults) break;

              const match = regex.exec(lines[i]);
              if (match) {
                const entry: GrepMatch = {
                  file: filePath,
                  line: i + 1,
                  column: match.index + 1,
                  text: lines[i],
                };

                if (contextLines > 0) {
                  const beforeStart = Math.max(0, i - contextLines);
                  const afterEnd = Math.min(lines.length - 1, i + contextLines);
                  entry.context = {
                    before: lines.slice(beforeStart, i),
                    after: lines.slice(i + 1, afterEnd + 1),
                  };
                }

                matches.push(entry);
              }
            }
          }

          return { matches };
        },
      },
    },
  });
