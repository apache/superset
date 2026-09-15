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
"""Tests for the scripted echo provider."""

from __future__ import annotations

import pytest

from superset.ai.llm.base import (
    CompletionRequest,
    LLMRequestError,
    LLMTransportError,
    Message,
    ModelAlias,
    StreamEventKind,
    ToolCall,
    ToolDefinition,
    ToolResult,
)
from superset.ai.llm.echo import (
    EchoProvider,
    EchoScriptExhaustedError,
    EMPTY_REPLY,
    ScriptedTurn,
    split_into_chunks,
)
from superset.ai.types import MessageRole


def _request(text: str = "how many rows?") -> CompletionRequest:
    return CompletionRequest(messages=[Message(role=MessageRole.USER, content=text)])


async def test_an_unscripted_provider_echoes_the_last_user_message() -> None:
    """The zero-setup path, so a smoke test needs no script."""
    provider = EchoProvider()

    response = await provider.complete(_request("hello"))

    assert response.text == "echo: hello"
    assert response.stop_reason == "end_turn"
    assert response.wants_tools is False


async def test_an_unscripted_provider_handles_a_turn_with_no_user_prose() -> None:
    """A conversation of nothing but tool traffic still gets an answer."""
    provider = EchoProvider()
    request = CompletionRequest(
        messages=[
            Message(
                role=MessageRole.USER,
                tool_results=[ToolResult(call_id="c1", content="9")],
            )
        ]
    )

    assert (await provider.complete(request)).text == EMPTY_REPLY


def test_model_ids_are_stable_across_tiers() -> None:
    provider = EchoProvider()

    assert provider.resolve_model(ModelAlias.DEFAULT) == "echo-default"
    assert provider.resolve_model(ModelAlias.FAST) == "echo-fast"
    assert provider.resolve_model(ModelAlias.REASONING) == "echo-reasoning"
    assert provider.available_models() == [
        "echo-default",
        "echo-fast",
        "echo-reasoning",
    ]


async def test_a_request_runs_against_the_model_its_alias_resolves_to() -> None:
    provider = EchoProvider()

    await provider.complete(
        CompletionRequest(
            messages=[Message(role=MessageRole.USER, content="hi")],
            model_alias=ModelAlias.FAST,
        )
    )

    assert provider.requests[-1].model == "echo-fast"


async def test_an_explicit_model_wins_over_the_alias() -> None:
    """How a picker or an evaluation pins one model without touching config."""
    provider = EchoProvider()

    response = await provider.complete(
        CompletionRequest(
            messages=[Message(role=MessageRole.USER, content="hi")],
            model_alias=ModelAlias.FAST,
            model="echo-reasoning",
        )
    )

    recorded = provider.requests[-1]
    assert recorded.model == "echo-reasoning"
    assert recorded.model_alias == ModelAlias.FAST
    # Reported usage attributes the tokens to the model that actually ran.
    assert response.usage["model"] == "echo-reasoning"


async def test_an_unknown_explicit_model_is_refused_not_substituted() -> None:
    """
    Silently falling back would make cost and answer quality unattributable.
    """
    provider = EchoProvider([ScriptedTurn(text="never reached")])
    request = CompletionRequest(
        messages=[Message(role=MessageRole.USER, content="hi")],
        model="echo-nonexistent",
    )

    with pytest.raises(LLMRequestError, match="echo-nonexistent"):
        await provider.complete(request)

    # Refused before it counted as a round trip, so the script is untouched.
    assert provider.requests == []
    assert provider.remaining_turns == 1


async def test_a_script_is_replayed_in_order() -> None:
    """A tool call then an answer, which is the shape of every loop test."""
    call = ToolCall(id="c1", name="run_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider(
        [ScriptedTurn(tool_calls=(call,)), ScriptedTurn(text="One row.")]
    )

    first = await provider.complete(_request())
    assert first.wants_tools
    assert first.tool_calls == [call]
    assert first.stop_reason == "tool_use"
    assert provider.remaining_turns == 1

    second = await provider.complete(_request())
    assert second.text == "One row."
    assert second.wants_tools is False
    assert second.stop_reason == "end_turn"
    assert provider.remaining_turns == 0


async def test_a_scripted_failure_is_raised_where_a_real_one_would_be() -> None:
    provider = EchoProvider([ScriptedTurn(error=LLMTransportError("upstream reset"))])

    with pytest.raises(LLMTransportError, match="upstream reset"):
        await provider.complete(_request())


async def test_an_exhausted_script_refuses_to_improvise() -> None:
    """
    An unplanned extra round trip is the bug under test, not something to
    paper over with an echo.
    """
    provider = EchoProvider([ScriptedTurn(text="done")])
    await provider.complete(_request())

    with pytest.raises(EchoScriptExhaustedError):
        await provider.complete(_request())


