#!/bin/bash
#
# Cursor audit hook: append agent tool call details to JSONL logs under
# .cursor/audit-logs/. Intended for postToolUse and postToolUseFailure.
#
# Always exits 0 so auditing never blocks the agent.

input=$(cat)

log_dir=".cursor/audit-logs"
mkdir -p "$log_dir"

date_str=$(date -u +"%Y-%m-%d")
log_file="${log_dir}/${date_str}.jsonl"
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

event=$(echo "$input" | jq -r '.hook_event_name // "unknown"')

case "$event" in
  postToolUse)
    status="success"
    ;;
  postToolUseFailure)
    status=$(echo "$input" | jq -r '.failure_type // "failure"')
    ;;
  *)
    status="$event"
    ;;
esac

# Cap large tool output to keep log files manageable.
echo "$input" | jq -c \
  --arg ts "$timestamp" \
  --arg status "$status" \
  '{
    timestamp: $ts,
    status: $status,
    hook_event_name: .hook_event_name,
    conversation_id: (.conversation_id // null),
    generation_id: (.generation_id // null),
    tool_name: (.tool_name // null),
    tool_use_id: (.tool_use_id // null),
    cwd: (.cwd // null),
    duration_ms: (.duration // null),
    model: (.model // null),
    user_email: (.user_email // null),
    tool_input: (.tool_input // null),
    tool_output: (
      if (.tool_output | type) == "string" and (.tool_output | length) > 8000 then
        .tool_output[0:8000] + "...[truncated]"
      else
        .tool_output // null
      end
    ),
    error_message: (.error_message // null),
    failure_type: (.failure_type // null),
    is_interrupt: (.is_interrupt // null)
  }' >> "$log_file" 2>/dev/null || true

exit 0
