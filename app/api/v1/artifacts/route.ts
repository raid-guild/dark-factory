import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { createArtifact } from "@/lib/db/artifacts";
import { isDatabaseConfigError } from "@/lib/db/errors";

export async function POST(request: Request) {
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);
  const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
  const workflowRunId = typeof body.workflow_run_id === "string" ? body.workflow_run_id.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const uri = typeof body.uri === "string" ? body.uri.trim() : "";
  const metadataJson =
    body.metadata_json && typeof body.metadata_json === "object" && !Array.isArray(body.metadata_json)
      ? (body.metadata_json as Record<string, unknown>)
      : {};

  if (!kind || !title || !uri) {
    return fail("kind, title, and uri are required", 400);
  }

  if (!taskId && !workflowRunId) {
    return fail("task_id or workflow_run_id is required", 400);
  }

  try {
    const artifact = await createArtifact({
      taskId: taskId || null,
      workflowRunId: workflowRunId || null,
      kind,
      title,
      uri,
      metadataJson,
      actorAgentKey: auth.agentId,
    });

    return ok(artifact, 201);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to create artifact", 500);
  }
}
