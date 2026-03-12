"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/coord/StatusPill";
import { taskStatusMeta } from "@/components/coord/status";
import type { Handoff, Task, TaskEvent } from "@/lib/coord/types";

type Props = {
  task: Task | null;
  relatedTasks: Task[];
  onClose: () => void;
};

const WRITE_KEY_STORAGE = "dark-factory-admin-api-key";

export function TaskDrawer({ task, relatedTasks, onClose }: Props) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [targetTaskId, setTargetTaskId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableTargets = useMemo(() => {
    if (!task) return [];
    return relatedTasks.filter((candidate) => candidate.id !== task.id);
  }, [relatedTasks, task]);

  useEffect(() => {
    if (!task) return;

    const stored = window.localStorage.getItem(WRITE_KEY_STORAGE);
    if (stored) setApiKey(stored);
    setTargetTaskId("");
    setNote("");
    setError(null);
    setSuccess(null);

    fetch(`/api/v1/tasks/${task.id}/handoffs`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { items: [] as Handoff[] };
        return (await response.json()) as { items?: Handoff[] };
      })
      .then((payload) => setHandoffs(Array.isArray(payload.items) ? payload.items : []))
      .catch(() => setHandoffs([]));

    fetch(`/api/v1/tasks/${task.id}/events`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { items: [] as TaskEvent[] };
        return (await response.json()) as { items?: TaskEvent[] };
      })
      .then((payload) => setEvents(Array.isArray(payload.items) ? payload.items : []))
      .catch(() => setEvents([]));
  }, [task]);

  async function handleCreateHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;

    setError(null);
    setSuccess(null);

    if (!targetTaskId) {
      setError("Choose a target task for the handoff.");
      return;
    }

    if (!apiKey.trim()) {
      setError("Enter a write API key.");
      return;
    }

    const response = await fetch("/api/v1/handoffs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-df-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        from_task_id: task.id,
        to_task_id: targetTaskId,
        note: note.trim() || null,
      }),
    });

    const payload = (await response.json()) as Handoff & { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "Failed to create handoff.");
      return;
    }

    window.localStorage.setItem(WRITE_KEY_STORAGE, apiKey.trim());
    setHandoffs((current) => [payload, ...current]);
    setEvents((current) => [
      {
        id: `local-${Date.now()}`,
        task_id: task.id,
        event_type: "handoff.created",
        payload: { to_task_id: targetTaskId, note: note.trim() || null },
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);
    setTargetTaskId("");
    setNote("");
    setSuccess("Handoff created.");
  }

  if (!task) return null;

  const status = taskStatusMeta[task.status];

  return (
    <aside className="drawer-backdrop" onClick={onClose}>
      <section className="task-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-top">
          <p className="type-label-sm">TASK DETAILS</p>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <h3>{task.title}</h3>
        <StatusPill className={status.className} label={status.label} />

        <dl className="drawer-grid">
          <div>
            <dt>Task ID</dt>
            <dd>{task.id}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{task.task_type}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{task.priority}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{task.owner_agent_id ?? "unassigned"}</dd>
          </div>
        </dl>

        {task.description ? (
          <>
            <h4>Description</h4>
            <p>{task.description}</p>
          </>
        ) : null}

        {task.blocked_reason ? (
          <>
            <h4>Blocked Reason</h4>
            <p>{task.blocked_reason}</p>
          </>
        ) : null}

        <div className="drawer-actions">
          <button type="button">Mark In Progress</button>
          <button type="button">Request Approval</button>
          <button type="button">Attach Artifact</button>
        </div>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <h4>Activity</h4>
            <p>{events.length ? `${events.length} recorded events` : "No activity recorded yet"}</p>
          </div>

          <div className="task-event-list">
            {events.length ? (
              events.map((event) => (
                <article className="task-event-card" key={event.id}>
                  <div className="handoff-card-head">
                    <strong>{event.event_type}</strong>
                    <span>{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  {event.actor_id ? <p className="handoff-card-meta">Actor: {event.actor_id}</p> : null}
                  {Object.keys(event.payload).length ? (
                    <pre className="task-event-payload">{JSON.stringify(event.payload, null, 2)}</pre>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="type-body-md">This task does not have an event history yet.</p>
            )}
          </div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <h4>Handoffs</h4>
            <p>{handoffs.length ? `${handoffs.length} linked handoff${handoffs.length === 1 ? "" : "s"}` : "No handoffs yet"}</p>
          </div>

          <form className="handoff-form" onSubmit={handleCreateHandoff}>
            <label className="create-run-field">
              <span>Target task</span>
              <select value={targetTaskId} onChange={(event) => setTargetTaskId(event.target.value)}>
                <option value="">Select a task</option>
                {availableTargets.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title} ({candidate.status})
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

            <label className="create-run-field create-run-field-wide">
              <span>Note</span>
              <textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What should the next task or agent pick up from here?"
              />
            </label>

            <div className="create-run-actions">
              <button className="button-primary" type="submit">
                Create handoff
              </button>
              {error ? <p className="create-run-error">{error}</p> : null}
              {success ? <p className="create-run-success">{success}</p> : null}
            </div>
          </form>

          <div className="handoff-list">
            {handoffs.length ? (
              handoffs.map((handoff) => (
                <article className="handoff-card" key={handoff.id}>
                  <div className="handoff-card-head">
                    <strong>{handoff.status}</strong>
                    <span>{new Date(handoff.created_at).toLocaleString()}</span>
                  </div>
                  <p className="handoff-card-meta">
                    {handoff.from_task_id === task.id ? "Outgoing" : "Incoming"} handoff
                  </p>
                  <p className="handoff-card-meta">From: {handoff.from_task_id ?? "n/a"}</p>
                  <p className="handoff-card-meta">To: {handoff.to_task_id ?? "n/a"}</p>
                  {handoff.note ? <p className="handoff-card-note">{handoff.note}</p> : null}
                </article>
              ))
            ) : (
              <p className="type-body-md">This task has no recorded handoffs yet.</p>
            )}
          </div>
        </section>
      </section>
    </aside>
  );
}
