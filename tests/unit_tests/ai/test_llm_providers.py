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
"""
Tests for the two optional-extra providers.

No SDK, no credential, no socket. What is tested is the part that can be got
wrong without any of those: the translation between Superset's provider contract
and each vendor's wire shape, in both directions, driven by synthetic objects
matching the documented event shapes.

That covers the interesting failure. A request whose tool results are ordered
wrongly, or a stream whose tool-call fragments are read as whole calls, fails
against a real endpoint in a way no amount of connection testing would have
caught first.
"""

from __future__ import annotations

import builtins
from types import SimpleNamespace
from typing import Any

import pytest

from superset.ai.llm import (
    anthropic as anthropic_provider,
    openai_compatible as openai_provider,
)
from superset.ai.llm.anthropic import AnthropicProvider
from superset.ai.llm.base import (
    BaseLLMProvider,
    CompletionRequest,
    LLMConfigurationError,
    LLMRequestError,
    LLMTransportError,
    Message,
    ModelAlias,
    StreamEventKind,
    ToolCall,
    ToolDefinition,
    ToolResult,
)
from superset.ai.llm.openai_compatible import OpenAICompatibleProvider
from superset.ai.types import MessageRole
from superset.utils import json

MODELS = {"default": "small", "fast": "small", "reasoning": "large"}


def _anthropic() -> AnthropicProvider:
    return AnthropicProvider(models=MODELS)


def _openai() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(models=MODELS)


def _request(text: str = "how many rows?") -> CompletionRequest:
    return CompletionRequest(messages=[Message(role=MessageRole.USER, content=text)])


def _hide(monkeypatch: pytest.MonkeyPatch, package: str) -> None:
    """
    Make ``import <package>`` fail the way an uninstalled package does.

    Simulated rather than assumed: the extras happen to be absent in this
    environment, but a developer machine that has them installed must still run
    this test.
    """
    real_import = builtins.__import__

    def fake_import(name: str, *args: Any, **kwargs: Any) -> Any:
        if name == package:
            raise ModuleNotFoundError(f"No module named {package!r}", name=package)
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)


# --- optional-extra safety ---------------------------------------------------


def test_both_providers_import_and_construct_without_their_extras() -> None:
    """
    The guarantee every deployment depends on.

    Neither module may import its vendor SDK at module scope, or a deployment
    that installed neither extra would fail to start every Superset process —
    web, worker and CLI. Reaching this assertion at all is most of the test,
    since the imports at the top of this file would have raised otherwise.
    """
    for provider in (_anthropic(), _openai()):
        assert isinstance(provider, BaseLLMProvider)
        assert provider.resolve_model(ModelAlias.DEFAULT) == "small"
        assert provider.supports_streaming is True


@pytest.mark.parametrize(
    "factory,package",
    [(_anthropic, "anthropic"), (_openai, "openai")],
)
async def test_a_missing_extra_is_an_actionable_configuration_error(
    monkeypatch: pytest.MonkeyPatch,
    factory: Any,
    package: str,
) -> None:
    """
    The error names the package and how to install it.

    A bare ``ModuleNotFoundError`` out of the middle of a run tells an operator
    nothing about which knob to turn.
    """
    provider = factory()
    _hide(monkeypatch, package)

    with pytest.raises(LLMConfigurationError, match=f"pip install {package}"):
        await provider.complete(_request())


# --- model selection ---------------------------------------------------------


@pytest.mark.parametrize("factory", [_anthropic, _openai])
def test_the_picker_is_whatever_configuration_names(factory: Any) -> None:
    provider = factory()

    # Deduplicated: two tiers pointing at one model offer one choice.
    assert provider.available_models() == ["small", "large"]


@pytest.mark.parametrize(
    "provider_class",
    [AnthropicProvider, OpenAICompatibleProvider],
)
def test_an_unconfigured_tier_is_a_configuration_error(provider_class: Any) -> None:
    """
    No vendor default is baked in, so an unconfigured tier says so.

    Inventing an identifier here would silently change what a deployment pays
    for, the first time a profile asked for a tier nobody had configured.
    """
    provider = provider_class(models={"default": "small"})

    with pytest.raises(LLMConfigurationError, match="fast"):
        provider.resolve_model(ModelAlias.FAST)
    assert provider.available_models() == ["small"]


@pytest.mark.parametrize("factory", [_anthropic, _openai])
async def test_an_unknown_model_is_refused_before_dialling(factory: Any) -> None:
    """
    Selection is validated before the client is built.

    That the failure is a request error rather than the configuration error a
    missing SDK would raise is the proof: nothing tried to reach the network.
    """
    provider = factory()
    request = CompletionRequest(
        messages=[Message(role=MessageRole.USER, content="hi")],
        model="not-configured",
    )

    with pytest.raises(LLMRequestError, match="not-configured"):
        await provider.complete(request)


