import type { TaskEvent } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";

type TaskEventRow = {
  id: string;
  task_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: Date;
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function mapTaskEvent(row: TaskEventRow): TaskEvent {
  return {
    id: row.id,
    task_id: row.task_id,
    actor_id: row.actor_id ?? undefined,
    event_type: row.event_type,
    payload: row.payload ?? {},
    created_at: row.created_at.toISOString(),
  };
}

export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  try {
    const result = await query<TaskEventRow>(
      `
        select
          id::text as id,
          task_id::text as task_id,
          actor_id::text as actor_id,
          event_type,
          payload,
          created_at
        from public.task_events
        where task_id = $1::uuid
        order by created_at desc
      `,
      [taskId],
    );

    return result.rows.map(mapTaskEvent);
  } catch (error) {
    mapDbError(error);
  }
}
