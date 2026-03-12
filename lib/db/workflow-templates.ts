import type { WorkflowTemplateSummary } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";

type WorkflowTemplateRow = WorkflowTemplateSummary;

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplateSummary[]> {
  try {
    const result = await query<WorkflowTemplateRow>(
      `
        select id, template_key, name, version, active
        from public.workflow_templates
        order by active desc, template_key asc, version desc
      `,
    );

    return result.rows;
  } catch (error) {
    mapDbError(error);
  }
}
