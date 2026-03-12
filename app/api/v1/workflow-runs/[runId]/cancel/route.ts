import { parseJson, todo } from "@/lib/api/respond";

type Context = { params: Promise<{ runId: string }> };

export async function POST(request: Request, context: Context) {
  const { runId } = await context.params;
  const body = await parseJson(request);
  return todo("POST /api/v1/workflow-runs/:runId/cancel", { runId, body });
}
