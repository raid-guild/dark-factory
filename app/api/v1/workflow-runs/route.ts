import { fail, ok, parseJson, todo } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { listWorkflowRuns } from "@/lib/db/workflow-runs";

export async function POST(request: Request) {
  const body = await parseJson(request);
  return todo("POST /api/v1/workflow-runs", { body });
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
