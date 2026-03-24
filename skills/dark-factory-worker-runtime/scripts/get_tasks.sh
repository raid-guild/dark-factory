#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_dark_factory_env

df_curl \
  "$(dark_factory_api_base)/agents/${AGENT_ID}/tasks"