# --- outbound translation: the request ---------------------------------------


def _tool_conversation() -> CompletionRequest:
    """A full tool round trip: question, call, result, ready for the answer."""
    return CompletionRequest(
        messages=[
            Message(role=MessageRole.SYSTEM, content="house rules"),
            Message(role=MessageRole.USER, content="how many rows?"),
            Message(
                role=MessageRole.ASSISTANT,
                content="Let me count.",
                tool_calls=[
                    ToolCall(id="c1", name="run_sql", arguments={"sql": "SELECT 1"})
                ],
            ),
            Message(
                role=MessageRole.USER,
                content="and by region?",
                tool_results=[ToolResult(call_id="c1", content="900")],
            ),
        ],
        system="be brief",
        tools=(
            ToolDefinition(
                name="run_sql",
                description="Run SQL",
                input_schema={"type": "object"},
            ),
        ),
    )


def test_anthropic_lifts_system_prose_out_of_the_conversation() -> None:
    """
    The Messages API rejects a system entry inside ``messages``.

    So a system-role turn is folded onto the system parameter rather than
    dropped, which is the difference between an instruction being obeyed and
    silently vanishing.
    """
    payload = _anthropic()._payload(_tool_conversation())

    assert payload["system"] == "be brief\n\nhouse rules"
    assert [message["role"] for message in payload["messages"]] == [
        "user",
        "assistant",
        "user",
    ]
    assert payload["tools"] == [
        {
            "name": "run_sql",
            "description": "Run SQL",
            "input_schema": {"type": "object"},
        }
    ]


def test_anthropic_puts_a_tool_result_first_in_its_turn() -> None:
    """
    The API requires the block answering a ``tool_use`` to open the next turn.

    Prose ordered ahead of it is rejected outright, so the ordering is load
    bearing rather than cosmetic.
    """
    payload = _anthropic()._payload(_tool_conversation())

    assistant, answering = payload["messages"][1], payload["messages"][2]
    assert [block["type"] for block in assistant["content"]] == ["text", "tool_use"]
    assert assistant["content"][1]["input"] == {"sql": "SELECT 1"}
    assert [block["type"] for block in answering["content"]] == ["tool_result", "text"]
    assert answering["content"][0]["tool_use_id"] == "c1"


def test_anthropic_sends_temperature_only_without_extended_thinking() -> None:
    """The API rejects a request that asks for both, since thinking pins sampling."""
    provider = _anthropic()
    messages = [Message(role=MessageRole.USER, content="hi")]

    plain = provider._payload(
        CompletionRequest(messages=messages, temperature=0.2),
    )
    thinking = provider._payload(
        CompletionRequest(
            messages=messages,
            temperature=0.2,
            thinking_budget_tokens=1024,
        ),
    )

    assert plain["temperature"] == 0.2
    assert "thinking" not in plain
    assert thinking["thinking"] == {"type": "enabled", "budget_tokens": 1024}
    assert "temperature" not in thinking


def test_openai_expands_one_turn_into_a_message_per_tool_result() -> None:
    """
    Tool output is its own message here, and must follow the assistant turn that
    asked for it with nothing in between — so it is emitted ahead of any user
    prose carried on the same turn.
    """
    payload = _openai()._payload(_tool_conversation())

    assert [message["role"] for message in payload["messages"]] == [
        "system",
        "system",
        "user",
        "assistant",
        "tool",
        "user",
    ]
    assistant = payload["messages"][3]
    assert assistant["tool_calls"][0]["id"] == "c1"
    assert assistant["tool_calls"][0]["function"]["name"] == "run_sql"
    # Arguments cross the wire as a JSON string, not an object.
    assert json.loads(assistant["tool_calls"][0]["function"]["arguments"]) == {
        "sql": "SELECT 1"
    }
    assert payload["messages"][4] == {
        "role": "tool",
        "tool_call_id": "c1",
        "content": "900",
    }


def test_openai_marks_a_failed_tool_result_in_its_content() -> None:
    """A tool message has no field for failure, so it has to say so in the text."""
    payload = _openai()._payload(
        CompletionRequest(
            messages=[
                Message(
                    role=MessageRole.USER,
                    tool_results=[
                        ToolResult(call_id="c1", content="no such table", is_error=True)
                    ],
                )
            ]
        )
    )

    assert payload["messages"][0]["content"] == "Error: no such table"


# --- inbound translation: the non-streaming reply ----------------------------


