import type { PoolClient } from "pg";
import type { Task, TaskStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/pool";

type TaskMutationRow = {
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

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["claimed"],
  claimed: ["in_progress", "blocked", "canceled"],
  in_progress: ["waiting_approval", "blocked", "completed", "failed"],
  blocked: ["in_progress", "canceled", "failed"],
  waiting_approval: ["in_progress", "completed", "failed"],
  completed: [],
  failed: [],
  canceled: [],
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function mapTask(row: TaskMutationRow): Task {
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

async function resolveActorId(client: PoolClient, agentKey: string | null) {
  if (!agentKey) return null;

  const result = await client.query<{ id: string }>(
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

async function loadTaskForUpdate(client: PoolClient, taskId: string) {
  const result = await client.query<TaskMutationRow>(
    `
      select
        t.id,
        t.title,
        t.description,
        t.task_type,
        t.status,
        t.priority,
        (
          select agent_key
          from public.agents
          where public.agents.id = t.owner_agent_id
        ) as owner_agent_id,
        t.workflow_run_id::text as workflow_run_id,
        t.blocked_reason,
        t.due_at
      from public.tasks t
      where t.id = $1::uuid
      for update
    `,
    [taskId],
  );

  return result.rows[0] ?? null;
}

async function writeTaskEvent(
  client: PoolClient,
  taskId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await client.query(
    `
      insert into public.task_events (task_id, actor_id, event_type, payload)
      values ($1::uuid, $2::uuid, $3, $4::jsonb)
    `,
    [taskId, actorId, eventType, JSON.stringify(payload)],
  );
}

async function transitionTask(
  client: PoolClient,
  taskId: string,
  nextStatus: TaskStatus,
  agentKey: string | null,
  blockedReason?: string | null,
  note?: string | null,
) {
  const current = await loadTaskForUpdate(client, taskId);
  if (!current) {
    return { kind: "not_found" as const };
  }

  if (!VALID_TRANSITIONS[current.status].includes(nextStatus)) {
    return {
      kind: "invalid_transition" as const,
      currentStatus: current.status,
      nextStatus,
    };
  }

  const actorId = await resolveActorId(client, agentKey);
  const ownerAgentKey = agentKey ?? current.owner_agent_id ?? null;
  const ownerAgentIdResult = ownerAgentKey
    ? await client.query<{ id: string }>("select id from public.agents where agent_key = $1 limit 1", [ownerAgentKey])
    : { rows: [] };
  const ownerAgentId = ownerAgentIdResult.rows[0]?.id ?? null;

  const updateResult = await client.query<TaskMutationRow>(
    `
      update public.tasks
      set
        status = $2::task_status,
        owner_agent_id = coalesce($3::uuid, owner_agent_id),
        blocked_reason = $4,
        updated_at = now()
      where id = $1::uuid
      returning
        id,
        title,
        description,
        task_type,
        status,
        priority,
        (
          select agent_key from public.agents where public.agents.id = tasks.owner_agent_id
        ) as owner_agent_id,
        workflow_run_id::text as workflow_run_id,
        blocked_reason,
        due_at
    `,
    [taskId, nextStatus, ownerAgentId, blockedReason ?? null],
  );

  const updated = mapTask(updateResult.rows[0]);
  await writeTaskEvent(client, taskId, actorId, `task.${nextStatus}`, {
    from_status: current.status,
    to_status: nextStatus,
    blocked_reason: blockedReason ?? null,
    note: note ?? null,
    owner_agent_id: updated.owner_agent_id ?? null,
  });

  return { kind: "ok" as const, task: updated };
}

export async function claimTask(taskId: string, agentKey: string | null) {
  try {
    return await withTransaction((client) => transitionTask(client, taskId, "claimed", agentKey, null, null));
  } catch (error) {
    mapDbError(error);
  }
}

export async function startTask(taskId: string, agentKey: string | null) {
  try {
    return await withTransaction((client) => transitionTask(client, taskId, "in_progress", agentKey, null, null));
  } catch (error) {
    mapDbError(error);
  }
}

export async function blockTask(taskId: string, agentKey: string | null, blockedReason: string | null) {
  try {
    return await withTransaction((client) => transitionTask(client, taskId, "blocked", agentKey, blockedReason, null));
  } catch (error) {
    mapDbError(error);
  }
}

export async function completeTask(taskId: string, agentKey: string | null, note: string | null = null) {
  try {
    return await withTransaction((client) => transitionTask(client, taskId, "completed", agentKey, null, note));
  } catch (error) {
    mapDbError(error);
  }
}
