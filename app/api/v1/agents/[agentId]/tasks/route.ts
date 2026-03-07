import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ agentId: string }> };

export async function GET(request: Request, context: Context) {
  const { agentId } = await context.params;
  const { searchParams } = new URL(request.url);
  return todo("GET /api/v1/agents/:agentId/tasks", {
    agentId,
    status: searchParams.get("status"),
  });
}
