import type { TaskContract, TaskDetail } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";

type TaskDetailRow = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: TaskDetail["status"];
  priority: TaskDetail["priority"];
  owner_agent_id: string | null;
  workflow_run_id: string | null;
  blocked_reason: string | null;
  due_at: Date | null;
  template_definition_json: Record<string, unknown> | null;
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function parseTaskContract(
  definitionJson: Record<string, unknown> | null,
  taskTitle: string,
  taskType: string,
): TaskContract | undefined {
  const tasks = definitionJson?.tasks;
  if (!Array.isArray(tasks)) return undefined;

  const matched = tasks.find((task) => {
    if (!task || typeof task !== "object" || Array.isArray(task)) return false;
    const raw = task as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const type = typeof raw.task_type === "string" ? raw.task_type.trim() : "";
    return title === taskTitle && type === taskType;
  });

  if (!matched || typeof matched !== "object" || Array.isArray(matched)) return undefined;
  const raw = matched as Record<string, unknown>;

  return {
    key: typeof raw.key === "string" ? raw.key : undefined,
    instructions: typeof raw.instructions === "string" ? raw.instructions : undefined,
    output_requirements: Array.isArray(raw.output_requirements)
      ? raw.output_requirements.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [],
    completion_criteria: Array.isArray(raw.completion_criteria)
      ? raw.completion_criteria.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [],
    artifact_kind: typeof raw.artifact_kind === "string" ? raw.artifact_kind : undefined,
  };
}

export async function getTaskDetailById(taskId: string): Promise<TaskDetail | null> {
  try {
    const result = await query<TaskDetailRow>(
      `
        select
          t.id,
          t.title,
          t.description,
          t.task_type,
          t.status,
          t.priority,
          coalesce(a.agent_key, t.owner_agent_id::text) as owner_agent_id,
          t.workflow_run_id::text as workflow_run_id,
          t.blocked_reason,
          t.due_at,
          wt.definition_json as template_definition_json
        from public.tasks t
        left join public.agents a on a.id = t.owner_agent_id
        left join public.workflow_runs wr on wr.id = t.workflow_run_id
        left join public.workflow_templates wt on wt.id = wr.workflow_template_id
        where t.id = $1::uuid
        limit 1
      `,
      [taskId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      task_type: row.task_type,
      status: row.status,
      priority: row.priority,
      owner_agent_id: row.owner_agent_id ?? undefined,
      workflow_run_id: row.workflow_run_id ?? undefined,
      blocked_reason: row.blocked_reason ?? undefined,
      due_at: row.due_at?.toISOString(),
      contract: parseTaskContract(row.template_definition_json, row.title, row.task_type),
    };
  } catch (error) {
    mapDbError(error);
  }
}
