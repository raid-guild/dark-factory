"use client";

import { StatusPill } from "@/components/coord/StatusPill";
import { taskStatusMeta } from "@/components/coord/status";
import type { Task } from "@/lib/coord/types";

type Props = {
  task: Task;
  onSelect: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
};

export function TaskCard({ task, onSelect, onDragStart, onDragEnd, isDragging }: Props) {
  const status = taskStatusMeta[task.status];

  return (
    <button
      className={`task-card ${isDragging ? "task-card-dragging" : ""}`}
      draggable
      onClick={() => onSelect(task)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/task-id", task.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      type="button"
    >
      <div className="task-card-head">
        <h4>{task.title}</h4>
        <StatusPill className={status.className} label={status.label} />
      </div>
      <p className="task-card-meta">{task.task_type}</p>
      <p className="task-card-meta">
        Owner: <span>{task.owner_agent_id ?? "unassigned"}</span>
      </p>
      {task.blocked_reason ? <p className="task-blocked-note">{task.blocked_reason}</p> : null}
    </button>
  );
}
