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
Tests for the default tool-use runtime.

Driven by the scripted echo provider, so every one of these exercises the real
loop with no network and no model.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from superset.ai.events import StreamEvent
from superset.ai.llm.base import (
    LLMTransportError,
    Message,
    ToolCall,
    ToolDefinition,
    ToolResult,
)
from superset.ai.llm.echo import EchoProvider, ScriptedTurn
from superset.ai.policy import Denial, PolicyChain, ToolPolicy
from superset.ai.runtime.base import RunRequest
from superset.ai.runtime.messages import MessagesApiRuntime
from superset.ai.types import MessageRole, StreamEventType


class StubTools:
    """A tool dispatcher that records calls and returns canned output."""

    def __init__(
        self,
        output: str = "tool output",
        raises: Exception | None = None,
    ) -> None:
        self.calls: list[ToolCall] = []
        self._output = output
        self._raises = raises

    def definitions(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="execute_sql",
                description="Run read-only SQL.",
                input_schema={
                    "type": "object",
                    "properties": {"sql": {"type": "string"}},
                },
            )
        ]

    def dispatch(self, call: ToolCall) -> ToolResult:
        self.calls.append(call)
        if self._raises is not None:
            raise self._raises
        return ToolResult(call_id=call.id, content=self._output)


def _run(runtime: MessagesApiRuntime, request: RunRequest) -> list[StreamEvent]:
    """Drive the async runtime to completion and collect its events."""

    async def collect() -> list[StreamEvent]:
        return [event async for event in runtime.run(request)]

    return asyncio.run(collect())


def _request(**kwargs: Any) -> RunRequest:
    defaults: dict[str, Any] = {
        "messages": [Message(role=MessageRole.USER, content="how many orders?")],
        "system_prompt": "You are a test assistant.",
    }
    defaults.update(kwargs)
    return RunRequest(**defaults)


def _types(events: list[StreamEvent]) -> list[StreamEventType]:
    return [event.type for event in events]


def _payloads(events: list[StreamEvent], kind: StreamEventType) -> list[dict[str, Any]]:
    return [event.payload for event in events if event.type is kind]


def test_plain_answer_without_tools() -> None:
    """A model that answers immediately produces exactly one final event."""
    provider = EchoProvider([ScriptedTurn(text="There were 42 orders.")])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())

    finals = _payloads(events, StreamEventType.FINAL)
    assert len(finals) == 1
    assert finals[0]["content"] == "There were 42 orders."
    assert runtime.result.ok
    assert runtime.result.turns == 1
    assert provider.remaining_turns == 0


def test_deltas_reassemble_into_the_final_answer() -> None:
    """Concatenated deltas equal the final content, so neither can drift."""
    answer = "x" * 1300
    runtime = MessagesApiRuntime(EchoProvider([ScriptedTurn(text=answer)]))

    events = _run(runtime, _request())

    deltas = "".join(
        p["delta"] for p in _payloads(events, StreamEventType.ASSISTANT_DELTA)
    )
    assert deltas == answer
    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == answer


def test_tool_loop_feeds_results_back_to_the_model() -> None:
    """
    The model asks, the tool runs, the result returns, the model answers.

    Also asserts the second request carried a result for the call the model
    actually made — the loop is not merely calling tools and discarding them.
    """
    call = ToolCall(id="call-1", name="execute_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider(
        [
            ScriptedTurn(tool_calls=(call,)),
            ScriptedTurn(text="One row."),
        ]
    )
    tools = StubTools(output="1")
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=tools))

    assert [c.id for c in tools.calls] == ["call-1"]
    assert provider.requests[1].tool_result_ids == ("call-1",)
    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == "One row."
    assert runtime.result.turns == 2
    assert runtime.result.tool_calls[0]["name"] == "execute_sql"
    assert runtime.result.tool_calls[0]["ok"] is True


