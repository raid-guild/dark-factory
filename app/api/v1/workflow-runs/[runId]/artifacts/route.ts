import { fail, ok } from "@/lib/api/respond";
import { listWorkflowRunArtifacts } from "@/lib/db/artifacts";
import { isDatabaseConfigError } from "@/lib/db/errors";

type Context = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: Context) {
  const { runId } = await context.params;
  try {
    return ok({ items: await listWorkflowRunArtifacts(runId) });
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load artifacts", 500, { runId });
  }
}
