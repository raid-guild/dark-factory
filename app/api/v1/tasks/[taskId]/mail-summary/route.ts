import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getTaskById } from "@/lib/db/tasks";
import { getTaskMailSummary } from "@/lib/integrations/agent-mail/service";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const { taskId } = await context.params;

  try {
    const task = await getTaskById(taskId);
    if (!task) return fail("Task not found", 404, { taskId });

    const summary = await getTaskMailSummary({
      taskId: task.id,
      workflowRunId: task.workflow_run_id,
    });

    return ok(summary);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load task mail summary", 500, { taskId });
  }
}
