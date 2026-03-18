import { fail, ok, parseJson } from "@/lib/api/respond";
import { getRequestAuthContext } from "@/lib/auth/request-auth";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { completeTask } from "@/lib/db/task-mutations";
import { mirrorTaskTransitionToAgentMail, releaseTaskFilesInAgentMail } from "@/lib/integrations/agent-mail/service";

type Context = { params: Promise<{ taskId: string }> };

function parseArtifacts(body: Record<string, unknown>) {
  if (!Array.isArray(body.artifacts)) return [];

  return body.artifacts
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;

      const artifact = item as Record<string, unknown>;
      const kind = typeof artifact.kind === "string" ? artifact.kind.trim() : "";
      const title = typeof artifact.title === "string" ? artifact.title.trim() : "";
      const uri = typeof artifact.uri === "string" ? artifact.uri.trim() : "";
      const metadata_json =
        artifact.metadata_json && typeof artifact.metadata_json === "object" && !Array.isArray(artifact.metadata_json)
          ? (artifact.metadata_json as Record<string, unknown>)
          : {};

      if (!kind || !title || !uri) return null;

      return { kind, title, uri, metadata_json };
    })
    .filter((item): item is { kind: string; title: string; uri: string; metadata_json: Record<string, unknown> } => Boolean(item));
}

export async function POST(request: Request, context: Context) {
  const { taskId } = await context.params;
  const body = await parseJson(request);
  const auth = getRequestAuthContext(request);
  const completionNote = typeof body.completion_note === "string" ? body.completion_note.trim() : "";
  const artifacts = parseArtifacts(body);

  try {
    const result = await completeTask(taskId, auth.agentId, completionNote || null, artifacts);
    if (result.kind === "not_found") return fail("Task not found", 404, { taskId });
    if (result.kind === "invalid_transition") {
      return fail("Invalid task transition", 409, {
        taskId,
        current_status: result.currentStatus,
        next_status: result.nextStatus,
      });
    }

    if (auth.agentId) {
      const reservationPaths = Array.isArray(body.file_paths)
        ? body.file_paths.filter((value): value is string => typeof value === "string")
        : [];

      void mirrorTaskTransitionToAgentMail({
        taskId: result.task.id,
        workflowRunId: result.task.workflow_run_id,
        senderName: auth.agentId,
        taskTitle: result.task.title,
        nextStatus: result.task.status,
        blockedReason: null,
        reservationPaths,
      }).catch(() => undefined);

      void releaseTaskFilesInAgentMail({
        senderName: auth.agentId,
        paths: reservationPaths,
      }).catch(() => undefined);
    }

    return ok({
      ...result.task,
      artifacts_created: artifacts.length,
    });
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to complete task", 500, { taskId });
  }
}
