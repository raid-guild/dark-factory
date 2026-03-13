import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getTaskRelations } from "@/lib/db/task-relations";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const { taskId } = await context.params;

  try {
    const relations = await getTaskRelations(taskId);
    return ok(relations);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load task relations", 500, { taskId });
  }
}
