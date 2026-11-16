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
"""Context-window invariants with a deterministic byte-token model."""

from __future__ import annotations

import asyncio
from dataclasses import asdict
from typing import Any

import pytest

from superset.ai.llm.base import (
    CompletionRequest,
    LLMConfigurationError,
    LLMResponse,
    Message,
    RequestTokenCount,
    ToolCall,
    ToolDefinition,
    ToolResult,
)
from superset.ai.llm.openai_compatible import OpenAICompatibleProvider
from superset.ai.runtime.context import (
    ContextManager,
    ContextPolicy,
    ContextWindowError,
    ConversationContext,
)
from superset.ai.types import MessageRole
from superset.utils import json


class ByteTokenProvider(OpenAICompatibleProvider):
    """A toy model whose vocabulary contains precisely the 256 byte values.

    This is the test provider's actual encoding, not a production token estimate.
    It lets assertions account for complete schemas and non-ASCII data exactly.
    """

    supports_token_counting = True

    def __init__(self, *, window: int = 8000) -> None:
        super().__init__(models={"default": "byte-model", "reasoning": "pinned-model"})
        self.window = window
        self.counted: list[CompletionRequest] = []
        self.summaries: list[CompletionRequest] = []
        self.response = LLMResponse(text="Verified total: 42. Source: dataset 7.")

    def encoded_size(self, request: CompletionRequest) -> int:
        """Encode the entire prompt, including explicit structural overhead."""
        wire = {
            "model": self.select_model(request),
            "system": request.system,
            "messages": [asdict(message) for message in request.messages],
            "tools": [asdict(tool) for tool in request.tools],
        }
        return len(json.dumps(wire, ensure_ascii=False).encode("utf-8"))

    async def count_tokens(self, request: CompletionRequest) -> RequestTokenCount:
        self.counted.append(request)
        return RequestTokenCount(self.encoded_size(request), self.window)

    async def complete(self, request: CompletionRequest) -> LLMResponse:
        self.summaries.append(request)
        assert request.max_output_tokens is not None
        assert self.encoded_size(request) + request.max_output_tokens <= self.window
        return self.response


def _template() -> CompletionRequest:
    return CompletionRequest(
        messages=[],
        model="pinned-model",
        system="Only use permitted data.",
        tools=[ToolDefinition("query", "Inspect the source", {"type": "object"})],
        max_output_tokens=17,
    )


def _history() -> ConversationContext:
    return ConversationContext(
        messages=[
            Message(MessageRole.USER, "Old question " + "a" * 1500),
            Message(
                MessageRole.ASSISTANT, "Source: dataset 7, total 42. " + "b" * 1500
            ),
            Message(MessageRole.USER, "Another question " + "c" * 1500),
            Message(MessageRole.ASSISTANT, "Another answer " + "d" * 1500),
            Message(MessageRole.USER, "What was the verified total?"),
        ]
    )


async def test_output_budget_is_all_remaining_measured_space() -> None:
    provider = ByteTokenProvider()
    context = ConversationContext([Message(MessageRole.USER, "Қазақ")])
    prepared = await ContextManager(provider, ContextPolicy()).prepare(
        _template(), context
    )
    assert (
        prepared.request.max_output_tokens
        == provider.window - provider.encoded_size(prepared.request)
    )
    assert prepared.request.max_output_tokens > 17
    assert prepared.context is context
    assert prepared.summary_usage == []
    assert not provider.summaries


