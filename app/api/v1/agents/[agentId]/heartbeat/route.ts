import { fail, ok, parseJson } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { upsertAgentHeartbeat } from "@/lib/db/agents";

type Context = { params: Promise<{ agentId: string }> };

export async function POST(request: Request, context: Context) {
  const { agentId } = await context.params;
  const body = await parseJson(request);

  if (
    body.status !== "idle" &&
    body.status !== "available" &&
    body.status !== "working" &&
    body.status !== "blocked" &&
    body.status !== "offline"
  ) {
    return fail("Heartbeat requires a valid status", 400, { agentId });
  }

  try {
    const presence = await upsertAgentHeartbeat(agentId, {
      status: body.status,
      station: typeof body.station === "string" ? body.station : null,
      currentTaskId: typeof body.current_task_id === "string" ? body.current_task_id : null,
      currentWorkflowRunId: typeof body.current_workflow_run_id === "string" ? body.current_workflow_run_id : null,
      progressPct: typeof body.progress_pct === "number" ? body.progress_pct : null,
      statusMessage: typeof body.status_message === "string" ? body.status_message : null,
    });

    if (!presence) {
      return fail("Agent not found", 404, { agentId });
    }

    return ok(presence);
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to record heartbeat", 500, { agentId });
  }
}
