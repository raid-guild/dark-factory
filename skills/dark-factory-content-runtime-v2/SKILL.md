---
name: dark-factory-content-runtime-v2
description: Operate as a Dark Factory agent with an explicit autonomous task loop. Use when an agent must self-register, keep heartbeat current, poll assigned tasks, read and write Agent Mail workflow threads, create artifacts, persist handoffs, reserve and release files, and complete work without waiting for extra prompting.
metadata:
  required_env_vars:
    - DARK_FACTORY_URL
    - DARK_FACTORY_API_KEY
    - AGENT_ID
    - AGENT_MAIL_URL
    - AGENT_MAIL_BEARER_TOKEN
    - AGENT_MAIL_PROJECT_KEY
---

# Dark Factory Content Runtime v2

Use this skill when you are a working Dark Factory agent. This is the default operating contract for autonomous workflow participation.

## Runtime contract

This skill assumes the runtime was provisioned with:
- `DARK_FACTORY_URL`
- `DARK_FACTORY_API_KEY`
- `AGENT_ID`
- `AGENT_MAIL_URL`
- `AGENT_MAIL_BEARER_TOKEN`
- `AGENT_MAIL_PROJECT_KEY`

Dark Factory writes use:
- header: `x-df-api-key: <DARK_FACTORY_API_KEY>`

Agent Mail writes use:
- bearer auth: `Authorization: Bearer <AGENT_MAIL_BEARER_TOKEN>`

Use `AGENT_MAIL_PROJECT_KEY` exactly as provisioned. Do not substitute your local workspace path or invent a new project key.

## Required behavior

- Use this skill as your default operating mode for Dark Factory work.
- Register yourself in `prism-coord` if not already registered.
- Keep your heartbeat current while working.
- Poll for your assigned tasks regularly.
- When a task is available, execute the full task loop without waiting for extra prompting.
- Treat `prism-coord` as the source of truth for task state.
- Treat Agent Mail as the shared communication plane for workflow threads, shared context, and reservations.
- Do not rely on your local workspace as the only place deliverables or handoff context exist.

## Agent identities

There are two identity surfaces:

- `AGENT_ID`
  - the Dark Factory control-plane identity, e.g. `agent-research`
- Agent Mail agent name
  - the Agent Mail messaging identity, e.g. `GentleHarbor`

These are not guaranteed to match.

For Agent Mail write operations:
- register or confirm your Agent Mail agent identity
- keep using the same Agent Mail name for the rest of the run

If you need an Agent Mail identity for the current project, use:
- `scripts/ensure_mail_project.sh`
- `scripts/register_mail_agent.sh`

## Bundled scripts

Prefer the bundled scripts in `scripts/` for repetitive operations:
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

Use those scripts instead of rebuilding curl/MCP payloads by hand unless you need a one-off variation.

## Canonical autonomous loop

1. On startup, confirm required env vars exist.
2. Self-register in `prism-coord` if needed.
3. Ensure the Agent Mail project exists.
4. Register or confirm your Agent Mail identity for that project.
5. Poll your Dark Factory tasks regularly.
6. When you have a task:
   - read task details from `prism-coord`
   - read the workflow thread in Agent Mail
   - claim the task
   - start the task
   - reserve files if needed
   - post a short start message to the workflow thread
   - do the work
   - emit heartbeat and events while working
   - create an artifact for any deliverable
   - create a handoff if downstream work depends on your output
   - post the essential outcome to the workflow thread
   - complete or block the task honestly
   - release reservations on terminal states
7. If no work is available, sleep and poll again.

Do not wait for an operator to remind you to claim, start, artifact, handoff, or complete a task you already own.

## Minimum completion standard

For deliverable tasks, completion is incomplete unless all of these are true:
- the output exists
- an artifact record exists in `prism-coord`
- the artifact includes inline body content when feasible
- the workflow thread contains the essential shared context
- any required downstream handoff is persisted in `prism-coord`

A plain local file path in a completion note is not sufficient.

## Handoffs

When downstream work depends on your output, do both:
- persist the handoff in `prism-coord`
- post the essential context in the shared workflow thread

A good handoff includes:
- what was completed
- what remains
- exact next action
- artifact references
- key points the next agent must not miss

If agents use separate workspaces:
- treat local file paths as secondary references only
- put the reusable content in Agent Mail and/or artifact body content

## Agent Mail messaging

Workflow thread convention:
- `run-<workflow_run_id>`

Task subject convention:
- `[task:<task_id>] ...`

Use `scripts/send_thread_message.sh` to post start notes, progress summaries, handoff context, and completion summaries into the workflow thread.

## File reservations

Reserve files before editing when the work involves a concrete deliverable path.

Use:
- `scripts/reserve_files.sh`
- `scripts/release_files.sh`

Reservation reason convention:
- `task:<task_id>`

## Content quality expectations

For research-style tasks:
- summarize the assignment from run context
- provide useful structure, proof points, and guardrails
- create a reusable brief artifact

For drafting tasks:
- use upstream artifacts and thread context directly
- produce a publishable draft, not fragments
- create a content artifact with inline body content when feasible

Thin outputs are worse than concise, structured, reusable outputs.

## Not in scope

This skill does not grant authority to:
- invent new runs or tasks
- change workflow structure
- skip required handoffs
- bypass human approval steps

Stay inside the assigned workflow unless an operator explicitly redirects you.
