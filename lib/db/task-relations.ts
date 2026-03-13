import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";

type TaskRelationRow = {
  id: string;
  title: string;
  task_type: string;
  status:
    | "queued"
    | "claimed"
    | "in_progress"
    | "blocked"
    | "waiting_approval"
    | "completed"
    | "failed"
    | "canceled";
  owner_agent_id: string | null;
};

export type TaskRelationSummary = {
  id: string;
  title: string;
  task_type: string;
  status: TaskRelationRow["status"];
  owner_agent_id?: string;
};

export type TaskRelations = {
  depends_on: TaskRelationSummary[];
  dependents: TaskRelationSummary[];
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function mapRelation(row: TaskRelationRow): TaskRelationSummary {
  return {
    id: row.id,
    title: row.title,
    task_type: row.task_type,
    status: row.status,
    owner_agent_id: row.owner_agent_id ?? undefined,
  };
}

export async function getTaskRelations(taskId: string): Promise<TaskRelations> {
  try {
    const [dependsOnResult, dependentsResult] = await Promise.all([
      query<TaskRelationRow>(
        `
          select
            t.id,
            t.title,
            t.task_type,
            t.status,
            coalesce(a.agent_key, t.owner_agent_id::text) as owner_agent_id
          from public.task_dependencies td
          inner join public.tasks t on t.id = td.depends_on_task_id
          left join public.agents a on a.id = t.owner_agent_id
          where td.task_id = $1::uuid
          order by t.created_at asc
        `,
        [taskId],
      ),
      query<TaskRelationRow>(
        `
          select
            t.id,
            t.title,
            t.task_type,
            t.status,
            coalesce(a.agent_key, t.owner_agent_id::text) as owner_agent_id
          from public.task_dependencies td
          inner join public.tasks t on t.id = td.task_id
          left join public.agents a on a.id = t.owner_agent_id
          where td.depends_on_task_id = $1::uuid
          order by t.created_at asc
        `,
        [taskId],
      ),
    ]);

    return {
      depends_on: dependsOnResult.rows.map(mapRelation),
      dependents: dependentsResult.rows.map(mapRelation),
    };
  } catch (error) {
    mapDbError(error);
  }
}
