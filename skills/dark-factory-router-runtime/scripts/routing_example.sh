#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_router_env

cat <<'EOF'
Suggested routing table:

- memory.research -> agent-community-memory
- knowledge.synthesis -> agent-community-memory
- web.research -> agent-research
- content.drafting -> agent-content
- human.approval -> operator

Use list_tasks.sh or list_run_tasks.sh to inspect queued work, then dispatch to the matching worker lane in your external harness.
EOF
