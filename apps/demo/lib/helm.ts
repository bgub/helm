import { edit, fs, git, grep, http, shell } from "@bgub/helm";
import { HelmServer } from "@bgub/helm-server";

const HELM_PORT = 3002;

let serverPromise: Promise<HelmServer> | null = null;

/**
 * Lazily start a HelmServer singleton.
 * The server runs on a separate port from Next.js and accepts
 * WebSocket connections from the client SDK.
 */
export function getServer(): Promise<HelmServer> {
  if (!serverPromise) {
    serverPromise = (async () => {
      const server = HelmServer.create({
        skills: [fs(), git(), grep(), edit(), shell(), http()],
        defaultPermissions: {},
        defaultPermission: "allow",
        port: HELM_PORT,
        dashboard: true,
      });
      await server.listen();
      return server;
    })();
  }
  return serverPromise;
}

export const HELM_WS_URL = `ws://localhost:${HELM_PORT}`;
