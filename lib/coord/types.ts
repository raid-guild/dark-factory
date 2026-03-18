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

export type WorkflowTemplateSummary = {
  id: string;
  template_key: string;
  name: string;
  version: string;
  active: boolean;
  tasks?: Array<{
    key: string;
    title: string;
    task_type: string;
    priority: "low" | "normal" | "high" | "urgent";
    owner_agent_key?: string;
    depends_on?: string[];
  }>;
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

export type TaskRelationSummary = {
  id: string;
  title: string;
  task_type: string;
  status: TaskStatus;
  owner_agent_id?: string;
};

export type AgentPresence = {
  agent_id: string;
  agent_name: string;
  status: PresenceStatus;
  current_task_id?: string;
  progress_pct?: number;
  last_heartbeat_at: string;
};

export type HandoffStatus = "created" | "accepted" | "declined" | "completed";

export type Handoff = {
  id: string;
  from_task_id?: string;
  to_task_id?: string;
  from_actor_id?: string;
  to_actor_id?: string;
  note?: string;
  status: HandoffStatus;
  created_at: string;
  updated_at: string;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  actor_id?: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ArtifactApprovalStatus = "unreviewed" | "approved" | "rejected";

export type Artifact = {
  id: string;
  task_id?: string;
  workflow_run_id?: string;
  kind: string;
  title: string;
  uri: string;
  metadata_json: Record<string, unknown>;
  created_by_actor_id?: string;
  approved_status: ArtifactApprovalStatus;
  created_at: string;
};
