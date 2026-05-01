import { connect } from "@bgub/helm-server/client";
import { getServer, HELM_WS_URL } from "../../../lib/helm";

export async function GET() {
  await getServer();
  const session = await connect(HELM_WS_URL);
  const results = session.skills;
  session.close();
  return Response.json(results);
}