def test_anthropic_reads_text_reasoning_and_calls_off_a_reply() -> None:
    blocks = [
        SimpleNamespace(type="thinking", thinking="Counting first."),
        SimpleNamespace(type="text", text="Nine hundred rows."),
        SimpleNamespace(
            type="tool_use", id="c1", name="run_sql", input={"sql": "SELECT 1"}
        ),
        SimpleNamespace(type="something_new"),
    ]

    text, thinking, calls = anthropic_provider._parse_content(blocks)

    assert text == "Nine hundred rows."
    assert thinking == "Counting first."
    assert calls == [ToolCall(id="c1", name="run_sql", arguments={"sql": "SELECT 1"})]


def test_openai_decodes_call_arguments_from_their_json_string() -> None:
    raw = [
        SimpleNamespace(
            id="c1",
            function=SimpleNamespace(name="run_sql", arguments='{"sql": "SELECT 1"}'),
        )
    ]

    assert openai_provider._parse_tool_calls(raw) == [
        ToolCall(id="c1", name="run_sql", arguments={"sql": "SELECT 1"})
    ]


@pytest.mark.parametrize("arguments", ['{"sql": ', "[1, 2]"])
def test_openai_refuses_call_arguments_that_are_not_an_object(arguments: str) -> None:
    """
    Undispatchable, and not worth retrying: another attempt would produce a
    differently broken call rather than a working one.
    """
    raw = [
        SimpleNamespace(
            id="c1", function=SimpleNamespace(name="run_sql", arguments=arguments)
        )
    ]

    with pytest.raises(LLMRequestError, match="run_sql"):
        openai_provider._parse_tool_calls(raw)


# --- inbound translation: the stream ----------------------------------------


def _kinds(events: list[Any]) -> list[StreamEventKind]:
    return [event.kind for event in events]


def _text_of(events: list[Any]) -> str:
    return "".join(e.text for e in events if e.kind == StreamEventKind.TEXT)


def test_anthropic_streams_text_in_order_then_usage_and_a_stop() -> None:
    raw = [
        SimpleNamespace(
            type="message_start",
            message=SimpleNamespace(usage=SimpleNamespace(input_tokens=11)),
        ),
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="text", text=""),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="text_delta", text="Nine "),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="text_delta", text="hundred rows."),
        ),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(
            type="message_delta",
            delta=SimpleNamespace(stop_reason="end_turn"),
            usage=SimpleNamespace(output_tokens=7),
        ),
        SimpleNamespace(type="message_stop"),
    ]

    events = list(anthropic_provider.translate_stream(raw, "small"))

    assert _text_of(events) == "Nine hundred rows."
    assert _kinds(events) == [
        StreamEventKind.TEXT,
        StreamEventKind.TEXT,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]
    usage = events[-2].usage
    assert usage == {
        "model": "small",
        "input_tokens": 11,
        "output_tokens": 7,
        "requests": 1,
    }


def test_anthropic_streams_reasoning_ahead_of_the_answer() -> None:
    raw = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="thinking"),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="thinking_delta", thinking="Counting."),
        ),
        # Carries a cryptographic signature, nothing the contract can express.
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="signature_delta", signature="abc"),
        ),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(
            type="content_block_delta",
            index=1,
            delta=SimpleNamespace(type="text_delta", text="Nine hundred."),
        ),
        SimpleNamespace(type="message_stop"),
    ]

    events = list(anthropic_provider.translate_stream(raw))

    assert _kinds(events) == [
        StreamEventKind.THINKING,
        StreamEventKind.TEXT,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]
    assert events[0].text == "Counting."


def test_anthropic_assembles_a_tool_call_from_json_fragments() -> None:
    """
    Arguments are only valid JSON once concatenated, so nothing can be emitted
    for a call until its block closes.
    """
    raw = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(
                type="tool_use", id="c1", name="run_sql", input={}
            ),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="input_json_delta", partial_json='{"sql":'),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="input_json_delta", partial_json=' "SELECT 1"}'),
        ),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(type="message_stop"),
    ]

    events = list(anthropic_provider.translate_stream(raw))

    assert _kinds(events) == [
        StreamEventKind.TOOL_USE,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]
    assert events[0].tool_call == ToolCall(
        id="c1", name="run_sql", arguments={"sql": "SELECT 1"}
    )


def test_anthropic_skips_an_event_kind_it_does_not_know() -> None:
    """
    A vocabulary the vendor can extend at any time.

    Failing over an unrecognised event would break the whole answer for the sake
    of something nobody asked about.
    """
    raw = [
        SimpleNamespace(type="ping"),
        SimpleNamespace(type="some_future_event", payload={"anything": True}),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="text_delta", text="Fine."),
        ),
        SimpleNamespace(type="message_stop"),
    ]

    events = list(anthropic_provider.translate_stream(raw))

    assert _text_of(events) == "Fine."
    assert _kinds(events)[-1] == StreamEventKind.STOP


