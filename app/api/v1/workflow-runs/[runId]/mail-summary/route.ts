import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getWorkflowRunById } from "@/lib/db/workflow-runs";
import { listTasks } from "@/lib/db/tasks";
import { getWorkflowRunMailSummary } from "@/lib/integrations/agent-mail/service";

type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: Context) {
  const { runId } = await context.params;

  try {
    const run = await getWorkflowRunById(runId);
    if (!run) return fail("Workflow run not found", 404, { runId });

    const tasks = await listTasks({ workflowRunId: runId });
    const participantAgentKeys = Array.from(
      new Set(tasks.map((task) => task.owner_agent_id).filter((value): value is string => Boolean(value))),
    );

    const summary = await getWorkflowRunMailSummary({
      workflowRunId: run.id,
      participantAgentKeys,
    });

    return ok(summary);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load workflow mail summary", 500, { runId });
  }
}
