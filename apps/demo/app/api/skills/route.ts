import { createCrag, edit, fs, git, grep, http, shell } from "crag";

const agent = createCrag({ defaultPermission: "allow" })
  .use(fs())
  .use(git())
  .use(grep())
  .use(edit())
  .use(shell())
  .use(http());

export async function GET() {
  const results = agent.search("");
  return Response.json(results);
}
