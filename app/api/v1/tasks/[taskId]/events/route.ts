import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { listTaskEvents } from "@/lib/db/task-events";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const { taskId } = await context.params;

  try {
    const items = await listTaskEvents(taskId);
    return ok({ items });
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load task events", 500, { taskId });
  }
}
