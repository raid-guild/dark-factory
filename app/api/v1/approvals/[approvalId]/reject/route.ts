import { parseJson, todo } from "@/lib/api/respond";

type Context = { params: Promise<{ approvalId: string }> };

export async function POST(request: Request, context: Context) {
  const { approvalId } = await context.params;
  const body = await parseJson(request);
  return todo("POST /api/v1/approvals/:approvalId/reject", { approvalId, body });
}
