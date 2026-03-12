import type { AgentPresence, PresenceStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query, withTransaction } from "@/lib/db/pool";

type AgentRow = {
  id: string;
  agent_key: string;
  name: string;
  description: string | null;
  type: string;
  capabilities: unknown;
  status: "active" | "inactive";
};

type PresenceRow = {
  agent_id: string;
  agent_name: string;
  status: PresenceStatus;
  current_task_id: string | null;
  progress_pct: number | null;
  last_heartbeat_at: Date;
};

type RegisterSelfInput = {
  agentKey: string;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  capabilities?: unknown;
};

type HeartbeatInput = {
  status: PresenceStatus;
  station?: string | null;
  currentTaskId?: string | null;
  currentWorkflowRunId?: string | null;
  progressPct?: number | null;
  statusMessage?: string | null;
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function mapPresence(row: PresenceRow): AgentPresence {
  return {
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    status: row.status,
    current_task_id: row.current_task_id ?? undefined,
    progress_pct: row.progress_pct ?? undefined,
    last_heartbeat_at: row.last_heartbeat_at.toISOString(),
  };
}

export async function registerSelfAgent(input: RegisterSelfInput) {
  try {
    return await withTransaction(async (client) => {
      const agentResult = await client.query<AgentRow>(
        `
          insert into public.agents (agent_key, name, description, type, capabilities, status)
          values ($1, $2, $3, $4, $5::jsonb, 'active')
          on conflict (agent_key) do update
          set
            name = excluded.name,
            description = excluded.description,
            type = excluded.type,
            capabilities = excluded.capabilities,
            status = 'active'
          returning id, agent_key, name, description, type, capabilities, status
        `,
        [
          input.agentKey,
          input.name?.trim() || input.agentKey,
          input.description?.trim() || null,
          input.type?.trim() || "general",
          JSON.stringify(Array.isArray(input.capabilities) ? input.capabilities : []),
        ],
      );

      const agent = agentResult.rows[0];

      await client.query(
        `
          insert into public.actors (actor_type, agent_id, display_name)
          values ('agent', $1, $2)
          on conflict (actor_type, agent_id) do update
          set display_name = excluded.display_name
        `,
        [agent.id, agent.name],
      );

      return {
        id: agent.id,
        agent_key: agent.agent_key,
        name: agent.name,
        description: agent.description,
        type: agent.type,
        capabilities: agent.capabilities,
        status: agent.status,
      };
    });
  } catch (error) {
    mapDbError(error);
  }
}

export async function upsertAgentHeartbeat(agentKey: string, input: HeartbeatInput): Promise<AgentPresence | null> {
  try {
    const result = await query<PresenceRow>(
      `
        insert into public.agent_presence (
          agent_id,
          status,
          station,
          current_task_id,
          current_workflow_run_id,
          progress_pct,
          status_message,
          last_heartbeat_at
        )
        select
          a.id,
          $2::presence_status,
          $3,
          $4::uuid,
          $5::uuid,
          $6,
          $7,
          now()
        from public.agents a
        where a.agent_key = $1
        on conflict (agent_id) do update
        set
          status = excluded.status,
          station = excluded.station,
          current_task_id = excluded.current_task_id,
          current_workflow_run_id = excluded.current_workflow_run_id,
          progress_pct = excluded.progress_pct,
          status_message = excluded.status_message,
          last_heartbeat_at = excluded.last_heartbeat_at
        returning
          agent_presence.agent_id::text as agent_id,
          (select name from public.agents where id = agent_presence.agent_id) as agent_name,
          agent_presence.status,
          agent_presence.current_task_id::text as current_task_id,
          agent_presence.progress_pct,
          agent_presence.last_heartbeat_at
      `,
      [
        agentKey,
        input.status,
        input.station ?? null,
        input.currentTaskId ?? null,
        input.currentWorkflowRunId ?? null,
        input.progressPct ?? null,
        input.statusMessage ?? null,
      ],
    );

    return result.rows[0] ? mapPresence(result.rows[0]) : null;
  } catch (error) {
    mapDbError(error);
  }
}

export async function getAgentPresence(agentKey: string): Promise<AgentPresence | null> {
  try {
    const result = await query<PresenceRow>(
      `
        select
          agent_presence.agent_id::text as agent_id,
          agents.name as agent_name,
          agent_presence.status,
          agent_presence.current_task_id::text as current_task_id,
          agent_presence.progress_pct,
          agent_presence.last_heartbeat_at
        from public.agent_presence
        inner join public.agents on agents.id = agent_presence.agent_id
        where agents.agent_key = $1
        limit 1
      `,
      [agentKey],
    );

    return result.rows[0] ? mapPresence(result.rows[0]) : null;
  } catch (error) {
    mapDbError(error);
  }
}