async def test_recorded_requests_are_snapshots_not_references() -> None:
    """
    A loop mutates one message list across turns, so the recording has to be a
    copy or every turn ends up looking like the last one.
    """
    provider = EchoProvider()
    messages = [Message(role=MessageRole.USER, content="first")]

    await provider.complete(CompletionRequest(messages=messages, system="be brief"))
    messages.append(Message(role=MessageRole.USER, content="second"))
    messages[0].content = "rewritten"

    recorded = provider.requests[0]
    assert recorded.system == "be brief"
    assert [message.content for message in recorded.messages] == ["first"]
    assert recorded.model == "echo-default"


async def test_a_recorded_request_reports_tools_and_answered_calls() -> None:
    """What a runtime test asserts on: the catalogue offered and results fed back."""
    provider = EchoProvider([ScriptedTurn(text="One row.")])
    request = CompletionRequest(
        messages=[
            Message(role=MessageRole.USER, content="how many rows?"),
            Message(
                role=MessageRole.ASSISTANT,
                tool_calls=[ToolCall(id="c1", name="run_sql", arguments={})],
            ),
            Message(
                role=MessageRole.USER,
                tool_results=[ToolResult(call_id="c1", content="1")],
            ),
        ],
        tools=(ToolDefinition(name="run_sql", description="Run SQL", input_schema={}),),
    )

    await provider.complete(request)

    recorded = provider.requests[-1]
    assert recorded.tool_names == ("run_sql",)
    assert recorded.tool_result_ids == ("c1",)


async def test_a_streamed_turn_arrives_in_pieces_and_reassembles() -> None:
    answer = "The dataset has four columns and nine hundred rows."
    provider = EchoProvider(
        [ScriptedTurn(text=answer, thinking="Counting rows first.")],
        stream_chunk_size=12,
    )

    events = [event async for event in provider.stream(_request())]
    kinds = [event.kind for event in events]

    assert kinds.count(StreamEventKind.TEXT) > 1
    assert "".join(e.text for e in events if e.kind == StreamEventKind.TEXT) == answer
    assert (
        "".join(e.text for e in events if e.kind == StreamEventKind.THINKING)
        == "Counting rows first."
    )
    # Reasoning precedes the answer; usage and a stop close the stream.
    assert kinds.index(StreamEventKind.THINKING) < kinds.index(StreamEventKind.TEXT)
    assert kinds[-2:] == [StreamEventKind.USAGE, StreamEventKind.STOP]


async def test_a_streamed_tool_call_is_its_own_event() -> None:
    call = ToolCall(id="c1", name="run_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider([ScriptedTurn(tool_calls=(call,))])

    events = [event async for event in provider.stream(_request())]

    assert [e.tool_call for e in events if e.kind == StreamEventKind.TOOL_USE] == [call]
    assert events[-1].kind == StreamEventKind.STOP


async def test_a_scripted_failure_reaches_a_streaming_caller() -> None:
    provider = EchoProvider([ScriptedTurn(error=LLMTransportError("upstream reset"))])

    with pytest.raises(LLMTransportError, match="upstream reset"):
        [event async for event in provider.stream(_request())]  # noqa: B018


async def test_streaming_and_completing_share_one_cursor() -> None:
    """A runtime that streams one turn and completes the next walks the script."""
    provider = EchoProvider([ScriptedTurn(text="first"), ScriptedTurn(text="second")])

    events = [event async for event in provider.stream(_request())]
    streamed = "".join(e.text for e in events if e.kind == StreamEventKind.TEXT)

    assert streamed == "first"
    assert (await provider.complete(_request())).text == "second"
    assert provider.remaining_turns == 0


async def test_reported_usage_grows_with_the_conversation() -> None:
    """Synthetic, but monotonic, so usage accounting is testable."""
    provider = EchoProvider([ScriptedTurn(text="short"), ScriptedTurn(text="short")])

    small = await provider.complete(_request("hi"))
    large = await provider.complete(
        CompletionRequest(
            messages=[
                Message(role=MessageRole.USER, content="hi"),
                Message(
                    role=MessageRole.USER,
                    tool_results=[ToolResult(call_id="c1", content="x" * 100)],
                ),
            ]
        )
    )

    assert small.usage["model"] == "echo-default"
    assert small.usage["output_tokens"] > 0
    assert large.usage["input_tokens"] > small.usage["input_tokens"]


def test_chunking_reassembles_exactly_and_keeps_words_whole() -> None:
    text = "a much longer sentence than the window allows"

    chunks = split_into_chunks(text, 10)

    assert len(chunks) > 1
    assert "".join(chunks) == text
    assert all(chunk.endswith(" ") for chunk in chunks[:-1])
