import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { createHandoff } from "@/lib/db/handoffs";

export async function POST(request: Request) {
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);
  const fromTaskId = typeof body.from_task_id === "string" ? body.from_task_id.trim() : "";
  const toTaskId = typeof body.to_task_id === "string" ? body.to_task_id.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!fromTaskId || !toTaskId) {
    return fail("from_task_id and to_task_id are required", 400);
  }

  try {
    const result = await createHandoff({
      fromTaskId,
      toTaskId,
      note: note || null,
      actorAgentKey: auth.agentId,
    });

    if (result.kind === "task_not_found") {
      return fail("Both handoff tasks must exist", 404);
    }

    if (result.kind === "cross_run") {
      return fail("Handoffs must stay within a single workflow run", 409);
    }

    if (result.kind !== "ok") {
      return fail("Failed to create handoff", 500);
    }

    return ok(result.handoff, 201);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to create handoff", 500);
  }
}
