import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: Context) {
  const { runId } = await context.params;
  return todo("GET /api/v1/workflow-runs/:runId", { runId });
}
