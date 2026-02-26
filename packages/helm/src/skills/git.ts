import * as childProcess from "node:child_process";
import { defineSkill } from "../define-skill.ts";

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  oldPath?: string;
}

export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface Commit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface Branch {
  name: string;
  current: boolean;
}

function run(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.execFile("git", args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            `git ${args[0]} failed: ${stderr.toString().trim() || error.message}`,
          ),
        );
        return;
      }
      resolve(stdout.toString());
    });
  });
}

const STATUS_MAP: Record<string, FileChange["status"]> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
};

function parseStatusCode(code: string): FileChange["status"] {
  return STATUS_MAP[code] ?? "modified";
}

function parseStatus(output: string): GitStatus {
  const result: GitStatus = {
    branch: "",
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
  };

  for (const line of output.split("\n")) {
    if (!line) continue;

    if (line.startsWith("# branch.head ")) {
      result.branch = line.slice("# branch.head ".length);
    } else if (line.startsWith("# branch.upstream ")) {
      result.upstream = line.slice("# branch.upstream ".length);
    } else if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+) -(\d+)/);
      if (match) {
        result.ahead = Number.parseInt(match[1], 10);
        result.behind = Number.parseInt(match[2], 10);
      }
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      // Ordinary (1) or rename/copy (2) entry
      const parts = line.split(" ");
      const xy = parts[1]; // two-char status: XY
      const stagedCode = xy[0];
      const unstagedCode = xy[1];

      if (line.startsWith("2 ")) {
        // Rename/copy: last field has "oldPath\tnewPath"
        const tabIndex = line.indexOf("\t");
        const paths = line.slice(tabIndex + 1).split("\t");
        const oldPath = paths[0];
        const newPath = paths[1] ?? paths[0];

        if (stagedCode !== ".") {
          result.staged.push({
            path: newPath,
            status: parseStatusCode(stagedCode),
            oldPath,
          });
        }
        if (unstagedCode !== ".") {
          result.unstaged.push({
            path: newPath,
            status: parseStatusCode(unstagedCode),
            oldPath,
          });
        }
      } else {
        // Ordinary entry: path is the last space-separated field
        const path = parts.slice(8).join(" ");

        if (stagedCode !== ".") {
          result.staged.push({ path, status: parseStatusCode(stagedCode) });
        }
        if (unstagedCode !== ".") {
          result.unstaged.push({ path, status: parseStatusCode(unstagedCode) });
        }
      }
    } else if (line.startsWith("? ")) {
      result.untracked.push(line.slice(2));
    }
  }

  return result;
}

function parseDiff(output: string): DiffFile[] {
  const files: DiffFile[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length >= 3) {
      files.push({
        additions: parts[0] === "-" ? 0 : Number.parseInt(parts[0], 10),
        deletions: parts[1] === "-" ? 0 : Number.parseInt(parts[1], 10),
        path: parts[2],
      });
    }
  }
  return files;
}

function parseLog(output: string): Commit[] {
  const commits: Commit[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const parts = line.split("\x00");
    if (parts.length >= 6) {
      commits.push({
        hash: parts[0],
        shortHash: parts[1],
        author: parts[2],
        email: parts[3],
        date: parts[4],
        message: parts[5],
      });
    }
  }
  return commits;
}

