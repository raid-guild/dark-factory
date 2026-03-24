#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_router_env

query="${1:-}"

url="$(dark_factory_api_base)/tasks"
if [[ -n "${query}" ]]; then
  url="${url}?${query}"
fi

df_curl "${url}"
