# Agent Mail Hardening Notes

These notes document the current Agent Mail integration posture in `prism-coord` and the hardening decisions still left open.

## Current State

- `prism-coord` treats Agent Mail as a best-effort mirror for task lifecycle messages and file reservations.
- Task and workflow state remain in Postgres.
- Agent Mail is currently called directly from route-adjacent service logic.
- Agent Mail access uses:
  - `AGENT_MAIL_URL`
  - `AGENT_MAIL_BEARER_TOKEN`
- Workflow thread ids are normalized to `run-<workflow_run_id>`.
- Control-plane agent ids are mapped to valid Agent Mail agent names before registration and messaging.

## Current Tradeoff

The current implementation favors speed and operator visibility over guaranteed delivery.

Benefits:
- simple implementation
- immediate operator value
- easy local and Railway testing

Risks:
- transient Agent Mail failures do not currently retry
- task transitions can succeed even when message mirroring fails
- reservation and message calls are not yet buffered behind a queue

## Recommended Next Hardening Steps

1. Keep Postgres as the source of truth for task state.
2. Move Agent Mail side effects behind a small domain service boundary rather than calling them directly from route handlers.
3. Add retry or outbox semantics for:
   - task transition mirrors
   - reservation creation
   - reservation release
4. Record Agent Mail delivery failures in task activity so operators can see mirror health.
5. Consider a background worker or queue once message volume justifies it.
6. Preserve the current stable conventions:
   - `run-<workflow_run_id>`
   - `[task:<task_id>] ...`
   - `task:<task_id>`

## Non-Goals For Now

- moving task-state ownership into Agent Mail
- copying full thread bodies into Postgres
- collapsing both systems into one database
