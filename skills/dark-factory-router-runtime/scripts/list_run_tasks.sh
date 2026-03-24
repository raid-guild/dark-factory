#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_router_env

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <workflow_run_id>" >&2
  exit 1
fi

workflow_run_id="$1"

df_curl "$(dark_factory_api_base)/tasks?workflow_run_id=${workflow_run_id}"