def test_anthropic_closes_a_stream_that_never_said_it_was_finished() -> None:
    """
    A consumer waits for the terminal event, so a truncated stream still gets one
    rather than hanging on a promise the vendor broke.
    """
    raw = [
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="text_delta", text="Half an ans"),
        ),
    ]

    events = list(anthropic_provider.translate_stream(raw))

    assert _kinds(events) == [
        StreamEventKind.TEXT,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]


def test_anthropic_emits_the_terminal_event_exactly_once() -> None:
    """``message_stop`` closes the stream; the wrapper's own close is a no-op."""
    raw = [SimpleNamespace(type="message_stop")]

    events = list(anthropic_provider.translate_stream(raw))

    assert _kinds(events) == [StreamEventKind.USAGE, StreamEventKind.STOP]


def test_anthropic_refuses_a_streamed_call_whose_json_never_parsed() -> None:
    raw = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="tool_use", id="c1", name="run_sql"),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="input_json_delta", partial_json='{"sql":'),
        ),
        SimpleNamespace(type="content_block_stop", index=0),
    ]

    with pytest.raises(LLMRequestError, match="run_sql"):
        list(anthropic_provider.translate_stream(raw))


def _chunk(**delta: Any) -> SimpleNamespace:
    """One content-bearing completion chunk."""
    return SimpleNamespace(
        usage=None,
        choices=[
            SimpleNamespace(delta=SimpleNamespace(**delta), finish_reason=None),
        ],
    )


def test_openai_streams_content_in_order_then_usage_and_a_stop() -> None:
    chunks = [
        # The opening chunk announces the role and carries no content.
        _chunk(role="assistant", content=None),
        _chunk(content="Nine "),
        _chunk(content="hundred rows."),
        SimpleNamespace(
            usage=None,
            choices=[
                SimpleNamespace(delta=SimpleNamespace(), finish_reason="stop"),
            ],
        ),
        # With usage requested, a trailing chunk arrives with no choices at all.
        SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=11, completion_tokens=7),
            choices=[],
        ),
    ]

    events = list(openai_provider.translate_stream(chunks, "small"))

    assert _text_of(events) == "Nine hundred rows."
    assert _kinds(events) == [
        StreamEventKind.TEXT,
        StreamEventKind.TEXT,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]
    assert events[-2].usage == {
        "model": "small",
        "input_tokens": 11,
        "output_tokens": 7,
        "requests": 1,
    }


def test_openai_streams_a_reasoning_trace_where_a_server_offers_one() -> None:
    events = list(
        openai_provider.translate_stream([_chunk(reasoning_content="Counting.")])
    )

    assert _kinds(events) == [
        StreamEventKind.THINKING,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]
    assert events[0].text == "Counting."


def test_openai_assembles_a_tool_call_split_across_chunks() -> None:
    """
    The case that breaks a naive translator.

    The identifier and the name arrive only on the first fragment, the arguments
    in pieces after it, and nothing but ``index`` ties them together. Reading
    each fragment as a whole call yields nameless calls with truncated
    arguments.
    """
    chunks = [
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id="c1",
                    type="function",
                    function=SimpleNamespace(name="run_sql", arguments=""),
                )
            ]
        ),
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id=None,
                    function=SimpleNamespace(name=None, arguments='{"sql"'),
                )
            ]
        ),
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id=None,
                    function=SimpleNamespace(name=None, arguments=': "SELECT 1"}'),
                )
            ]
        ),
        SimpleNamespace(
            usage=None,
            choices=[
                SimpleNamespace(delta=SimpleNamespace(), finish_reason="tool_calls"),
            ],
        ),
    ]

    events = list(openai_provider.translate_stream(chunks))

    assert _kinds(events) == [
        StreamEventKind.TOOL_USE,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]
    assert events[0].tool_call == ToolCall(
        id="c1", name="run_sql", arguments={"sql": "SELECT 1"}
    )


def test_openai_keeps_parallel_tool_calls_apart_by_index() -> None:
    """Two calls interleaved in one stream, told apart only by their index."""
    chunks = [
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id="c1",
                    function=SimpleNamespace(name="run_sql", arguments='{"sql":'),
                ),
                SimpleNamespace(
                    index=1,
                    id="c2",
                    function=SimpleNamespace(name="get_schema", arguments="{}"),
                ),
            ]
        ),
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id=None,
                    function=SimpleNamespace(name=None, arguments=' "SELECT 1"}'),
                )
            ]
        ),
        SimpleNamespace(
            usage=None,
            choices=[
                SimpleNamespace(delta=SimpleNamespace(), finish_reason="tool_calls"),
            ],
        ),
    ]

    events = list(openai_provider.translate_stream(chunks))

    assert [e.tool_call for e in events if e.kind == StreamEventKind.TOOL_USE] == [
        ToolCall(id="c1", name="run_sql", arguments={"sql": "SELECT 1"}),
        ToolCall(id="c2", name="get_schema", arguments={}),
    ]


