# Dark Factory POC Checklist

## Completed

### Product + Architecture
- [x] High-level developer brief created
- [x] MVP scope, state models, and acceptance criteria documented
- [x] OpenAPI 3.1 draft contract created

### Repo + Project Setup
- [x] Git repo initialized and pushed to GitHub
- [x] Next.js app scaffolded (TypeScript, ESLint, build scripts)
- [x] Build and lint running clean

### Data Layer
- [x] Postgres migration scaffold created
- [x] Core tables/enums/indexes defined:
  - agents, actor, presence, tasks, task_events, events
  - workflow_templates, workflow_runs
  - approvals, artifacts, handoffs
- [x] `updated_at` trigger function included

### API Layer
- [x] `/api/v1/*` route structure scaffolded for all core domains
- [x] Response helper utilities added for consistent JSON stubs

### Security / Access
- [x] Write API protection enabled via header key
- [x] Multiple API key support implemented (`DARK_FACTORY_API_KEYS_JSON`)
- [x] Role-based write access policy implemented (`admin`, `human`, `agent`)
- [x] Agent key binding to `agent_id` for `/agents/:agentId/*` writes
- [x] Legacy single-key fallback retained (`DARK_FACTORY_API_KEY`)

### UI / Visualization
- [x] Runs index page (`/runs`)
- [x] Run board page (`/runs/[id]`) with status columns
- [x] Task detail drawer
- [x] Agent presence panel
- [x] Drag-and-drop task movement between columns (client-side)
- [x] Board UX enhancements:
  - search
  - owner filter
  - hide done toggle
  - recent activity panel

### Brand Alignment
- [x] Early RaidGuild brand alignment doc added
- [x] Semantic color tokens and base visual system applied

## Remaining For POC

### Critical Path (Must-Have)
- [ ] Implement real Postgres DB calls in API routes (replace stubs)
- [ ] Add task state transition enforcement server-side
- [ ] Persist task moves from Kanban to API (not client-only)
- [ ] Persist workflow events on each status change
- [ ] Implement approval endpoints with real DB mutations
- [ ] Implement artifact attach/list endpoints with DB reads/writes
- [ ] Implement handoff create/read endpoints with DB reads/writes

### Auth + Governance
- [ ] Add server-side actor resolution (`who is calling`) for writes
- [ ] Record actor identity in task/events/audit tables
- [ ] Add key rotation playbook and key revocation process
- [ ] Add environment validation on startup (required secrets, DB URL)

### Data + Workflow
- [ ] Seed at least one workflow template (`content_pipeline:v1`)
- [ ] Add workflow run bootstrap logic (auto-create initial tasks)
- [ ] Add task dependency checks before start/complete transitions
- [ ] Add blocked/unblocked lifecycle handling

### UI POC Completion
- [ ] Wire Kanban drop actions to real task endpoints with optimistic rollback
- [ ] Show live task data from API without mock fallback in production mode
- [ ] Add approval queue view for humans (`/approvals`)
- [ ] Add task event timeline in drawer (from API)
- [ ] Add artifact list and add-artifact action in drawer

### Observability + Reliability
- [ ] Add structured request logging (endpoint, actor, latency, status)
- [ ] Add error normalization and response codes across all endpoints
- [ ] Add health/readiness endpoint
- [ ] Add basic integration tests for core flow:
  - create run -> create tasks -> agent progresses task -> approval -> completion

### Deployment / Ops
- [ ] Add `.env.example` with all required variables
- [ ] Add Postgres setup docs (local + hosted)
- [ ] Add deploy target config (Vercel or equivalent)
- [ ] Add POC runbook (start app, seed data, demo flow)

## Suggested POC Exit Criteria
- [ ] Human can create a workflow run and see generated tasks on board
- [ ] Agent-authenticated requests can update task lifecycle in DB
- [ ] Human-authenticated requests can approve/reject task outputs
- [ ] Artifacts and handoffs are persisted and visible in UI
- [ ] End-to-end event history is queryable for one completed run