def test_prose_before_a_tool_call_is_not_part_of_the_answer() -> None:
    """
    Reasoning is separated from the answer.

    A model narrating a hypothesis it may abandon must not have that narration
    appended to what the user reads.
    """
    call = ToolCall(id="c1", name="execute_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider(
        [
            ScriptedTurn(
                text="The orders table looks right, let me check.",
                tool_calls=(call,),
            ),
            ScriptedTurn(text="42 orders."),
        ]
    )
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=StubTools()))

    thoughts = [p["delta"] for p in _payloads(events, StreamEventType.THOUGHTS)]
    assert "The orders table looks right, let me check." in thoughts
    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == "42 orders."
    assert "let me check" not in runtime.result.answer


def test_thinking_is_surfaced_as_thoughts() -> None:
    """Provider-reported thinking reaches the reasoning pane, not the answer."""
    provider = EchoProvider(
        [ScriptedTurn(thinking="considering the grain", text="Done.")]
    )
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())

    assert "considering the grain" in [
        p["delta"] for p in _payloads(events, StreamEventType.THOUGHTS)
    ]
    assert runtime.result.answer == "Done."


def test_policy_denial_blocks_dispatch_and_tells_the_model_why() -> None:
    """
    A denied call never reaches the tool, and the reason goes back to the model.

    The reason is the steering signal: without it the model retries the same
    thing.
    """

    class DenyAll(ToolPolicy):
        name = "deny_all"

        def check(self, tool_name: str, arguments: dict[str, Any]) -> Denial | None:
            return Denial("Only read-only SQL is allowed.")

    call = ToolCall(id="c1", name="execute_sql", arguments={"sql": "DELETE FROM t"})
    provider = EchoProvider(
        [ScriptedTurn(tool_calls=(call,)), ScriptedTurn(text="Understood.")]
    )
    tools = StubTools()
    runtime = MessagesApiRuntime(provider)

    _run(
        runtime,
        _request(tools=tools, policies=PolicyChain([DenyAll()])),
    )

    assert tools.calls == []
    results = [
        result
        for message in provider.requests[1].messages
        for result in message.tool_results
    ]
    assert results[0].is_error is True
    assert "read-only" in results[0].content
    assert runtime.result.tool_calls[0]["ok"] is False


def test_a_failing_tool_does_not_end_the_run() -> None:
    """One broken tool becomes an error result; the model gets another turn."""
    call = ToolCall(id="c1", name="execute_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider(
        [
            ScriptedTurn(tool_calls=(call,)),
            ScriptedTurn(text="I could not read that table."),
        ]
    )
    tools = StubTools(raises=RuntimeError("connection refused"))
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=tools))

    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == (
        "I could not read that table."
    )
    assert runtime.result.tool_calls[0]["ok"] is False
    assert runtime.result.ok


def test_tool_exception_text_is_not_relayed_to_the_model() -> None:
    """
    Exception text is not a safe channel.

    It can carry connection strings, hostnames and query fragments, so the model
    is told the tool failed and nothing more.
    """
    call = ToolCall(id="c1", name="execute_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider([ScriptedTurn(tool_calls=(call,)), ScriptedTurn(text="ok")])
    # A connection string is the worst realistic case: it carries a credential
    # and an internal hostname in one string a driver might put in an exception.
    connection_string = "postgresql://user:s3cret@internal-host:5432/db"  # noqa: S105
    tools = StubTools(raises=RuntimeError(connection_string))
    runtime = MessagesApiRuntime(provider)

    _run(runtime, _request(tools=tools))

    relayed = "".join(
        result.content
        for message in provider.requests[1].messages
        for result in message.tool_results
    )
    assert connection_string not in relayed
    assert "s3cret" not in relayed
    assert "internal-host" not in relayed


def test_missing_dispatcher_is_reported_to_the_model() -> None:
    """A tool call with no dispatcher configured fails that call, not the run."""
    call = ToolCall(id="c1", name="execute_sql", arguments={})
    provider = EchoProvider(
        [ScriptedTurn(tool_calls=(call,)), ScriptedTurn(text="No tools then.")]
    )
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=None))

    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == "No tools then."
    assert runtime.result.tool_calls[0]["ok"] is False


