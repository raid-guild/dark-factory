import { todo } from "@/lib/api/respond";

type Context = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, context: Context) {
  const { agentId } = await context.params;
  return todo("GET /api/v1/agents/:agentId/presence", { agentId });
}
