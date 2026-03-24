---
name: dark-factory-router-runtime
description: Route Dark Factory work deterministically across sub-agents. Use when a harness or orchestrator should inspect all tasks, match them to worker lanes by task type or owner, and dispatch work without itself acting as the worker.
metadata:
  required_env_vars:
    - DARK_FACTORY_URL
    - DARK_FACTORY_API_KEY
---

# Dark Factory Router Runtime

Use this skill when you are acting as the router or harness for Dark Factory.

## Purpose

This skill is for dispatch and coordination, not for doing the underlying task work.

You should:
- inspect the available task pool
- route tasks to the correct worker lane
- keep deterministic mappings between task types and worker identities
- avoid duplicate dispatch

You should not:
- impersonate a worker when a real worker lane is available
- perform the full research, drafting, or memory task yourself unless explicitly acting as fallback

## Required env vars

- `DARK_FACTORY_URL`
- `DARK_FACTORY_API_KEY`

This skill assumes router-level access to read the task pool. It does not require Agent Mail credentials by default.

## Core idea

Dark Factory remains the control plane.
The router/harness decides which sub-agent should handle each queued task.

Keep worker identities distinct even if they share one external runtime.

Examples:
- `memory.research` -> `agent-community-memory`
- `web.research` -> `agent-research`
- `content.drafting` -> `agent-content`

## Bundled scripts

- `list_tasks.sh`
- `list_run_tasks.sh`
- `routing_example.sh`

Use these to inspect the task pool and reason about routing before dispatching work to sub-agents.

## Canonical router loop

1. Poll the task pool.
2. Identify queued or actionable tasks.
3. Match each task to a lane using:
   - `owner_agent_id`
   - task type
   - fallback routing rules
4. If a matching worker lane is available:
   - dispatch the task to that worker
5. If no worker lane is available:
   - leave the task queued
   - or record/operator-escalate the gap
6. Avoid assigning the same task to multiple workers.
7. Re-check the pool on a regular interval.

## Deterministic routing policy

Prefer this order:

1. explicit owner lane
2. task type mapping
3. capability fallback
4. operator escalation

Do not let workers decide system-wide routing ad hoc.

## Dispatch rules

- If a task already has a clear intended owner, dispatch only to that worker lane.
- If a worker is unavailable, do not silently reroute unless the fallback policy says to do so.
- Record routing decisions in your harness logs, even if Dark Factory does not yet persist them directly.
- Use stable lane names so visualizations remain meaningful over time.

## Suggested mapping

- `memory.research` -> `agent-community-memory`
- `knowledge.synthesis` -> `agent-community-memory` or `agent-knowledge`
- `web.research` -> `agent-research`
- `content.drafting` -> `agent-content`
- `human.approval` -> operator / human lane

## What this skill is not for

This skill does not replace the worker skill.

Once a task is routed, the worker should use the worker runtime skill to:
- claim
- start
- artifact
- handoff
- complete or block

The router decides who should work. The worker performs the work.
