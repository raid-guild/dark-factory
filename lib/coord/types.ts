export type TaskStatus =
  | "queued"
  | "claimed"
  | "in_progress"
  | "blocked"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "canceled";

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "canceled";

export type PresenceStatus = "idle" | "available" | "working" | "blocked" | "offline";

export type WorkflowRun = {
  id: string;
  workflow_template_id: string;
  status: WorkflowRunStatus;
  requested_by_actor_id?: string;
  started_at?: string;
  completed_at?: string;
  context_json?: Record<string, unknown>;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  owner_agent_id?: string;
  workflow_run_id?: string;
  blocked_reason?: string;
  due_at?: string;
};

export type AgentPresence = {
  agent_id: string;
  agent_name: string;
  status: PresenceStatus;
  current_task_id?: string;
  progress_pct?: number;
  last_heartbeat_at: string;
};
