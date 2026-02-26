import * as childProcess from "node:child_process";
import { defineSkill } from "../define-skill.ts";

export interface ShellExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdin?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const shell = (opts?: {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}) =>
  defineSkill({
    name: "shell",
    description: "Run shell commands and return structured output",
    operations: {
      dangerousExec: {
        description: "Run a shell command",
        signature:
          "(command: string, opts?: { cwd?: string; env?: Record<string, string>; timeout?: number; stdin?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>",
        defaultPermission: "ask" as const,
        tags: ["shell", "exec", "run", "command", "bash", "process"],
        handler: async (
          command: string,
          execOpts?: ShellExecOptions,
        ): Promise<ExecResult> => {
          const cwd = execOpts?.cwd ?? opts?.cwd;
          const env = execOpts?.env
            ? { ...process.env, ...opts?.env, ...execOpts.env }
            : opts?.env
              ? { ...process.env, ...opts.env }
              : undefined;
          const timeout = execOpts?.timeout ?? opts?.timeout;

          return new Promise((resolve) => {
            const child = childProcess.exec(
              command,
              { cwd, env, timeout },
              (error, stdout, stderr) => {
                resolve({
                  stdout: stdout.toString(),
                  stderr: stderr.toString(),
                  exitCode:
                    error && "code" in error
                      ? (error as { code: number }).code
                      : 0,
                });
              },
            );

            if (execOpts?.stdin != null) {
              child.stdin?.write(execOpts.stdin);
              child.stdin?.end();
            }
          });
        },
      },
    },
  });
