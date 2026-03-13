import { DatabaseConfigError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/pool";

type EventInput = {
  agentKey: string;
  eventType: string;
  taskId?: string | null;
  workflowRunId?: string | null;
  payload?: unknown;
};

type EventRow = {
  id: string;
  agent_id: string | null;
  task_id: string | null;
  workflow_run_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: Date;
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

export async function createAgentEvent(input: EventInput) {
  try {
    return await withTransaction(async (client) => {
      const actorResult = await client.query<{ actor_id: string | null; agent_id: string }>(
        `
          select
            actors.id as actor_id,
            agents.id as agent_id
          from public.agents
          left join public.actors
            on actors.agent_id = agents.id
           and actors.actor_type = 'agent'
          where agents.agent_key = $1
          limit 1
        `,
        [input.agentKey],
      );

      const agent = actorResult.rows[0];
      if (!agent) return null;

      const result = await client.query<EventRow>(
        `
          insert into public.events (
            actor_id,
            agent_id,
            task_id,
            workflow_run_id,
            event_type,
            payload
          )
          values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::jsonb)
          returning
            id,
            agent_id::text as agent_id,
            task_id::text as task_id,
            workflow_run_id::text as workflow_run_id,
            event_type,
            payload,
            created_at
        `,
        [
          agent.actor_id,
          agent.agent_id,
          input.taskId ?? null,
          input.workflowRunId ?? null,
          input.eventType,
          JSON.stringify(
            input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {},
          ),
        ],
      );

      if (input.taskId) {
        await client.query(
          `
            insert into public.task_events (task_id, actor_id, event_type, payload)
            values ($1::uuid, $2::uuid, $3, $4::jsonb)
          `,
          [
            input.taskId,
            agent.actor_id,
            input.eventType,
            JSON.stringify(
              input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {},
            ),
          ],
        );
      }

      return result.rows[0];
    });
  } catch (error) {
    mapDbError(error);
  }
}
