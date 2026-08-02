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
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from superset.ai_chat.exceptions import (
    AiChatConfigurationError,
    AiChatProviderError,
)
from superset.ai_chat.providers import get_provider, is_provider_configured
from superset.ai_chat.providers.anthropic_provider import (
    _to_wire_messages as anthropic_wire,
    AnthropicProvider,
)
from superset.ai_chat.providers.mock import MockChatProvider
from superset.ai_chat.providers.openai_compat import (
    _to_wire_messages as openai_wire,
    OpenAiCompatibleProvider,
)
from superset.ai_chat.types import (
    ChatMessage,
    ChatRole,
    FinishReason,
    ImageAttachment,
    ToolCall,
    ToolClassification,
    ToolSpec,
)

TOOLS = [
    ToolSpec(
        name="list_dashboards",
        description="List dashboards",
        input_schema={"type": "object"},
        classification=ToolClassification.READ_ONLY,
    ),
    ToolSpec(
        name="delete_dashboard",
        description="Delete a dashboard",
        input_schema={"type": "object"},
        classification=ToolClassification.DESTRUCTIVE,
    ),
    ToolSpec(
        name="execute_sql",
        description="Execute SQL",
        input_schema={"type": "object"},
        classification=ToolClassification.DESTRUCTIVE,
    ),
]


def _user(text: str) -> list[ChatMessage]:
    return [ChatMessage(role=ChatRole.USER, content=text)]


def test_factory_returns_mock_without_credentials() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    assert isinstance(provider, MockChatProvider)
    assert is_provider_configured({"PROVIDER": "mock"}) is True


def test_factory_rejects_unknown_provider() -> None:
    with pytest.raises(AiChatConfigurationError):
        get_provider({"PROVIDER": "skynet"})
    assert is_provider_configured({"PROVIDER": "skynet"}) is False


def test_factory_rejects_commercial_provider_without_key() -> None:
    for provider in ("openai_compatible", "anthropic"):
        with pytest.raises(AiChatConfigurationError):
            get_provider({"PROVIDER": provider, "MODEL": "some-model"})


