import type { WorkflowTemplateSummary } from "@/lib/coord/types";
import { DatabaseConfigError } from "@/lib/db/errors";
import { query } from "@/lib/db/pool";
import { getFallbackTemplateTasks } from "@/lib/db/workflow-runs";

type WorkflowTemplateRow = Omit<WorkflowTemplateSummary, "tasks"> & {
  definition_json?: Record<string, unknown> | null;
};

function parseTemplateTasks(definitionJson: Record<string, unknown> | null | undefined): WorkflowTemplateSummary["tasks"] {
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

function normalizeTemplateTasks(
  tasks: Array<{
    key: string;
    title: string;
    task_type: string;
    priority?: "low" | "normal" | "high" | "urgent";
    owner_agent_key?: string;
    depends_on?: string[];
  }>,
): NonNullable<WorkflowTemplateSummary["tasks"]> {
  return tasks.map((task) => ({
    key: task.key,
    title: task.title,
    task_type: task.task_type,
    priority: task.priority ?? "normal",
    owner_agent_key: task.owner_agent_key,
    depends_on: task.depends_on ?? [],
  }));
}

function buildDefinitionJson(
  definitionJson: Record<string, unknown> | null | undefined,
  tasks: NonNullable<WorkflowTemplateSummary["tasks"]>,
) {
  return {
    ...(definitionJson ?? {}),
    tasks,
  };
}

function mapWorkflowTemplateRow(row: WorkflowTemplateRow): WorkflowTemplateSummary {
  const parsedTasks = parseTemplateTasks(row.definition_json) ?? [];
  const normalizedTasks = parsedTasks.length
    ? normalizeTemplateTasks(parsedTasks)
    : normalizeTemplateTasks(getFallbackTemplateTasks(row.template_key, row.version));

  return {
    id: row.id,
    template_key: row.template_key,
    name: row.name,
    version: row.version,
    active: row.active,
    definition_json: buildDefinitionJson(row.definition_json, normalizedTasks),
    tasks: normalizedTasks,
  };
}

function mapDbError(error: unknown): never {
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    throw new DatabaseConfigError();
  }

  throw error;
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplateSummary[]> {
  try {
    const result = await query<WorkflowTemplateRow>(
      `
        select id, template_key, name, version, active, definition_json
        from public.workflow_templates
        order by active desc, template_key asc, version desc
      `,
    );

    return result.rows.map(mapWorkflowTemplateRow);
  } catch (error) {
    mapDbError(error);
  }
}

export async function updateWorkflowTemplate(input: {
  templateId: string;
  name?: string;
  active?: boolean;
  definitionJson?: Record<string, unknown>;
}): Promise<WorkflowTemplateSummary | null> {
  try {
    const updates: string[] = [];
    const values: unknown[] = [input.templateId];
    let index = 2;

    if (typeof input.name === "string") {
      updates.push(`name = $${index++}`);
      values.push(input.name);
    }

    if (typeof input.active === "boolean") {
      updates.push(`active = $${index++}`);
      values.push(input.active);
    }

    if (input.definitionJson) {
      updates.push(`definition_json = $${index++}::jsonb`);
      values.push(JSON.stringify(input.definitionJson));
    }

    if (!updates.length) {
      const existing = await query<WorkflowTemplateRow>(
        `
          select id, template_key, name, version, active, definition_json
          from public.workflow_templates
          where id = $1::uuid
          limit 1
        `,
        [input.templateId],
      );

      return existing.rows[0] ? mapWorkflowTemplateRow(existing.rows[0]) : null;
    }

    const result = await query<WorkflowTemplateRow>(
      `
        update public.workflow_templates
        set ${updates.join(", ")}
        where id = $1::uuid
        returning id, template_key, name, version, active, definition_json
      `,
      values,
    );

    const row = result.rows[0];
    if (!row) return null;

    return mapWorkflowTemplateRow(row);
  } catch (error) {
    mapDbError(error);
  }
}
