#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_agent_mail_env

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <workflow_run_id>" >&2
  exit 1
fi

workflow_run_id="$1"

project_key_encoded="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "${AGENT_MAIL_PROJECT_KEY}")"
thread_id="run-${workflow_run_id}"
uri="resource://thread/${thread_id}?project=${project_key_encoded}&include_bodies=true"
payload="$(printf '{"jsonrpc":"2.0","id":"read-run-thread","method":"resources/read","params":{"uri":"%s"}}' "${uri}")"

mail_curl \
  -X POST "$(agent_mail_base)" \
  -d "${payload}"
