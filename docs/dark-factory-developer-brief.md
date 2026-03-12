# Dark Factory Developer Brief (MVP)

## 1. Product Intent

Dark Factory is an API-first coordination runtime for humans and autonomous agents collaborating on structured workflows.

The MVP is intentionally backend-heavy:
- durable coordination state
- append-only audit trail
- lightweight integration contract for agents
- human approval gates

Dark Factory coordinates external artifacts. It does not replace artifact storage systems.

## 2. MVP Outcomes

The MVP is successful when teams can:
- register agents and track live presence
- create tasks and run workflow pipelines
- emit durable events for every meaningful transition
- request and resolve approvals
- attach artifact references to tasks and runs
- execute handoffs across agents/humans with traceability

## 3. Architecture (MVP)

- `Next.js` app using Route Handlers (`app/api/*`)
- `Supabase Postgres` as primary store
- `Supabase Auth` for humans
- Agent auth via API keys/service tokens
- Optional queue/cron later (initially synchronous API actions)

## 4. Core Domain Model

### Actors
- `agent`: autonomous runtime participant
- `human`: authenticated user
- `admin`: elevated human with override capability

### Main entities
- `agents`: static registration and capabilities
- `agent_presence`: latest mutable status per agent
- `events`: append-only cross-domain event log
- `tasks`: unit of work with lifecycle
- `task_events`: append-only task-local event stream
- `workflow_templates`: reusable workflow definitions
- `workflow_runs`: concrete execution of a template
- `artifacts`: external references linked to tasks/runs
- `handoffs`: explicit transfer records
- `approvals`: human decision objects

## 5. State Machines

### Task status
- `queued`
- `claimed`
- `in_progress`
- `blocked`
- `waiting_approval`
- `completed`
- `failed`
- `canceled`

Valid transitions:
- `queued -> claimed`
- `claimed -> in_progress | blocked | canceled`
- `in_progress -> waiting_approval | blocked | completed | failed`
- `waiting_approval -> in_progress | completed | failed`
- `blocked -> in_progress | canceled | failed`

### Workflow run status
- `pending`
- `running`
- `blocked`
- `completed`
- `failed`
- `canceled`

### Approval status
- `pending`
- `approved`
- `rejected`
- `revision_requested`

### Presence status
- `idle`
- `available`
- `working`
- `blocked`
- `offline`

## 6. API Contract (v1)

Base path: `/api/v1`

### Agents
- `POST /agents/register`
- `POST /agents/register-self`
- `PATCH /agents/:agentId`
- `POST /agents/:agentId/heartbeat`
- `GET /agents/:agentId/presence`
- `POST /agents/:agentId/events`
- `GET /agents/:agentId/tasks?status=queued,in_progress`

### Tasks
- `POST /tasks`
- `GET /tasks`
- `GET /tasks/:taskId`
- `PATCH /tasks/:taskId`
- `POST /tasks/:taskId/claim`
- `POST /tasks/:taskId/start`
- `POST /tasks/:taskId/block`
- `POST /tasks/:taskId/complete`
- `POST /tasks/:taskId/fail`
- `POST /tasks/:taskId/cancel`
- `POST /tasks/:taskId/comments`

### Workflow runs
- `POST /workflow-runs`
- `GET /workflow-runs`
- `GET /workflow-runs/:runId`
- `POST /workflow-runs/:runId/advance`
- `POST /workflow-runs/:runId/block`
- `POST /workflow-runs/:runId/cancel`

### Approvals
- `POST /approvals`
- `GET /approvals/pending`
- `GET /approvals/:approvalId`
- `POST /approvals/:approvalId/approve`
- `POST /approvals/:approvalId/reject`
- `POST /approvals/:approvalId/revise`

### Artifacts
- `POST /artifacts`
- `GET /artifacts/:artifactId`
- `GET /tasks/:taskId/artifacts`
- `GET /workflow-runs/:runId/artifacts`
- `POST /artifacts/:artifactId/mark-approved`

### Handoffs
- `POST /handoffs`
- `GET /handoffs/:handoffId`
- `GET /tasks/:taskId/handoffs`

## 7. Request/Response Shape (minimal)

### `POST /agents/:agentId/heartbeat`
```json
{
  "status": "working",
  "station": "drafting",
  "current_task_id": "uuid-or-null",
  "current_workflow_run_id": "uuid-or-null",
  "progress_pct": 55,
  "status_message": "Draft variant B"
}
```

### `POST /tasks/:taskId/block`
```json
{
  "reason_code": "missing_input",
  "blocked_reason": "Need source links for section 2"
}
```

### `POST /approvals`
```json
{
  "task_id": "uuid",
  "artifact_id": "uuid",
  "requested_from_actor_id": "uuid",
  "note": "Please approve final draft for publish"
}
```

## 8. Supabase/Postgres Schema (first pass)

