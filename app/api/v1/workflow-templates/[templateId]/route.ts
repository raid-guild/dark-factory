import { fail, ok, parseJson } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { updateWorkflowTemplate } from "@/lib/db/workflow-templates";

type Context = { params: Promise<{ templateId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { templateId } = await context.params;
  const body = await parseJson(request);
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const active = typeof body.active === "boolean" ? body.active : undefined;
  const definitionJson =
    body.definition_json && typeof body.definition_json === "object" && !Array.isArray(body.definition_json)
      ? (body.definition_json as Record<string, unknown>)
      : undefined;

  try {
    const updated = await updateWorkflowTemplate({
      templateId,
      name,
      active,
      definitionJson,
    });

    if (!updated) return fail("Workflow template not found", 404, { templateId });
    return ok(updated);
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to update workflow template", 500, { templateId });
  }
}
