"use client";

import { StatusPill } from "@/components/coord/StatusPill";
import { taskStatusMeta } from "@/components/coord/status";
import type { Task } from "@/lib/coord/types";

type Props = {
  task: Task | null;
  onClose: () => void;
};

export function TaskDrawer({ task, onClose }: Props) {
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
      </section>
    </aside>
  );
}
