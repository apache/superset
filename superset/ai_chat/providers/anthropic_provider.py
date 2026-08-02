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
"""Anthropic Messages API provider.

Talks to the Anthropic ``/v1/messages`` endpoint over plain HTTP through
``httpx``, with no vendor SDK dependency. The base URL is operator
configuration only, never taken from the request, and redirects are not
followed.
"""

from __future__ import annotations

import logging
from typing import Any

from superset.ai_chat.exceptions import AiChatProviderError
from superset.ai_chat.providers.base import (
    BaseChatProvider,
    normalize_usage,
    post_json,
    require_httpx,
)
from superset.ai_chat.types import (
    ChatMessage,
    ChatRole,
    FinishReason,
    ProviderResult,
    ToolCall,
    ToolSpec,
)

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"
PROVIDER_LABEL = "Anthropic"

_STOP_REASONS = {
    "end_turn": FinishReason.STOP,
    "stop_sequence": FinishReason.STOP,
    "tool_use": FinishReason.TOOL_CALLS,
    "max_tokens": FinishReason.LENGTH,
}


def _to_wire_messages(
    messages: list[ChatMessage],
) -> tuple[str, list[dict[str, Any]]]:
    """Split the neutral format into (system prompt, Anthropic messages)."""
    system_parts: list[str] = []
    wire: list[dict[str, Any]] = []
    for message in messages:
        if message.role == ChatRole.SYSTEM:
            system_parts.append(message.content)
        elif message.role == ChatRole.TOOL:
            wire.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": message.tool_call_id,
                            "content": message.content,
                        }
                    ],
                }
            )
        elif message.tool_calls:
            content: list[dict[str, Any]] = []
            if message.content:
                content.append({"type": "text", "text": message.content})
            content.extend(
                {
                    "type": "tool_use",
                    "id": call.id,
                    "name": call.name,
                    "input": call.arguments,
                }
                for call in message.tool_calls
            )
            wire.append({"role": "assistant", "content": content})
        elif message.images:
            # Multimodal user turn: text first, then one block per image.
            wire.append(
                {
                    "role": message.role.value,
                    "content": [
                        *(
                            [{"type": "text", "text": message.content}]
                            if message.content
                            else []
                        ),
                        *(
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": image.media_type,
                                    "data": image.data,
                                },
                            }
                            for image in message.images
                        ),
                    ],
                }
            )
        else:
            wire.append({"role": message.role.value, "content": message.content})
    return "\n\n".join(system_parts), wire


def _to_wire_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
        }
        for tool in tools
    ]


class AnthropicProvider(BaseChatProvider):
    """See the module docstring."""

    async def complete(
        self,
        messages: list[ChatMessage],
        tools: list[ToolSpec],
    ) -> ProviderResult:
        httpx = require_httpx(PROVIDER_LABEL)

        base_url = (self.settings.base_url or DEFAULT_BASE_URL).rstrip("/")
        system, wire_messages = _to_wire_messages(messages)
        payload: dict[str, Any] = {
            "model": self.settings.model,
            "max_tokens": self.settings.max_output_tokens,
            "messages": wire_messages,
        }
        if system:
            payload["system"] = system
        if tools:
            payload["tools"] = _to_wire_tools(tools)

        headers = {
            "x-api-key": self.settings.api_key or "",
            "anthropic-version": ANTHROPIC_VERSION,
        }
        async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
            data = await post_json(
                client,
                f"{base_url}/v1/messages",
                payload,
                headers,
                PROVIDER_LABEL,
            )
        return self._parse_response(data)

    @staticmethod
    def _parse_response(data: dict[str, Any]) -> ProviderResult:
        blocks = data.get("content")
        if not isinstance(blocks, list):
            raise AiChatProviderError(
                "The AI model provider returned an unexpected response."
            )

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for block in blocks:
            block_type = block.get("type")
            if block_type == "text":
                text_parts.append(block.get("text") or "")
            elif block_type == "tool_use":
                arguments = block.get("input")
                if not isinstance(arguments, dict):
                    arguments = {}
                tool_calls.append(
                    ToolCall(
                        id=str(block.get("id") or ""),
                        name=str(block.get("name") or ""),
                        arguments=arguments,
                    )
                )

        return ProviderResult(
            content="\n".join(part for part in text_parts if part) or None,
            tool_calls=tool_calls,
            finish_reason=_STOP_REASONS.get(
                str(data.get("stop_reason") or ""), FinishReason.STOP
            ),
            usage=normalize_usage(data.get("usage")),
        )
