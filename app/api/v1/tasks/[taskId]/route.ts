import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getTaskDetailById } from "@/lib/db/task-details";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const { taskId } = await context.params;

  try {
    const task = await getTaskDetailById(taskId);
    if (!task) return fail("Task not found", 404, { taskId });
    return ok(task);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load task", 500, { taskId });
  }
}
