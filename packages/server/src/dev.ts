import { edit, fs, git, grep, shell } from "@bgub/helm";
import { HelmServer } from "./index.ts";

const server = HelmServer.create({
  skills: [fs(), git(), grep(), edit(), shell()],
  defaultPermissions: {
    "fs.readFile": "allow",
    "fs.readdir": "allow",
    "fs.stat": "allow",
    "fs.cwd": "allow",
    "grep.search": "allow",
    "git.status": "allow",
    "git.diff": "allow",
    "git.log": "allow",
  },
  defaultPermission: "ask",
  port: 3001,
  dashboard: true,
});

await server.listen();
