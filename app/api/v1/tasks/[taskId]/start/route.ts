import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { startTask } from "@/lib/db/task-mutations";

type Context = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, context: Context) {
  const { taskId } = await context.params;
  await parseJson(request);
  const auth = getRequestAuthContext(request);

  try {
    const result = await startTask(taskId, auth.agentId);
    if (result.kind === "not_found") return fail("Task not found", 404, { taskId });
    if (result.kind === "invalid_transition") {
      return fail("Invalid task transition", 409, {
        taskId,
        current_status: result.currentStatus,
        next_status: result.nextStatus,
      });
    }

    return ok(result.task);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to start task", 500, { taskId });
  }
}
