import { fail, ok, parseJson } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { getWorkflowRunById, updateWorkflowRun } from "@/lib/db/workflow-runs";

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

export async function PATCH(request: Request, context: Context) {
  const { runId } = await context.params;
  const body = await parseJson(request);

  const status =
    body.status === "pending" ||
    body.status === "running" ||
    body.status === "blocked" ||
    body.status === "completed" ||
    body.status === "failed" ||
    body.status === "canceled"
      ? body.status
      : undefined;

  const contextJson =
    body.context_json && typeof body.context_json === "object" && !Array.isArray(body.context_json)
      ? (body.context_json as Record<string, unknown>)
      : undefined;

  try {
    const run = await updateWorkflowRun({
      runId,
      status,
      contextJson,
    });

    if (!run) return fail("Workflow run not found", 404, { runId });
    return ok(run);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to update workflow run", 500, { runId });
  }
}
