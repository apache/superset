#!/usr/bin/env bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# Run the AI translation backfill (`npm run translations:backfill`) over
# several catalogs in parallel, with a fallback provider.
#
# Usage: backfill_all.sh [--provider anthropic|llmao] [--model MODEL]
#                        [--no-fallback] [LANG ...]
#
#   --provider   anthropic (default): Claude via the Claude Code CLI's own
#                credentials (ANTHROPIC_API_KEY, or a logged-in CLI locally).
#                llmao: Apache LLMAO (https://llm.apache.org), the ASF model
#                gateway, authenticated with LLMAO_KEY.
#   --model      Model for the primary provider (default: the script default,
#                the latest Sonnet, for anthropic; gemma4-26b for llmao).
#   --no-fallback
#                Don't fall back to LLMAO. By default, when the primary
#                provider is anthropic and LLMAO_KEY is set, the whole run
#                moves to LLMAO if a preflight request to Anthropic fails, and
#                any language left with failed entries gets a second pass on
#                LLMAO (the backfill only fills empty entries, so that pass
#                only touches what the first one missed).
#   LANG ...     Language codes (default: every catalog except en).
#
# Prints one result line per language. Each generated entry's attribution
# comment records the model that produced it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LLMAO_URL="https://llm.apache.org"
LLMAO_DEFAULT_MODEL="gemma4-26b"
# Gateway limits: at most 8,192 output tokens per request (30 Tamil strings
# already use ~6k) and a handful of concurrent long requests per model.
LLMAO_BATCH_SIZE=20
LLMAO_PARALLEL=4
ANTHROPIC_PARALLEL=8

provider="anthropic"
model=""
fallback=true
langs=()
while [ $# -gt 0 ]; do
  case "$1" in
    --provider) provider="$2"; shift 2 ;;
    --model) model="$2"; shift 2 ;;
    --no-fallback) fallback=false; shift ;;
    -h|--help) sed -n '19,41p' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) langs+=("$1"); shift ;;
  esac
done

case "$provider" in
  anthropic|llmao) ;;
  *) echo "Invalid provider: $provider (expected anthropic or llmao)" >&2; exit 2 ;;
esac
# Values are passed to a per-language shell, so only accept plain tokens.
if [ -n "$model" ] && ! printf '%s' "$model" | grep -Eqx '[A-Za-z0-9._-]+'; then
  echo "Invalid model: $model" >&2
  exit 2
fi
if [ ${#langs[@]} -eq 0 ]; then
  while IFS= read -r lang; do langs+=("$lang"); done < <(
    find "$ROOT/superset/translations" -path '*/LC_MESSAGES/messages.po' \
      | awk -F/ '{print $(NF-2)}' | grep -vx en | sort
  )
fi
for lang in "${langs[@]}"; do
  if ! printf '%s' "$lang" | grep -Eqx '[a-z]{2,3}(_[A-Za-z]{2,4})?'; then
    echo "Invalid language code: $lang" >&2
    exit 2
  fi
done
if [ "$provider" = "llmao" ] && [ -z "${LLMAO_KEY:-}" ]; then
  echo "LLMAO_KEY is not set." >&2
  exit 2
fi
if [ "$fallback" = true ] && { [ "$provider" = "llmao" ] || [ -z "${LLMAO_KEY:-}" ]; }; then
  fallback=false
fi

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

# Run a command with the environment for the given provider.
with_provider() {
  local which="$1"; shift
  if [ "$which" = "llmao" ]; then
    local m="${PROVIDER_MODEL:-$LLMAO_DEFAULT_MODEL}"
    # The gateway answers only for the models it serves, so every Claude Code
    # model role points at the same one. See https://llm.apache.org/help/claude-code.
    env -u ANTHROPIC_API_KEY \
      ANTHROPIC_BASE_URL="$LLMAO_URL" \
      ANTHROPIC_AUTH_TOKEN="$LLMAO_KEY" \
      ANTHROPIC_MODEL="$m" \
      ANTHROPIC_DEFAULT_OPUS_MODEL="$m" \
      ANTHROPIC_DEFAULT_SONNET_MODEL="$m" \
      ANTHROPIC_DEFAULT_HAIKU_MODEL="$m" \
      CLAUDE_CODE_SUBAGENT_MODEL="$m" \
      CLAUDE_CODE_MAX_CONTEXT_TOKENS=120000 \
      CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192 \
      CLAUDE_CODE_EFFORT_LEVEL=medium \
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
      "$@"
  else
    "$@"
  fi
}

# Backfill the given languages on one provider; print "<lang> ok|failed: …".
run_pass() {
  local which="$1"; shift
  local args parallel
  if [ "$which" = "llmao" ]; then
    PROVIDER_MODEL="${PASS_MODEL:-$LLMAO_DEFAULT_MODEL}"
    args="--model $PROVIDER_MODEL --batch-size $LLMAO_BATCH_SIZE"
    parallel=$LLMAO_PARALLEL
  else
    PROVIDER_MODEL=""
    args="${PASS_MODEL:+--model $PASS_MODEL}"
    parallel=$ANTHROPIC_PARALLEL
  fi
  export LOG_DIR ROOT PASS_ARGS="$args" PASS_NAME="$which"
  # The language is passed as $1 (not substituted with -I{}): BSD xargs
  # caps -I replacement commands at 255 bytes.
  # shellcheck disable=SC2016 # the inner script expands its own variables
  printf '%s\n' "$@" | with_provider "$which" xargs -P "$parallel" -n 1 bash -c '
    lang="$1"
    log="$LOG_DIR/$PASS_NAME-$lang.log"
    if (cd "$ROOT/superset-frontend" && npm run --silent translations:backfill -- \
        --lang "$lang" $PASS_ARGS) > "$log" 2>&1; then
      done_line=$(grep -h "^Done\." "$log" || echo "Done. Nothing to do.")
      failed=$(printf "%s" "$done_line" | sed -n "s/.*Failed\/skipped: \([0-9]*\).*/\1/p")
      if [ "${failed:-0}" -gt 0 ]; then
        echo "$lang failed: [$PASS_NAME] $done_line"
      else
        echo "$lang ok: [$PASS_NAME] $done_line"
      fi
    else
      echo "$lang failed: [$PASS_NAME] exited non-zero: $(tail -1 "$log")"
    fi
  ' _
}

primary="$provider"
if [ "$fallback" = true ]; then
  # Fail fast on a broken or out-of-credit Anthropic account rather than
  # discovering it one failed batch at a time.
  if ! printf 'Reply with the single word OK.' \
      | claude ${model:+--model "$model"} -p --tools "" --no-session-persistence \
      > /dev/null 2>&1; then
    echo "Anthropic preflight request failed; using LLMAO for this run." >&2
    primary="llmao"
    model=""
  fi
fi

PASS_MODEL="$model" run_pass "$primary" "${langs[@]}" | tee "$LOG_DIR/pass1.txt"

if [ "$fallback" = true ] && [ "$primary" = "anthropic" ]; then
  retry=()
  while IFS= read -r lang; do retry+=("$lang"); done < <(
    grep ' failed: ' "$LOG_DIR/pass1.txt" | cut -d' ' -f1
  )
  if [ ${#retry[@]} -gt 0 ]; then
    echo "Retrying ${retry[*]} on LLMAO ($LLMAO_DEFAULT_MODEL)." >&2
    PASS_MODEL="" run_pass llmao "${retry[@]}"
  fi
fi
