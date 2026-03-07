import type { AgentPresence, Task, WorkflowRun } from "@/lib/coord/types";

export const mockRuns: WorkflowRun[] = [
  {
    id: "run-content-001",
    workflow_template_id: "content_pipeline:v1",
    status: "running",
    started_at: new Date().toISOString(),
    context_json: { topic: "AI Coordination Patterns" },
  },
  {
    id: "run-content-002",
    workflow_template_id: "newsletter_pipeline:v1",
    status: "blocked",
    started_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    context_json: { issue: "Week 10" },
  },
];

export const mockTasks: Task[] = [
  {
    id: "task-001",
    title: "Generate topic candidates",
    task_type: "memory.research",
    status: "completed",
    priority: "normal",
    owner_agent_id: "agent-memory",
    workflow_run_id: "run-content-001",
  },
  {
    id: "task-002",
    title: "Select topic",
    task_type: "human.review",
    status: "completed",
    priority: "normal",
    owner_agent_id: "human-editor",
    workflow_run_id: "run-content-001",
  },
  {
    id: "task-003",
    title: "Produce research brief",
    task_type: "knowledge.synthesis",
    status: "in_progress",
    priority: "high",
    owner_agent_id: "agent-knowledge",
    workflow_run_id: "run-content-001",
  },
  {
    id: "task-004",
    title: "Draft post variants",
    task_type: "content.drafting",
    status: "queued",
    priority: "high",
    owner_agent_id: "agent-content",
    workflow_run_id: "run-content-001",
  },
  {
    id: "task-005",
    title: "Final human approval",
    task_type: "human.approval",
    status: "waiting_approval",
    priority: "urgent",
    owner_agent_id: "human-editor",
    workflow_run_id: "run-content-002",
  },
  {
    id: "task-006",
    title: "Distribution prep",
    task_type: "distribution.publish",
    status: "blocked",
    priority: "normal",
    owner_agent_id: "agent-distribution",
    blocked_reason: "Waiting on approval for selected draft",
    workflow_run_id: "run-content-002",
  },
];

export const mockPresence: AgentPresence[] = [
  {
    agent_id: "agent-memory",
    agent_name: "memory-manager",
    status: "available",
    last_heartbeat_at: new Date().toISOString(),
  },
  {
    agent_id: "agent-knowledge",
    agent_name: "knowledge-manager",
    status: "working",
    current_task_id: "task-003",
    progress_pct: 58,
    last_heartbeat_at: new Date().toISOString(),
  },
  {
    agent_id: "agent-content",
    agent_name: "content-drafter",
    status: "idle",
    last_heartbeat_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    agent_id: "agent-distribution",
    agent_name: "distribution-agent",
    status: "blocked",
    current_task_id: "task-006",
    progress_pct: 0,
    last_heartbeat_at: new Date(Date.now() - 1000 * 45).toISOString(),
  },
];
