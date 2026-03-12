import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ handoffId: string }> };

export async function GET(_request: Request, context: Context) {
  const { handoffId } = await context.params;
  return todo("GET /api/v1/handoffs/:handoffId", { handoffId });
}
