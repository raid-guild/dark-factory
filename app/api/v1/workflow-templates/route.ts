import { fail, ok } from "@/lib/api/respond";
import { isDatabaseConfigError } from "@/lib/db/errors";
import { listWorkflowTemplates } from "@/lib/db/workflow-templates";

export async function GET() {
  try {
    const items = await listWorkflowTemplates();
    return ok({ items });
  } catch (error) {
    if (isDatabaseConfigError(error)) return fail("Database is not configured", 503);
    return fail("Failed to load workflow templates", 500);
  }
}
