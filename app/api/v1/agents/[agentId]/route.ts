import { parseJson, todo } from "@/lib/api/respond";

type Context = { params: Promise<{ agentId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { agentId } = await context.params;
  const body = await parseJson(request);
  return todo("PATCH /api/v1/agents/:agentId", { agentId, body });
}
