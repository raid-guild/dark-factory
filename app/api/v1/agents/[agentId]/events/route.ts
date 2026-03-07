import { parseJson, todo } from "@/lib/api/respond";

type Context = { params: Promise<{ agentId: string }> };

export async function POST(request: Request, context: Context) {
  const { agentId } = await context.params;
  const body = await parseJson(request);
  return todo("POST /api/v1/agents/:agentId/events", { agentId, body });
}