async def test_compaction_preserves_question_and_original_transcript() -> None:
    provider = ByteTokenProvider()
    context = _history()
    before = asdict(context)
    prepared = await ContextManager(provider, ContextPolicy()).prepare(
        _template(), context
    )
    assert asdict(context) == before
    assert prepared.context.messages == [context.messages[-1]]
    assert prepared.context.summary == provider.response.text
    assert prepared.context.compactions == 1
    assert prepared.request.messages[-1].content == "What was the verified total?"
    assert (
        "historical evidence, not a new request" in prepared.request.messages[0].content
    )
    assert prepared.request.system == _template().system
    assert prepared.request.tools == _template().tools
    assert all(
        request.model == "pinned-model"
        for request in provider.counted + provider.summaries
    )
    assert all(not request.tools for request in provider.summaries)
    assert len(provider.summaries) > 1
    second = json.loads(provider.summaries[1].messages[0].content)
    assert second["previous_summary"] == provider.response.text
    summarized = [
        row
        for request in provider.summaries
        for row in json.loads(request.messages[0].content)["earlier_messages"]
    ]
    assert summarized == [asdict(message) for message in context.messages[:-1]]
    assert prepared.request.max_output_tokens is not None
    assert (
        prepared.count.input_tokens + prepared.request.max_output_tokens
        == provider.window
    )


async def test_compaction_preserves_complete_tool_exchanges_and_latest_result() -> None:
    provider = ByteTokenProvider()
    old_calls = Message(
        MessageRole.ASSISTANT,
        tool_calls=[ToolCall("a", "query", {}), ToolCall("b", "query", {})],
    )
    old_results = [
        Message(MessageRole.USER, tool_results=[ToolResult("a", "x" * 3000)]),
        Message(MessageRole.USER, tool_results=[ToolResult("b", "y" * 3000)]),
    ]
    question = Message(MessageRole.USER, "Compare the two sources.")
    latest_pair = [
        Message(MessageRole.ASSISTANT, tool_calls=[ToolCall("c", "query", {})]),
        Message(
            MessageRole.USER, tool_results=[ToolResult("c", "latest exact evidence")]
        ),
    ]
    context = ConversationContext([question, old_calls, *old_results, *latest_pair])
    prepared = await ContextManager(provider, ContextPolicy()).prepare(
        _template(), context
    )
    assert prepared.context.messages == [question, *latest_pair]
    rows = json.loads(provider.summaries[0].messages[0].content)["earlier_messages"]
    assert rows == [asdict(old_calls), *(asdict(message) for message in old_results)]
    assert (
        json.loads(provider.summaries[0].messages[0].content)["current_question"]
        == question.content
    )


@pytest.mark.parametrize("oversized", [True, False])
@pytest.mark.parametrize(
    "bad_result", ["orphan", "missing", "duplicate", "wrong_id", "wrong_role"]
)
async def test_compaction_never_hides_broken_tool_pairs(
    bad_result: str, oversized: bool
) -> None:
    provider = ByteTokenProvider()
    context = _history() if oversized else ConversationContext([])
    call = Message(MessageRole.ASSISTANT, tool_calls=[ToolCall("a", "query", {})])
    result = Message(MessageRole.USER, tool_results=[ToolResult("a", "result")])
    additions = {
        "orphan": [result],
        "missing": [call],
        "duplicate": [
            call,
            Message(
                MessageRole.USER,
                tool_results=[ToolResult("a", "1"), ToolResult("a", "2")],
            ),
        ],
        "wrong_id": [
            call,
            Message(MessageRole.USER, tool_results=[ToolResult("b", "1")]),
        ],
        "wrong_role": [
            call,
            Message(MessageRole.ASSISTANT, tool_results=[ToolResult("a", "1")]),
        ],
    }
    context.messages.extend(additions[bad_result])
    before = asdict(context)
    with pytest.raises(ContextWindowError, match="tool"):
        await ContextManager(provider, ContextPolicy()).prepare(_template(), context)
    assert asdict(context) == before
    assert not provider.summaries


@pytest.mark.parametrize(
    "response",
    [
        LLMResponse(text="unfinished", stop_reason="max_tokens"),
        LLMResponse(text=" "),
        LLMResponse(tool_calls=[ToolCall("no", "query", {})], stop_reason="tool_use"),
    ],
)
async def test_failed_summary_never_replaces_history(response: LLMResponse) -> None:
    provider = ByteTokenProvider()
    provider.response = response
    context = ConversationContext(
        [
            Message(MessageRole.ASSISTANT, "x" * 6100),
            Message(MessageRole.USER, "Keep the exact values."),
        ]
    )
    before = asdict(context)
    with pytest.raises(ContextWindowError, match="complete conversation summary"):
        await ContextManager(provider, ContextPolicy()).prepare(_template(), context)
    assert asdict(context) == before


