#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_agent_mail_env

if [[ $# -lt 2 || $# -gt 4 ]]; then
  echo "Usage: $0 <program> <model> [agent_mail_name] [task_description]" >&2
  exit 1
fi

program="$1"
model="$2"
agent_mail_name="${3:-}"
task_description="${4:-}"

arguments_json="$(printf '{"project_key":%s,"program":%s,"model":%s,"task_description":%s' \
  "$(printf '%s' "${AGENT_MAIL_PROJECT_KEY}" | json_quote)" \
  "$(printf '%s' "${program}" | json_quote)" \
  "$(printf '%s' "${model}" | json_quote)" \
  "$(printf '%s' "${task_description}" | json_quote)")"

if [[ -n "${agent_mail_name}" ]]; then
  arguments_json="${arguments_json},\"name\":$(printf '%s' "${agent_mail_name}" | json_quote)"
fi

arguments_json="${arguments_json}}"

mail_tool_call "register-mail-agent" "register_agent" "${arguments_json}"