def test_factory_reads_key_from_named_env_var(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TEST_AI_KEY", "not-a-real-key")
    provider = get_provider(
        {
            "PROVIDER": "anthropic",
            "MODEL": "some-model",
            "API_KEY_ENV_VAR": "TEST_AI_KEY",
        }
    )
    assert isinstance(provider, AnthropicProvider)
    assert provider.settings.api_key == "not-a-real-key"


def test_mock_replies_deterministic_help() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    result = asyncio.run(provider.complete(_user("hello there"), TOOLS))
    assert result.finish_reason == FinishReason.STOP
    assert result.content is not None
    assert "mock" in result.content.lower()
    # Deterministic: identical input, identical output.
    result_two = asyncio.run(provider.complete(_user("hello there"), TOOLS))
    assert result_two.content == result.content


def test_mock_calls_list_dashboards() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    result = asyncio.run(provider.complete(_user("find my dashboards"), TOOLS))
    assert result.finish_reason == FinishReason.TOOL_CALLS
    assert result.tool_calls[0].name == "list_dashboards"


def test_mock_proposes_delete_dashboard() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    result = asyncio.run(provider.complete(_user("please delete dashboard 42"), TOOLS))
    assert result.tool_calls[0].name == "delete_dashboard"
    assert result.tool_calls[0].arguments == {"request": {"identifier": 42}}


def test_mock_respects_available_tools() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    result = asyncio.run(provider.complete(_user("list dashboards"), []))
    assert result.tool_calls == []
    assert result.content is not None


def test_mock_summarizes_tool_results() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    messages = [
        ChatMessage(role=ChatRole.USER, content="list dashboards"),
        ChatMessage(
            role=ChatRole.ASSISTANT,
            tool_calls=[ToolCall(id="tc1", name="list_dashboards", arguments={})],
        ),
        ChatMessage(
            role=ChatRole.TOOL,
            content='{"count": 2}',
            tool_call_id="tc1",
            name="list_dashboards",
        ),
    ]
    result = asyncio.run(provider.complete(messages, TOOLS))
    assert result.finish_reason == FinishReason.STOP
    assert "list_dashboards" in (result.content or "")


def test_mock_provider_error_path() -> None:
    provider = get_provider({"PROVIDER": "mock"})
    with pytest.raises(AiChatProviderError):
        asyncio.run(provider.complete(_user("trigger provider_error! now"), TOOLS))


def test_openai_wire_format_round_trip() -> None:
    messages = [
        ChatMessage(role=ChatRole.SYSTEM, content="system rules"),
        ChatMessage(role=ChatRole.USER, content="hi"),
        ChatMessage(
            role=ChatRole.ASSISTANT,
            content="calling a tool",
            tool_calls=[ToolCall(id="tc1", name="list_dashboards", arguments={"a": 1})],
        ),
        ChatMessage(
            role=ChatRole.TOOL,
            content="result",
            tool_call_id="tc1",
            name="list_dashboards",
        ),
    ]
    wire = openai_wire(messages)
    assert wire[0] == {"role": "system", "content": "system rules"}
    assert wire[2]["tool_calls"][0]["function"]["name"] == "list_dashboards"
    assert wire[3] == {"role": "tool", "tool_call_id": "tc1", "content": "result"}


def test_openai_wire_format_carries_images_as_parts() -> None:
    """A screenshot becomes an image part beside the text of the same turn."""
    wire = openai_wire(
        [
            ChatMessage(
                role=ChatRole.USER,
                content="what is wrong here?",
                images=[
                    ImageAttachment(
                        media_type="image/png", data="AAAB", name="shot.png"
                    )
                ],
            )
        ]
    )
    assert wire[0]["content"] == [
        {"type": "text", "text": "what is wrong here?"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAB"}},
    ]


def test_anthropic_wire_format_carries_images_as_blocks() -> None:
    _, wire = anthropic_wire(
        [
            ChatMessage(
                role=ChatRole.USER,
                content="what is wrong here?",
                images=[ImageAttachment(media_type="image/png", data="AAAB")],
            )
        ]
    )
    assert wire[0]["content"][1] == {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": "AAAB"},
    }


def test_wire_format_omits_empty_text_part() -> None:
    """An image sent with no typed text produces no empty text part."""
    message = ChatMessage(
        role=ChatRole.USER,
        content="",
        images=[ImageAttachment(media_type="image/jpeg", data="AAAB")],
    )
    assert openai_wire([message])[0]["content"] == [
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,AAAB"}},
    ]
    assert len(anthropic_wire([message])[1][0]["content"]) == 1


def test_openai_response_parsing() -> None:
    result = OpenAiCompatibleProvider._parse_response(  # pylint: disable=protected-access
        {
            "choices": [
                {
                    "finish_reason": "tool_calls",
                    "message": {
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_1",
                                "function": {
                                    "name": "list_dashboards",
                                    "arguments": '{"request": {"limit": 5}}',
                                },
                            }
                        ],
                    },
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }
    )
    assert result.finish_reason == FinishReason.TOOL_CALLS
    assert result.tool_calls[0].arguments == {"request": {"limit": 5}}
    assert result.usage == {"prompt_tokens": 10, "completion_tokens": 5}


def test_openai_response_parsing_malformed() -> None:
    with pytest.raises(AiChatProviderError):
        OpenAiCompatibleProvider._parse_response({})  # pylint: disable=protected-access


def test_anthropic_wire_format() -> None:
    messages = [
        ChatMessage(role=ChatRole.SYSTEM, content="system rules"),
        ChatMessage(role=ChatRole.USER, content="hi"),
        ChatMessage(
            role=ChatRole.ASSISTANT,
            content="calling",
            tool_calls=[ToolCall(id="tu1", name="list_dashboards", arguments={"a": 1})],
        ),
        ChatMessage(
            role=ChatRole.TOOL,
            content="result",
            tool_call_id="tu1",
            name="list_dashboards",
        ),
    ]
    system, wire = anthropic_wire(messages)
    assert system == "system rules"
    assert wire[0] == {"role": "user", "content": "hi"}
    assistant_blocks = wire[1]["content"]
    assert assistant_blocks[0] == {"type": "text", "text": "calling"}
    assert assistant_blocks[1]["type"] == "tool_use"
    tool_result = wire[2]["content"][0]
    assert tool_result["type"] == "tool_result"
    assert tool_result["tool_use_id"] == "tu1"


def test_anthropic_response_parsing() -> None:
    result = AnthropicProvider._parse_response(  # pylint: disable=protected-access
        {
            "content": [
                {"type": "text", "text": "Let me check."},
                {
                    "type": "tool_use",
                    "id": "tu1",
                    "name": "list_dashboards",
                    "input": {"request": {"limit": 5}},
                },
            ],
            "stop_reason": "tool_use",
            "usage": {"input_tokens": 7, "output_tokens": 3},
        }
    )
    assert result.content == "Let me check."
    assert result.finish_reason == FinishReason.TOOL_CALLS
    assert result.tool_calls[0].name == "list_dashboards"


def test_anthropic_response_parsing_malformed() -> None:
    with pytest.raises(AiChatProviderError):
        AnthropicProvider._parse_response({"content": "nope"})  # pylint: disable=protected-access


def test_max_completion_tokens_retry_detection() -> None:
    from superset.ai_chat.providers.openai_compat import (
        _needs_max_completion_tokens,
    )

    # The exact rejection newer OpenAI models return for max_tokens.
    assert (
        _needs_max_completion_tokens(
            400,
            {
                "error": {
                    "message": "Unsupported parameter: 'max_tokens' is not "
                    "supported with this model. Use "
                    "'max_completion_tokens' instead.",
                    "type": "invalid_request_error",
                    "param": "max_tokens",
                    "code": "unsupported_parameter",
                }
            },
        )
        is True
    )
    # Other 400s and non-400s must not trigger a retry.
    assert (
        _needs_max_completion_tokens(
            400, {"error": {"message": "invalid model", "param": "model"}}
        )
        is False
    )
    assert (
        _needs_max_completion_tokens(401, {"error": {"param": "max_tokens"}}) is False
    )
    assert _needs_max_completion_tokens(400, None) is False
    assert _needs_max_completion_tokens(400, {"error": "boom"}) is False


def test_reasoning_effort_rejection_detection() -> None:
    from superset.ai_chat.providers.openai_compat import (
        _needs_reasoning_effort_none,
    )

    # The exact rejection gpt-5.6-luna returns when tools are supplied.
    assert (
        _needs_reasoning_effort_none(
            400,
            {
                "error": {
                    "message": "Function tools with reasoning_effort are not "
                    "supported for gpt-5.6-luna in /v1/chat/completions. To "
                    "use function tools, use /v1/responses or set "
                    "reasoning_effort to 'none'.",
                    "type": "invalid_request_error",
                    "param": "reasoning_effort",
                    "code": None,
                }
            },
        )
        is True
    )
    # An unrelated 400 must not trigger it.
    assert (
        _needs_reasoning_effort_none(
            400, {"error": {"message": "bad request", "param": "messages"}}
        )
        is False
    )
    assert _needs_reasoning_effort_none(500, {"error": {}}) is False


@pytest.mark.asyncio
async def test_payload_adapts_until_the_model_accepts_it() -> None:
    """A model can reject several parameters, one rejection at a time."""
    from superset.ai_chat.providers.base import post_json

    sent: list[dict[str, Any]] = []

    class FakeResponse:
        def __init__(self, status: int, body: dict[str, Any]) -> None:
            self.status_code = status
            self._body = body
            self.text = str(body)

        def json(self) -> dict[str, Any]:
            return self._body

    rejections = [
        {"error": {"param": "max_tokens", "message": "use max_completion_tokens"}},
        {
            "error": {
                "param": "reasoning_effort",
                "message": "Function tools with reasoning_effort are not "
                "supported. Set reasoning_effort to 'none'.",
            }
        },
    ]

    class FakeClient:
        async def post(
            self, url: str, json: dict[str, Any], headers: dict[str, str]
        ) -> FakeResponse:
            sent.append(dict(json))
            if rejections:
                return FakeResponse(400, rejections.pop(0))
            return FakeResponse(200, {"ok": True})

    def adapt(status: int, body: Any, current: dict[str, Any]) -> dict[str, Any] | None:
        error = body["error"]
        if error["param"] == "max_tokens" and "max_tokens" in current:
            adapted = dict(current)
            adapted["max_completion_tokens"] = adapted.pop("max_tokens")
            return adapted
        if error["param"] == "reasoning_effort":
            return {**current, "reasoning_effort": "none"}
        return None

    result = await post_json(
        FakeClient(),
        "https://example.invalid/v1/chat/completions",
        {"model": "m", "max_tokens": 16},
        {},
        "Test",
        adapt=adapt,
    )

    assert result == {"ok": True}
    assert len(sent) == 3
    assert "max_tokens" in sent[0]
    assert sent[1]["max_completion_tokens"] == 16
    assert sent[2]["reasoning_effort"] == "none"
    # Adaptations accumulate rather than replacing one another.
    assert sent[2]["max_completion_tokens"] == 16
