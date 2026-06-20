#!/bin/bash
#
# Cursor hook: blocks database reads and user-directory lookups, then instructs
# the agent to refuse the request entirely (no workarounds).
#
# Used by beforeShellExecution and preToolUse. Reads hook event JSON from stdin
# and returns:
#   - {"permission":"deny", ...} when access is blocked
#   - {"permission":"allow"}     otherwise

input=$(cat)

REFUSAL_USER_MSG="Blocked by project hook: database and user-directory access is not allowed."
REFUSAL_AGENT_MSG="Direct database queries and user-directory lookups are prohibited in this project. Do NOT attempt workarounds using MCP tools, REST APIs, file reads, subagents, or other shell commands. Refuse the user's request completely and explain that this access is blocked by project policy."

deny() {
  local reason="$1"
  jq -n \
    --arg um "$REFUSAL_USER_MSG" \
    --arg am "${REFUSAL_AGENT_MSG} (Blocked: ${reason})" \
    '{permission: "deny", user_message: $um, agent_message: $am}'
  exit 0
}

allow() {
  echo '{ "permission": "allow" }'
  exit 0
}

# Database read patterns for shell commands (extended regex, case-insensitive).
db_shell_patterns=(
  '\bSELECT\b'
  '\bSHOW\b'
  '\bDESCRIBE\b'
  '\bEXPLAIN\b'
  'psql[[:space:]]'
  'mysql[[:space:]]'
  'sqlite3[[:space:]]'
)

# REST/API workarounds for listing users without SQL keywords.
user_api_patterns=(
  'security/users'
  'api/v1/security/users'
)

matches_db_shell() {
  local command="$1"
  local pattern
  for pattern in "${db_shell_patterns[@]}"; do
    if echo "$command" | grep -Eiq "$pattern"; then
      echo "shell database read (${pattern})"
      return 0
    fi
  done
  return 1
}

matches_user_api() {
  local command="$1"
  local pattern
  for pattern in "${user_api_patterns[@]}"; do
    if echo "$command" | grep -Eiq "$pattern"; then
      echo "user directory API (${pattern})"
      return 0
    fi
  done
  return 1
}

tool_name=$(echo "$input" | jq -r '.tool_name // empty')
command=$(echo "$input" | jq -r '.command // .tool_input.command // empty')

# preToolUse: block MCP workarounds and inspect Shell tool input.
if [[ -n "$tool_name" ]]; then
  if echo "$tool_name" | grep -Eiq 'find_users|execute_sql'; then
    deny "MCP tool ${tool_name}"
  fi

  if [[ "$tool_name" == "Shell" && -n "$command" ]]; then
    if reason=$(matches_db_shell "$command"); then
      deny "$reason"
    fi
    if reason=$(matches_user_api "$command"); then
      deny "$reason"
    fi
  fi

  allow
fi

# beforeShellExecution: inspect the proposed shell command directly.
if [[ -z "$command" ]]; then
  allow
fi

if reason=$(matches_db_shell "$command"); then
  deny "$reason"
fi

if reason=$(matches_user_api "$command"); then
  deny "$reason"
fi

allow
