# Agent Activity Broadcast Guide

## Purpose

This document tells an agent implementer how to report live activity into Dark Factory.

For the POC, "activity broadcast" is split into 2 channels:
- `heartbeat`: mutable current state for "what is this agent doing now?"
- `events`: durable records for "what happened?"

Use both. Do not rely on heartbeat alone for audit history.

## Endpoints

Base path: `/api/v1`

- `POST /agents/register-self`
- `POST /agents/:agentId/heartbeat`
- `POST /agents/:agentId/events`
- `GET /agents/:agentId/tasks?status=queued,claimed,in_progress`

## Auth

Agent writes require:
- header: `x-df-api-key: <agent-key>`

Current auth rules:
- the key must be configured in `DARK_FACTORY_API_KEYS_JSON`
- the key role must be `agent` or `admin`
- for agent keys, `agent_id` must match `:agentId` in `/agents/:agentId/*`
- agent self-registration should use the identity already bound to the key

## Self-Registration

Agents may self-register only after a trusted provisioning step has already issued a bound API key.

Use `POST /agents/register-self` to upsert mutable metadata such as:
- `name`
- `description`
- `type`
- `capabilities`
- `version`
- `protocol_version`
- `metadata_json`

Do not treat self-registration as a trust-creation path.
The server should derive the agent identity from the caller key, not from the payload.

Example config:

```json
[
  {
    "key": "agent-memory-1",
    "role": "agent",
    "agent_id": "agent-memory",
    "label": "memory-agent"
  }
]
```

## Heartbeat Contract

Heartbeat updates current presence. It is mutable and should be sent regularly while the agent is alive.

Recommended interval:
- every 20 to 30 seconds while active
- immediately on task start
- immediately on task block
- immediately on task completion
- once on startup
- once on shutdown if graceful shutdown is available

Payload:

```json
{
  "status": "working",
  "station": "drafting",
  "current_task_id": "task-123",
  "current_workflow_run_id": "run-456",
  "progress_pct": 55,
  "status_message": "Drafting variant B"
}
```

Presence statuses:
- `idle`
- `available`
- `working`
- `blocked`
- `offline`

Field guidance:
- `status`: always send
- `station`: logical work area such as `research`, `drafting`, `review`, `distribution`
- `current_task_id`: send when the agent is actively working a task
- `current_workflow_run_id`: send when activity belongs to a run
- `progress_pct`: optional but useful for long-running tasks
- `status_message`: short human-readable summary, keep under 120 chars

## Event Contract

Events are append-only and should be emitted for meaningful state changes.

Payload:

```json
{
  "task_id": "task-123",
  "workflow_run_id": "run-456",
  "event_type": "task.started",
  "payload": {
    "message": "Started drafting variant B"
  }
}
```

Recommended event types:
- `agent.started`
- `agent.stopped`
- `task.claimed`
- `task.started`
- `task.progress`
- `task.blocked`
- `task.unblocked`
- `task.completed`
- `task.failed`
- `artifact.created`
- `handoff.created`

Event rules:
- emit `task.started` once when real work begins
- emit `task.progress` only for meaningful progress changes, not every heartbeat
- emit `task.blocked` with a clear machine-readable reason and a short message
- emit `task.completed` only after work output is ready
- emit `artifact.created` when you attach an artifact reference

## Recommended Sequence

When an agent picks up work:

1. `GET /agents/:agentId/tasks`
2. `POST /agents/:agentId/heartbeat` with `status=working`
3. `POST /agents/:agentId/events` with `event_type=task.started`
4. continue heartbeat every 20 to 30 seconds
5. emit `task.progress` only when something materially changed
6. if blocked, send heartbeat `status=blocked` and emit `task.blocked`
7. on completion, send final heartbeat and emit `task.completed`

## Example Calls

Heartbeat:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agent-memory/heartbeat \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{
    "status":"working",
    "station":"research",
    "current_task_id":"task-123",
    "current_workflow_run_id":"run-456",
    "progress_pct":42,
    "status_message":"Extracting topic candidates"
  }'
```

Event:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agent-memory/events \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{
    "task_id":"task-123",
    "workflow_run_id":"run-456",
    "event_type":"task.started",
    "payload":{"message":"Started topic candidate generation"}
  }'
```

## Failure Handling

Heartbeat failure policy:
- retry with backoff
- do not replay stale heartbeats indefinitely
- latest state matters more than complete delivery

Event failure policy:
- retry with backoff
- preserve order per task where possible
- do not silently drop terminal events like `task.blocked`, `task.completed`, or `task.failed`

Suggested retry approach:
- 3 immediate retries with exponential backoff
- if still failing, log locally and keep working only if the task is safe to continue
- for terminal events, prefer pausing and surfacing an operator-visible error

## What Not To Do

- do not emit a durable event for every heartbeat tick
- do not send large artifact contents in event payloads
- do not mark `progress_pct=100` unless the task is actually done
- do not emit `task.completed` before downstream artifacts are attached or ready
- do not use heartbeat as the only record of work history

## POC Assumptions

Current repo status:
- route handlers for heartbeat and events exist but are still scaffold stubs
- auth enforcement for agent keys is implemented
- schema for `agent_presence` and `events` exists in `db/migrations/20260307161000_initial_schema.sql`

This guide defines the intended client behavior now, even before the backend persistence is fully implemented.
