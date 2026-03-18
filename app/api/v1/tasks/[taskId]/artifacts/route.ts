import { fail, ok } from "@/lib/api/respond";
import { listTaskArtifacts } from "@/lib/db/artifacts";
import { isDatabaseConfigError } from "@/lib/db/errors";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_request: Request, context: Context) {
  const { taskId } = await context.params;
  try {
    return ok({ items: await listTaskArtifacts(taskId) });
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load artifacts", 500, { taskId });
  }
}
