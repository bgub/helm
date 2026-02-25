import { respondToApproval } from "../../../lib/approvals";

export async function POST(req: Request) {
  const { id, approved } = (await req.json()) as {
    id: string;
    approved: boolean;
  };
  respondToApproval(id, approved);
  return Response.json({ ok: true });
}
