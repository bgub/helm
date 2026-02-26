import { createBevel, edit, fs, git, grep, http, shell } from "bevel";

const agent = createBevel({ defaultPermission: "allow" })
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
