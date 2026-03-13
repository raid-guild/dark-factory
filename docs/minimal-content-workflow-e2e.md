# Minimal Content Workflow E2E

This walkthrough exercises the smallest useful Dark Factory content workflow:

- operator provides a topic and initial guidance
- `agent-memory` produces a research brief
- `agent-content` produces a draft

The template used here is:

- `Content Brief To Draft` (`content_brief_to_draft:v1`)

## Goal

Validate that the current system can handle a real end-to-end content run using:

- workflow run creation
- task materialization
- agent task lifecycle updates
- handoff context
- Agent Mail thread mirroring
- operator supervision in `/runs/:id`

## Preconditions

Before starting:

1. `prism-coord` is running locally or deployed.
2. Postgres is configured and the seed SQL has been applied.
3. Agent Mail is reachable and configured for `prism-coord`.
4. You have write-capable API keys available.

Useful local envs:

```bash
DATABASE_URL=...
DARK_FACTORY_API_KEYS_JSON='[
  {"key":"admin-local-1","role":"admin","label":"owner"},
  {"key":"agent-memory-1","role":"agent","agent_id":"agent-memory","label":"memory-agent"},
  {"key":"agent-content-1","role":"agent","agent_id":"agent-content","label":"content-agent"}
]'
AGENT_MAIL_URL=...
AGENT_MAIL_BEARER_TOKEN=...
```

## Operator Input

Create the run with a small, concrete context object. Example:

```json
{
  "topic": "How multi-agent coordination helps small teams ship content",
  "content_type": "x-post",
  "goal": "Draft one concise publishable post",
  "audience": "operators and contributors",
  "tone": "clear, practical, not hype-heavy",
  "operator_guidance": "Focus on workflow visibility and tradeoffs. Avoid generic AI claims.",
  "source_links": []
}
```

## Step 1: Confirm The Template Exists

API check:

```bash
curl -sS http://localhost:3000/api/v1/workflow-templates
```

Expected:

- one template with `template_key = content_brief_to_draft`
- two tasks:
  - `Build research brief`
  - `Draft content output`

UI check:

- open `/runs`
- confirm `Content Brief To Draft` appears in the template selector
- confirm the task preview shows the two-task sequence

## Step 2: Create The Workflow Run

Via UI:

1. open `/runs`
2. select `Content Brief To Draft`
3. paste the context JSON
4. use an admin or human write key
5. create the run

Via API:

```bash
curl -X POST http://localhost:3000/api/v1/workflow-runs \
  -H "content-type: application/json" \
  -H "x-df-api-key: admin-local-1" \
  -d '{
    "workflow_template_id":"cccccccc-cccc-cccc-cccc-cccccccccccc",
    "status":"running",
    "context_json":{
      "topic":"How multi-agent coordination helps small teams ship content",
      "content_type":"x-post",
      "goal":"Draft one concise publishable post",
      "audience":"operators and contributors",
      "tone":"clear, practical, not hype-heavy",
      "operator_guidance":"Focus on workflow visibility and tradeoffs. Avoid generic AI claims.",
      "source_links":[]
    }
  }'
```

Expected:

- one new workflow run
- two materialized tasks
- `Build research brief` owned by `agent-memory`
- `Draft content output` owned by `agent-content`
- `Draft content output` depends on `Build research brief`

## Step 3: Memory Agent Executes The Brief Task

1. fetch or inspect the assigned task:

```bash
curl -sS "http://localhost:3000/api/v1/agents/agent-memory/tasks"
```

2. claim it:

```bash
curl -X POST http://localhost:3000/api/v1/tasks/<brief-task-id>/claim \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{}'
```

3. start it and optionally reserve the working file:

```bash
curl -X POST http://localhost:3000/api/v1/tasks/<brief-task-id>/start \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{"file_paths":["content/brief.md"]}'
```

4. heartbeat while working:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agent-memory/heartbeat \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{"status":"working","current_task_id":"<brief-task-id>","progress_pct":50,"status_message":"Building research brief"}'
```

5. emit a progress event:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agent-memory/events \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{"event_type":"brief.progress","task_id":"<brief-task-id>","payload":{"summary":"Collected framing and source angles"}}'
```

6. complete it:

```bash
curl -X POST http://localhost:3000/api/v1/tasks/<brief-task-id>/complete \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{"completion_note":"Research brief complete. Recommended angle and source framing are ready.","file_paths":["content/brief.md"]}'
```

Expected:

- task moves to `completed`
- task events record claim/start/complete
- Agent Mail thread gets mirrored updates

## Step 4: Handoff To Content Agent

Create the handoff once the brief is done:

```bash
curl -X POST http://localhost:3000/api/v1/handoffs \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-memory-1" \
  -d '{
    "from_task_id":"<brief-task-id>",
    "to_task_id":"<draft-task-id>",
    "note":"Brief complete. Draft one concise X post focused on workflow visibility, tradeoffs, and operator control."
  }'
```

Expected:

- handoff row created
- source task gets `handoff.created`
- target task gets `handoff.received`

## Step 5: Content Agent Executes The Draft Task

1. inspect the assigned task:

```bash
curl -sS "http://localhost:3000/api/v1/agents/agent-content/tasks"
```

2. claim and start it:

```bash
curl -X POST http://localhost:3000/api/v1/tasks/<draft-task-id>/claim \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-content-1" \
  -d '{}'

curl -X POST http://localhost:3000/api/v1/tasks/<draft-task-id>/start \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-content-1" \
  -d '{"file_paths":["content/draft.md"]}'
```

3. optionally emit a working event:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agent-content/events \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-content-1" \
  -d '{"event_type":"draft.progress","task_id":"<draft-task-id>","payload":{"summary":"Draft structure created"}}'
```

4. complete it:

```bash
curl -X POST http://localhost:3000/api/v1/tasks/<draft-task-id>/complete \
  -H "content-type: application/json" \
  -H "x-df-api-key: agent-content-1" \
  -d '{"completion_note":"Draft complete and ready for operator review.","file_paths":["content/draft.md"]}'
```

Expected:

- draft task moves to `completed`
- reservations release
- Agent Mail mirrors the final state

## Step 6: Operator Review In The UI

Open `/runs/<workflow-run-id>`.

Verify:

- run context is visible
- both tasks appear in the board
- the drawer shows:
  - task events
  - dependency chain
  - handoff history
  - Agent Mail summary
- activity panel reflects the recent lifecycle

## What Success Looks Like

A successful run means:

- the operator can create a run with real topic/guidance
- `agent-memory` can move the brief task through its lifecycle
- `agent-content` can move the draft task through its lifecycle
- handoff context is visible and durable
- Agent Mail mirrors messages and reservations without owning task state

## Current Known Limits

- outputs are still mostly represented through notes/events rather than a complete artifacts workflow
- Agent Mail web links may require separate browser auth depending on the deployment configuration
- approvals and content artifact publishing are not part of this minimal test