export const git = (opts?: { cwd?: string }) =>
  defineSkill({
    name: "git",
    description:
      "Git operations — status, diff, log, show, add, commit, branches, checkout",
    operations: {
      status: {
        description: "Get repository status with branch info and file changes",
        signature: "() => Promise<GitStatus>",
        defaultPermission: "allow" as const,
        tags: ["git", "status", "changes", "staged", "unstaged", "branch"],
        handler: async (): Promise<GitStatus> => {
          const output = await run(
            ["status", "--porcelain=v2", "--branch"],
            opts?.cwd,
          );
          return parseStatus(output);
        },
      },
      diff: {
        description: "Show file changes with additions/deletions counts",
        signature:
          "(opts?: { staged?: boolean; ref?: string }) => Promise<{ files: DiffFile[] }>",
        defaultPermission: "allow" as const,
        tags: ["git", "diff", "changes", "delta", "compare"],
        handler: async (diffOpts?: {
          staged?: boolean;
          ref?: string;
        }): Promise<{ files: DiffFile[] }> => {
          const args = ["diff", "--numstat"];
          if (diffOpts?.staged) args.push("--cached");
          if (diffOpts?.ref) args.push(diffOpts.ref);
          const output = await run(args, opts?.cwd);
          return { files: parseDiff(output) };
        },
      },
      log: {
        description: "Show commit history",
        signature:
          "(opts?: { limit?: number; ref?: string }) => Promise<{ commits: Commit[] }>",
        defaultPermission: "allow" as const,
        tags: ["git", "log", "history", "commits", "recent"],
        handler: async (logOpts?: {
          limit?: number;
          ref?: string;
        }): Promise<{ commits: Commit[] }> => {
          const limit = logOpts?.limit ?? 10;
          const args = [
            "log",
            `--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s`,
            `-n${limit}`,
          ];
          if (logOpts?.ref) args.push(logOpts.ref);
          const output = await run(args, opts?.cwd);
          return { commits: parseLog(output) };
        },
      },
      show: {
        description: "Show content of a commit or file at a ref",
        signature:
          "(ref: string, opts?: { path?: string }) => Promise<{ content: string }>",
        defaultPermission: "allow" as const,
        tags: ["git", "show", "content", "ref", "commit", "file", "blob"],
        handler: async (
          ref: string,
          showOpts?: { path?: string },
        ): Promise<{ content: string }> => {
          const target = showOpts?.path ? `${ref}:${showOpts.path}` : ref;
          const content = await run(["show", target], opts?.cwd);
          return { content };
        },
      },
      add: {
        description: "Stage files for commit",
        signature: "(paths: string[]) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["git", "add", "stage", "track"],
        handler: async (paths: string[]): Promise<void> => {
          await run(["add", "--", ...paths], opts?.cwd);
        },
      },
      commit: {
        description: "Create a commit with the given message",
        signature: "(message: string) => Promise<{ hash: string }>",
        defaultPermission: "ask" as const,
        tags: ["git", "commit", "save", "snapshot"],
        handler: async (message: string): Promise<{ hash: string }> => {
          const output = await run(["commit", "-m", message], opts?.cwd);
          const match = output.match(/\[[\w/.-]+ ([a-f0-9]+)\]/);
          const hash = match ? match[1] : "";
          return { hash };
        },
      },
      branchList: {
        description: "List branches",
        signature: "() => Promise<{ branches: Branch[]; current: string }>",
        defaultPermission: "allow" as const,
        tags: ["git", "branch", "list", "branches"],
        handler: async (): Promise<{
          branches: Branch[];
          current: string;
        }> => {
          const output = await run(
            ["branch", "--list", "--format=%(HEAD)%(refname:short)"],
            opts?.cwd,
          );
          const branches: Branch[] = [];
          let current = "";
          for (const line of output.split("\n")) {
            if (!line) continue;
            const isCurrent = line.startsWith("*");
            const name = isCurrent ? line.slice(1) : line.slice(1);
            branches.push({ name, current: isCurrent });
            if (isCurrent) current = name;
          }
          return { branches, current };
        },
      },
      branchCreate: {
        description: "Create a new branch",
        signature:
          "(name: string, opts?: { startPoint?: string }) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["git", "branch", "create", "new"],
        handler: async (
          name: string,
          branchOpts?: { startPoint?: string },
        ): Promise<void> => {
          const args = ["branch", name];
          if (branchOpts?.startPoint) args.push(branchOpts.startPoint);
          await run(args, opts?.cwd);
        },
      },
      checkout: {
        description: "Switch branches or restore working tree files",
        signature: "(ref: string) => Promise<void>",
        defaultPermission: "ask" as const,
        tags: ["git", "checkout", "switch", "branch", "restore"],
        handler: async (ref: string): Promise<void> => {
          await run(["checkout", ref], opts?.cwd);
        },
      },
    },
  });
