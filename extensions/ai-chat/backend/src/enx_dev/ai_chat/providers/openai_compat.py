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
"""OpenAI-compatible chat completions provider.

Talks to any endpoint implementing the OpenAI ``/chat/completions`` contract,
such as OpenAI, Azure-compatible gateways, vLLM, llama.cpp server or
OpenRouter, over plain HTTP through ``httpx`` and with no vendor SDK
dependency. The base URL is operator configuration only, never taken from the
request, and redirects are not followed.
"""

from __future__ import annotations

import json  # noqa: TID251  (superset.utils.json is host-internal)
import logging
from typing import Any

from enx_dev.ai_chat.exceptions import AiChatProviderError
from enx_dev.ai_chat.providers.base import (
    BaseChatProvider,
    normalize_usage,
    post_json,
    require_httpx,
)
from enx_dev.ai_chat.types import (
    ChatMessage,
    ChatRole,
    FinishReason,
    ProviderResult,
    ToolCall,
    ToolSpec,
)

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.openai.com/v1"
PROVIDER_LABEL = "OpenAI-compatible"

_FINISH_REASONS = {
    "stop": FinishReason.STOP,
    "tool_calls": FinishReason.TOOL_CALLS,
    "length": FinishReason.LENGTH,
}


def _to_wire_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    wire: list[dict[str, Any]] = []
    for message in messages:
        if message.role == ChatRole.TOOL:
            wire.append(
                {
                    "role": "tool",
                    "tool_call_id": message.tool_call_id,
                    "content": message.content,
                }
            )
        elif message.tool_calls:
            wire.append(
                {
                    "role": "assistant",
                    "content": message.content or None,
                    "tool_calls": [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {
                                "name": call.name,
                                "arguments": json.dumps(call.arguments),
                            },
                        }
                        for call in message.tool_calls
                    ],
                }
            )
        elif message.images:
            # Multimodal user turn: text first, then one part per image.
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
                                "type": "image_url",
                                "image_url": {"url": image.data_url},
                            }
                            for image in message.images
                        ),
                    ],
                }
            )
        else:
            wire.append({"role": message.role.value, "content": message.content})
    return wire


def _to_wire_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            },
        }
        for tool in tools
    ]


def _error_of(status_code: int, body: Any) -> dict[str, Any] | None:
    """The provider's error object for a 400, when it has the usual shape."""
    if status_code != 400 or not isinstance(body, dict):
        return None
    error = body.get("error")
    return error if isinstance(error, dict) else None


def _needs_max_completion_tokens(status_code: int, body: Any) -> bool:
    """Whether the server rejected the legacy ``max_tokens`` parameter.

    Newer OpenAI models such as the gpt-5 family and the o-series accept only
    ``max_completion_tokens`` on ``/chat/completions``, while most
    OpenAI-compatible servers, including vLLM and llama.cpp, accept only
    ``max_tokens``. The provider sends the widely supported name first and
    adapts when it sees this specific rejection.
    """
    error = _error_of(status_code, body)
    if error is None:
        return False
    return error.get("param") == "max_tokens" or "max_completion_tokens" in str(
        error.get("message") or ""
    )


def _needs_reasoning_effort_none(status_code: int, body: Any) -> bool:
    """Whether the model refuses function tools at its default reasoning effort.

    Some gpt-5.x models reject function tools on ``/chat/completions`` unless
    reasoning is switched off, pointing callers at ``/v1/responses`` instead.
    The assistant is built around tools, so applying the documented remedy
    beats losing every tool the gateway offers.
    """
    error = _error_of(status_code, body)
    if error is None:
        return False
    message = str(error.get("message") or "")
    return error.get("param") == "reasoning_effort" or (
        "reasoning_effort" in message and "tools" in message
    )


class OpenAiCompatibleProvider(BaseChatProvider):
    """See the module docstring."""

    async def complete(
        self,
        messages: list[ChatMessage],
        tools: list[ToolSpec],
    ) -> ProviderResult:
        httpx = require_httpx(PROVIDER_LABEL)

        base_url = (self.settings.base_url or DEFAULT_BASE_URL).rstrip("/")
        payload: dict[str, Any] = {
            "model": self.settings.model,
            "messages": _to_wire_messages(messages),
            "max_tokens": self.settings.max_output_tokens,
        }
        if tools:
            payload["tools"] = _to_wire_tools(tools)

        headers = {"Authorization": f"Bearer {self.settings.api_key}"}

        def adapt(
            status_code: int, body: Any, current: dict[str, Any]
        ) -> dict[str, Any] | None:
            """Apply one documented fix per rejection, newest model first."""
            if _needs_max_completion_tokens(status_code, body) and (
                "max_tokens" in current
            ):
                adapted = dict(current)
                adapted["max_completion_tokens"] = adapted.pop("max_tokens")
                return adapted
            if _needs_reasoning_effort_none(status_code, body) and (
                current.get("reasoning_effort") != "none"
            ):
                return {**current, "reasoning_effort": "none"}
            return None

        async with httpx.AsyncClient(timeout=self.settings.timeout_seconds) as client:
            data = await post_json(
                client,
                f"{base_url}/chat/completions",
                payload,
                headers,
                PROVIDER_LABEL,
                adapt=adapt,
            )
        return self._parse_response(data)

    @staticmethod
    def _parse_response(data: dict[str, Any]) -> ProviderResult:
        try:
            choice = data["choices"][0]
            message = choice.get("message") or {}
        except (KeyError, IndexError, TypeError) as ex:
            raise AiChatProviderError(
                "The AI model provider returned an unexpected response."
            ) from ex

        tool_calls: list[ToolCall] = []
        for raw_call in message.get("tool_calls") or []:
            function = raw_call.get("function") or {}
            raw_arguments = function.get("arguments") or "{}"
            try:
                arguments = json.loads(raw_arguments)
            except (ValueError, TypeError):
                arguments = {}
            if not isinstance(arguments, dict):
                arguments = {}
            tool_calls.append(
                ToolCall(
                    id=str(raw_call.get("id") or ""),
                    name=str(function.get("name") or ""),
                    arguments=arguments,
                )
            )

        return ProviderResult(
            content=message.get("content"),
            tool_calls=tool_calls,
            finish_reason=_FINISH_REASONS.get(
                choice.get("finish_reason"), FinishReason.STOP
            ),
            usage=normalize_usage(data.get("usage")),
        )
