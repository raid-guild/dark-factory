import { fail, ok, parseJson } from "@/lib/api/respond";
import { createAgentEvent } from "@/lib/db/events";
import { isDatabaseConfigError } from "@/lib/db/errors";

type Context = { params: Promise<{ agentId: string }> };

export async function POST(request: Request, context: Context) {
  const { agentId } = await context.params;
  const body = await parseJson(request);

  if (typeof body.event_type !== "string" || !body.event_type.trim()) {
    return fail("event_type is required", 400, { agentId });
  }

  try {
    const event = await createAgentEvent({
      agentKey: agentId,
      eventType: body.event_type,
      taskId: typeof body.task_id === "string" ? body.task_id : null,
      workflowRunId: typeof body.workflow_run_id === "string" ? body.workflow_run_id : null,
      payload: body.payload,
    });

    if (!event) {
      return fail("Agent not found", 404, { agentId });
    }

    return ok(event, 201);
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to record event", 500, { agentId });
  }
}
