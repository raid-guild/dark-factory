import type { WorkflowRun, WorkflowRunStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";

type WorkflowRunRow = {
  id: string;
  workflow_template_id: string;
  status: WorkflowRunStatus;
  requested_by_actor_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  context_json: Record<string, unknown> | null;
};

type WorkflowRunFilters = {
  status?: string | null;
  workflowTemplateId?: string | null;
};

function mapWorkflowRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    workflow_template_id: row.workflow_template_id,
    status: row.status,
    requested_by_actor_id: row.requested_by_actor_id ?? undefined,
    started_at: row.started_at?.toISOString(),
    completed_at: row.completed_at?.toISOString(),
    context_json: row.context_json ?? {},
  };
}

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

export async function listWorkflowRuns(filters: WorkflowRunFilters): Promise<WorkflowRun[]> {
  try {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filters.status) {
      values.push(filters.status);
      where.push(`wr.status = $${values.length}`);
    }

    if (filters.workflowTemplateId) {
      values.push(filters.workflowTemplateId, filters.workflowTemplateId, filters.workflowTemplateId);
      where.push(
        `(wt.template_key = $${values.length - 2} or wt.template_key || ':' || wt.version = $${values.length - 1} or wr.workflow_template_id::text = $${values.length})`,
      );
    }

    const result = await query<WorkflowRunRow>(
      `
        select
          wr.id,
          coalesce(wt.template_key || ':' || wt.version, wt.template_key, wr.workflow_template_id::text) as workflow_template_id,
          wr.status,
          wr.requested_by_actor_id,
          wr.started_at,
          wr.completed_at,
          wr.context_json
        from public.workflow_runs wr
        left join public.workflow_templates wt on wt.id = wr.workflow_template_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by wr.created_at desc
      `,
      values,
    );

    return result.rows.map(mapWorkflowRun);
  } catch (error) {
    mapDbError(error);
  }
}

export async function getWorkflowRunById(runId: string): Promise<WorkflowRun | null> {
  try {
    const result = await query<WorkflowRunRow>(
      `
        select
          wr.id,
          coalesce(wt.template_key || ':' || wt.version, wt.template_key, wr.workflow_template_id::text) as workflow_template_id,
          wr.status,
          wr.requested_by_actor_id,
          wr.started_at,
          wr.completed_at,
          wr.context_json
        from public.workflow_runs wr
        left join public.workflow_templates wt on wt.id = wr.workflow_template_id
        where wr.id = $1
        limit 1
      `,
      [runId],
    );

    return result.rows[0] ? mapWorkflowRun(result.rows[0]) : null;
  } catch (error) {
    mapDbError(error);
  }
}
