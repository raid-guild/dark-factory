#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require_dark_factory_env() {
  require_env "DARK_FACTORY_URL"
  require_env "DARK_FACTORY_API_KEY"
  require_env "AGENT_ID"
}

require_agent_mail_env() {
  require_env "AGENT_MAIL_URL"
  require_env "AGENT_MAIL_BEARER_TOKEN"
  require_env "AGENT_MAIL_PROJECT_KEY"
}

dark_factory_api_base() {
  printf '%s' "${DARK_FACTORY_URL%/}/api/v1"
}

agent_mail_base() {
  if [[ "${AGENT_MAIL_URL}" == */ ]]; then
    printf '%s' "${AGENT_MAIL_URL}"
  else
    printf '%s/' "${AGENT_MAIL_URL}"
  fi
}

df_curl() {
  curl -sS \
    -H "content-type: application/json" \
    -H "x-df-api-key: ${DARK_FACTORY_API_KEY}" \
    "$@"
}

mail_curl() {
  curl -sS \
    -H "content-type: application/json" \
    -H "authorization: Bearer ${AGENT_MAIL_BEARER_TOKEN}" \
    "$@"
}
