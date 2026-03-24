#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_agent_mail_env

if [[ $# -lt 6 ]]; then
  echo "Usage: $0 <sender_name> <workflow_run_id> <to_csv> <subject> <body_markdown> <task_id>" >&2
  exit 1
fi

sender_name="$1"
workflow_run_id="$2"
to_csv="$3"
subject="$4"
body_md="$5"
task_id="$6"

python3 -c 'import json,sys; json.dumps([p.strip() for p in sys.argv[1].split(",") if p.strip()])' "${to_csv}" > /tmp/dark_factory_to_json.$$
to_json="$(cat /tmp/dark_factory_to_json.$$)"
rm -f /tmp/dark_factory_to_json.$$

thread_id="run-${workflow_run_id}"

arguments_json="$(printf '{"project_key":%s,"sender_name":%s,"to":%s,"subject":%s,"body_md":%s,"thread_id":%s}' \
  "$(printf '%s' "${AGENT_MAIL_PROJECT_KEY}" | json_quote)" \
  "$(printf '%s' "${sender_name}" | json_quote)" \
  "${to_json}" \
  "$(printf '%s' "${subject}" | json_quote)" \
  "$(printf '%s' "${body_md}" | json_quote)" \
  "$(printf '%s' "${thread_id}" | json_quote)")"

mail_tool_call "send-thread-message" "send_message" "${arguments_json}"
