import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const { taskId } = await context.params;
  return todo("GET /api/v1/tasks/:taskId/artifacts", { taskId });
}
