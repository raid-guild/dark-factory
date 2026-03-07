import { parseJson, todo } from "@/lib/api/respond";

type Context = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: Context) {
  const { taskId } = await context.params;
  const body = await parseJson(request);
  return todo("POST /api/v1/tasks/:taskId/cancel", { taskId, body });
}
