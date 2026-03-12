import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { blockTask } from "@/lib/db/task-mutations";
import { mirrorTaskTransitionToAgentMail, releaseTaskFilesInAgentMail } from "@/lib/integrations/agent-mail/service";

type Context = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: Context) {
  const { taskId } = await context.params;
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);
  const blockedReason = typeof body.blocked_reason === "string" ? body.blocked_reason.trim() : "";

  if (!blockedReason) {
    return fail("blocked_reason is required", 400, { taskId });
  }

  try {
    const result = await blockTask(taskId, auth.agentId, blockedReason);
    if (result.kind === "not_found") return fail("Task not found", 404, { taskId });
    if (result.kind === "invalid_transition") {
      return fail("Invalid task transition", 409, {
        taskId,
        current_status: result.currentStatus,
        next_status: result.nextStatus,
      });
    }

    if (auth.agentId) {
      const reservationPaths = Array.isArray(body.file_paths)
        ? body.file_paths.filter((value): value is string => typeof value === "string")
        : [];

      void mirrorTaskTransitionToAgentMail({
        taskId: result.task.id,
        workflowRunId: result.task.workflow_run_id,
        senderName: auth.agentId,
        taskTitle: result.task.title,
        nextStatus: result.task.status,
        blockedReason,
        reservationPaths,
      }).catch(() => undefined);

      void releaseTaskFilesInAgentMail({
        senderName: auth.agentId,
        paths: reservationPaths,
      }).catch(() => undefined);
    }

    return ok(result.task);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to block task", 500, { taskId });
  }
}
