import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ approvalId: string }> };

export async function GET(_request: Request, context: Context) {
  const { approvalId } = await context.params;
  return todo("GET /api/v1/approvals/:approvalId", { approvalId });
}
