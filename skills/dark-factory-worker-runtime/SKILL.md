---
name: dark-factory-worker-runtime
description: Execute assigned Dark Factory tasks as a worker agent. Use when an agent should self-register, keep heartbeat current, poll only its own tasks, read and write workflow-thread context in Agent Mail, create artifacts, persist handoffs, reserve and release files, and complete work without extra prompting.
metadata:
  required_env_vars:
    - DARK_FACTORY_URL
    - DARK_FACTORY_API_KEY
    - AGENT_ID
    - AGENT_MAIL_URL
    - AGENT_MAIL_BEARER_TOKEN
    - AGENT_MAIL_PROJECT_KEY
---

# Dark Factory Worker Runtime

Use this skill when you are a worker agent in Dark Factory.

## Purpose

This skill is for execution, not orchestration.

You should:
- self-register if needed
- keep heartbeat current
- poll your own assigned tasks
- execute them end to end
- create artifacts, handoffs, and workflow-thread updates

You should not:
- inspect the entire task pool to decide what work exists for everyone
- create workflow runs
- act as the system router

## Required env vars

- `DARK_FACTORY_URL`
- `DARK_FACTORY_API_KEY`
- `AGENT_ID`
- `AGENT_MAIL_URL`
- `AGENT_MAIL_BEARER_TOKEN`
- `AGENT_MAIL_PROJECT_KEY`

Dark Factory writes use:
- `x-df-api-key: <DARK_FACTORY_API_KEY>`

Agent Mail writes use:
- `Authorization: Bearer <AGENT_MAIL_BEARER_TOKEN>`

## Identity surfaces

- `AGENT_ID`
  - your Dark Factory control-plane identity
- Agent Mail agent name
  - your messaging identity inside Agent Mail

These are not guaranteed to match. Keep using the same Agent Mail identity for the life of the run.

## Bundled scripts

- `register_self.sh`
- `get_tasks.sh`
- `task_transition.sh`
- `create_artifact.sh`
- `create_handoff.sh`
- `read_run_thread.sh`
- `ensure_mail_project.sh`
- `register_mail_agent.sh`
- `send_thread_message.sh`
- `reserve_files.sh`
- `release_files.sh`

Prefer the scripts over hand-written curl or JSON-RPC payloads.

## Canonical worker loop

1. Confirm required env vars exist.
2. Self-register in `prism-coord` if needed.
3. Ensure the Agent Mail project exists.
4. Register or confirm your Agent Mail identity.
5. Poll only your own assigned tasks.
6. When one is available:
   - read the task details
   - read the workflow thread
   - claim the task
   - start the task
   - reserve files if needed
   - post a short start message
   - do the work
   - emit heartbeat and progress events
   - create an artifact for any deliverable
   - persist a handoff if downstream work depends on your output
   - post shared context to the workflow thread
   - complete or block the task honestly
   - release reservations on terminal states
7. If no work is assigned to you, sleep and poll again.

Do not wait for extra prompting once a valid assigned task exists.

## Hard rules

- Treat `prism-coord` as the source of truth for task state.
- Treat Agent Mail as the shared communication plane.
- Do not rely on your local workspace as the only place outputs exist.
- For deliverable tasks, create an artifact record.
- For text deliverables, include inline body content when possible.
- When downstream work depends on your output, persist a handoff in `prism-coord`.

## What this skill is not for

This skill is not the router. If you need to:
- look across all tasks
- dispatch work by lane or capability
- decide which sub-agent should pick up which task

use the router skill instead.
