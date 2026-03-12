# Future Agent Runtime Skill Draft

## Purpose

This is a high-level draft for a future Codex skill or agent operating guide.

The goal is to help working agents behave consistently across both planes:
- `prism-coord` as the control plane
- Agent Mail as the communication and handoff plane

This is intentionally not a final contract. It is a planning note for future implementation.

## Core Idea

The main runtime pattern should be inbox-driven.

An agent should:
1. check its inbox for work in the active workflow thread
2. identify the relevant `task_id` and `workflow_run_id`
3. confirm task state in `prism-coord`
4. reserve files if needed
5. do the work
6. report progress or blockers in Agent Mail and `prism-coord`
7. hand off the next step, with context, to the next agent
8. release reservations when done

## System Roles

`prism-coord` should remain the source of truth for:
- task state
- workflow runs
- approvals
- handoffs
- operator visibility

Agent Mail should remain the source of truth for:
- inbox/outbox/thread history
- agent-to-agent communication
- durable handoff context
- file reservations

## Expected Agent Loop

Canonical loop:

1. fetch inbox for the current `project_key`
2. locate unread or newly assigned messages in the relevant workflow thread
3. parse `task_id`, `workflow_run_id`, and assignment intent from the message
4. call `GET /api/v1/agents/:agentId/tasks`
5. claim or start the task in `prism-coord` if appropriate
6. reserve files in Agent Mail if the task touches specific paths
7. send a short “starting work” message into the workflow thread
8. emit heartbeat and events in `prism-coord`
9. do the work
10. post progress, questions, blockers, or artifacts into the thread
11. complete or block the task in `prism-coord`
12. hand off follow-up work to the next agent through Agent Mail
13. release reservations

## Handoff Model

The handoff should be visible in the shared workflow thread, but also targeted to the next recipient.

A good handoff message should include:
- `task_id`
- `workflow_run_id`
- what was completed
- what remains
- artifact links or output references
- blocker details if any
- exact next requested action
- relevant file paths or reservations

The next agent should be able to continue without reconstructing the full history manually.

## Recommended Conventions

Use the same conventions everywhere:

- workflow thread id: `run-<workflow_run_id>`
- message subject prefix: `[task:<task_id>] ...`
- reservation reason: `task:<task_id>`

If an agent name in `prism-coord` is not valid for Agent Mail, the adapter should map it to a stable valid Agent Mail name.

## What The Future Skill Should Teach

The future skill should encode:
- how to authenticate to `prism-coord`
- how to poll or fetch inbox state in Agent Mail
- how to identify the current workflow thread
- how to map a message to a task and run
- how to claim, start, block, and complete tasks
- how to heartbeat and emit events
- how to reserve and release files
- how to write a useful handoff message
- how to avoid taking over task-state ownership from the control plane

## Good First Skill Scope

First version should stay narrow:
- single-agent inbox check
- task start message
- progress/blocker message
- completion message
- file reservation and release
- one explicit handoff pattern to another agent

It does not need to solve:
- autonomous workflow planning
- full multi-agent negotiation
- dynamic role discovery
- complex approval routing

## Open Questions

Questions to settle before turning this into a real skill:
- should agents poll inbox continuously or be triggered externally?
- should handoffs originate only from explicit `prism-coord` records, or can agents initiate them first in Agent Mail?
- how much context should be duplicated between thread messages and task events?
- should Agent Mail mirroring remain fire-and-forget or move behind a queue/domain service?
- what is the exact expected inbox selection strategy when multiple workflow threads are active?

## Suggested Next Step

When ready to formalize this:
1. implement task activity and handoff UI in `prism-coord`
2. stabilize handoff persistence and workflow creation flows
3. turn this draft into a real reusable Codex skill for agent runtimes
