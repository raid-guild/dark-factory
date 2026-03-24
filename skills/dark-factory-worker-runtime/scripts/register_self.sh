#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_dark_factory_env

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 '<json payload>'" >&2
  exit 1
fi

payload="$1"

df_curl \
  -X POST "$(dark_factory_api_base)/agents/register-self" \
  -d "${payload}"
