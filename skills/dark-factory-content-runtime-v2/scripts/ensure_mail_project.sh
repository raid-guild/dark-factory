#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_agent_mail_env

human_key="${1:-${AGENT_MAIL_PROJECT_KEY}}"

arguments_json="$(printf '{"human_key":%s}' \
  "$(printf '%s' "${human_key}" | json_quote)")"

mail_tool_call "ensure-mail-project" "ensure_project" "${arguments_json}"
