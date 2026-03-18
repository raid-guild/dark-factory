#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_dark_factory_env

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <from_task_id> <to_task_id> '<note>'" >&2
  exit 1
fi

from_task_id="$1"
to_task_id="$2"
note="$3"

if [[ -z "${note// }" ]]; then
  echo "Handoff note is required." >&2
  exit 1
fi

payload="$(printf '{"from_task_id":"%s","to_task_id":"%s","note":%s}' \
  "${from_task_id}" \
  "${to_task_id}" \
  "$(printf '%s' "${note}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"

df_curl \
  -X POST "$(dark_factory_api_base)/handoffs" \
  -d "${payload}"