def test_openai_flushes_tool_calls_for_a_server_that_sends_no_finish_reason() -> None:
    """
    Not every compatible server sends one, and a swallowed tool call looks like
    the model deciding to do nothing.
    """
    chunks = [
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id="c1",
                    function=SimpleNamespace(name="run_sql", arguments="{}"),
                )
            ]
        ),
    ]

    events = list(openai_provider.translate_stream(chunks))

    assert _kinds(events) == [
        StreamEventKind.TOOL_USE,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]


def test_openai_emits_each_tool_call_once_even_after_a_finish_reason() -> None:
    """The finish reason flushes; closing the stream must not flush again."""
    chunks = [
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id="c1",
                    function=SimpleNamespace(name="run_sql", arguments="{}"),
                )
            ]
        ),
        SimpleNamespace(
            usage=None,
            choices=[
                SimpleNamespace(delta=SimpleNamespace(), finish_reason="tool_calls"),
            ],
        ),
    ]

    events = list(openai_provider.translate_stream(chunks))

    assert _kinds(events).count(StreamEventKind.TOOL_USE) == 1


def test_openai_skips_a_chunk_that_carries_nothing() -> None:
    """Keep-alives and role-only openers are not content."""
    chunks = [
        SimpleNamespace(usage=None, choices=[]),
        _chunk(role="assistant", content=""),
        _chunk(content="Fine."),
    ]

    events = list(openai_provider.translate_stream(chunks))

    assert _text_of(events) == "Fine."
    assert _kinds(events) == [
        StreamEventKind.TEXT,
        StreamEventKind.USAGE,
        StreamEventKind.STOP,
    ]


def test_openai_refuses_a_streamed_call_whose_json_never_parsed() -> None:
    chunks = [
        _chunk(
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id="c1",
                    function=SimpleNamespace(name="run_sql", arguments='{"sql":'),
                )
            ]
        ),
    ]

    with pytest.raises(LLMRequestError, match="run_sql"):
        list(openai_provider.translate_stream(chunks))


# --- the socket bridge, with a stand-in for the client -----------------------


class _AsyncStream:
    """Stands in for the SDK's async event stream over a recorded event list."""

    def __init__(self, events: list[Any]) -> None:
        self._events = events

    async def __aiter__(self) -> Any:
        for event in self._events:
            yield event


def _stub_client(returns: Any, calls: list[dict[str, Any]]) -> Any:
    """A client whose only job is to record the payload and hand back a reply."""

    async def create(**payload: Any) -> Any:
        calls.append(payload)
        return returns

    completions = SimpleNamespace(create=create)
    return SimpleNamespace(
        messages=SimpleNamespace(create=create),
        chat=SimpleNamespace(completions=completions),
    )


async def test_anthropic_stream_bridges_a_client_onto_provider_events() -> None:
    """
    The wiring between the socket and the translator.

    Injecting the client is what makes this reachable without an SDK: the
    provider only builds one when it does not already have one.
    """
    provider = _anthropic()
    calls: list[dict[str, Any]] = []
    provider._async_client = _stub_client(
        _AsyncStream(
            [
                SimpleNamespace(
                    type="content_block_delta",
                    index=0,
                    delta=SimpleNamespace(type="text_delta", text="Nine hundred."),
                ),
                SimpleNamespace(type="message_stop"),
            ]
        ),
        calls,
    )

    events = [event async for event in provider.stream(_request())]

    assert calls[0]["stream"] is True
    assert calls[0]["model"] == "small"
    assert _text_of(events) == "Nine hundred."
    assert _kinds(events)[-1] == StreamEventKind.STOP


async def test_openai_stream_bridges_a_client_onto_provider_events() -> None:
    provider = _openai()
    calls: list[dict[str, Any]] = []
    provider._async_client = _stub_client(
        _AsyncStream([_chunk(content="Nine hundred.")]), calls
    )

    events = [event async for event in provider.stream(_request())]

    assert calls[0]["stream"] is True
    # Token counts are only reported for a stream that asked for them.
    assert calls[0]["stream_options"] == {"include_usage": True}
    assert _text_of(events) == "Nine hundred."
    assert _kinds(events)[-1] == StreamEventKind.STOP


