create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'actor_type') then
    create type actor_type as enum ('human', 'agent');
  end if;
  if not exists (select 1 from pg_type where typname = 'agent_status') then
    create type agent_status as enum ('active', 'inactive');
  end if;
  if not exists (select 1 from pg_type where typname = 'presence_status') then
    create type presence_status as enum ('idle', 'available', 'working', 'blocked', 'offline');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('queued', 'claimed', 'in_progress', 'blocked', 'waiting_approval', 'completed', 'failed', 'canceled');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'workflow_run_status') then
    create type workflow_run_status as enum ('pending', 'running', 'blocked', 'completed', 'failed', 'canceled');
  end if;
  if not exists (select 1 from pg_type where typname = 'approval_status') then
    create type approval_status as enum ('pending', 'approved', 'rejected', 'revision_requested');
  end if;
  if not exists (select 1 from pg_type where typname = 'handoff_status') then
    create type handoff_status as enum ('created', 'accepted', 'declined', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'artifact_approval_status') then
    create type artifact_approval_status as enum ('unreviewed', 'approved', 'rejected');
  end if;
end $$;

create table if not exists public.agents (
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

create table if not exists public.actors (
  id uuid primary key default gen_random_uuid(),
  actor_type actor_type not null,
  human_user_id uuid,
  agent_id uuid references public.agents(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique(actor_type, human_user_id),
  unique(actor_type, agent_id)
);

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  name text not null,
  version text not null,
  definition_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(template_key, version)
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_template_id uuid not null references public.workflow_templates(id),
  status workflow_run_status not null default 'pending',
  requested_by_actor_id uuid references public.actors(id),
  started_at timestamptz,
  completed_at timestamptz,
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_type text not null,
  status task_status not null default 'queued',
  priority task_priority not null default 'normal',
  owner_agent_id uuid references public.agents(id),
  requested_by_actor_id uuid references public.actors(id),
  workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  blocked_reason text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.agent_presence (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  status presence_status not null,
  station text,
  current_task_id uuid references public.tasks(id) on delete set null,
  current_workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  progress_pct int check (progress_pct between 0 and 100),
  status_message text,
  last_heartbeat_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.actors(id),
  agent_id uuid references public.agents(id),
  task_id uuid references public.tasks(id),
  workflow_run_id uuid references public.workflow_runs(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.actors(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  kind text not null,
  title text not null,
  uri text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by_actor_id uuid references public.actors(id),
  approved_status artifact_approval_status not null default 'unreviewed',
  created_at timestamptz not null default now()
);

create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  from_task_id uuid references public.tasks(id) on delete set null,
  to_task_id uuid references public.tasks(id) on delete set null,
  from_actor_id uuid references public.actors(id),
  to_actor_id uuid references public.actors(id),
  note text,
  status handoff_status not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  artifact_id uuid references public.artifacts(id) on delete set null,
  requested_from_actor_id uuid references public.actors(id),
  status approval_status not null default 'pending',
  note text,
  decided_by_actor_id uuid references public.actors(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_events_task_id on public.events(task_id);
create index if not exists idx_events_workflow_run_id on public.events(workflow_run_id);
create index if not exists idx_events_event_type on public.events(event_type);
create index if not exists idx_task_events_task_id on public.task_events(task_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_owner_agent_id on public.tasks(owner_agent_id);
create index if not exists idx_tasks_workflow_run_id on public.tasks(workflow_run_id);
create index if not exists idx_approvals_status on public.approvals(status);
create index if not exists idx_artifacts_task_id on public.artifacts(task_id);
create index if not exists idx_artifacts_workflow_run_id on public.artifacts(workflow_run_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists trg_workflow_runs_updated_at on public.workflow_runs;
create trigger trg_workflow_runs_updated_at
before update on public.workflow_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_agent_presence_updated_at on public.agent_presence;
create trigger trg_agent_presence_updated_at
before update on public.agent_presence
for each row execute function public.set_updated_at();

drop trigger if exists trg_handoffs_updated_at on public.handoffs;
create trigger trg_handoffs_updated_at
before update on public.handoffs
for each row execute function public.set_updated_at();

drop trigger if exists trg_approvals_updated_at on public.approvals;
create trigger trg_approvals_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();
