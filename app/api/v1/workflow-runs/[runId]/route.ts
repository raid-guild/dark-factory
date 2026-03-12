import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getWorkflowRunById } from "@/lib/db/workflow-runs";

type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: Context) {
  const { runId } = await context.params;
  try {
    const run = await getWorkflowRunById(runId);
    if (!run) {
      return fail("Workflow run not found", 404, { runId });
    }

    return ok(run);
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to load workflow run", 500, { runId });
  }
}
