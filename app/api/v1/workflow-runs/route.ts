import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { createWorkflowRun, listWorkflowRuns } from "@/lib/db/workflow-runs";

export async function POST(request: Request) {
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);
  const workflowTemplateId =
    typeof body.workflow_template_id === "string" ? body.workflow_template_id.trim() : "";

  if (!workflowTemplateId) {
    return fail("workflow_template_id is required", 400);
  }

  const contextJson =
    body.context_json && typeof body.context_json === "object" && !Array.isArray(body.context_json)
      ? (body.context_json as Record<string, unknown>)
      : {};
  const status =
    body.status === "pending" ||
    body.status === "running" ||
    body.status === "blocked" ||
    body.status === "completed" ||
    body.status === "failed" ||
    body.status === "canceled"
      ? body.status
      : undefined;

  try {
    const result = await createWorkflowRun({
      workflowTemplateId,
      contextJson,
      requestedByAgentKey: auth.agentId,
      status,
    });

    if (result.kind === "not_found") return fail("Workflow template not found", 404, { workflow_template_id: workflowTemplateId });
    if (result.kind === "invalid_template") {
      return fail("Workflow template does not define any tasks", 422, { workflow_template_id: workflowTemplateId });
    }

    return ok(result, 201);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to create workflow run", 500);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const items = await listWorkflowRuns({
      status: searchParams.get("status"),
      workflowTemplateId: searchParams.get("workflow_template_id"),
    });

    return ok({ items });
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to load workflow runs", 500);
  }
}