async def test_openai_can_be_told_not_to_ask_for_streamed_usage() -> None:
    """Some compatible servers reject the whole request over the unknown option."""
    provider = OpenAICompatibleProvider(models=MODELS, stream_usage=False)
    calls: list[dict[str, Any]] = []
    provider._async_client = _stub_client(_AsyncStream([]), calls)

    [event async for event in provider.stream(_request())]  # noqa: B018

    assert "stream_options" not in calls[0]


async def test_anthropic_complete_still_translates_a_whole_reply() -> None:
    """The non-streaming path, which a provider without streaming falls back to."""
    provider = _anthropic()
    calls: list[dict[str, Any]] = []
    provider._async_client = _stub_client(
        SimpleNamespace(
            content=[SimpleNamespace(type="text", text="Nine hundred rows.")],
            usage=SimpleNamespace(input_tokens=11, output_tokens=7),
            stop_reason="stop_sequence",
        ),
        calls,
    )

    response = await provider.complete(_request())

    assert "stream" not in calls[0]
    assert response.text == "Nine hundred rows."
    # A vendor reason with no counterpart normalises onto one that has.
    assert response.stop_reason == "end_turn"
    assert response.usage["input_tokens"] == 11


async def test_openai_complete_still_translates_a_whole_reply() -> None:
    provider = _openai()
    calls: list[dict[str, Any]] = []
    provider._async_client = _stub_client(
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content="Nine hundred rows.",
                        tool_calls=None,
                    ),
                    finish_reason="tool_calls",
                )
            ],
            usage=SimpleNamespace(prompt_tokens=11, completion_tokens=7),
        ),
        calls,
    )

    response = await provider.complete(_request())

    assert response.text == "Nine hundred rows."
    assert response.stop_reason == "tool_use"
    assert response.usage["output_tokens"] == 7


async def test_openai_reports_a_reply_that_carries_no_choices() -> None:
    """No answer and no reason for its absence, so it cannot be handed onward."""
    provider = _openai()
    provider._async_client = _stub_client(SimpleNamespace(choices=[]), [])

    with pytest.raises(LLMRequestError, match="no choices"):
        await provider.complete(_request())


# --- vendor exception mapping ------------------------------------------------


class _StubConnectionError(Exception):
    """Stands in for the SDK's connection failure, timeouts included."""


class _StubStatusError(Exception):
    def __init__(self, status: int) -> None:
        super().__init__(f"HTTP {status}")
        self.status_code = status


class _StubResponseError(Exception):
    """A vendor error that hangs its status off a response object instead."""

    def __init__(self, status: int) -> None:
        super().__init__(f"HTTP {status}")
        self.response = SimpleNamespace(status_code=status)


_SDK_STUB = SimpleNamespace(APIConnectionError=_StubConnectionError)


@pytest.mark.parametrize("module", [anthropic_provider, openai_provider])
@pytest.mark.parametrize("status", [408, 429, 500, 502, 503])
def test_a_transient_status_is_worth_retrying(module: Any, status: int) -> None:
    error = module._translate(_SDK_STUB, _StubStatusError(status))

    assert isinstance(error, LLMTransportError)


@pytest.mark.parametrize("module", [anthropic_provider, openai_provider])
@pytest.mark.parametrize("status", [400, 401, 403, 404, 409, 422])
def test_a_rejected_request_is_never_retried(module: Any, status: int) -> None:
    """
    Retrying a rejection turns one bad request into four.

    409 sits here deliberately: a conflict is still a conflict next time.
    """
    error = module._translate(_SDK_STUB, _StubStatusError(status))

    assert isinstance(error, LLMRequestError)


@pytest.mark.parametrize("module", [anthropic_provider, openai_provider])
def test_a_connection_failure_is_worth_retrying(module: Any) -> None:
    error = module._translate(_SDK_STUB, _StubConnectionError("reset by peer"))

    assert isinstance(error, LLMTransportError)


@pytest.mark.parametrize("module", [anthropic_provider, openai_provider])
def test_a_status_behind_a_response_object_is_still_found(module: Any) -> None:
    """The two SDKs do not agree on where the status lives."""
    assert isinstance(
        module._translate(_SDK_STUB, _StubResponseError(503)), LLMTransportError
    )
    assert isinstance(
        module._translate(_SDK_STUB, _StubResponseError(422)), LLMRequestError
    )


@pytest.mark.parametrize("module", [anthropic_provider, openai_provider])
def test_a_failure_with_no_status_at_all_is_not_retried(module: Any) -> None:
    """
    Neither a transport failure nor an HTTP response: a client-side error or a
    bug, and another attempt cannot change either.
    """
    error = module._translate(_SDK_STUB, TypeError("unexpected keyword"))

    assert isinstance(error, LLMRequestError)


