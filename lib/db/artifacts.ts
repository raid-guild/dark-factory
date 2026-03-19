import type { Artifact, ArtifactApprovalStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query, withTransaction } from "@/lib/db/pool";

type ArtifactRow = {
  id: string;
  task_id: string | null;
  workflow_run_id: string | null;
  kind: string;
  title: string;
  uri: string;
  metadata_json: Record<string, unknown> | null;
  body_markdown: string | null;
  body_text: string | null;
  created_by_actor_id: string | null;
  approved_status: ArtifactApprovalStatus;
  created_at: Date;
};

type CreateArtifactInput = {
  taskId?: string | null;
  workflowRunId?: string | null;
  kind: string;
  title: string;
  uri: string;
  metadataJson?: Record<string, unknown>;
  bodyMarkdown?: string | null;
  bodyText?: string | null;
  actorAgentKey?: string | null;
};

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

function mapArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    task_id: row.task_id ?? undefined,
    workflow_run_id: row.workflow_run_id ?? undefined,
    kind: row.kind,
    title: row.title,
    uri: row.uri,
    metadata_json: row.metadata_json ?? {},
    body_markdown: row.body_markdown ?? undefined,
    body_text: row.body_text ?? undefined,
    created_by_actor_id: row.created_by_actor_id ?? undefined,
    approved_status: row.approved_status,
    created_at: row.created_at.toISOString(),
  };
}

async function resolveActorId(agentKey: string | null | undefined) {
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

export async function createArtifact(input: CreateArtifactInput): Promise<Artifact> {
  try {
    const actorId = await resolveActorId(input.actorAgentKey);

    return await withTransaction(async (client) => {
      const result = await client.query<ArtifactRow>(
        `
          insert into public.artifacts (
            task_id,
            workflow_run_id,
            kind,
            title,
            uri,
            metadata_json,
            body_markdown,
            body_text,
            created_by_actor_id,
            approved_status
          )
          values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9::uuid, 'unreviewed')
          returning
            id,
            task_id::text,
            workflow_run_id::text,
            kind,
            title,
            uri,
            metadata_json,
            body_markdown,
            body_text,
            created_by_actor_id::text,
            approved_status,
            created_at
        `,
        [
          input.taskId ?? null,
          input.workflowRunId ?? null,
          input.kind,
          input.title,
          input.uri,
          JSON.stringify(input.metadataJson ?? {}),
          input.bodyMarkdown ?? null,
          input.bodyText ?? null,
          actorId,
        ],
      );

      return mapArtifact(result.rows[0]);
    });
  } catch (error) {
    mapDbError(error);
  }
}

export async function listTaskArtifacts(taskId: string): Promise<Artifact[]> {
  try {
    const result = await query<ArtifactRow>(
      `
        select
          id,
          task_id::text,
          workflow_run_id::text,
          kind,
          title,
          uri,
          metadata_json,
          body_markdown,
          body_text,
          created_by_actor_id::text,
          approved_status,
          created_at
        from public.artifacts
        where task_id = $1::uuid
        order by created_at desc
      `,
      [taskId],
    );

    return result.rows.map(mapArtifact);
  } catch (error) {
    mapDbError(error);
  }
}

export async function listWorkflowRunArtifacts(runId: string): Promise<Artifact[]> {
  try {
    const result = await query<ArtifactRow>(
      `
        select
          id,
          task_id::text,
          workflow_run_id::text,
          kind,
          title,
          uri,
          metadata_json,
          body_markdown,
          body_text,
          created_by_actor_id::text,
          approved_status,
          created_at
        from public.artifacts
        where workflow_run_id = $1::uuid
        order by created_at desc
      `,
      [runId],
    );

    return result.rows.map(mapArtifact);
  } catch (error) {
    mapDbError(error);
  }
}
