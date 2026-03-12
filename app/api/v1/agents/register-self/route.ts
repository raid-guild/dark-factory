import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { registerSelfAgent } from "@/lib/db/agents";

export async function POST(request: Request) {
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);
  const boundAgentId = auth.agentId;

  if (!boundAgentId && auth.role !== "admin") {
    return fail("Authenticated agent key is missing its bound agent_id", 403);
  }

  try {
    const agent = await registerSelfAgent({
      agentKey: boundAgentId ?? (typeof body.agent_key === "string" ? body.agent_key : ""),
      name: typeof body.name === "string" ? body.name : boundAgentId,
      description: typeof body.description === "string" ? body.description : null,
      type: typeof body.type === "string" ? body.type : null,
      capabilities: body.capabilities,
    });

    return ok(agent);
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to register agent", 500);
  }
}
