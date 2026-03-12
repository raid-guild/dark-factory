import { fail, ok, parseJson, todo } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { listTasks } from "@/lib/db/tasks";

export async function POST(request: Request) {
  const body = await parseJson(request);
  return todo("POST /api/v1/tasks", { body });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const items = await listTasks({
      status: searchParams.get("status"),
      ownerAgentId: searchParams.get("owner_agent_id"),
      workflowRunId: searchParams.get("workflow_run_id"),
    });

    return ok({ items });
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return fail("Database is not configured", 503);
    }

    return fail("Failed to load tasks", 500);
  }
}
