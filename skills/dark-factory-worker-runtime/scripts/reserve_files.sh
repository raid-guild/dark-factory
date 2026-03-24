#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_agent_mail_env

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <agent_mail_name> <task_id> <path1[,path2,...]> [ttl_seconds]" >&2
  exit 1
fi

agent_name="$1"
task_id="$2"
paths_csv="$3"
ttl_seconds="${4:-3600}"

python3 -c 'import json,sys; print(json.dumps([p.strip() for p in sys.argv[1].split(",") if p.strip()]))' "${paths_csv}" > /tmp/dark_factory_paths_json.$$
paths_json="$(cat /tmp/dark_factory_paths_json.$$)"
rm -f /tmp/dark_factory_paths_json.$$

arguments_json="$(printf '{"project_key":%s,"agent_name":%s,"paths":%s,"ttl_seconds":%s,"exclusive":true,"reason":%s}' \
  "$(printf '%s' "${AGENT_MAIL_PROJECT_KEY}" | json_quote)" \
  "$(printf '%s' "${agent_name}" | json_quote)" \
  "${paths_json}" \
  "${ttl_seconds}" \
  "$(printf 'task:%s' "${task_id}" | json_quote)")"

mail_tool_call "reserve-files" "file_reservation_paths" "${arguments_json}"
