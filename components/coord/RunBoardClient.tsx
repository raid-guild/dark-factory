"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { PresenceBar } from "@/components/coord/PresenceBar";
import { StatusPill } from "@/components/coord/StatusPill";
import { TaskCard } from "@/components/coord/TaskCard";
import { TaskDrawer } from "@/components/coord/TaskDrawer";
import { runStatusMeta, taskStatusMeta, taskStatusOrder } from "@/components/coord/status";
import { mockPresence, mockRuns, mockTasks } from "@/lib/coord/mock";
import type { AgentPresence, Task, TaskStatus, WorkflowRun } from "@/lib/coord/types";

type Props = {
  runId: string;
};

type WorkflowRunMailSummary = {
  enabled: boolean;
  project_url?: string;
  thread_id?: string;
  thread_url?: string;
  latest_subject?: string;
  thread_digest?: string;
  participants: string[];
  message_count: number;
  urgent_unread_count: number;
  active_reservations: number;
  reservation_conflicts: number;
  stale_reservations: number;
};

async function loadRun(runId: string): Promise<WorkflowRun | null> {
  try {
    const response = await fetch(`/api/v1/workflow-runs/${runId}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as WorkflowRun;
  } catch {
    return null;
  }
}

async function loadTasks(runId: string): Promise<Task[] | null> {
  try {
    const response = await fetch(`/api/v1/tasks?workflow_run_id=${runId}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { items?: Task[] };
    if (!Array.isArray(data.items)) return null;
    return data.items;
  } catch {
    return null;
  }
}

async function loadMailSummary(runId: string): Promise<WorkflowRunMailSummary | null> {
  try {
    const response = await fetch(`/api/v1/workflow-runs/${runId}/mail-summary`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as WorkflowRunMailSummary;
  } catch {
    return null;
  }
}

export function RunBoardClient({ runId }: Props) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [tasks, setTasks] = useState<Task[]>(mockTasks.filter((t) => t.workflow_run_id === runId));
  const [presence, setPresence] = useState<AgentPresence[]>(mockPresence);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [source, setSource] = useState<"api" | "mock">("mock");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);
  const [mailSummary, setMailSummary] = useState<WorkflowRunMailSummary | null>(null);
  const [runApiKey, setRunApiKey] = useState("");
  const [runContextText, setRunContextText] = useState("{\n}");
  const [runStatusDraft, setRunStatusDraft] = useState<WorkflowRun["status"]>("running");
  const [runUpdateError, setRunUpdateError] = useState<string | null>(null);
  const [runUpdateSuccess, setRunUpdateSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(false);

  useEffect(() => {
    Promise.all([loadRun(runId), loadTasks(runId), loadMailSummary(runId)]).then(([runResult, tasksResult, mailResult]) => {
      const fallbackRun = mockRuns.find((item) => item.id === runId) ?? null;
      const nextRun = runResult ?? fallbackRun;
      const nextTasks = tasksResult && tasksResult.length > 0 ? tasksResult : mockTasks.filter((t) => t.workflow_run_id === runId);

      setRun(nextRun);
      setTasks(nextTasks);
      setSource(runResult || tasksResult ? "api" : "mock");
      setPresence(mockPresence);
      setMailSummary(mailResult);
      if (nextRun) {
        setRunStatusDraft(nextRun.status);
        setRunContextText(JSON.stringify(nextRun.context_json ?? {}, null, 2));
      }
      const stored = window.localStorage.getItem("dark-factory-admin-api-key");
      if (stored) setRunApiKey(stored);
      setIsLoading(false);
    });
  }, [runId]);

  const owners = useMemo(() => {
    const set = new Set(tasks.map((task) => task.owner_agent_id).filter(Boolean));
    return ["all", ...Array.from(set)] as string[];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchOwner = ownerFilter === "all" || task.owner_agent_id === ownerFilter;
      const matchDone = !hideDone || !["completed", "failed", "canceled"].includes(task.status);
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        task.title.toLowerCase().includes(q) ||
        task.task_type.toLowerCase().includes(q) ||
        (task.owner_agent_id ?? "").toLowerCase().includes(q);
      return matchOwner && matchDone && matchQuery;
    });
  }, [hideDone, ownerFilter, searchQuery, tasks]);

  const grouped = useMemo(() => {
    return taskStatusOrder.map((status) => ({
      status,
      tasks: filteredTasks.filter((task) => task.status === status),
    }));
  }, [filteredTasks]);

  function moveTask(taskId: string, nextStatus: TaskStatus) {
    setTasks((prev) => {
      const current = prev.find((task) => task.id === taskId);
      if (!current || current.status === nextStatus) return prev;

      const next = prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task));
      const fromLabel = taskStatusMeta[current.status].label;
      const toLabel = taskStatusMeta[nextStatus].label;
      const now = new Date().toLocaleTimeString();
      setActivity((logs) => [`${now}: ${current.title} moved ${fromLabel} -> ${toLabel}`, ...logs].slice(0, 12));
      return next;
    });
  }

  async function handleRunUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunUpdateError(null);
    setRunUpdateSuccess(null);

    let contextJson: Record<string, unknown>;
    try {
      const parsed = JSON.parse(runContextText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setRunUpdateError("Run context must be a JSON object.");
        return;
      }
      contextJson = parsed as Record<string, unknown>;
    } catch {
      setRunUpdateError("Run context must be valid JSON.");
      return;
    }

    if (!runApiKey.trim()) {
      setRunUpdateError("Enter an admin or human API key.");
      return;
    }

    const response = await fetch(`/api/v1/workflow-runs/${runId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-df-api-key": runApiKey.trim(),
      },
      body: JSON.stringify({
        status: runStatusDraft,
        context_json: contextJson,
      }),
    });

    const payload = (await response.json()) as WorkflowRun & { message?: string };
    if (!response.ok) {
      setRunUpdateError(payload.message ?? "Failed to update workflow run.");
      return;
    }

    window.localStorage.setItem("dark-factory-admin-api-key", runApiKey.trim());
    setRun(payload);
    setRunContextText(JSON.stringify(payload.context_json ?? {}, null, 2));
    setRunUpdateSuccess("Workflow run updated.");
  }

  if (isLoading) {
    return (
      <main className="container-custom">
        <Link className="back-link" href="/runs">
          Back to runs
        </Link>
        <p className="type-label-sm">WORKFLOW RUN</p>
        <section className="run-loading-shell">
          <div className="run-loading-block run-loading-title" />
          <div className="run-loading-block run-loading-subtitle" />
          <div className="run-loading-grid">
            <div className="run-loading-card" />
            <div className="run-loading-card" />
            <div className="run-loading-card" />
          </div>
        </section>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="container-custom">
        <Link className="back-link" href="/runs">
          Back to runs
        </Link>
        <h1 className="type-display-lg">Run not found</h1>
      </main>
    );
  }

  const runStatus = runStatusMeta[run.status];

  return (
    <main className="container-custom">
      <Link className="back-link" href="/runs">
        Back to runs
      </Link>
      <p className="type-label-sm">WORKFLOW RUN</p>
      <div className="run-header">
        <h1>{run.id}</h1>
        <StatusPill className={runStatus.className} label={runStatus.label} />
      </div>
      <p className="type-body-md">
        Template: {run.workflow_template_id} • Data source: {source === "api" ? "API + fallback" : "mock fallback"}
      </p>

      <section className="landing-panel create-run-panel">
        <div className="run-card-head">
          <div>
            <p className="type-label-sm">RUN CONTROLS</p>
            <h2>Update run status and context.</h2>
          </div>
        </div>

        <form className="create-run-form" onSubmit={handleRunUpdate}>
          <label className="create-run-field">
            <span>Run status</span>
            <select value={runStatusDraft} onChange={(event) => setRunStatusDraft(event.target.value as WorkflowRun["status"])}>
              {Object.keys(runStatusMeta).map((status) => (
                <option key={status} value={status}>
                  {runStatusMeta[status as WorkflowRun["status"]].label}
                </option>
              ))}
            </select>
          </label>

          <label className="create-run-field">
            <span>Write API key</span>
            <input
              type="password"
              value={runApiKey}
              onChange={(event) => setRunApiKey(event.target.value)}
              placeholder="admin-local-1"
              autoComplete="off"
            />
          </label>

          <label className="create-run-field create-run-field-wide">
            <span>Run context JSON</span>
            <textarea rows={7} value={runContextText} onChange={(event) => setRunContextText(event.target.value)} />
          </label>

          <div className="create-run-actions">
            <button className="button-primary" type="submit">
              Update workflow run
            </button>
            {runUpdateError ? <p className="create-run-error">{runUpdateError}</p> : null}
            {runUpdateSuccess ? <p className="create-run-success">{runUpdateSuccess}</p> : null}
          </div>
        </form>
      </section>

      <section className="board-controls">
        <input
          aria-label="Search tasks"
          className="board-input"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search title, type, owner..."
          value={searchQuery}
        />
        <select
          aria-label="Filter owner"
          className="board-select"
          onChange={(e) => setOwnerFilter(e.target.value)}
          value={ownerFilter}
        >
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner === "all" ? "All owners" : owner}
            </option>
          ))}
        </select>
        <label className="board-toggle">
          <input checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} type="checkbox" />
          Hide done
        </label>
      </section>

      <PresenceBar presence={presence} />

      <section className={`kanban-and-activity ${activityExpanded ? "activity-expanded" : "activity-collapsed"}`}>
        <div className="kanban-board-wrap">
          <div className="kanban-board">
            {grouped.map((column) => {
              const meta = taskStatusMeta[column.status];
              return (
                <article
                  className={`kanban-column ${dropStatus === column.status ? "kanban-column-drop-target" : ""}`}
                  key={column.status}
                  onDragLeave={() => setDropStatus((prev) => (prev === column.status ? null : prev))}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropStatus(column.status);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const taskId = event.dataTransfer.getData("text/task-id");
                    if (taskId) moveTask(taskId, column.status);
                    setDropStatus(null);
                    setDragTaskId(null);
                  }}
                >
                  <div className="kanban-column-head">
                    <StatusPill className={meta.className} label={meta.label} />
                    <span>{column.tasks.length}</span>
                  </div>
                  <div className="kanban-cards">
                    {column.tasks.length ? (
                      column.tasks.map((task) => (
                        <TaskCard
                          isDragging={dragTaskId === task.id}
                          key={task.id}
                          onDragEnd={() => setDragTaskId(null)}
                          onDragStart={setDragTaskId}
                          onSelect={setSelectedTask}
                          task={task}
                        />
                      ))
                    ) : (
                      <p className="empty-column">No tasks</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <aside className={`activity-panel ${activityExpanded ? "activity-panel-expanded" : "activity-panel-collapsed"}`}>
          <div className="activity-panel-head">
            <p className="type-label-sm">RECENT ACTIVITY</p>
            <button className="activity-toggle" onClick={() => setActivityExpanded((value) => !value)} type="button">
              {activityExpanded ? "Hide" : "Show"}
            </button>
          </div>

          {activityExpanded ? (
            <>
              {mailSummary?.enabled ? (
                <div className="mail-summary-panel">
                  <p className="mail-summary-title">Agent Mail</p>
                  <p className="mail-summary-line">
                    {mailSummary.project_url ? (
                      <a href={mailSummary.project_url} target="_blank" rel="noreferrer">
                        Open project
                      </a>
                    ) : (
                      <span>Project link unavailable</span>
                    )}
                    {mailSummary.thread_url ? (
                      <>
                        {" • "}
                        <a href={mailSummary.thread_url} target="_blank" rel="noreferrer">
                          Open thread
                        </a>
                      </>
                    ) : null}
                  </p>
                  <p className="mail-summary-line">Thread: {mailSummary.thread_id ?? "n/a"}</p>
                  <p className="mail-summary-line">Messages: {mailSummary.message_count}</p>
                  <p className="mail-summary-line">Urgent unread: {mailSummary.urgent_unread_count}</p>
                  <p className="mail-summary-line">
                    Reservations: {mailSummary.active_reservations} active / {mailSummary.reservation_conflicts} conflicts
                  </p>
                  {mailSummary.stale_reservations ? (
                    <p className="mail-summary-line">Stale reservations: {mailSummary.stale_reservations}</p>
                  ) : null}
                  {mailSummary.thread_digest ? <p className="mail-summary-digest">{mailSummary.thread_digest}</p> : null}
                  {mailSummary.latest_subject ? <p className="mail-summary-line">Latest: {mailSummary.latest_subject}</p> : null}
                </div>
              ) : null}
              {activity.length ? (
                <ul>
                  {activity.map((entry, index) => (
                    <li key={`${index}-${entry}`}>{entry}</li>
                  ))}
                </ul>
              ) : (
                <p className="type-body-md">Drag tasks between columns to log state changes.</p>
              )}
            </>
          ) : (
            <div className="activity-compact">
              <p>{mailSummary?.urgent_unread_count ?? 0} unread</p>
              <p>{mailSummary?.message_count ?? 0} msgs</p>
              <p>{activity.length} events</p>
            </div>
          )}
        </aside>
      </section>

      <TaskDrawer key={selectedTask?.id ?? "task-drawer"} onClose={() => setSelectedTask(null)} relatedTasks={tasks} task={selectedTask} />
    </main>
  );
}
