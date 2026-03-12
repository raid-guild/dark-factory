import { fail, ok } from "@/lib/api/respond";
import { getAgentPresence } from "@/lib/db/agents";
import { isDatabaseConfigError } from "@/lib/db/errors";

type Context = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, context: Context) {
  const { agentId } = await context.params;
  try {
    const presence = await getAgentPresence(agentId);
    if (!presence) {
      return fail("Agent presence not found", 404, { agentId });
    }

    return ok(presence);
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to load agent presence", 500, { agentId });
  }
}
