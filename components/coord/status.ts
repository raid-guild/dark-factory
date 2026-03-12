import type { TaskStatus, WorkflowRunStatus } from "@/lib/coord/types";

type StatusMeta = {
  label: string;
  className: string;
};

export const taskStatusOrder: TaskStatus[] = [
  "queued",
  "claimed",
  "in_progress",
  "waiting_approval",
  "blocked",
  "completed",
  "failed",
  "canceled",
];

export const taskStatusMeta: Record<TaskStatus, StatusMeta> = {
  queued: { label: "Queued", className: "status-queued" },
  claimed: { label: "Claimed", className: "status-claimed" },
  in_progress: { label: "In Progress", className: "status-in-progress" },
  waiting_approval: { label: "Waiting Approval", className: "status-waiting-approval" },
  blocked: { label: "Blocked", className: "status-blocked" },
  completed: { label: "Completed", className: "status-completed" },
  failed: { label: "Failed", className: "status-failed" },
  canceled: { label: "Canceled", className: "status-canceled" },
};

export const runStatusMeta: Record<WorkflowRunStatus, StatusMeta> = {
  pending: { label: "Pending", className: "status-claimed" },
  running: { label: "Running", className: "status-in-progress" },
  blocked: { label: "Blocked", className: "status-blocked" },
  completed: { label: "Completed", className: "status-completed" },
  failed: { label: "Failed", className: "status-failed" },
  canceled: { label: "Canceled", className: "status-canceled" },
};
