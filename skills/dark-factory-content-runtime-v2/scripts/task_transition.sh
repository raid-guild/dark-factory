#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_dark_factory_env

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <claim|start|block|complete> <task_id> [json payload]" >&2
  exit 1
fi

action="$1"
task_id="$2"
payload="${3:-{}}"

case "${action}" in
  claim|start|block|complete)
    ;;
  *)
    echo "Invalid action: ${action}" >&2
    exit 1
    ;;
esac

df_curl \
  -X POST "$(dark_factory_api_base)/tasks/${task_id}/${action}" \
  -d "${payload}"
