insert into public.agents (id, agent_key, name, description, type, capabilities, status)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'agent-memory',
    'memory-manager',
    'Research and topic generation agent',
    'memory',
    '["memory.research","topic.discovery"]'::jsonb,
    'active'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'agent-knowledge',
    'knowledge-manager',
    'Synthesis and briefing agent',
    'knowledge',
    '["knowledge.synthesis","brief.authoring"]'::jsonb,
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'agent-content',
    'content-drafter',
    'Drafting agent for content production',
    'content',
    '["content.drafting","variant.generation"]'::jsonb,
    'active'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'agent-distribution',
    'distribution-agent',
    'Publishing and distribution prep agent',
    'distribution',
    '["distribution.publish","distribution.prep"]'::jsonb,
    'active'
  )
on conflict (agent_key) do update
set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  capabilities = excluded.capabilities,
  status = excluded.status;

insert into public.workflow_templates (id, template_key, name, version, definition_json, active)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'content_pipeline',
    'Content Pipeline',
    'v1',
    '{"stages":["research","selection","brief","draft","approval"]}'::jsonb,
    true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'newsletter_pipeline',
    'Newsletter Pipeline',
    'v1',
    '{"stages":["brief","draft","approval","distribution"]}'::jsonb,
    true
  )
on conflict (template_key, version) do update
set
  name = excluded.name,
  definition_json = excluded.definition_json,
  active = excluded.active;

insert into public.workflow_runs (id, workflow_template_id, status, started_at, context_json)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'running',
    now() - interval '12 minutes',
    '{"topic":"AI Coordination Patterns"}'::jsonb
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'blocked',
    now() - interval '92 minutes',
    '{"issue":"Week 10"}'::jsonb
  )
on conflict (id) do update
set
  workflow_template_id = excluded.workflow_template_id,
  status = excluded.status,
  started_at = excluded.started_at,
  context_json = excluded.context_json;

insert into public.tasks (
  id,
  title,
  task_type,
  status,
  priority,
  owner_agent_id,
  workflow_run_id,
  blocked_reason
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Generate topic candidates',
    'memory.research',
    'completed',
    'normal',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-0000-0000-0000-000000000001',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Produce research brief',
    'knowledge.synthesis',
    'in_progress',
    'high',
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-0000-0000-0000-000000000001',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Draft post variants',
    'content.drafting',
    'queued',
    'high',
    '33333333-3333-3333-3333-333333333333',
    'aaaaaaaa-0000-0000-0000-000000000001',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Final human approval',
    'human.approval',
    'waiting_approval',
    'urgent',
    null,
    'bbbbbbbb-0000-0000-0000-000000000002',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Distribution prep',
    'distribution.publish',
    'blocked',
    'normal',
    '44444444-4444-4444-4444-444444444444',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Waiting on approval for selected draft'
  )
on conflict (id) do update
set
  title = excluded.title,
  task_type = excluded.task_type,
  status = excluded.status,
  priority = excluded.priority,
  owner_agent_id = excluded.owner_agent_id,
  workflow_run_id = excluded.workflow_run_id,
  blocked_reason = excluded.blocked_reason;

insert into public.agent_presence (
  agent_id,
  status,
  current_task_id,
  current_workflow_run_id,
  progress_pct,
  status_message,
  last_heartbeat_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'available',
    null,
    'aaaaaaaa-0000-0000-0000-000000000001',
    null,
    'Ready for the next research task',
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'working',
    '10000000-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    58,
    'Compiling research brief',
    now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'idle',
    null,
    'aaaaaaaa-0000-0000-0000-000000000001',
    null,
    'Awaiting draft assignment',
    now() - interval '2 minutes'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'blocked',
    '10000000-0000-0000-0000-000000000005',
    'bbbbbbbb-0000-0000-0000-000000000002',
    0,
    'Waiting on approval before prep can resume',
    now() - interval '45 seconds'
  )
on conflict (agent_id) do update
set
  status = excluded.status,
  current_task_id = excluded.current_task_id,
  current_workflow_run_id = excluded.current_workflow_run_id,
  progress_pct = excluded.progress_pct,
  status_message = excluded.status_message,
  last_heartbeat_at = excluded.last_heartbeat_at;
