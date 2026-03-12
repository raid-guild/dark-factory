import type { Task, TaskStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: TaskStatus;
  priority: Task["priority"];
  owner_agent_id: string | null;
  workflow_run_id: string | null;
  blocked_reason: string | null;
  due_at: Date | null;
};

type TaskFilters = {
  status?: string | null;
  ownerAgentId?: string | null;
  workflowRunId?: string | null;
  agentId?: string | null;
};

function mapTask(row: TaskRow): Task {
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
  };
}

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

export async function listTasks(filters: TaskFilters): Promise<Task[]> {
  try {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filters.status) {
      const statuses = filters.status.split(",").map((value) => value.trim()).filter(Boolean);
      if (statuses.length) {
        values.push(statuses);
        where.push(`t.status = any($${values.length}::task_status[])`);
      }
    }

    if (filters.ownerAgentId) {
      values.push(filters.ownerAgentId, filters.ownerAgentId);
      where.push(`(a.agent_key = $${values.length - 1} or t.owner_agent_id::text = $${values.length})`);
    }

    if (filters.agentId) {
      values.push(filters.agentId, filters.agentId);
      where.push(`(a.agent_key = $${values.length - 1} or t.owner_agent_id::text = $${values.length})`);
    }

    if (filters.workflowRunId) {
      values.push(filters.workflowRunId);
      where.push(`t.workflow_run_id::text = $${values.length}`);
    }

    const result = await query<TaskRow>(
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
          t.due_at
        from public.tasks t
        left join public.agents a on a.id = t.owner_agent_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by t.created_at desc
      `,
      values,
    );

    return result.rows.map(mapTask);
  } catch (error) {
    mapDbError(error);
  }
}
