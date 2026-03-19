---
name: dark-factory-content-runtime
description: Run inbox-driven content workflow tasks in Dark Factory. Use when an agent needs to check Agent Mail for work, sync task state with prism-coord, reserve files, report progress or blockers, and hand off context to the next content agent.
metadata:
  required_env_vars:
    - DARK_FACTORY_URL
    - DARK_FACTORY_API_KEY
    - AGENT_ID
    - AGENT_MAIL_URL
    - AGENT_MAIL_BEARER_TOKEN
    - AGENT_MAIL_PROJECT_KEY
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

## Auth And Bootstrap

This skill assumes the runtime was provisioned with:
- `DARK_FACTORY_URL`
- `DARK_FACTORY_API_KEY`
- `AGENT_ID`
- `AGENT_MAIL_URL`
- `AGENT_MAIL_BEARER_TOKEN`
- `AGENT_MAIL_PROJECT_KEY`

Example shared project key for this repo:
- `raidguild/dark-factory/prism-coord`

Dark Factory writes use:
- header: `x-df-api-key: <DARK_FACTORY_API_KEY>`

The API key is already bound to the agent identity. Do not invent or swap identities at runtime.

Expected first control-plane call:
- `POST /api/v1/agents/register-self`

Example:

```bash
curl -X POST "$DARK_FACTORY_URL/api/v1/agents/register-self" \
  -H "content-type: application/json" \
  -H "x-df-api-key: $DARK_FACTORY_API_KEY" \
  -d '{
    "name":"memory-manager",
    "description":"Research agent",
    "type":"memory",
    "capabilities":["memory.research"]
  }'
```

If `DARK_FACTORY_API_KEY` is missing, the agent cannot register, heartbeat, claim tasks, or update task state.

If `AGENT_MAIL_PROJECT_KEY` is missing, the agent may create or read mail under the wrong project namespace. All agents participating in the same workflow must use the same explicit project key.
Use a stable shared logical key, not your own local filesystem path, unless an operator explicitly tells you otherwise.

## Bundled Scripts

Prefer the bundled scripts in `scripts/` for repetitive control-plane and mail operations:
- `scripts/register_self.sh`
- `scripts/get_tasks.sh`
- `scripts/task_transition.sh`
- `scripts/create_artifact.sh`
- `scripts/create_handoff.sh`
- `scripts/read_run_thread.sh`

Use those scripts instead of rewriting curl commands unless the workflow requires a one-off variation.

## Hard Rules

- Treat `prism-coord` as the source of truth for task state.
- Treat Agent Mail as the source of truth for inbox history and reservations.
- Do not invent new workflow or task ids.
- Do not change task state in Agent Mail alone.
- Do not release someone else’s reservations unless the workflow explicitly requires it.
- Keep subjects and reservation reasons consistent with the conventions below.
- Do not rely on another agent's local workspace paths as the only handoff mechanism.
- When work moves to another task, persist the handoff in `prism-coord` and also post the context in Agent Mail.
- When completing a task, include output references in the completion note and in the thread message.
- If a task produced a deliverable, create an artifact record before or during completion. A local file path in a note is not enough by itself.
- For text deliverables, include the body in the artifact record whenever possible so operators can inspect it directly in prism-coord.

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
- create an artifact record for any deliverable output using `POST /api/v1/artifacts` or `scripts/create_artifact.sh`
- for markdown or text outputs, prefer `scripts/create_artifact.sh ... --body-markdown-file <path>` or `--body-text-file <path>`
- `POST /api/v1/tasks/:taskId/complete`
- include artifacts, outputs, or summary context in the thread message
- include output references in the completion note whenever possible
- release any reservations tied to `task:<task_id>`

For content workflows, a completion is not high quality unless the next actor can use it without guessing. Prefer a concise but structured completion note over a generic "done".
For deliverable tasks, a completion without an artifact record is incomplete unless an operator explicitly says otherwise.

## Handoffs

Create handoffs when:
- the next task depends on your output
- another agent needs context that is not obvious from the current task state
- a blocker requires a different specialization

Handoffs are not optional when downstream work depends on your output. Do both:
- `POST /api/v1/handoffs` or `scripts/create_handoff.sh`
- post the same essential context in the shared workflow thread

A useful handoff message includes:
- `task_id`
- `workflow_run_id`
- what was completed
- what remains
- exact next action requested
- artifact or output references
- relevant files or reservations
- blockers or assumptions

When an artifact exists, reference it explicitly in the handoff note.

If agents use separate workspaces:
- do not assume another agent can read your local files
- summarize the important content directly in the handoff
- include file paths only as secondary references

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

Bundled control-plane helpers:
- `scripts/register_self.sh '<json payload>'`
- `scripts/get_tasks.sh`
- `scripts/task_transition.sh <claim|start|block|complete> <task_id> [json payload]`
- `scripts/create_artifact.sh <task_id> <workflow_run_id> <kind> <title> <uri> [metadata json] [--body-markdown-file <path>] [--body-text-file <path>]`
- `scripts/create_handoff.sh <from_task_id> <to_task_id> '<note>'`

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

Use the provisioned `AGENT_MAIL_PROJECT_KEY` exactly as given. Do not replace it with the agent's local workspace path unless an operator explicitly told you to do so.

For this repo, the shared project key should normally stay:
- `raidguild/dark-factory/prism-coord`

All cooperating agents in the same workflow must use the same project key.

Bundled mail helper:
- `scripts/read_run_thread.sh <workflow_run_id>`

## Content Quality Expectations

For `memory.research` or research-style tasks, the expected output should usually include:
- objective and audience
- key message angles
- proof points or sources
- outline or framing recommendation
- guardrails or open risks
- a clear next step for the drafting agent
- an artifact record for the brief output

For `content.drafting` tasks, the expected output should usually include:
- the requested format
- a draft aligned to the run guidance
- explicit use of the research handoff
- any assumptions or missing inputs
- a completion note that points to the draft output
- an artifact record for the draft output

Thin outputs are worse than a brief but actionable structured handoff. Prefer specific, reusable context over short generic summaries.

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
