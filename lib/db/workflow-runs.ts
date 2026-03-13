import type { WorkflowRun, WorkflowRunStatus } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query, withTransaction } from "@/lib/db/pool";

type TaskPriority = "low" | "normal" | "high" | "urgent";

type CreateWorkflowRunInput = {
  workflowTemplateId: string;
  contextJson: Record<string, unknown>;
  requestedByAgentKey: string | null;
  status?: WorkflowRunStatus;
};

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

type WorkflowTemplateDefinitionTask = {
  key: string;
  title: string;
  description?: string;
  task_type: string;
  priority?: TaskPriority;
  owner_agent_key?: string;
  depends_on?: string[];
};

type WorkflowTemplateRecord = {
  id: string;
  template_key: string;
  name: string;
  version: string;
  definition_json: Record<string, unknown> | null;
};

type MaterializedTask = WorkflowTemplateDefinitionTask;

type UpdateWorkflowRunInput = {
  runId: string;
  status?: WorkflowRunStatus;
  contextJson?: Record<string, unknown>;
};

type WorkflowRunCreateResult =
  | {
      kind: "ok";
      run: WorkflowRun;
      tasks_created: number;
    }
  | {
      kind: "not_found" | "invalid_template";
      run: null;
      tasks_created: 0;
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

function parseTemplateTasks(definitionJson: Record<string, unknown> | null): WorkflowTemplateDefinitionTask[] {
  const tasks = definitionJson?.tasks;
  if (!Array.isArray(tasks)) return [];

  return tasks.flatMap((task) => {
    if (!task || typeof task !== "object") return [];
    const raw = task as Record<string, unknown>;
    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const taskType = typeof raw.task_type === "string" ? raw.task_type.trim() : "";
    if (!key || !title || !taskType) return [];

    return [
      {
        key,
        title,
        description: typeof raw.description === "string" ? raw.description : undefined,
        task_type: taskType,
        priority:
          raw.priority === "low" || raw.priority === "normal" || raw.priority === "high" || raw.priority === "urgent"
            ? raw.priority
            : "normal",
        owner_agent_key: typeof raw.owner_agent_key === "string" ? raw.owner_agent_key : undefined,
        depends_on: Array.isArray(raw.depends_on)
          ? raw.depends_on.filter((value): value is string => typeof value === "string" && value.length > 0)
          : [],
      },
    ];
  });
}

export function getFallbackTemplateTasks(templateKey: string, version: string): MaterializedTask[] {
  const templateRef = `${templateKey}:${version}`;

  if (templateRef === "content_pipeline:v1") {
    return [
      {
        key: "research",
        title: "Generate topic candidates",
        task_type: "memory.research",
        priority: "normal",
        owner_agent_key: "agent-memory",
      },
      {
        key: "brief",
        title: "Produce research brief",
        task_type: "knowledge.synthesis",
        priority: "high",
        owner_agent_key: "agent-knowledge",
        depends_on: ["research"],
      },
      {
        key: "draft",
        title: "Draft post variants",
        task_type: "content.drafting",
        priority: "high",
        owner_agent_key: "agent-content",
        depends_on: ["brief"],
      },
      {
        key: "approval",
        title: "Final human approval",
        task_type: "human.approval",
        priority: "urgent",
        depends_on: ["draft"],
      },
      {
        key: "distribution",
        title: "Distribution prep",
        task_type: "distribution.publish",
        priority: "normal",
        owner_agent_key: "agent-distribution",
        depends_on: ["approval"],
      },
    ];
  }

  if (templateRef === "newsletter_pipeline:v1") {
    return [
      {
        key: "brief",
        title: "Build newsletter brief",
        task_type: "knowledge.synthesis",
        priority: "high",
        owner_agent_key: "agent-knowledge",
      },
      {
        key: "draft",
        title: "Draft newsletter sections",
        task_type: "content.drafting",
        priority: "high",
        owner_agent_key: "agent-content",
        depends_on: ["brief"],
      },
      {
        key: "approval",
        title: "Final human approval",
        task_type: "human.approval",
        priority: "urgent",
        depends_on: ["draft"],
      },
      {
        key: "distribution",
        title: "Prepare distribution package",
        task_type: "distribution.publish",
        priority: "normal",
        owner_agent_key: "agent-distribution",
        depends_on: ["approval"],
      },
    ];
  }

  if (templateRef === "content_brief_to_draft:v1") {
    return [
      {
        key: "brief",
        title: "Build research brief",
        description: "Gather the topic context, relevant source angles, constraints, and a concise recommended framing for the draft.",
        task_type: "memory.research",
        priority: "high",
        owner_agent_key: "agent-memory",
      },
      {
        key: "draft",
        title: "Draft content output",
        description: "Turn the approved brief into the requested content output while following the operator guidance in the run context.",
        task_type: "content.drafting",
        priority: "high",
        owner_agent_key: "agent-content",
        depends_on: ["brief"],
      },
    ];
  }

  return [];
}

async function resolveRequestedByActorId(agentKey: string | null) {
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

export async function createWorkflowRun(input: CreateWorkflowRunInput): Promise<WorkflowRunCreateResult> {
  try {
    const requestedByActorId = await resolveRequestedByActorId(input.requestedByAgentKey);

    return await withTransaction(async (client) => {
      const templateResult = await client.query<WorkflowTemplateRecord>(
        `
          select id, template_key, name, version, definition_json
          from public.workflow_templates
          where id = $1::uuid
          limit 1
        `,
        [input.workflowTemplateId],
      );

      const template = templateResult.rows[0];
      if (!template) {
        return {
          run: null,
          tasks_created: 0,
          kind: "not_found" as const,
        };
      }

      const parsedTasks = parseTemplateTasks(template.definition_json);
      const materializedTasks = parsedTasks.length ? parsedTasks : getFallbackTemplateTasks(template.template_key, template.version);
      if (!materializedTasks.length) {
        return {
          run: null,
          tasks_created: 0,
          kind: "invalid_template" as const,
        };
      }

      const status = input.status ?? "running";
      const runResult = await client.query<WorkflowRunRow>(
        `
          insert into public.workflow_runs (
            workflow_template_id,
            status,
            requested_by_actor_id,
            started_at,
            context_json
          )
          values (
            $1::uuid,
            $2::workflow_run_status,
            $3::uuid,
            case when $2::workflow_run_status = 'running' then now() else null end,
            $4::jsonb
          )
          returning
            id,
            $5 as workflow_template_id,
            status,
            requested_by_actor_id,
            started_at,
            completed_at,
            context_json
        `,
        [
          template.id,
          status,
          requestedByActorId,
          JSON.stringify(input.contextJson ?? {}),
          `${template.template_key}:${template.version}`,
        ],
      );

      const run = mapWorkflowRun(runResult.rows[0]);
      const taskIdsByKey = new Map<string, string>();

      for (const task of materializedTasks) {
        let ownerAgentId: string | null = null;
        if (task.owner_agent_key) {
          const ownerResult = await client.query<{ id: string }>(
            `select id from public.agents where agent_key = $1 limit 1`,
            [task.owner_agent_key],
          );
          ownerAgentId = ownerResult.rows[0]?.id ?? null;
        }

        const taskResult = await client.query<{ id: string }>(
          `
            insert into public.tasks (
              title,
              description,
              task_type,
              status,
              priority,
              owner_agent_id,
              requested_by_actor_id,
              workflow_run_id
            )
            values ($1, $2, $3, 'queued', $4::task_priority, $5::uuid, $6::uuid, $7::uuid)
            returning id
          `,
          [
            task.title,
            task.description ?? null,
            task.task_type,
            task.priority ?? "normal",
            ownerAgentId,
            requestedByActorId,
            run.id,
          ],
        );

        taskIdsByKey.set(task.key, taskResult.rows[0].id);
      }

      for (const task of materializedTasks) {
        const taskId = taskIdsByKey.get(task.key);
        if (!taskId) continue;

        for (const dependencyKey of task.depends_on ?? []) {
          const dependencyId = taskIdsByKey.get(dependencyKey);
          if (!dependencyId) continue;

          await client.query(
            `
              insert into public.task_dependencies (task_id, depends_on_task_id)
              values ($1::uuid, $2::uuid)
              on conflict do nothing
            `,
            [taskId, dependencyId],
          );
        }
      }

      return {
        kind: "ok",
        run,
        tasks_created: materializedTasks.length,
      };
    });
  } catch (error) {
    mapDbError(error);
  }
}

export async function updateWorkflowRun(input: UpdateWorkflowRunInput): Promise<WorkflowRun | null> {
  try {
    const updates: string[] = [];
    const values: unknown[] = [input.runId];

    if (input.status) {
      values.push(input.status);
      updates.push(`status = $${values.length}::workflow_run_status`);
      if (input.status === "running") {
        updates.push(`started_at = coalesce(started_at, now())`);
      }
      if (input.status === "completed") {
        updates.push(`completed_at = coalesce(completed_at, now())`);
      }
      if (input.status !== "completed") {
        updates.push(`completed_at = case when $${values.length}::workflow_run_status = 'completed' then completed_at else null end`);
      }
    }

    if (input.contextJson) {
      values.push(JSON.stringify(input.contextJson));
      updates.push(`context_json = $${values.length}::jsonb`);
    }

    if (!updates.length) {
      return getWorkflowRunById(input.runId);
    }

    const result = await query<WorkflowRunRow>(
      `
        update public.workflow_runs wr
        set
          ${updates.join(",\n          ")},
          updated_at = now()
        from public.workflow_templates wt
        where wr.workflow_template_id = wt.id
          and wr.id = $1::uuid
        returning
          wr.id,
          coalesce(wt.template_key || ':' || wt.version, wt.template_key, wr.workflow_template_id::text) as workflow_template_id,
          wr.status,
          wr.requested_by_actor_id,
          wr.started_at,
          wr.completed_at,
          wr.context_json
      `,
      values,
    );

    return result.rows[0] ? mapWorkflowRun(result.rows[0]) : null;
  } catch (error) {
    mapDbError(error);
  }
}
