#!/usr/bin/env bash
# Fetch SSM parameters listed in $SSM_PARAM_MAP and append KEY=value lines
# to $ENV_FILE. {environment} placeholders in paths are substituted with
# $DEPLOY_ENVIRONMENT.
#
# Required env vars:
#   DEPLOY_ENVIRONMENT  Deploy environment name (replaces {environment})
#   ENV_FILE            Target .env file (relative to PWD)
#   SSM_PARAM_MAP       JSON object: { "ENV_VAR_NAME": "/ssm/path", ... }
#
# Requires: aws cli with ssm:GetParameters permission, jq.

set -euo pipefail

: "${DEPLOY_ENVIRONMENT:?DEPLOY_ENVIRONMENT must be set}"
: "${ENV_FILE:?ENV_FILE must be set}"
: "${SSM_PARAM_MAP:?SSM_PARAM_MAP must be set}"

resolved="$(echo "${SSM_PARAM_MAP}" | jq -c --arg env "${DEPLOY_ENVIRONMENT}" '
  [to_entries[] | {key: .key, path: (.value | gsub("\\{environment\\}"; $env))}]
')"

mapfile -t ssm_paths < <(echo "${resolved}" | jq -r '.[].path' | sort -u)

if [[ ${#ssm_paths[@]} -eq 0 ]]; then
  echo "ssm_param_map is empty; skipping"
  exit 0
fi

# aws ssm get-parameters accepts at most 10 names per call; chunk and merge.
parameters='[]'
invalid='[]'
for ((i=0; i<${#ssm_paths[@]}; i+=10)); do
  chunk=("${ssm_paths[@]:i:10}")
  response="$(aws ssm get-parameters --names "${chunk[@]}" --with-decryption --output json)"
  parameters="$(jq -c --argjson acc "${parameters}" '$acc + .Parameters' <<< "${response}")"
  invalid="$(jq -c --argjson acc "${invalid}" '$acc + (.InvalidParameters // [])' <<< "${response}")"
done

invalid_list="$(jq -r '.[]' <<< "${invalid}")"
if [[ -n "${invalid_list}" ]]; then
  echo "ERROR: Missing SSM parameters: ${invalid_list}" >&2
  exit 1
fi

bad_keys="$(jq -r --argjson params "${parameters}" '
  ($params | map({(.Name): .Value}) | add // {}) as $byPath |
  .[] | select(($byPath[.path] // "") | test("[\\n\\r]")) | .key
' <<< "${resolved}")"
if [[ -n "${bad_keys}" ]]; then
  echo "ERROR: SSM parameter(s) contain newlines; only single-line String values are supported: ${bad_keys}" >&2
  exit 1
fi

# Ensure the file ends with a newline so the first appended entry starts on its own line.
if [[ -s "${ENV_FILE}" && "$(tail -c1 "${ENV_FILE}")" != $'\n' ]]; then
  printf '\n' >> "${ENV_FILE}"
fi

jq -r --argjson params "${parameters}" '
  ($params | map({(.Name): .Value}) | add) as $byPath |
  .[] | "\(.key)=\($byPath[.path])"
' <<< "${resolved}" >> "${ENV_FILE}"
