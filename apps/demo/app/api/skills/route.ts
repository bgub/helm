import { createCrag, fs } from "crag";

const agent = createCrag({ defaultPermission: "allow" }).use(fs());

export async function GET() {
  const results = agent.search("");
  return Response.json(results);
}
