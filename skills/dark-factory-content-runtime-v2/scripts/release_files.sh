#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_agent_mail_env

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <agent_mail_name> [path1,path2,...]" >&2
  exit 1
fi

agent_name="$1"
paths_csv="${2:-}"

arguments_json="$(printf '{"project_key":%s,"agent_name":%s' \
  "$(printf '%s' "${AGENT_MAIL_PROJECT_KEY}" | json_quote)" \
  "$(printf '%s' "${agent_name}" | json_quote)")"

if [[ -n "${paths_csv}" ]]; then
  python3 -c 'import json,sys; print(json.dumps([p.strip() for p in sys.argv[1].split(",") if p.strip()]))' "${paths_csv}" > /tmp/dark_factory_release_paths_json.$$
  paths_json="$(cat /tmp/dark_factory_release_paths_json.$$)"
  rm -f /tmp/dark_factory_release_paths_json.$$
  arguments_json="${arguments_json},\"paths\":${paths_json}"
fi

arguments_json="${arguments_json}}"

mail_tool_call "release-files" "release_file_reservations" "${arguments_json}"
