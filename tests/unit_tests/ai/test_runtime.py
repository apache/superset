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


@pytest.mark.parametrize("streaming", [True, False])
def test_tool_turn_prose_stays_in_the_answer(
    streaming: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Only the provider's thinking channel belongs in the reasoning pane."""
    call = ToolCall(id="c1", name="execute_sql", arguments={"sql": "SELECT 1"})
    provider = EchoProvider(
        [
            ScriptedTurn(
                text="I'll check the row count.",
                thinking="Choose a count query.",
                tool_calls=(call,),
            ),
            ScriptedTurn(text="42 orders."),
        ]
    )
    monkeypatch.setattr(provider, "supports_streaming", streaming)
    runtime = MessagesApiRuntime(provider)
    events = _run(runtime, _request(tools=StubTools()))

    expected = "I'll check the row count.\n\n42 orders."
    assert runtime.result.answer == expected
    assert _payloads(events, StreamEventType.FINAL)[0]["content"] == expected
    assert (
        "".join(p["delta"] for p in _payloads(events, StreamEventType.ASSISTANT_DELTA))
        == expected
    )
    assert runtime.result.thoughts == "Choose a count query."
    assert [p["delta"] for p in _payloads(events, StreamEventType.THOUGHTS)] == [
        "Choose a count query."
    ]


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


def test_provider_reasoning_before_a_tool_call_is_not_streamed_as_answer() -> None:
    """Provider thinking never enters either the streamed or final answer."""
    tools = StubTools()
    provider = EchoProvider(
        [
            ScriptedTurn(
                thinking="The orders table looks right, let me check.",
                tool_calls=(ToolCall(id="c1", name="execute_sql", arguments={}),),
            ),
            ScriptedTurn(text="Nine hundred rows."),
        ]
    )
    runtime = MessagesApiRuntime(provider)

    events = _run(runtime, _request(tools=tools))

    final = _payloads(events, StreamEventType.FINAL)[0]["content"]
    assert final == "Nine hundred rows."
    assert "let me check" in (runtime.result.thoughts or "")
    assert (
        "".join(p["delta"] for p in _payloads(events, StreamEventType.ASSISTANT_DELTA))
        == final
    )


@pytest.mark.parametrize(
    "cancellation", ["implicit", "live_cursor", "explicit", "during_execute"]
)
def test_deadline_cancels_an_active_query_and_skips_remaining_tools(
    cancellation: str,
    mocker: Any,
) -> None:
    import threading
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from flask import g

    from superset.models.core import Database
    from superset.sql.execution.cancellation import cancellable_cursor, cursor_scope

    cancelled = threading.Event()
    spec = SimpleNamespace(
        has_implicit_cancel=lambda: cancellation == "implicit",
        supports_cancel_on_live_cursor=cancellation == "live_cursor",
        has_query_id_before_execute=cancellation == "explicit",
        has_query_id_during_execute=cancellation == "during_execute",
    )
    original = MagicMock(spec=Database, id=17, db_engine_spec=spec)
    reloaded = MagicMock(spec=Database, id=17, db_engine_spec=spec)
    user = SimpleNamespace(id=7)
    original_thread = threading.get_ident()
    capture = mocker.patch(
        "superset.ai.runtime.sql_deadline.capture_cancel_query_id",
        side_effect=[None, "cancel-id"]
        if cancellation == "during_execute"
        else ["cancel-id"],
    )
    mocker.patch("superset.utils.core.get_user_id", return_value=7)
    mocker.patch(
        "superset.db.session.get",
        side_effect=lambda model, _id: reloaded if model is Database else user,
    )

    def cancel(database: Any, handle: str, **kwargs: Any) -> bool:
        assert database is reloaded
        assert g.user is user
        assert threading.get_ident() != original_thread
        assert handle == "cancel-id"
        assert kwargs == {"catalog": "catalog", "schema": "schema"}
        cancelled.set()
        return True

    cancel_query = mocker.patch(
        "superset.ai.runtime.sql_deadline.cancel_chart_query", side_effect=cancel
    )
    cursor = MagicMock()
    cursor.cancel.side_effect = cancelled.set

    class BlockingTools(StubTools):
        def dispatch(self, call: ToolCall) -> ToolResult:
            self.calls.append(call)
            with cancellable_cursor(original, cursor, "catalog", "schema"):
                assert cancelled.wait(2), "the query was never cancelled"
            return ToolResult(call_id=call.id, content="late result")

    tools = BlockingTools()
    calls = (
        ToolCall(id="c1", name="execute_sql", arguments={}),
        ToolCall(id="c2", name="execute_sql", arguments={}),
    )
    provider = EchoProvider([ScriptedTurn(tool_calls=calls), ScriptedTurn(text="late")])
    runtime = MessagesApiRuntime(provider)
    _run(runtime, _request(tools=tools, timeout_seconds=0.1))
    assert cancelled.is_set()
    assert runtime.result.timed_out
    assert [call.id for call in tools.calls] == ["c1"]
    assert len(provider.requests) == 1
    assert cursor_scope.get() is None
    if cancellation in {"implicit", "live_cursor"}:
        cursor.cancel.assert_called_once_with()
        capture.assert_not_called()
        cancel_query.assert_not_called()
    else:
        cancel_query.assert_called_once()


def test_sql_timeout_can_shorten_but_never_extend_the_run_deadline() -> None:
    from unittest.mock import patch

    from superset.ai.runtime.sql_deadline import warehouse_deadline
    from superset.exceptions import SupersetTimeoutException
    from superset.sql.execution.cancellation import check_query_deadline, timeout_scope

    with patch("superset.ai.runtime.sql_deadline.time.monotonic", return_value=100):
        with warehouse_deadline(110):
            owner_timeout = timeout_scope.get()
            assert owner_timeout is not None
            for seconds, elapsed in [(2, 103), (60, 111)]:
                with (
                    pytest.raises(SupersetTimeoutException),
                    owner_timeout(seconds),
                    patch(
                        "superset.ai.runtime.sql_deadline.time.monotonic",
                        return_value=elapsed,
                    ),
                ):
                    check_query_deadline()
            check_query_deadline()
    assert timeout_scope.get() is None


@pytest.mark.parametrize("mode", ["complete", "first_event", "after_text"])
def test_run_deadline_stops_a_stalled_provider(mode: str, mocker: Any) -> None:
    from superset.ai.llm.base import ProviderStreamEvent, StreamEventKind

    provider = EchoProvider()
    mocker.patch.object(provider, "supports_streaming", mode != "complete")
    close = mocker.patch.object(provider, "aclose", new_callable=mocker.AsyncMock)
    closed: list[str] = []

    async def complete(_request: Any) -> Any:
        try:
            await asyncio.Event().wait()
        finally:
            closed.append("complete")

    async def stream(_request: Any) -> Any:
        try:
            if mode == "after_text":
                yield ProviderStreamEvent(StreamEventKind.TEXT, text="Partial answer")
            await asyncio.Event().wait()
        finally:
            closed.append("stream")

    mocker.patch.object(provider, "complete", side_effect=complete)
    mocker.patch.object(provider, "stream", side_effect=stream)
    runtime = MessagesApiRuntime(provider)
    tools = StubTools()

    async def collect() -> list[StreamEvent]:
        return [
            event
            async for event in runtime.run(_request(tools=tools, timeout_seconds=0.02))
        ]

    async def drive() -> list[StreamEvent]:
        return await asyncio.wait_for(collect(), timeout=0.5)

    events = asyncio.run(drive())
    assert runtime.result.timed_out
    assert runtime.result.error is None
    assert StreamEventType.ERROR not in _types(events)
    assert tools.calls == []
    assert closed == ["complete" if mode == "complete" else "stream"]
    close.assert_awaited_once_with()
    if mode == "after_text":
        assert runtime.result.answer == "Partial answer"
        assert (
            _payloads(events, StreamEventType.FINAL)[0]["content"] == "Partial answer"
        )


def test_stream_deadline_survives_separate_synchronous_pulls(mocker: Any) -> None:
    from superset.ai.llm.base import ProviderStreamEvent, StreamEventKind
    from superset.ai.orchestrator import _drain

    provider = EchoProvider()

    async def stream(_request: Any) -> Any:
        yield ProviderStreamEvent(StreamEventKind.TEXT, text="Partial answer")
        await asyncio.sleep(0.1)
        yield ProviderStreamEvent(StreamEventKind.TEXT, text=" too late")

    mocker.patch.object(provider, "stream", side_effect=stream)
    runtime = MessagesApiRuntime(provider)
    list(_drain(runtime.run(_request(timeout_seconds=0.02))))
    assert runtime.result.timed_out
    assert runtime.result.answer == "Partial answer"


def test_provider_timeout_is_not_relabelled_as_the_run_deadline(mocker: Any) -> None:
    provider = EchoProvider()
    mocker.patch.object(provider, "supports_streaming", False)
    mocker.patch.object(provider, "complete", side_effect=TimeoutError("provider"))
    runtime = MessagesApiRuntime(provider)
    events = _run(runtime, _request(timeout_seconds=30))
    assert not runtime.result.timed_out
    assert runtime.result.error is not None
    assert StreamEventType.ERROR in _types(events)


@pytest.mark.parametrize("streaming", [False, True])
def test_run_deadline_includes_provider_retry_backoff(
    streaming: bool, mocker: Any
) -> None:
    provider = EchoProvider(
        [
            ScriptedTurn(error=LLMTransportError("retry")),
            ScriptedTurn(text="too late"),
        ]
    )
    mocker.patch.object(provider, "supports_streaming", streaming)
    runtime = MessagesApiRuntime(provider)
    _run(runtime, _request(timeout_seconds=0.02))
    assert runtime.result.timed_out
    assert runtime.result.error is None
    assert len(provider.requests) == 1