def test_provider_error_ends_the_run_with_an_error_event() -> None:
    """A provider failure yields an error event and no answer."""
    provider = EchoProvider([ScriptedTurn(error=LLMTransportError("upstream 503"))])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())

    assert StreamEventType.ERROR in _types(events)
    assert StreamEventType.FINAL not in _types(events)
    assert runtime.result.ok is False
    assert runtime.result.error is not None


def test_provider_error_detail_is_not_sent_to_the_client() -> None:
    """The error frame carries a generic message, not the upstream detail."""
    provider = EchoProvider(
        [ScriptedTurn(error=LLMTransportError("https://internal.example/v1 refused"))]
    )
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())

    payload = _payloads(events, StreamEventType.ERROR)[0]
    assert "internal.example" not in payload["error"]


def test_unexpected_exception_is_contained() -> None:
    """A non-provider exception is still reported as an error event."""
    provider = EchoProvider([ScriptedTurn(error=ValueError("boom"))])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())

    assert StreamEventType.ERROR in _types(events)
    assert StreamEventType.FINAL not in _types(events)
    assert runtime.result.ok is False


def test_turn_budget_still_produces_an_answer() -> None:
    """
    Exhausting the step budget answers with what it has.

    Raising instead would leave the user with a spinner and no reply, since the
    response headers went out long ago.
    """
    call = ToolCall(id="c", name="execute_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider([ScriptedTurn(tool_calls=(call,)) for _ in range(5)])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=StubTools(), max_turns=2))

    assert runtime.result.turns == 2
    assert StreamEventType.FINAL in _types(events)
    stages = [p["stage"] for p in _payloads(events, StreamEventType.THINKING)]
    assert "fallback" in stages


def test_timeout_is_recorded_and_still_answers() -> None:
    """A run past its deadline reports the timeout and yields an answer."""
    provider = EchoProvider([ScriptedTurn(text="never reached")])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(timeout_seconds=-1.0))

    assert runtime.result.timed_out is True
    assert runtime.result.ok is False
    assert StreamEventType.FINAL in _types(events)


def test_cancellation_before_the_first_turn() -> None:
    """A cancelled run emits no answer."""
    provider = EchoProvider([ScriptedTurn(text="should not be produced")])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(should_cancel=lambda: True))

    assert runtime.result.cancelled is True
    assert runtime.result.ok is False
    assert StreamEventType.FINAL not in _types(events)
    assert provider.requests == []


def test_cancellation_between_tool_calls() -> None:
    """Cancellation is honoured part-way through a turn's tool calls."""
    calls = (
        ToolCall(id="c1", name="execute_sql", arguments={"sql": "SELECT 1"}),
        ToolCall(id="c2", name="execute_sql", arguments={"sql": "SELECT 2"}),
    )
    provider = EchoProvider([ScriptedTurn(tool_calls=calls), ScriptedTurn(text="late")])
    tools = StubTools()
    # Allow the run to start, then cancel once the first tool has been executed.
    state = {"ticks": 0}

    def should_cancel() -> bool:
        state["ticks"] += 1
        return len(tools.calls) >= 1

    runtime = MessagesApiRuntime(provider)
    events = _run(runtime, _request(tools=tools, should_cancel=should_cancel))

    assert len(tools.calls) == 1
    assert runtime.result.cancelled is True
    assert StreamEventType.FINAL not in _types(events)


def test_non_streaming_provider_is_supported() -> None:
    """A provider that cannot stream still drives the loop."""

    class NonStreaming(EchoProvider):
        supports_streaming = False

    runtime = MessagesApiRuntime(NonStreaming([ScriptedTurn(text="fine")]))
    events = _run(runtime, _request())

    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == "fine"


def test_empty_answer_falls_back_to_a_usable_message() -> None:
    """A model that returns nothing does not produce an empty bubble."""
    runtime = MessagesApiRuntime(EchoProvider([ScriptedTurn(text="")]))

    events = _run(runtime, _request())

    content = _payloads(events, StreamEventType.FINAL)[0]["content"]
    assert content.strip()
    assert runtime.result.answer == content


