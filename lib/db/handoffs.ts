import type { Handoff, HandoffStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query, withTransaction } from "@/lib/db/pool";

type HandoffRow = {
  id: string;
  from_task_id: string | null;
  to_task_id: string | null;
  from_actor_id: string | null;
  to_actor_id: string | null;
  note: string | null;
  status: HandoffStatus;
  created_at: Date;
  updated_at: Date;
};

type CreateHandoffInput = {
  fromTaskId: string;
  toTaskId: string;
  note: string | null;
  actorAgentKey: string | null;
};

type CreateHandoffResult =
  | {
      kind: "ok";
      handoff: Handoff;
    }
  | {
      kind: "task_not_found" | "cross_run";
    };

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function mapHandoff(row: HandoffRow): Handoff {
  return {
    id: row.id,
    from_task_id: row.from_task_id ?? undefined,
    to_task_id: row.to_task_id ?? undefined,
    from_actor_id: row.from_actor_id ?? undefined,
    to_actor_id: row.to_actor_id ?? undefined,
    note: row.note ?? undefined,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function resolveActorId(agentKey: string | null) {
  if (!agentKey) return null;

  const result = await query<{ id: string }>(
    `
      select actors.id
      from public.actors
      inner join public.agents on agents.id = actors.agent_id
      where actors.actor_type = 'agent' and agents.agent_key = $1
      limit 1
    `,
    [agentKey],
  );

  return result.rows[0]?.id ?? null;
}

export async function listTaskHandoffs(taskId: string): Promise<Handoff[]> {
  try {
    const result = await query<HandoffRow>(
      `
        select
          id,
          from_task_id::text as from_task_id,
          to_task_id::text as to_task_id,
          from_actor_id::text as from_actor_id,
          to_actor_id::text as to_actor_id,
          note,
          status,
          created_at,
          updated_at
        from public.handoffs
        where from_task_id = $1::uuid or to_task_id = $1::uuid
        order by created_at desc
      `,
      [taskId],
    );

    return result.rows.map(mapHandoff);
  } catch (error) {
    mapDbError(error);
  }
}

export async function getHandoffById(handoffId: string): Promise<Handoff | null> {
  try {
    const result = await query<HandoffRow>(
      `
        select
          id,
          from_task_id::text as from_task_id,
          to_task_id::text as to_task_id,
          from_actor_id::text as from_actor_id,
          to_actor_id::text as to_actor_id,
          note,
          status,
          created_at,
          updated_at
        from public.handoffs
        where id = $1::uuid
        limit 1
      `,
      [handoffId],
    );

    return result.rows[0] ? mapHandoff(result.rows[0]) : null;
  } catch (error) {
    mapDbError(error);
  }
}

export async function createHandoff(input: CreateHandoffInput): Promise<CreateHandoffResult> {
  try {
    const fromActorId = await resolveActorId(input.actorAgentKey);

    return await withTransaction(async (client) => {
      const tasks = await client.query<{
        id: string;
        workflow_run_id: string | null;
        owner_actor_id: string | null;
      }>(
        `
          select
            tasks.id::text as id,
            tasks.workflow_run_id::text as workflow_run_id,
            (
              select actors.id::text
              from public.actors
              where actors.actor_type = 'agent' and actors.agent_id = tasks.owner_agent_id
              limit 1
            ) as owner_actor_id
          from public.tasks
          where tasks.id in ($1::uuid, $2::uuid)
        `,
        [input.fromTaskId, input.toTaskId],
      );

      const fromTask = tasks.rows.find((row) => row.id === input.fromTaskId);
      const toTask = tasks.rows.find((row) => row.id === input.toTaskId);
      if (!fromTask || !toTask) return { kind: "task_not_found" as const };
      if (!fromTask.workflow_run_id || !toTask.workflow_run_id || fromTask.workflow_run_id !== toTask.workflow_run_id) {
        return { kind: "cross_run" as const };
      }

      const result = await client.query<HandoffRow>(
        `
          insert into public.handoffs (
            from_task_id,
            to_task_id,
            from_actor_id,
            to_actor_id,
            note,
            status
          )
          values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'created')
          returning
            id,
            from_task_id::text,
            to_task_id::text,
            from_actor_id::text,
            to_actor_id::text,
            note,
            status,
            created_at,
            updated_at
        `,
        [input.fromTaskId, input.toTaskId, fromActorId, toTask.owner_actor_id, input.note ?? null],
      );

      await client.query(
        `
          insert into public.task_events (task_id, actor_id, event_type, payload)
          values
            ($1::uuid, $2::uuid, 'handoff.created', $3::jsonb),
            ($4::uuid, $2::uuid, 'handoff.received', $5::jsonb)
        `,
        [
          input.fromTaskId,
          fromActorId,
          JSON.stringify({ to_task_id: input.toTaskId, note: input.note ?? null }),
          input.toTaskId,
          JSON.stringify({ from_task_id: input.fromTaskId, note: input.note ?? null }),
        ],
      );

      return {
        kind: "ok" as const,
        handoff: mapHandoff(result.rows[0]),
      };
    });
  } catch (error) {
    mapDbError(error);
  }
}
