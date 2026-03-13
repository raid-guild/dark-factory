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

type TaskMailSummary = {
  enabled: boolean;
  project_url?: string;
  thread_id?: string;
  thread_url?: string;
  recent_messages: Array<{
    id: number;
    subject?: string;
    from?: string;
    created_ts?: string;
    importance?: string;
  }>;
  active_reservations: Array<{
    id: number;
    agent: string;
    path_pattern: string;
    reason?: string | null;
    stale?: boolean;
  }>;
  reservation_conflicts: number;
};

export function TaskDrawer({ task, relatedTasks, onClose }: Props) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [mailSummary, setMailSummary] = useState<TaskMailSummary | null>(null);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(WRITE_KEY_STORAGE) ?? "";
  });
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

    fetch(`/api/v1/tasks/${task.id}/mail-summary`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as TaskMailSummary;
      })
      .then((payload) => setMailSummary(payload))
      .catch(() => setMailSummary(null));
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
            <h4>Agent Mail</h4>
            <p>{mailSummary?.enabled ? `Thread ${mailSummary.thread_id ?? "n/a"}` : "Agent Mail not available for this task"}</p>
          </div>

          {mailSummary?.enabled ? (
            <div className="task-event-list">
              <article className="task-event-card">
                <div className="handoff-card-head">
                  <strong>Links</strong>
                </div>
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
              </article>

              <article className="task-event-card">
                <div className="handoff-card-head">
                  <strong>Recent task messages</strong>
                  <span>{mailSummary.recent_messages.length}</span>
                </div>
                {mailSummary.recent_messages.length ? (
                  <div className="mail-summary-list">
                    {mailSummary.recent_messages.map((message) => (
                      <div key={message.id} className="mail-summary-item">
                        <p>{message.subject ?? "Untitled message"}</p>
                        <span>
                          {message.from ?? "unknown"} • {message.importance ?? "normal"} •{" "}
                          {message.created_ts ? new Date(message.created_ts).toLocaleString() : "n/a"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="type-body-md">No task-specific messages in the thread yet.</p>
                )}
              </article>

              <article className="task-event-card">
                <div className="handoff-card-head">
                  <strong>Active reservations</strong>
                  <span>{mailSummary.active_reservations.length}</span>
                </div>
                {mailSummary.active_reservations.length ? (
                  <div className="mail-summary-list">
                    {mailSummary.active_reservations.map((reservation) => (
                      <div key={reservation.id} className="mail-summary-item">
                        <p>{reservation.path_pattern}</p>
                        <span>
                          {reservation.agent}
                          {reservation.reason ? ` • ${reservation.reason}` : ""}
                          {reservation.stale ? " • stale" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="type-body-md">No active reservations linked to this task.</p>
                )}
                {mailSummary.reservation_conflicts ? (
                  <p className="create-run-error">Reservation conflicts: {mailSummary.reservation_conflicts}</p>
                ) : null}
              </article>
            </div>
          ) : null}
        </section>

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
