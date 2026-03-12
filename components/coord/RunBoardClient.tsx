"use client";

import Link from "next/link";
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

  useEffect(() => {
    Promise.all([loadRun(runId), loadTasks(runId)]).then(([runResult, tasksResult]) => {
      const fallbackRun = mockRuns.find((item) => item.id === runId) ?? null;
      const nextRun = runResult ?? fallbackRun;
      const nextTasks = tasksResult && tasksResult.length > 0 ? tasksResult : mockTasks.filter((t) => t.workflow_run_id === runId);

      setRun(nextRun);
      setTasks(nextTasks);
      setSource(runResult || tasksResult ? "api" : "mock");
      setPresence(mockPresence);
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

      <section className="kanban-and-activity">
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
        <aside className="activity-panel">
          <p className="type-label-sm">RECENT ACTIVITY</p>
          {activity.length ? (
            <ul>
              {activity.map((entry, index) => (
                <li key={`${index}-${entry}`}>{entry}</li>
              ))}
            </ul>
          ) : (
            <p className="type-body-md">Drag tasks between columns to log state changes.</p>
          )}
        </aside>
      </section>

      <TaskDrawer onClose={() => setSelectedTask(null)} relatedTasks={tasks} task={selectedTask} />
    </main>
  );
}
