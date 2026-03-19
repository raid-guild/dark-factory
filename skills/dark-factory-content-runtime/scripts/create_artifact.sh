#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

require_dark_factory_env

usage() {
  cat >&2 <<'EOF'
Usage:
  create_artifact.sh <task_id> <workflow_run_id> <kind> <title> <uri> [metadata json] [--body-markdown-file <path>] [--body-text-file <path>]

Examples:
  create_artifact.sh task-1 run-1 content_draft "Draft X post" "outputs/draft.md"
  create_artifact.sh task-1 run-1 content_draft "Draft X post" "outputs/draft.md" \
    '{"format":"markdown"}' --body-markdown-file outputs/draft.md
EOF
}

if [[ $# -lt 5 ]]; then
  usage
  exit 1
fi

task_id="$1"
workflow_run_id="$2"
kind="$3"
title="$4"
uri="$5"
shift 5

metadata_json="{}"
if [[ $# -gt 0 && "${1:-}" != --* ]]; then
  metadata_json="$1"
  shift
fi

body_markdown=""
body_text=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --body-markdown-file)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --body-markdown-file" >&2
        exit 1
      fi
      body_markdown="$(<"$2")"
      shift 2
      ;;
    --body-text-file)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --body-text-file" >&2
        exit 1
      fi
      body_text="$(<"$2")"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

python3 -c 'import json,sys; json.loads(sys.argv[1])' "${metadata_json}" >/dev/null

title_json="$(printf '%s' "${title}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
uri_json="$(printf '%s' "${uri}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
body_markdown_json="$(printf '%s' "${body_markdown}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
body_text_json="$(printf '%s' "${body_text}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"

payload="$(printf '{"task_id":"%s","workflow_run_id":"%s","kind":"%s","title":%s,"uri":%s,"metadata_json":%s,"body_markdown":%s,"body_text":%s}' \
  "${task_id}" \
  "${workflow_run_id}" \
  "${kind}" \
  "${title_json}" \
  "${uri_json}" \
  "${metadata_json}" \
  "${body_markdown_json}" \
  "${body_text_json}")"

df_curl \
  -X POST "$(dark_factory_api_base)/artifacts" \
  -d "${payload}"
