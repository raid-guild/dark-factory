"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/coord/StatusPill";
import { taskStatusMeta } from "@/components/coord/status";
import type { Artifact, Handoff, Task, TaskEvent, TaskRelationSummary } from "@/lib/coord/types";

type Props = {
  task: Task | null;
  relatedTasks: Task[];
  runContext?: Record<string, unknown>;
  onClose: () => void;
  onTaskMutated: (taskId: string) => Promise<void>;
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

type TaskRelations = {
  depends_on: TaskRelationSummary[];
  dependents: TaskRelationSummary[];
};

export function TaskDrawer({ task, relatedTasks, runContext, onClose, onTaskMutated }: Props) {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [mailSummary, setMailSummary] = useState<TaskMailSummary | null>(null);
  const [relations, setRelations] = useState<TaskRelations>({ depends_on: [], dependents: [] });
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(WRITE_KEY_STORAGE) ?? "";
  });
  const [filePathsText, setFilePathsText] = useState("");
  const [blockedReason, setBlockedReason] = useState(task?.blocked_reason ?? "");
  const [completionNote, setCompletionNote] = useState("");
  const [mutationPending, setMutationPending] = useState<string | null>(null);
  const [targetTaskId, setTargetTaskId] = useState("");
  const [note, setNote] = useState("");
  const [artifactKind, setArtifactKind] = useState("note");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactUri, setArtifactUri] = useState("");
  const [artifactMetadataText, setArtifactMetadataText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableTargets = useMemo(() => {
    if (!task) return [];
    return relatedTasks.filter((candidate) => candidate.id !== task.id);
  }, [relatedTasks, task]);
  const latestHandoff = handoffs[0] ?? null;

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

    fetch(`/api/v1/tasks/${task.id}/relations`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { depends_on: [] as TaskRelationSummary[], dependents: [] as TaskRelationSummary[] };
        return (await response.json()) as TaskRelations;
      })
      .then((payload) =>
        setRelations({
          depends_on: Array.isArray(payload.depends_on) ? payload.depends_on : [],
          dependents: Array.isArray(payload.dependents) ? payload.dependents : [],
        }),
      )
      .catch(() => setRelations({ depends_on: [], dependents: [] }));

    fetch(`/api/v1/tasks/${task.id}/artifacts`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { items: [] as Artifact[] };
        return (await response.json()) as { items?: Artifact[] };
      })
      .then((payload) => setArtifacts(Array.isArray(payload.items) ? payload.items : []))
      .catch(() => setArtifacts([]));
  }, [task]);

  function parseFilePaths() {
    return filePathsText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  async function refreshTaskPanels() {
    if (!task) return;

    const [artifactsResponse, eventsResponse, handoffsResponse, mailResponse, relationsResponse] = await Promise.all([
      fetch(`/api/v1/tasks/${task.id}/artifacts`, { cache: "no-store" }),
      fetch(`/api/v1/tasks/${task.id}/events`, { cache: "no-store" }),
      fetch(`/api/v1/tasks/${task.id}/handoffs`, { cache: "no-store" }),
      fetch(`/api/v1/tasks/${task.id}/mail-summary`, { cache: "no-store" }),
      fetch(`/api/v1/tasks/${task.id}/relations`, { cache: "no-store" }),
    ]);

    if (artifactsResponse.ok) {
      const payload = (await artifactsResponse.json()) as { items?: Artifact[] };
      setArtifacts(Array.isArray(payload.items) ? payload.items : []);
    }

    if (eventsResponse.ok) {
      const payload = (await eventsResponse.json()) as { items?: TaskEvent[] };
      setEvents(Array.isArray(payload.items) ? payload.items : []);
    }

    if (handoffsResponse.ok) {
      const payload = (await handoffsResponse.json()) as { items?: Handoff[] };
      setHandoffs(Array.isArray(payload.items) ? payload.items : []);
    }

    if (mailResponse.ok) {
      setMailSummary((await mailResponse.json()) as TaskMailSummary);
    }

    if (relationsResponse.ok) {
      const payload = (await relationsResponse.json()) as TaskRelations;
      setRelations({
        depends_on: Array.isArray(payload.depends_on) ? payload.depends_on : [],
        dependents: Array.isArray(payload.dependents) ? payload.dependents : [],
      });
    }
  }

  async function mutateTask(action: "claim" | "start" | "block" | "complete") {
    if (!task) return;
    setError(null);
    setSuccess(null);

    if (!apiKey.trim()) {
      setError("Enter a write API key.");
      return;
    }

    const payload: Record<string, unknown> = {};
    const filePaths = parseFilePaths();
    if (filePaths.length) payload.file_paths = filePaths;
    if (action === "block") {
      if (!blockedReason.trim()) {
        setError("Enter a blocked reason.");
        return;
      }
      payload.blocked_reason = blockedReason.trim();
    }
    if (action === "complete" && completionNote.trim()) {
      payload.completion_note = completionNote.trim();
    }
    if (action === "complete" && artifactKind.trim() && artifactTitle.trim() && artifactUri.trim()) {
      let metadataJson: Record<string, unknown> = {};
      if (artifactMetadataText.trim()) {
        try {
          metadataJson = JSON.parse(artifactMetadataText) as Record<string, unknown>;
        } catch {
          setError("Artifact metadata must be valid JSON.");
          return;
        }
      }

      payload.artifacts = [
        {
          kind: artifactKind.trim(),
          title: artifactTitle.trim(),
          uri: artifactUri.trim(),
          metadata_json: metadataJson,
        },
      ];
    }

    setMutationPending(action);
    const response = await fetch(`/api/v1/tasks/${task.id}/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-df-api-key": apiKey.trim(),
      },
      body: JSON.stringify(payload),
    });
    setMutationPending(null);

    const body = (await response.json()) as Task & { message?: string; artifacts_created?: number };
    if (!response.ok) {
      setError(body.message ?? `Failed to ${action} task.`);
      return;
    }

    window.localStorage.setItem(WRITE_KEY_STORAGE, apiKey.trim());
    setSuccess(
      `Task ${
        action === "complete" ? "completed" : action === "block" ? "blocked" : action === "start" ? "started" : "claimed"
      }${action === "complete" && body.artifacts_created ? ` with ${body.artifacts_created} artifact${body.artifacts_created === 1 ? "" : "s"}` : ""}.`,
    );
    await onTaskMutated(task.id);
    await refreshTaskPanels();
  }

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

  async function handleCreateArtifact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;

    setError(null);
    setSuccess(null);

    if (!apiKey.trim()) {
      setError("Enter a write API key.");
      return;
    }

    if (!artifactKind.trim() || !artifactTitle.trim() || !artifactUri.trim()) {
      setError("Artifact kind, title, and uri are required.");
      return;
    }

    let metadataJson: Record<string, unknown> = {};
    if (artifactMetadataText.trim()) {
      try {
        metadataJson = JSON.parse(artifactMetadataText) as Record<string, unknown>;
      } catch {
        setError("Artifact metadata must be valid JSON.");
        return;
      }
    }

    const response = await fetch("/api/v1/artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-df-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        task_id: task.id,
        workflow_run_id: task.workflow_run_id,
        kind: artifactKind.trim(),
        title: artifactTitle.trim(),
        uri: artifactUri.trim(),
        metadata_json: metadataJson,
      }),
    });

    const payload = (await response.json()) as Artifact & { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "Failed to create artifact.");
      return;
    }

    window.localStorage.setItem(WRITE_KEY_STORAGE, apiKey.trim());
    setArtifacts((current) => [payload, ...current]);
    setArtifactKind("note");
    setArtifactTitle("");
    setArtifactUri("");
    setArtifactMetadataText("");
    setSuccess("Artifact captured.");
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

        <section className="drawer-section">
          <div className="drawer-section-head">
            <h4>Operate task</h4>
            <p>Operators use the same task lifecycle APIs that agents use.</p>
          </div>

          <div className="drawer-actions">
            {task.status === "queued" ? (
              <button disabled={mutationPending !== null} onClick={() => void mutateTask("claim")} type="button">
                {mutationPending === "claim" ? "Claiming..." : "Claim"}
              </button>
            ) : null}
            {(task.status === "claimed" || task.status === "blocked") ? (
              <button disabled={mutationPending !== null} onClick={() => void mutateTask("start")} type="button">
                {mutationPending === "start" ? "Starting..." : task.status === "blocked" ? "Resume" : "Start"}
              </button>
            ) : null}
            {(task.status === "in_progress" || task.status === "claimed") ? (
              <button disabled={mutationPending !== null} onClick={() => void mutateTask("block")} type="button">
                {mutationPending === "block" ? "Blocking..." : "Block"}
              </button>
            ) : null}
            {(task.status === "in_progress" || task.status === "waiting_approval") ? (
              <button className="button-primary" disabled={mutationPending !== null} onClick={() => void mutateTask("complete")} type="button">
                {mutationPending === "complete" ? "Completing..." : "Complete"}
              </button>
            ) : null}
          </div>

          <div className="handoff-form">
            <label className="create-run-field create-run-field-wide">
              <span>Reservation file paths</span>
              <textarea
                rows={4}
                value={filePathsText}
                onChange={(event) => setFilePathsText(event.target.value)}
                placeholder={"content/draft.md\ncontent/brief.md"}
              />
            </label>

            <label className="create-run-field create-run-field-wide">
              <span>Blocked reason</span>
              <textarea
                rows={3}
                value={blockedReason}
                onChange={(event) => setBlockedReason(event.target.value)}
                placeholder="What is preventing this task from moving forward?"
              />
            </label>

            <label className="create-run-field create-run-field-wide">
              <span>Completion note</span>
              <textarea
                rows={3}
                value={completionNote}
                onChange={(event) => setCompletionNote(event.target.value)}
                placeholder="Optional operator note for completion context"
              />
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
          </div>

          {error ? <p className="create-run-error">{error}</p> : null}
          {success ? <p className="create-run-success">{success}</p> : null}
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <h4>Task context</h4>
            <p>
              {task.task_type === "human.approval"
                ? "This task is an approval gate in the content flow."
                : task.owner_agent_id
                  ? `Assigned to ${task.owner_agent_id}.`
                  : "Currently unassigned."}
            </p>
          </div>

          {runContext && Object.keys(runContext).length ? (
            <article className="task-event-card">
              <div className="handoff-card-head">
                <strong>Run context</strong>
              </div>
              <pre className="task-event-payload">{JSON.stringify(runContext, null, 2)}</pre>
            </article>
          ) : null}

          {latestHandoff?.note ? (
            <article className="task-event-card">
              <div className="handoff-card-head">
                <strong>Latest handoff</strong>
                <span>{new Date(latestHandoff.created_at).toLocaleString()}</span>
              </div>
              <p className="handoff-card-meta">
                {latestHandoff.from_task_id === task.id ? "Outgoing" : "Incoming"} handoff context
              </p>
              <p className="handoff-card-note">{latestHandoff.note}</p>
            </article>
          ) : null}

          <div className="task-event-list">
            <article className="task-event-card">
              <div className="handoff-card-head">
                <strong>Depends on</strong>
                <span>{relations.depends_on.length}</span>
              </div>
              {relations.depends_on.length ? (
                <div className="mail-summary-list">
                  {relations.depends_on.map((item) => (
                    <div key={item.id} className="mail-summary-item">
                      <p>{item.title}</p>
                      <span>
                        {item.task_type} • {taskStatusMeta[item.status].label}
                        {item.owner_agent_id ? ` • ${item.owner_agent_id}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="type-body-md">This task has no prerequisite tasks.</p>
              )}
            </article>

            <article className="task-event-card">
              <div className="handoff-card-head">
                <strong>Unlocks</strong>
                <span>{relations.dependents.length}</span>
              </div>
              {relations.dependents.length ? (
                <div className="mail-summary-list">
                  {relations.dependents.map((item) => (
                    <div key={item.id} className="mail-summary-item">
                      <p>{item.title}</p>
                      <span>
                        {item.task_type} • {taskStatusMeta[item.status].label}
                        {item.owner_agent_id ? ` • ${item.owner_agent_id}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="type-body-md">No downstream tasks depend on this task yet.</p>
              )}
            </article>
          </div>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-head">
            <h4>Artifacts</h4>
            <p>Capture durable output references for this task.</p>
          </div>

          <div className="task-event-list">
            <article className="task-event-card">
              <div className="handoff-card-head">
                <strong>Current artifacts</strong>
                <span>{artifacts.length}</span>
              </div>
              {artifacts.length ? (
                <div className="mail-summary-list">
                  {artifacts.map((artifact) => (
                    <div key={artifact.id} className="mail-summary-item">
                      <p>{artifact.title}</p>
                      <span>
                        {artifact.kind} • {artifact.approved_status} •{" "}
                        {new Date(artifact.created_at).toLocaleString()}
                      </span>
                      <a href={artifact.uri} target="_blank" rel="noreferrer">
                        {artifact.uri}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="type-body-md">No artifacts recorded for this task yet.</p>
              )}
            </article>
          </div>

          <form className="handoff-form" onSubmit={(event) => void handleCreateArtifact(event)}>
            <label className="create-run-field">
              <span>Kind</span>
              <input value={artifactKind} onChange={(event) => setArtifactKind(event.target.value)} placeholder="research_brief" />
            </label>

            <label className="create-run-field create-run-field-wide">
              <span>Title</span>
              <input value={artifactTitle} onChange={(event) => setArtifactTitle(event.target.value)} placeholder="Research brief" />
            </label>

            <label className="create-run-field create-run-field-wide">
              <span>URI or path</span>
              <input value={artifactUri} onChange={(event) => setArtifactUri(event.target.value)} placeholder="outputs/research-brief-run-123.md" />
            </label>

            <label className="create-run-field create-run-field-wide">
              <span>Metadata JSON</span>
              <textarea
                rows={3}
                value={artifactMetadataText}
                onChange={(event) => setArtifactMetadataText(event.target.value)}
                placeholder='{"format":"markdown","source":"agent-content"}'
              />
            </label>

            <div className="drawer-actions">
              <button type="submit">Add artifact</button>
            </div>
          </form>
        </section>

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