def test_tools_and_system_prompt_are_passed_to_the_provider() -> None:
    """What the runtime sends is what the caller configured."""
    provider = EchoProvider([ScriptedTurn(text="ok")])
    runtime = MessagesApiRuntime(provider)

    _run(runtime, _request(tools=StubTools(), system_prompt="SYSTEM RULES"))

    assert provider.requests[0].system == "SYSTEM RULES"
    assert provider.requests[0].tool_names == ("execute_sql",)


def test_session_starts_with_a_progress_event() -> None:
    """The client gets a progress signal before any model latency."""
    runtime = MessagesApiRuntime(EchoProvider([ScriptedTurn(text="ok")]))

    events = _run(runtime, _request())

    assert events[0].type is StreamEventType.THINKING
    assert events[0].payload["stage"] == "start"


@pytest.mark.parametrize("frame", list(StreamEventType))
def test_every_event_type_encodes_as_a_valid_sse_frame(frame: StreamEventType) -> None:
    """Frames are well-formed regardless of type."""
    encoded = StreamEvent(frame, {"k": "v"}).encode()
    assert encoded.startswith(f"event: {frame.value}\n")
    assert encoded.endswith("\n\n")
    assert "data: " in encoded


def test_answer_text_is_streamed_while_the_model_produces_it() -> None:
    """
    The answer reaches the client as it is generated, not in one lump at the end.

    The runtime used to buffer every text event from the provider, assemble the
    finished answer and only then replay it in chunks — so the panel sat on a
    spinner for the whole generation and then filled in at once.
    """
    provider = EchoProvider([ScriptedTurn(text="Revenue rose by twelve percent.")])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())
    kinds = _types(events)

    # Deltas arrive before the authoritative answer, which is the whole point.
    first_delta = kinds.index(StreamEventType.ASSISTANT_DELTA)
    assert first_delta < kinds.index(StreamEventType.FINAL)

    streamed = "".join(
        payload["delta"]
        for payload in _payloads(events, StreamEventType.ASSISTANT_DELTA)
    )
    assert streamed == "Revenue rose by twelve percent."
    assert (
        _payloads(events, StreamEventType.FINAL)[0]["content"]
        == "Revenue rose by twelve percent."
    )


def test_streamed_text_is_not_replayed_after_the_fact() -> None:
    """
    Text already sent is not sent again.

    The finished answer is still replayed for a provider that cannot stream, so
    the guard has to be on whether anything was streamed rather than removed.
    """
    provider = EchoProvider([ScriptedTurn(text="Twelve percent.")])
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request())
    streamed = "".join(
        payload["delta"]
        for payload in _payloads(events, StreamEventType.ASSISTANT_DELTA)
    )
    # Exactly once, not twice.
    assert streamed == "Twelve percent."


def test_a_non_streaming_provider_still_delivers_its_answer_in_chunks() -> None:
    """
    The replay path survives for providers with no streaming support.

    Without it such a provider would deliver nothing until the final frame.
    """

    class NonStreaming(EchoProvider):
        supports_streaming = False

    runtime = MessagesApiRuntime(NonStreaming([ScriptedTurn(text="fine")]))
    events = _run(runtime, _request())

    deltas = _payloads(events, StreamEventType.ASSISTANT_DELTA)
    assert "".join(payload["delta"] for payload in deltas) == "fine"


def test_reasoning_before_a_tool_call_is_not_streamed_as_answer() -> None:
    """
    Prose accompanying a tool call is reasoning and must not read as the answer.

    Streaming text as it arrives risks showing it before the runtime knows the
    turn was a tool call; the client replaces its copy on the final frame, which
    is what keeps the answer from contradicting itself.
    """
    tools = StubTools()
    provider = EchoProvider(
        [
            ScriptedTurn(
                text="The orders table looks right, let me check.",
                tool_calls=(ToolCall(id="c1", name="execute_sql", arguments={}),),
            ),
            ScriptedTurn(text="Nine hundred rows."),
        ]
    )
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=tools))

    # The authoritative answer excludes the reasoning, however it was streamed.
    final = _payloads(events, StreamEventType.FINAL)[0]["content"]
    assert final == "Nine hundred rows."
    assert "let me check" in (runtime.result.thoughts or "")