def _tool_use_stream(fragments: list[str], supplied_input: object = None) -> list[Any]:
    """A stream carrying one tool_use block whose arguments arrive in fragments."""
    block = SimpleNamespace(type="tool_use", id="call-1", name="get_chart_context")
    if supplied_input is not None:
        block.input = supplied_input
    return [
        SimpleNamespace(type="content_block_start", index=0, content_block=block),
        *[
            SimpleNamespace(
                type="content_block_delta",
                index=0,
                delta=SimpleNamespace(type="input_json_delta", partial_json=fragment),
            )
            for fragment in fragments
        ],
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(type="message_stop"),
    ]


def _only_tool_call(events: list[Any]) -> Any:
    calls = [event.tool_call for event in events if event.tool_call is not None]
    assert len(calls) == 1, calls
    return calls[0]


def test_anthropic_stream_assembles_fragmented_tool_arguments() -> None:
    """The ordinary case: arguments split across several deltas."""
    events = list(
        anthropic_provider.translate_stream(
            _tool_use_stream(['{"chart', '_id": 42}']), "small"
        )
    )
    assert _only_tool_call(events).arguments == {"chart_id": 42}


def test_anthropic_stream_survives_a_repeated_fragment_stream() -> None:
    """
    A gateway that repeats the fragments must not cost the user their answer.

    The concatenation is two copies of the same object, which a strict parse
    rejects as "Extra data" — and that failed the whole run over a duplicate of
    the very arguments being requested.
    """
    events = list(
        anthropic_provider.translate_stream(
            _tool_use_stream(['{"chart_id": 42}', '{"chart_id": 42}']), "small"
        )
    )
    assert _only_tool_call(events).arguments == {"chart_id": 42}


def test_anthropic_stream_prefers_a_complete_input_object() -> None:
    """
    An endpoint that sends finished arguments is believed over the fragments.

    The finished object is the one that is certainly whole, so it wins even when
    the fragment stream is unusable.
    """
    events = list(
        anthropic_provider.translate_stream(
            _tool_use_stream(["not json at all"], supplied_input={"chart_id": 7}),
            "small",
        )
    )
    assert _only_tool_call(events).arguments == {"chart_id": 7}


def test_anthropic_stream_ignores_an_empty_opening_input() -> None:
    """
    The vendor opens a tool block with ``{}`` and streams the rest.

    Treating that as complete would send every tool call an empty argument set.
    """
    events = list(
        anthropic_provider.translate_stream(
            _tool_use_stream(['{"chart_id": 9}'], supplied_input={}), "small"
        )
    )
    assert _only_tool_call(events).arguments == {"chart_id": 9}


def test_anthropic_stream_rejects_arguments_that_are_not_an_object() -> None:
    """A call nobody can dispatch is still an error; retrying would not help."""
    from superset.ai.llm.base import LLMRequestError

    with pytest.raises(LLMRequestError):
        list(anthropic_provider.translate_stream(_tool_use_stream(["[1, 2]"]), "small"))


def test_anthropic_stream_keeps_parallel_tool_calls_apart() -> None:
    """
    Two blocks in one turn each keep their own buffer.

    Sharing one would concatenate their arguments, which is the shape of the
    failure this guards.
    """
    raw = [
        SimpleNamespace(
            type="content_block_start",
            index=0,
            content_block=SimpleNamespace(type="tool_use", id="a", name="first"),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=0,
            delta=SimpleNamespace(type="input_json_delta", partial_json='{"x": 1}'),
        ),
        SimpleNamespace(
            type="content_block_start",
            index=1,
            content_block=SimpleNamespace(type="tool_use", id="b", name="second"),
        ),
        SimpleNamespace(
            type="content_block_delta",
            index=1,
            delta=SimpleNamespace(type="input_json_delta", partial_json='{"y": 2}'),
        ),
        SimpleNamespace(type="content_block_stop", index=0),
        SimpleNamespace(type="content_block_stop", index=1),
        SimpleNamespace(type="message_stop"),
    ]

    calls = [
        event.tool_call
        for event in anthropic_provider.translate_stream(raw, "small")
        if event.tool_call is not None
    ]
    assert [(call.name, call.arguments) for call in calls] == [
        ("first", {"x": 1}),
        ("second", {"y": 2}),
    ]