async def test_summary_that_grows_the_context_is_not_committed() -> None:
    provider = ByteTokenProvider()
    provider.response = LLMResponse(text="x" * 6500)
    context = ConversationContext(
        [
            Message(MessageRole.ASSISTANT, "x" * 6100),
            Message(MessageRole.USER, "Keep the exact values."),
        ]
    )
    before = asdict(context)
    with pytest.raises(ContextWindowError, match="did not reduce"):
        await ContextManager(provider, ContextPolicy()).prepare(_template(), context)
    assert asdict(context) == before


async def test_oversized_current_question_is_not_silently_cut() -> None:
    provider = ByteTokenProvider()
    context = ConversationContext([Message(MessageRole.USER, "x" * 9000)])
    before = asdict(context)
    with pytest.raises(ContextWindowError, match="No history was discarded"):
        await ContextManager(provider, ContextPolicy()).prepare(_template(), context)
    assert asdict(context) == before
    assert not provider.summaries


async def test_system_and_tool_schemas_count_toward_the_same_window() -> None:
    provider = ByteTokenProvider()
    template = _template()
    template.tools = [ToolDefinition("query", "x" * 9000, {})]
    context = ConversationContext([Message(MessageRole.USER, "Small question")])
    with pytest.raises(ContextWindowError, match="context window"):
        await ContextManager(provider, ContextPolicy()).prepare(template, context)


async def test_summary_itself_can_be_recompacted_on_a_later_turn() -> None:
    provider = ByteTokenProvider()
    context = ConversationContext(
        [Message(MessageRole.USER, "What was the total?")],
        summary="Verified result. " + "x" * 6100,
        compactions=2,
    )
    prepared = await ContextManager(provider, ContextPolicy()).prepare(
        _template(), context
    )
    assert prepared.context.compactions == 3
    assert prepared.context.messages == context.messages
    payload = json.loads(provider.summaries[0].messages[0].content)
    assert payload["earlier_messages"] == []
    assert payload["previous_summary"] == context.summary


async def test_cancel_during_compaction_preserves_the_original_checkpoint() -> None:
    provider = ByteTokenProvider()
    context = _history()
    before = asdict(context)
    calls = 0

    def check_active() -> None:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise asyncio.CancelledError

    with pytest.raises(asyncio.CancelledError):
        await ContextManager(
            provider, ContextPolicy(), check_active=check_active
        ).prepare(_template(), context)
    assert asdict(context) == before
    assert not provider.summaries


async def test_changing_serving_window_is_not_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = ByteTokenProvider()
    count = provider.count_tokens

    async def changing(request: CompletionRequest) -> RequestTokenCount:
        result = await count(request)
        provider.window -= 1
        return result

    monkeypatch.setattr(provider, "count_tokens", changing)
    with pytest.raises(LLMConfigurationError, match="window changed"):
        await ContextManager(provider, ContextPolicy()).prepare(_template(), _history())
    assert not provider.summaries


@pytest.mark.parametrize(
    "fraction", [0, 1, -0.1, float("nan"), float("inf"), True, "0.75"]
)
def test_invalid_headroom_policy_is_a_configuration_error(fraction: Any) -> None:
    with pytest.raises(LLMConfigurationError, match="fraction"):
        ContextPolicy(input_fraction=fraction)


async def test_context_compaction_requires_an_exact_counter() -> None:
    provider = OpenAICompatibleProvider(models={"default": "no-counter"})
    with pytest.raises(LLMConfigurationError, match="exact token counting"):
        await ContextManager(provider, ContextPolicy()).prepare(_template(), _history())
