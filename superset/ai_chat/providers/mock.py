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
"""Deterministic mock provider for development and tests.

The mock provider needs no credentials and never leaves the process. Its
behavior is rule-based on the latest user message, so development and test
flows are reproducible:

- ``provider_error!`` anywhere in the message raises a provider error,
  exercising the error path.
- After a tool result, summarizes the result deterministically.
- "list/find/show/search ... dashboards" calls ``list_dashboards``.
- "delete dashboard <id>" calls ``delete_dashboard``, exercising the mutation
  approval path.
- "run sql: <query>" calls ``execute_sql`` when a database id is present as
  "on database <id>".
- Anything else returns a deterministic help message.

Tool calls are issued only for tools available to the current user, meaning
the allowlist intersected with RBAC visibility. Otherwise the mock explains
that the capability is unavailable.
"""

from __future__ import annotations

import re

from superset.ai_chat.exceptions import AiChatProviderError
from superset.ai_chat.providers.base import BaseChatProvider
from superset.ai_chat.types import (
    ChatMessage,
    ChatRole,
    FinishReason,
    ProviderResult,
    ToolCall,
    ToolSpec,
)

LIST_DASHBOARDS_PATTERN = re.compile(
    r"\b(?:list|find|show|search)\b.*\bdashboards?\b", re.IGNORECASE | re.DOTALL
)
DELETE_DASHBOARD_PATTERN = re.compile(
    r"\bdelete\b.*\bdashboard\b\D*(\d+)", re.IGNORECASE | re.DOTALL
)
RUN_SQL_PATTERN = re.compile(
    r"\brun sql\s*:\s*(?P<sql>.+?)\s+on database\s+(?P<db>\d+)\s*$",
    re.IGNORECASE | re.DOTALL,
)

HELP_TEXT = (
    "I am the **deterministic mock assistant** — no model provider is "
    "configured. I can demonstrate the full chat workflow:\n\n"
    "- `list dashboards` — runs a read-only MCP tool\n"
    "- `delete dashboard <id>` — proposes a destructive MCP tool "
    "(requires your approval)\n"
    "- `run sql: <query> on database <id>` — proposes SQL execution "
    "(requires your approval)\n\n"
    "Configure a real provider in `AI_CHAT_CONFIG` to chat with a model."
)


class MockChatProvider(BaseChatProvider):
    """Rule-based deterministic provider. See the module docstring."""

    requires_api_key = False

    async def complete(
        self,
        messages: list[ChatMessage],
        tools: list[ToolSpec],
    ) -> ProviderResult:
        tool_names = {tool.name for tool in tools}
        # Deterministic for a given conversation but unique across turns, so
        # the frontend never collapses two calls into one transcript card.
        call_seq = len(messages)
        last = messages[-1] if messages else None

        if last is not None and last.role == ChatRole.TOOL:
            name = last.name or "tool"
            snippet = (last.content or "")[:400]
            return ProviderResult(
                content=(
                    f"Tool `{name}` finished. Result excerpt:\n\n"
                    f"```json\n{snippet}\n```"
                ),
                finish_reason=FinishReason.STOP,
            )

        last_user = next(
            (
                message
                for message in reversed(messages)
                if message.role == ChatRole.USER
            ),
            None,
        )
        text = (last_user.content or "") if last_user else ""

        if "provider_error!" in text:
            raise AiChatProviderError("The mock provider failed as requested.")

        if match := RUN_SQL_PATTERN.search(text):
            if "execute_sql" in tool_names:
                return ProviderResult(
                    content="I will run this SQL query for you.",
                    tool_calls=[
                        ToolCall(
                            id=f"mock_tc_execute_sql_{call_seq}",
                            name="execute_sql",
                            arguments={
                                "request": {
                                    "database_id": int(match.group("db")),
                                    "sql": match.group("sql"),
                                }
                            },
                        )
                    ],
                    finish_reason=FinishReason.TOOL_CALLS,
                )
            return ProviderResult(
                content="SQL execution is not available to you on this instance.",
                finish_reason=FinishReason.STOP,
            )

        if match := DELETE_DASHBOARD_PATTERN.search(text):
            if "delete_dashboard" in tool_names:
                return ProviderResult(
                    content="I can delete that dashboard, pending your approval.",
                    tool_calls=[
                        ToolCall(
                            id=f"mock_tc_delete_dashboard_{call_seq}",
                            name="delete_dashboard",
                            arguments={"request": {"identifier": int(match.group(1))}},
                        )
                    ],
                    finish_reason=FinishReason.TOOL_CALLS,
                )
            return ProviderResult(
                content="Dashboard deletion is not available to you.",
                finish_reason=FinishReason.STOP,
            )

        if LIST_DASHBOARDS_PATTERN.search(text):
            if "list_dashboards" in tool_names:
                return ProviderResult(
                    content=None,
                    tool_calls=[
                        ToolCall(
                            id=f"mock_tc_list_dashboards_{call_seq}",
                            name="list_dashboards",
                            arguments={"request": {"limit": 5}},
                        )
                    ],
                    finish_reason=FinishReason.TOOL_CALLS,
                )
            return ProviderResult(
                content="Dashboard listing is not available to you.",
                finish_reason=FinishReason.STOP,
            )

        return ProviderResult(content=HELP_TEXT, finish_reason=FinishReason.STOP)
