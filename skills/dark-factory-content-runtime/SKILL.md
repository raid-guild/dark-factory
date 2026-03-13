---
name: dark-factory-content-runtime
description: Run inbox-driven content workflow tasks in Dark Factory. Use when an agent needs to check Agent Mail for work, sync task state with prism-coord, reserve files, report progress or blockers, and hand off context to the next content agent.
---

# Dark Factory Content Runtime

Use this skill when operating as a working content agent in Dark Factory.

This skill assumes:
- `prism-coord` is the control plane for workflow runs, tasks, handoffs, approvals, and task state
- Agent Mail is the communication plane for inboxes, workflow threads, durable handoff context, and file reservations

## Preflight

Before using this skill, confirm:
- the repo has access to `prism-coord`
- the agent has a bound API key for `prism-coord`
- Agent Mail access is configured for the current project
- the active project uses the shared conventions below

If any of those are missing, stop and ask for the missing runtime details instead of guessing.

## Hard Rules

- Treat `prism-coord` as the source of truth for task state.
- Treat Agent Mail as the source of truth for inbox history and reservations.
- Do not invent new workflow or task ids.
- Do not change task state in Agent Mail alone.
- Do not release someone else’s reservations unless the workflow explicitly requires it.
- Keep subjects and reservation reasons consistent with the conventions below.

## Conventions

- workflow thread id: `run-<workflow_run_id>`
- task subject prefix: `[task:<task_id>] ...`
- reservation reason: `task:<task_id>`

## Canonical Loop

1. Check Agent Mail for unread or newly assigned work in the current project.
2. Identify the active `workflow_run_id` and `task_id` from the thread and subject.
3. Confirm the task exists and is available in `prism-coord`.
4. Claim or start the task in `prism-coord` when appropriate.
5. Reserve any relevant files in Agent Mail before editing.
6. Send a short "starting work" or progress message into the workflow thread.
7. Emit heartbeat and task events in `prism-coord` while working.
8. Complete or block the task in `prism-coord`.
9. Post the outcome and any handoff context into Agent Mail.
10. Release reservations on terminal states or when blocked work no longer requires the files.

## Minimum Task Execution Pattern

When starting work:
- read the most recent task-specific messages in the workflow thread
- confirm the task is yours or explicitly handed to you
- reserve only the files you need
- post a brief start message if the thread does not already reflect that you took the task

While working:
- use `POST /api/v1/agents/:agentId/heartbeat`
- use `POST /api/v1/agents/:agentId/events` for material progress, blockers, and notable context
- keep messages short and specific; prefer concrete progress over narrative filler

When blocked:
- `POST /api/v1/tasks/:taskId/block`
- include the blocker in both the task transition and the Agent Mail message
- if another agent should take over, create a handoff with a precise next action

When complete:
- `POST /api/v1/tasks/:taskId/complete`
- include artifacts, outputs, or summary context in the thread message
- release any reservations tied to `task:<task_id>`

## Handoffs

Create handoffs when:
- the next task depends on your output
- another agent needs context that is not obvious from the current task state
- a blocker requires a different specialization

A useful handoff message includes:
- `task_id`
- `workflow_run_id`
- what was completed
- what remains
- exact next action requested
- artifact or output references
- relevant files or reservations
- blockers or assumptions

Keep the handoff visible in the shared workflow thread so operators can follow the run.

## Control-Plane Calls

Typical `prism-coord` calls:
- `GET /api/v1/agents/:agentId/tasks`
- `POST /api/v1/tasks/:taskId/claim`
- `POST /api/v1/tasks/:taskId/start`
- `POST /api/v1/tasks/:taskId/block`
- `POST /api/v1/tasks/:taskId/complete`
- `POST /api/v1/handoffs`
- `POST /api/v1/agents/:agentId/heartbeat`
- `POST /api/v1/agents/:agentId/events`

Use the bound API key and do not write under another agent’s identity.

Typical identity pattern:
- key bound to `agent_id`
- `POST /api/v1/agents/register-self` once the runtime is provisioned
- then heartbeat, events, and task transitions under that same bound identity

## Communication-Plane Calls

Typical Agent Mail operations:
- fetch inbox for the current project
- inspect the workflow thread `run-<workflow_run_id>`
- send task-specific messages using `[task:<task_id>] ...`
- reserve files with reason `task:<task_id>`
- release reservations when the task is done or reassigned

If Agent Mail agent names differ from `prism-coord` agent ids, rely on the configured stable mapping rather than inventing new names.

## Good Default Behavior

- Prefer a short start message over silence.
- Prefer one clear handoff over multiple ambiguous messages.
- Prefer blocking honestly over pretending the task is progressing.
- Prefer thread-visible context over private state when others depend on your output.

## Not In Scope

This skill does not assume:
- autonomous workflow planning
- dynamic workflow creation
- software-delivery or PR review flows
- final approval authority

Stay within the assigned content workflow unless an operator explicitly redirects you.