@pytest.mark.asyncio
async def test_anthropic_aclose_releases_the_client() -> None:
    """
    The client is closed and forgotten.

    A turn runs on a loop of its own and the caller closes it immediately after,
    so a client left open is finalised against a dead loop — which surfaced as
    ``RuntimeError: Event loop is closed`` out of the transport.
    """
    provider = anthropic_provider.AnthropicProvider(models={"default": "small"})
    closed: list[bool] = []
    provider._async_client = SimpleNamespace(  # noqa: SLF001
        close=lambda: _record_close(closed)
    )

    await provider.aclose()

    assert closed == [True]
    # Forgotten as well as closed, so the next turn builds one on its own loop.
    assert provider._async_client is None  # noqa: SLF001


async def _record_close(sink: list[bool]) -> None:
    sink.append(True)


@pytest.mark.asyncio
async def test_anthropic_aclose_tolerates_never_having_connected() -> None:
    """Called after every run, including runs that failed before connecting."""
    provider = anthropic_provider.AnthropicProvider(models={"default": "small"})
    await provider.aclose()
    assert provider._async_client is None  # noqa: SLF001


def _openai_tool_stream(fragments: list[str]) -> list[Any]:
    """An OpenAI-shaped stream carrying one tool call in fragments."""
    from superset.ai.llm import openai_compatible

    def chunk(delta: Any, finish: str | None = None) -> Any:
        return SimpleNamespace(
            choices=[SimpleNamespace(delta=delta, finish_reason=finish)],
            usage=None,
        )

    opening = chunk(
        SimpleNamespace(
            content=None,
            tool_calls=[
                SimpleNamespace(
                    index=0,
                    id="call-1",
                    function=SimpleNamespace(
                        name="get_chart_context", arguments=fragments[0]
                    ),
                )
            ],
        )
    )
    rest = [
        chunk(
            SimpleNamespace(
                content=None,
                tool_calls=[
                    SimpleNamespace(
                        index=0,
                        id=None,
                        function=SimpleNamespace(name=None, arguments=fragment),
                    )
                ],
            )
        )
        for fragment in fragments[1:]
    ]
    del openai_compatible
    closing = chunk(SimpleNamespace(content=None, tool_calls=None), "tool_calls")
    return [opening, *rest, closing]


def _openai_calls(raw: list[Any]) -> list[Any]:
    from superset.ai.llm import openai_compatible

    return [
        event.tool_call
        for event in openai_compatible.translate_stream(raw, "small")
        if event.tool_call is not None
    ]


def test_openai_stream_assembles_fragmented_tool_arguments() -> None:
    """The ordinary case, on the provider a compatible gateway actually uses."""
    calls = _openai_calls(_openai_tool_stream(['{"chart', '_id": 42}']))
    assert [(c.name, c.arguments) for c in calls] == [
        ("get_chart_context", {"chart_id": 42})
    ]


def test_openai_stream_survives_a_repeated_fragment_stream() -> None:
    """
    The failure seen in practice, against a real gateway.

    The buffer holds the same object twice and a strict parse rejects it as
    "Extra data", which failed the whole run over a duplicate of the arguments
    that had already arrived intact.
    """
    calls = _openai_calls(_openai_tool_stream(['{"chart_id": 42}', '{"chart_id": 42}']))
    assert [(c.name, c.arguments) for c in calls] == [
        ("get_chart_context", {"chart_id": 42})
    ]


def test_openai_non_streaming_tolerates_repeated_arguments() -> None:
    """The same tolerance on the non-streaming path, which shares the shape."""
    from superset.ai.llm.openai_compatible import _parse_tool_calls

    calls = _parse_tool_calls(
        [
            SimpleNamespace(
                id="c1",
                function=SimpleNamespace(
                    name="get_chart_context",
                    arguments='{"chart_id": 42}{"chart_id": 42}',
                ),
            )
        ]
    )
    assert calls[0].arguments == {"chart_id": 42}


def test_openai_rejects_arguments_that_are_not_an_object() -> None:
    """A call nobody can dispatch is still an error."""
    from superset.ai.llm.base import LLMRequestError

    with pytest.raises(LLMRequestError):
        _openai_calls(_openai_tool_stream(["[1, 2]"]))


@pytest.mark.asyncio
async def test_openai_aclose_releases_the_client() -> None:
    """
    The provider in use holds the connection pool that outlived its loop.

    Closing it is what stops ``RuntimeError: Event loop is closed`` coming out of
    the transport once a turn's loop is torn down.
    """
    from superset.ai.llm.openai_compatible import OpenAICompatibleProvider

    provider = OpenAICompatibleProvider(models={"default": "small"})
    closed: list[bool] = []
    provider._async_client = SimpleNamespace(  # noqa: SLF001
        close=lambda: _record_close(closed)
    )

    await provider.aclose()

    assert closed == [True]
    assert provider._async_client is None  # noqa: SLF001
