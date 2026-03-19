"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { StatusPill } from "@/components/coord/StatusPill";
import { runStatusMeta } from "@/components/coord/status";
import { mockRuns } from "@/lib/coord/mock";
import type { WorkflowRun, WorkflowTemplateSummary } from "@/lib/coord/types";

async function loadRuns(): Promise<{ items: WorkflowRun[]; source: "api" | "mock" }> {
  try {
    const response = await fetch("/api/v1/workflow-runs", { cache: "no-store" });
    if (!response.ok) return { items: mockRuns, source: "mock" };
    const data = (await response.json()) as { items?: WorkflowRun[] };
    if (!Array.isArray(data.items) || data.items.length === 0) return { items: mockRuns, source: "mock" };
    return { items: data.items, source: "api" };
  } catch {
    return { items: mockRuns, source: "mock" };
  }
}

async function loadTemplates(): Promise<WorkflowTemplateSummary[]> {
  try {
    const response = await fetch("/api/v1/workflow-templates", { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { items?: WorkflowTemplateSummary[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

const CREATE_RUN_KEY_STORAGE = "dark-factory-admin-api-key";

export function RunsPageClient() {
  const [runs, setRuns] = useState<WorkflowRun[]>(mockRuns);
  const [source, setSource] = useState<"api" | "mock">("mock");
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CREATE_RUN_KEY_STORAGE) ?? "";
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [initialStatus, setInitialStatus] = useState<WorkflowRun["status"]>("pending");
  const [contextJsonText, setContextJsonText] = useState('{\n  "topic": "New workflow run"\n}');
  const [templateJsonText, setTemplateJsonText] = useState("{\n}");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function syncTemplateEditor(templateId: string, templateList: WorkflowTemplateSummary[]) {
    const nextTemplate = templateList.find((template) => template.id === templateId) ?? null;
    if (!nextTemplate) return;

    setTemplateJsonText(JSON.stringify(nextTemplate.definition_json ?? { tasks: nextTemplate.tasks ?? [] }, null, 2));
  }

  useEffect(() => {
    loadRuns().then((result) => {
      setRuns(result.items);
      setSource(result.source);
    });

    loadTemplates().then((items) => {
      setTemplates(items);
      setSelectedTemplateId((current) => {
        const nextId = current || items[0]?.id || "";
        if (nextId) syncTemplateEditor(nextId, items);
        return nextId;
      });
    });
  }, []);

  const statusCounts = useMemo(() => {
    return runs.reduce<Record<string, number>>((acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [runs]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  async function refreshRuns() {
    const result = await loadRuns();
    setRuns(result.items);
    setSource(result.source);
  }

  async function refreshTemplates() {
    const items = await loadTemplates();
    setTemplates(items);
    return items;
  }

  async function handleCreateRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!selectedTemplateId) {
      setCreateError("Select a workflow template.");
      return;
    }

    let contextJson: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(contextJsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setCreateError("context_json must be a JSON object.");
        return;
      }
      contextJson = parsed as Record<string, unknown>;
    } catch {
      setCreateError("context_json must be valid JSON.");
      return;
    }

    if (!apiKey.trim()) {
      setCreateError("Enter an admin or human API key.");
      return;
    }

    startTransition(async () => {
      window.localStorage.setItem(CREATE_RUN_KEY_STORAGE, apiKey.trim());

      const response = await fetch("/api/v1/workflow-runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-df-api-key": apiKey.trim(),
        },
        body: JSON.stringify({
          workflow_template_id: selectedTemplateId,
          status: initialStatus,
          context_json: contextJson,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        run?: WorkflowRun;
        tasks_created?: number;
      };

      if (!response.ok) {
        setCreateError(payload.message ?? "Failed to create workflow run.");
        return;
      }

      setCreateSuccess(`Created run ${payload.run?.id ?? ""} with ${payload.tasks_created ?? 0} tasks.`);
      await refreshRuns();
    });
  }

  async function handleUpdateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTemplateError(null);
    setTemplateSuccess(null);

    if (!selectedTemplateId) {
      setTemplateError("Select a workflow template.");
      return;
    }

    if (!apiKey.trim()) {
      setTemplateError("Enter an admin or human API key.");
      return;
    }

    let definitionJson: Record<string, unknown>;
    try {
      const parsed = JSON.parse(templateJsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setTemplateError("Template definition must be a JSON object.");
        return;
      }
      definitionJson = parsed as Record<string, unknown>;
    } catch {
      setTemplateError("Template definition must be valid JSON.");
      return;
    }

    const response = await fetch(`/api/v1/workflow-templates/${selectedTemplateId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-df-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        definition_json: definitionJson,
      }),
    });

    const payload = (await response.json()) as WorkflowTemplateSummary & { message?: string };
    if (!response.ok) {
      setTemplateError(payload.message ?? "Failed to update template.");
      return;
    }

    window.localStorage.setItem(CREATE_RUN_KEY_STORAGE, apiKey.trim());
    const items = await refreshTemplates();
    const refreshed = items.find((template) => template.id === selectedTemplateId) ?? payload;
    setTemplateJsonText(JSON.stringify(refreshed.definition_json ?? { tasks: refreshed.tasks ?? [] }, null, 2));
    setTemplateSuccess(`Updated template ${refreshed.name}. New runs will use the edited definition.`);
  }

  return (
    <main className="container-custom">
      <p className="type-label-sm">WORKFLOW RUNS</p>
      <h1 className="type-display-lg">Factory Queue</h1>
      <p className="type-body-md">
        {source === "api" ? "Live API data" : "Mock fallback data"} for workflow runs.
      </p>

      <section className="landing-panel create-run-panel">
        <div className="run-card-head">
          <div>
            <p className="type-label-sm">NEW RUN</p>
            <h2>Create a workflow run from an active template.</h2>
          </div>
        </div>

        <form className="create-run-form" onSubmit={handleCreateRun}>
          <label className="create-run-field">
            <span>Template</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedTemplateId(nextId);
                syncTemplateEditor(nextId, templates);
              }}
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.template_key}:{template.version})
                </option>
              ))}
            </select>
          </label>

          <label className="create-run-field">
            <span>Write API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="admin-local-1"
              autoComplete="off"
            />
          </label>

          <label className="create-run-field">
            <span>Initial status</span>
            <select value={initialStatus} onChange={(event) => setInitialStatus(event.target.value as WorkflowRun["status"])}>
              {Object.keys(runStatusMeta).map((status) => (
                <option key={status} value={status}>
                  {runStatusMeta[status as WorkflowRun["status"]].label}
                </option>
              ))}
            </select>
          </label>

          <label className="create-run-field create-run-field-wide">
            <span>Run context JSON</span>
            <textarea value={contextJsonText} onChange={(event) => setContextJsonText(event.target.value)} rows={7} />
          </label>

          {selectedTemplate?.tasks?.length ? (
            <div className="create-run-template-preview">
              <div className="drawer-section-head">
                <h4>Template task preview</h4>
                <p>{selectedTemplate.tasks.length} tasks will be materialized</p>
              </div>
              <div className="mail-summary-list">
                {selectedTemplate.tasks.map((task) => (
                  <div className="mail-summary-item" key={task.key}>
                    <p>
                      {task.title} <span className="type-label-sm">({task.task_type})</span>
                    </p>
                    <span>
                      owner: {task.owner_agent_key ?? "unassigned"} • priority: {task.priority}
                      {task.depends_on?.length ? ` • depends on: ${task.depends_on.join(", ")}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="create-run-actions">
            <button className="button-primary" type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create workflow run"}
            </button>
            {createError ? <p className="create-run-error">{createError}</p> : null}
            {createSuccess ? <p className="create-run-success">{createSuccess}</p> : null}
          </div>
        </form>
      </section>

      {selectedTemplate ? (
        <section className="landing-panel create-run-panel">
          <div className="run-card-head">
            <div>
              <p className="type-label-sm">TEMPLATE EDITOR</p>
              <h2>Edit the selected template definition.</h2>
            </div>
          </div>

          <form className="create-run-form" onSubmit={handleUpdateTemplate}>
            <label className="create-run-field create-run-field-wide">
              <span>Template definition JSON</span>
              <textarea rows={16} value={templateJsonText} onChange={(event) => setTemplateJsonText(event.target.value)} />
            </label>

            <div className="create-run-actions">
              <button type="submit">Save template</button>
              {templateError ? <p className="create-run-error">{templateError}</p> : null}
              {templateSuccess ? <p className="create-run-success">{templateSuccess}</p> : null}
            </div>
          </form>
        </section>
      ) : null}

      <section className="runs-summary">
        {Object.entries(statusCounts).map(([status, count]) => (
          <article key={status} className="summary-card">
            <p>{status.replace("_", " ")}</p>
            <strong>{count}</strong>
          </article>
        ))}
      </section>

      <section className="runs-list">
        {runs.map((run) => {
          const status = runStatusMeta[run.status];
          return (
            <Link className="run-card" href={`/runs/${run.id}`} key={run.id}>
              <div className="run-card-head">
                <h3>{run.id}</h3>
                <StatusPill className={status.className} label={status.label} />
              </div>
              <p>Template: {run.workflow_template_id}</p>
              <p>Started: {run.started_at ? new Date(run.started_at).toLocaleString() : "n/a"}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