```sql
create extension if not exists "pgcrypto";

create type actor_type as enum ('human', 'agent');
create type agent_status as enum ('active', 'inactive');
create type presence_status as enum ('idle', 'available', 'working', 'blocked', 'offline');
create type task_status as enum ('queued', 'claimed', 'in_progress', 'blocked', 'waiting_approval', 'completed', 'failed', 'canceled');
create type task_priority as enum ('low', 'normal', 'high', 'urgent');
create type workflow_run_status as enum ('pending', 'running', 'blocked', 'completed', 'failed', 'canceled');
create type approval_status as enum ('pending', 'approved', 'rejected', 'revision_requested');
create type handoff_status as enum ('created', 'accepted', 'declined', 'completed');
create type artifact_approval_status as enum ('unreviewed', 'approved', 'rejected');

create table agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text unique not null,
  name text not null,
  description text,
  type text not null default 'general',
  capabilities jsonb not null default '[]'::jsonb,
  status agent_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table actors (
  id uuid primary key default gen_random_uuid(),
  actor_type actor_type not null,
  human_user_id uuid,
  agent_id uuid references agents(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique(actor_type, human_user_id),
  unique(actor_type, agent_id)
);

create table workflow_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  name text not null,
  version text not null,
  definition_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(template_key, version)
);

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_template_id uuid not null references workflow_templates(id),
  status workflow_run_status not null default 'pending',
  requested_by_actor_id uuid references actors(id),
  started_at timestamptz,
  completed_at timestamptz,
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_type text not null,
  status task_status not null default 'queued',
  priority task_priority not null default 'normal',
  owner_agent_id uuid references agents(id),
  requested_by_actor_id uuid references actors(id),
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  blocked_reason text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table agent_presence (
  agent_id uuid primary key references agents(id) on delete cascade,
  status presence_status not null,
  station text,
  current_task_id uuid references tasks(id) on delete set null,
  current_workflow_run_id uuid references workflow_runs(id) on delete set null,
  progress_pct int check (progress_pct between 0 and 100),
  status_message text,
  last_heartbeat_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references actors(id),
  agent_id uuid references agents(id),
  task_id uuid references tasks(id),
  workflow_run_id uuid references workflow_runs(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references actors(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete set null,
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  kind text not null,
  title text not null,
  uri text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by_actor_id uuid references actors(id),
  approved_status artifact_approval_status not null default 'unreviewed',
  created_at timestamptz not null default now()
);

create table handoffs (
  id uuid primary key default gen_random_uuid(),
  from_task_id uuid references tasks(id) on delete set null,
  to_task_id uuid references tasks(id) on delete set null,
  from_actor_id uuid references actors(id),
  to_actor_id uuid references actors(id),
  note text,
  status handoff_status not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete set null,
  artifact_id uuid references artifacts(id) on delete set null,
  requested_from_actor_id uuid references actors(id),
  status approval_status not null default 'pending',
  note text,
  decided_by_actor_id uuid references actors(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_events_task_id on events(task_id);
create index idx_events_workflow_run_id on events(workflow_run_id);
create index idx_events_event_type on events(event_type);
create index idx_task_events_task_id on task_events(task_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_owner_agent_id on tasks(owner_agent_id);
create index idx_tasks_workflow_run_id on tasks(workflow_run_id);
create index idx_approvals_status on approvals(status);
create index idx_artifacts_task_id on artifacts(task_id);
create index idx_artifacts_workflow_run_id on artifacts(workflow_run_id);
```

## 9. Authorization Model (MVP)

### Agents
- Can self-register only the identity bound to their API key
- Can update only own presence
- Can emit events for own actor identity
- Can claim/start/block/complete tasks for allowed task types
- Cannot approve unless explicitly configured as human-equivalent reviewer

### Humans
- Can create tasks and workflow runs
- Can request and resolve approvals assigned to them
- Can comment and inspect artifacts

### Admins
- Can provision new agent registry entries
- Can override task/workflow status
- Can reassign tasks
- Can resolve deadlocks and blocked flows

## 9.1 Registry Model

Provisioning and registration are separate concerns.

- `POST /agents/register`
  - admin only
  - creates or provisions a trusted agent registry entry
- `POST /agents/register-self`
  - agent or admin
  - upserts metadata for the identity already bound to the caller key

Important rule:
- self-registration must never create trust from request payload alone
- authoritative identity comes from the authenticated key binding, not from body fields

## 10. Observability and Audit

Required logs:
- API access log (actor, endpoint, response code, latency)
- domain event log (already persisted in `events` + `task_events`)
- auth failures and permission denials

Minimum audit guarantees:
- every status transition emits an event
- every approval action stores actor + timestamp
- every artifact links to task and/or run

## 11. Suggested Folder Layout (Next.js)

```txt
app/
  api/
    v1/
      agents/
      tasks/
      workflow-runs/
      approvals/
      artifacts/
      handoffs/
lib/
  db/
  auth/
  domain/
    tasks/
    workflows/
    approvals/
    events/
  validators/
supabase/
  migrations/
docs/
  dark-factory-developer-brief.md
```

## 12. First Build Sequence

1. Create DB schema + enums + indexes.
2. Add auth primitives for `agent` and `human`.
3. Implement `agents`, `tasks`, `workflow-runs` routes.
4. Add `events`, `approvals`, `artifacts`, `handoffs`.
5. Add invariant checks for state transitions.
6. Seed one workflow template: `content_pipeline:v1`.
7. Run end-to-end test of content flow with one approval gate.

## 13. Open Decisions

- Multi-tenant now vs single-org MVP
- RLS policies vs API-layer auth only in phase 1
- Event outbox/webhooks needed in MVP or phase 2
- Polling vs push model for agent task acquisition
- Whether workflow advancement is explicit (`/advance`) or engine-driven

## 14. Acceptance Criteria (MVP)

- At least 3 agents can concurrently report presence and progress.
- A human can create a content workflow run and observe generated tasks.
- At least one task can enter `waiting_approval` and be approved/rejected.
- Artifact references can be attached and queried from task/run.
- Full flow is reconstructable from durable events and task events.
