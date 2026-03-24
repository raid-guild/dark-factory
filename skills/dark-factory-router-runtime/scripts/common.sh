#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require_router_env() {
  require_env "DARK_FACTORY_URL"
  require_env "DARK_FACTORY_API_KEY"
}

dark_factory_api_base() {
  printf '%s' "${DARK_FACTORY_URL%/}/api/v1"
}

df_curl() {
  curl -sS \
    -H "content-type: application/json" \
    -H "x-df-api-key: ${DARK_FACTORY_API_KEY}" \
    "$@"
}
