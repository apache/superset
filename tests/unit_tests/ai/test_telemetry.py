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
Tests for pluggable assistant telemetry.

The spans are produced by driving the real tool-use loop over the scripted echo
provider, so what a sink receives here is what a sink receives in production.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import pytest
from pytest_mock import MockerFixture

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
from superset.ai.telemetry import (
    AITelemetry,
    bind_run,
    current_run,
    LoggingAITelemetry,
    ModelCallTrace,
    NO_TELEMETRY,
    NullAITelemetry,
    POLICY_DENIED,
    resolve_sinks,
    RunTrace,
    start_run,
    StatsLoggerAITelemetry,
    TOOL_UNAVAILABLE,
    ToolCallTrace,
)
from superset.ai.tools.base import AITool, ToolError, ToolOutput, ToolRegistry
from superset.ai.types import MessageRole, RunOutcome, StreamEventType
from superset.extensions import stats_logger_manager
from superset.utils import json

#: Strings that must never leave the process while redaction is on. Distinctive
#: enough that a substring sweep over serialised traces is conclusive.
QUESTION = "how many zorbulate widgets shipped last quarter"
SQL = "SELECT count(*) FROM zorbulate_shipments WHERE quarter = 'Q3'"
DATA_VALUE = "zorbulate-secret-row-value-914733"
ANSWER = f"There were {DATA_VALUE} widgets."


class CapturingTelemetry(AITelemetry):
    """Keeps everything it is handed, so a test can sweep all of it at once."""

    def __init__(self) -> None:
        self.runs_started: list[RunTrace] = []
        self.runs_ended: list[RunTrace] = []
        self.model_calls: list[tuple[RunTrace, ModelCallTrace]] = []
        self.tool_calls: list[tuple[RunTrace, ToolCallTrace]] = []
        self.errors: list[tuple[RunTrace, Any]] = []

    def on_run_start(self, run: RunTrace) -> None:
        self.runs_started.append(run)

    def on_run_end(self, run: RunTrace) -> None:
        self.runs_ended.append(run)

    def on_model_call(self, run: RunTrace, call: ModelCallTrace) -> None:
        self.model_calls.append((run, call))

    def on_tool_call(self, run: RunTrace, call: ToolCallTrace) -> None:
        self.tool_calls.append((run, call))

    def on_error(self, run: RunTrace, error: BaseException | str) -> None:
        self.errors.append((run, error))

    @property
    def traces(self) -> list[Any]:
        """Every trace object captured, in no particular order."""
        return [
            *self.runs_started,
            *self.runs_ended,
            *(call for _, call in self.model_calls),
            *(call for _, call in self.tool_calls),
        ]

    def serialised(self) -> str:
        """
        Everything captured, as one string.

        Includes the error payloads as well as the traces: an exception's text
        is another way for a prompt or a statement to escape.
        """
        return json.dumps(
            {
                "traces": [trace.as_dict() for trace in self.traces],
                "errors": [str(error) for _, error in self.errors],
            },
            default=json.pessimistic_json_iso_dttm_ser,
        )


class ExplodingTelemetry(AITelemetry):
    """Fails from every hook. A configured sink is allowed to be this broken."""

    def __init__(self) -> None:
        self.calls = 0

    def on_run_start(self, run: RunTrace) -> None:
        self._fail()

    def on_run_end(self, run: RunTrace) -> None:
        self._fail()

    def on_model_call(self, run: RunTrace, call: ModelCallTrace) -> None:
        self._fail()

    def on_tool_call(self, run: RunTrace, call: ToolCallTrace) -> None:
        self._fail()

    def on_error(self, run: RunTrace, error: BaseException | str) -> None:
        self._fail()

    def _fail(self) -> None:
        self.calls += 1
        raise RuntimeError("the monitoring system is down")


class RecordingStatsLogger:
    """Stands in for a configured ``STATS_LOGGER``."""

    def __init__(self) -> None:
        self.counters: list[str] = []
        self.timings: list[tuple[str, float]] = []
        self.gauges: list[tuple[str, float]] = []

    def incr(self, key: str) -> None:
        self.counters.append(key)

    def timing(self, key: str, value: float) -> None:
        self.timings.append((key, value))

    def gauge(self, key: str, value: float) -> None:
        self.gauges.append((key, value))

    @property
    def keys(self) -> list[str]:
        return [
            *self.counters,
            *(key for key, _ in self.timings),
            *(key for key, _ in self.gauges),
        ]


class StubTools:
    """A dispatcher that returns the data value the sweep looks for."""

    def __init__(self, output: str = DATA_VALUE) -> None:
        self.calls: list[ToolCall] = []
        self._output = output

    def definitions(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="execute_sql",
                description="Run read-only SQL.",
                input_schema={"type": "object"},
            )
        ]

    def dispatch(self, call: ToolCall) -> ToolResult:
        self.calls.append(call)
        return ToolResult(call_id=call.id, content=self._output)


class TimedInvocation:
    """What a rich dispatcher hands back, including its own timing."""

    def __init__(
        self,
        result: ToolResult,
        duration_ms: int,
        truncated: bool,
        error_type: str | None = None,
    ) -> None:
        self.result = result
        self.duration_ms = duration_ms
        self.truncated = truncated
        self.error_type = error_type
        self.display: dict[str, Any] = {}


class RichStubTools(StubTools):
    """A dispatcher that reports how long the call took, as the real one does."""

    def __init__(self, duration_ms: int = 1234, truncated: bool = True) -> None:
        super().__init__()
        self._duration_ms = duration_ms
        self._truncated = truncated

    def invoke(self, call: ToolCall) -> TimedInvocation:
        return TimedInvocation(
            self.dispatch(call),
            duration_ms=self._duration_ms,
            truncated=self._truncated,
        )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _configure(
    mocker: MockerFixture,
    sinks: list[Any],
    *,
    redact: bool = True,
    max_chars: int = 10_000,
) -> None:
    from flask import current_app

    mocker.patch.dict(
        current_app.config,
        {
            "AI_TELEMETRY": sinks,
            "AI_TELEMETRY_REDACT_CONTENT": redact,
            "AI_TELEMETRY_MAX_CONTENT_CHARS": max_chars,
        },
    )


def _script_with_a_tool_call() -> EchoProvider:
    """A model that queries once and then answers, which is the usual shape."""
    return EchoProvider(
        [
            ScriptedTurn(
                text="Checking the shipments table.",
                tool_calls=(
                    ToolCall(id="c1", name="execute_sql", arguments={"sql": SQL}),
                ),
            ),
            ScriptedTurn(text=ANSWER),
        ]
    )


def _drive(
    provider: EchoProvider,
    tools: Any = None,
    policies: PolicyChain | None = None,
) -> tuple[MessagesApiRuntime, list[StreamEvent]]:
    """Run one turn against the real loop, inside the bound telemetry run."""
    runtime = MessagesApiRuntime(provider)
    request = RunRequest(
        messages=[Message(role=MessageRole.USER, content=QUESTION)],
        system_prompt=f"You are a test assistant. The question is: {QUESTION}",
        tools=tools,
        policies=policies,
    )

    async def collect() -> list[StreamEvent]:
        return [event async for event in runtime.run(request)]

    recorder = start_run(run_id="run-1", thread_uuid="thread-1", user_id=7)
    with bind_run(recorder):
        recorder.run_started()
        recorder.describe(agent_key="analyst", model="echo-default", question=QUESTION)
        events = asyncio.run(collect())
        recorder.run_ended(
            outcome=(RunOutcome.SUCCESS if runtime.result.ok else RunOutcome.ERROR),
            turns=runtime.result.turns,
            answer=runtime.result.answer,
        )
    return runtime, events


def _with_stats_logger(mocker: MockerFixture) -> RecordingStatsLogger:
    """Swap in a stats logger that keeps every key it is given."""
    stats = RecordingStatsLogger()
    mocker.patch.object(stats_logger_manager, "_stats_logger", stats)
    return stats


def _final(events: list[StreamEvent]) -> str:
    return next(
        event.payload["content"]
        for event in events
        if event.type is StreamEventType.FINAL
    )


# --------------------------------------------------------------------------- #
# Redaction — the property that matters most
# --------------------------------------------------------------------------- #


def test_redaction_keeps_every_content_field_empty(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    With redaction on, a sink is handed structure and measurements only.

    Checked field by field rather than by sweeping strings, so that a new
    content field added to a trace without a redaction path fails here.
    """
    sink = CapturingTelemetry()
    _configure(mocker, [sink], redact=True)

    _drive(_script_with_a_tool_call(), tools=StubTools())

    assert sink.runs_ended, "a run must always report its end"
    for run in [*sink.runs_started, *sink.runs_ended]:
        assert run.question is None
        assert run.answer is None
    for _, model_call in sink.model_calls:
        assert model_call.system_prompt is None
        assert model_call.response_text is None
    for _, tool_call in sink.tool_calls:
        assert tool_call.arguments is None
        assert tool_call.output is None


def test_redaction_leaks_neither_question_nor_sql_nor_data(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    The question, the statement and a returned value appear nowhere at all.

    This is the test that decides whether the feature is safe to enable. It
    sweeps everything every sink was handed, serialised, rather than trusting
    that the fields checked above are the only ones carrying content.
    """
    sink = CapturingTelemetry()
    _configure(mocker, [sink], redact=True)

    runtime, events = _drive(_script_with_a_tool_call(), tools=StubTools())

    # The run really did carry all three, so their absence below is redaction
    # working rather than the run never having seen them.
    assert runtime.result.tool_calls[0]["arguments"] == {"sql": SQL}
    assert runtime.result.tool_calls[0]["output"] == DATA_VALUE
    assert DATA_VALUE in _final(events)

    captured = sink.serialised()
    for secret in (QUESTION, SQL, DATA_VALUE):
        assert secret not in captured, f"{secret!r} reached a telemetry sink"
    # Fragments too: a partial statement is still a statement.
    assert "zorbulate_shipments" not in captured
    assert "count(*)" not in captured


def test_redaction_hides_provider_error_text(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    An exception is reduced to its class name while redacting.

    Provider errors quote the request that failed often enough that the text has
    to be treated as content.
    """
    sink = CapturingTelemetry()
    _configure(mocker, [sink], redact=True)

    provider = EchoProvider([ScriptedTurn(error=LLMTransportError(f"rejected {SQL}"))])
    _drive(provider)

    assert sink.errors
    assert [str(error) for _, error in sink.errors] == ["LLMTransportError"]
    assert SQL not in sink.serialised()


def test_content_is_forwarded_when_redaction_is_off(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """Turning redaction off is what makes a trace useful for answer quality."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink], redact=False)

    _drive(_script_with_a_tool_call(), tools=StubTools())

    assert sink.runs_ended[0].question == QUESTION
    assert DATA_VALUE in (sink.runs_ended[0].answer or "")
    assert QUESTION in (sink.model_calls[0][1].system_prompt or "")
    arguments = sink.tool_calls[0][1].arguments or {}
    assert arguments["sql"] == SQL
    assert sink.tool_calls[0][1].output == DATA_VALUE


def test_content_is_capped_when_redaction_is_off(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """One oversized result cannot dominate a trace payload."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink], redact=False, max_chars=12)

    long_sql = "SELECT " + "x" * 500
    provider = EchoProvider(
        [
            ScriptedTurn(
                tool_calls=(
                    ToolCall(id="c1", name="execute_sql", arguments={"sql": long_sql}),
                ),
            ),
            ScriptedTurn(text="y" * 500),
        ]
    )
    _drive(provider, tools=StubTools(output="z" * 500))

    tool_call = sink.tool_calls[0][1]
    assert len(tool_call.output or "") == 12
    assert len((tool_call.arguments or {})["sql"]) == 12
    assert len(sink.runs_ended[0].answer or "") == 12


def test_non_string_arguments_are_bounded_too(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A nested argument becomes one capped string, not an unbounded structure."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink], redact=False, max_chars=20)

    provider = EchoProvider(
        [
            ScriptedTurn(
                tool_calls=(
                    ToolCall(
                        id="c1",
                        name="execute_sql",
                        arguments={"rows": list(range(500)), "limit": 10},
                    ),
                ),
            ),
            ScriptedTurn(text="done"),
        ]
    )
    _drive(provider, tools=StubTools())

    arguments = sink.tool_calls[0][1].arguments or {}
    assert arguments["limit"] == 10
    assert isinstance(arguments["rows"], str)
    assert len(arguments["rows"]) == 20


# --------------------------------------------------------------------------- #
# Robustness
# --------------------------------------------------------------------------- #


def test_a_sink_that_raises_everywhere_does_not_affect_the_run(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    A broken sink costs a log line and nothing else.

    Monitoring is not on the critical path: an answer must not be lost because a
    tracing backend was unreachable.
    """
    exploding = ExplodingTelemetry()
    working = CapturingTelemetry()
    _configure(mocker, [exploding, working], redact=False)

    runtime, events = _drive(_script_with_a_tool_call(), tools=StubTools())

    assert runtime.result.ok
    assert runtime.result.answer == ANSWER
    assert _final(events) == ANSWER
    assert exploding.calls > 0, "the broken sink was called"
    # The sink after the broken one still received the whole run.
    assert working.runs_started
    assert working.runs_ended
    assert working.model_calls
    assert working.tool_calls


def test_a_broken_sink_is_warned_about_once_per_hook(
    app_context: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """
    Repeated failures are reported once, then dropped to debug.

    A sink that fails on one span fails on all of them, and a long run must not
    turn one misconfiguration into a wall of identical warnings.
    """
    _configure(mocker, [ExplodingTelemetry()])

    with caplog.at_level(logging.WARNING, logger="superset.ai.telemetry"):
        _drive(
            EchoProvider(
                [
                    ScriptedTurn(
                        tool_calls=(
                            ToolCall(id="c1", name="execute_sql", arguments={}),
                        ),
                    ),
                    ScriptedTurn(
                        tool_calls=(
                            ToolCall(id="c2", name="execute_sql", arguments={}),
                        ),
                    ),
                    ScriptedTurn(text="fine"),
                ]
            ),
            tools=StubTools(),
        )

    on_model_call_warnings = [
        record
        for record in caplog.records
        if record.levelno == logging.WARNING and "on_model_call" in record.getMessage()
    ]
    assert len(on_model_call_warnings) == 1


def test_an_unimportable_sink_is_skipped_not_fatal(
    app_context: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """
    A mistyped path loses the trace, not the feature.

    Deliberately unlike ``AI_AGENT_TOOL_POLICIES``, where a bad path is fatal
    because a missing guard is a security change; a missing observer is not.
    """
    working = CapturingTelemetry()
    with caplog.at_level(logging.WARNING, logger="superset.ai.telemetry"):
        sinks = resolve_sinks(
            ["superset.ai.telemetry.NoSuchSink", "not.a.module.At.All", working]
        )

    assert sinks == (working,)
    assert any(
        "could not be loaded" in record.getMessage() for record in caplog.records
    )


def test_resolution_accepts_instances_and_dotted_paths(app_context: None) -> None:
    """Both configuration styles work, as they do for the other logger hooks."""
    instance = CapturingTelemetry()

    sinks = resolve_sinks([instance, "superset.ai.telemetry.NullAITelemetry"])

    assert sinks[0] is instance
    assert isinstance(sinks[1], NullAITelemetry)


def test_something_that_is_not_a_sink_is_skipped(
    app_context: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A wrong type in the list is reported and ignored."""
    with caplog.at_level(logging.WARNING, logger="superset.ai.telemetry"):
        # A raw value, and a path that resolves to something real but unrelated.
        assert resolve_sinks([42, "superset.ai.telemetry.POLICY_DENIED"]) == ()

    messages = [record.getMessage() for record in caplog.records]
    assert len(messages) == 2
    assert all("AITelemetry" in message for message in messages)


# --------------------------------------------------------------------------- #
# Cost when unconfigured
# --------------------------------------------------------------------------- #


def test_no_sinks_configured_allocates_no_recorder(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    An unconfigured deployment pays a config read and nothing more.

    Asserted through identity with the shared do-nothing recorder, because that
    is what proves no trace object was allocated.
    """
    _configure(mocker, [])

    recorder = start_run(run_id="r", thread_uuid="t", user_id=1)

    assert recorder is NO_TELEMETRY
    assert recorder.enabled is False


def test_the_runtime_runs_untraced_with_no_run_bound() -> None:
    """
    The runtime works when nothing bound a run at all.

    A deployment may drive a runtime directly, and a test certainly does.
    """
    assert current_run() is NO_TELEMETRY

    runtime = MessagesApiRuntime(EchoProvider([ScriptedTurn(text="fine")]))
    request = RunRequest(
        messages=[Message(role=MessageRole.USER, content="hello")],
        system_prompt="be brief",
    )

    async def collect() -> list[StreamEvent]:
        return [event async for event in runtime.run(request)]

    asyncio.run(collect())
    assert runtime.result.answer == "fine"


def test_binding_is_undone_afterwards(app_context: None, mocker: MockerFixture) -> None:
    """A run does not leak its recorder to whatever runs next on this thread."""
    _configure(mocker, [CapturingTelemetry()])

    recorder = start_run(run_id="r", thread_uuid="t")
    with bind_run(recorder):
        assert current_run() is recorder
    assert current_run() is NO_TELEMETRY


# --------------------------------------------------------------------------- #
# Span content
# --------------------------------------------------------------------------- #


def test_one_model_span_per_round_trip_with_token_counts(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """Each round trip is its own span, carrying what the provider reported."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=StubTools())

    assert [call.turn for _, call in sink.model_calls] == [1, 2]
    for _, call in sink.model_calls:
        assert call.model == "echo-default"
        assert (call.input_tokens or 0) > 0
        assert call.duration_ms >= 0
    assert sink.model_calls[0][1].stop_reason == "tool_use"
    assert sink.model_calls[1][1].stop_reason == "end_turn"


def test_run_usage_is_the_total_across_round_trips(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    The run's usage aggregates its calls.

    Aggregated in one place so that neither the orchestrator nor a custom
    runtime has to keep a running total that exists only for telemetry.
    """
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=StubTools())

    usage = sink.runs_ended[0].usage or {}
    per_call = [call.input_tokens or 0 for _, call in sink.model_calls]
    assert usage["requests"] == 2
    assert usage["input_tokens"] == sum(per_call)


def test_a_failed_round_trip_is_a_span_and_an_error(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A provider failure is both a model span and an error, with its class."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(EchoProvider([ScriptedTurn(error=LLMTransportError("upstream 503"))]))

    assert sink.model_calls[0][1].error_type == "LLMTransportError"
    assert sink.runs_ended[0].error_type == "LLMTransportError"
    assert len(sink.errors) == 1


def test_tool_span_reuses_the_dispatcher_timing(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    The duration comes from the dispatcher, which already measured it.

    Timing the call again in the telemetry path would report the same work twice
    under two names, and the two would disagree.
    """
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=RichStubTools(duration_ms=1234))

    call = sink.tool_calls[0][1]
    assert call.duration_ms == 1234
    assert call.truncated is True
    assert call.ok is True


def test_a_refused_tool_call_is_reported_with_its_reason_class(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A policy denial is a visible span, not a silent absence."""

    class DenyAll(ToolPolicy):
        name = "deny_all"

        def check(self, tool_name: str, arguments: dict[str, Any]) -> Denial | None:
            return Denial("Only read-only SQL is allowed.")

    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(
        _script_with_a_tool_call(),
        tools=StubTools(),
        policies=PolicyChain([DenyAll()]),
    )

    call = sink.tool_calls[0][1]
    assert call.ok is False
    assert call.error_type == POLICY_DENIED


def test_a_raising_tool_reports_the_exception_class(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """The failure class is recoverable from the span, unlike from the result."""

    class Broken(StubTools):
        def dispatch(self, call: ToolCall) -> ToolResult:
            raise ZeroDivisionError("no rows")

    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=Broken())

    assert sink.tool_calls[0][1].error_type == "ZeroDivisionError"
    assert sink.tool_calls[0][1].ok is False


def test_a_rich_dispatcher_failure_preserves_its_exception_class(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A concrete ToolError reaches telemetry but not persisted run detail."""

    class WarehouseDeniedError(ToolError):
        pass

    class RefusingTool(AITool):
        name = "execute_sql"
        description = "Always refuses the test call."
        input_schema = {"type": "object"}

        def run(self, **_kwargs: Any) -> ToolOutput:
            raise WarehouseDeniedError("warehouse refused the query")

    sink = CapturingTelemetry()
    _configure(mocker, [sink])
    mocker.patch(
        "superset.ai.tools.base._current_user",
        return_value=mocker.Mock(id=7, is_authenticated=True),
    )

    runtime, _ = _drive(
        _script_with_a_tool_call(), tools=ToolRegistry([RefusingTool()])
    )

    assert sink.tool_calls[0][1].error_type == "WarehouseDeniedError"
    assert "error_type" not in runtime.result.tool_calls[0]


def test_a_call_for_a_tool_that_is_not_offered_is_reported(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A model asking for a tool the deployment does not have is worth seeing."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=None)

    assert sink.tool_calls[0][1].error_type == TOOL_UNAVAILABLE


def test_run_end_is_idempotent(app_context: None, mocker: MockerFixture) -> None:
    """
    A second close is ignored.

    The orchestrator closes the run on its ordinary paths and again in a
    ``finally`` that catches an abandoned stream, and a monitoring system must
    not see two ends for one run.
    """
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    recorder = start_run(run_id="r", thread_uuid="t")
    recorder.run_ended(outcome=RunOutcome.SUCCESS)
    recorder.run_ended(outcome=RunOutcome.CANCELLED)

    assert len(sink.runs_ended) == 1
    assert sink.runs_ended[0].outcome is RunOutcome.SUCCESS


def test_run_identity_is_carried_on_every_span(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A child span can always be tied back to its run."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=StubTools())

    for run, _ in [*sink.model_calls, *sink.tool_calls]:
        assert run.run_id == "run-1"
        assert run.thread_uuid == "thread-1"
        assert run.user_id == 7
        assert run.agent_key == "analyst"


def test_a_finished_run_reports_its_shape(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """The run trace carries the fields a monitoring system groups by."""
    sink = CapturingTelemetry()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=StubTools())

    run = sink.runs_ended[0]
    assert run.outcome is RunOutcome.SUCCESS
    assert run.turns == 2
    assert run.model == "echo-default"
    assert run.started_at is not None
    assert run.ended_at is not None
    assert run.duration_ms is not None
    assert run.duration_ms >= 0


# --------------------------------------------------------------------------- #
# Bundled sinks
# --------------------------------------------------------------------------- #


def test_the_null_sink_accepts_everything_and_does_nothing() -> None:
    """Each hook has a working no-op default, so a sink overrides only some."""
    sink: AITelemetry = NullAITelemetry()
    run = RunTrace(run_id="r", thread_uuid="t")

    sink.on_run_start(run)
    sink.on_run_end(run)
    sink.on_model_call(run, ModelCallTrace(turn=1))
    sink.on_tool_call(run, ToolCallTrace(tool_name="execute_sql"))
    sink.on_error(run, RuntimeError("x"))


def test_a_sink_may_implement_a_single_hook(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    The stated shape of the contract: one method, four inherited no-ops.

    A deployment that only wants token counts should not have to write five
    methods to get them.
    """

    class TokensOnly(AITelemetry):
        def __init__(self) -> None:
            self.tokens = 0

        def on_model_call(self, run: RunTrace, call: ModelCallTrace) -> None:
            self.tokens += call.output_tokens or 0

    sink = TokensOnly()
    _configure(mocker, [sink])

    _drive(_script_with_a_tool_call(), tools=StubTools())

    assert sink.tokens > 0


def test_the_logging_sink_writes_one_line_per_span(
    app_context: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Lines are named by event and carry a JSON body a pipeline can parse."""
    _configure(mocker, [LoggingAITelemetry(level=logging.INFO)])

    with caplog.at_level(logging.INFO, logger="superset.ai.telemetry"):
        _drive(_script_with_a_tool_call(), tools=StubTools())

    messages = [record.getMessage() for record in caplog.records]
    events = [message.split(" ", 1)[0] for message in messages]
    assert "ai.run.start" in events
    assert "ai.run.end" in events
    assert events.count("ai.model_call") == 2
    assert events.count("ai.tool_call") == 1
    body = next(m for m in messages if m.startswith("ai.run.end")).split(" ", 1)[1]
    assert json.loads(body)["outcome"] == "success"


def test_the_logging_sink_honours_its_configured_level(
    app_context: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A deployment can make spans debug-only without losing failures."""
    _configure(mocker, [LoggingAITelemetry(level=logging.DEBUG)])

    with caplog.at_level(logging.DEBUG, logger="superset.ai.telemetry"):
        _drive(EchoProvider([ScriptedTurn(error=LLMTransportError("upstream 503"))]))

    levels = {
        record.getMessage().split(" ", 1)[0]: record.levelno
        for record in caplog.records
        if record.getMessage().startswith("ai.")
    }
    assert levels["ai.run.start"] == logging.DEBUG
    # Errors are raised to warning whatever the level, because a deployment that
    # only wants summaries still wants to hear about failures.
    assert levels["ai.error"] == logging.WARNING


def test_the_stats_sink_emits_bounded_metric_keys(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """The keys a metrics backend will see, stated explicitly."""
    stats = _with_stats_logger(mocker)
    _configure(mocker, [StatsLoggerAITelemetry()])

    _drive(_script_with_a_tool_call(), tools=RichStubTools(duration_ms=5))

    assert stats.counters == [
        "superset.ai.run.start",
        "superset.ai.model_call",
        "superset.ai.tool_call.execute_sql",
        "superset.ai.tool_call.execute_sql.truncated",
        "superset.ai.model_call",
        "superset.ai.run.end",
        "superset.ai.run.outcome.success",
    ]
    assert [key for key, _ in stats.timings] == [
        "superset.ai.model_call.duration_ms",
        "superset.ai.tool_call.execute_sql.duration_ms",
        "superset.ai.model_call.duration_ms",
        "superset.ai.run.duration_ms",
    ]
    assert [key for key, _ in stats.gauges] == [
        "superset.ai.run.turns",
        "superset.ai.run.tokens.input",
        "superset.ai.run.tokens.output",
    ]


def test_the_stats_sink_never_puts_an_identifier_in_a_key(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    Cardinality is the failure mode here.

    A metric per user, run or thread is how a metrics backend is brought down by
    a feature nobody thought was expensive. Per-run detail belongs in a trace.
    """
    stats = _with_stats_logger(mocker)
    _configure(mocker, [StatsLoggerAITelemetry()])

    _drive(_script_with_a_tool_call(), tools=StubTools())

    assert stats.keys
    for key in stats.keys:
        assert key.startswith("superset.ai.")
        for identifier in ("run-1", "thread-1", "7"):
            assert identifier not in key


def test_the_stats_sink_sanitises_an_unexpected_tool_name(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    A name that is not a plain identifier cannot produce an unusable key.

    Tool names come from a bounded registry, but the name on a call arrives from
    the model, so the sink does not assume it is well formed.
    """
    stats = _with_stats_logger(mocker)
    _configure(mocker, [StatsLoggerAITelemetry()])

    provider = EchoProvider(
        [
            ScriptedTurn(
                tool_calls=(ToolCall(id="c1", name="Run SQL!/../*", arguments={}),),
            ),
            ScriptedTurn(text="done"),
        ]
    )
    _drive(provider, tools=StubTools())

    assert "superset.ai.tool_call.run_sql" in stats.counters


def test_the_stats_sink_counts_failures_separately(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A failed run and a failed tool are each their own counter."""
    stats = _with_stats_logger(mocker)
    _configure(mocker, [StatsLoggerAITelemetry()])

    _drive(EchoProvider([ScriptedTurn(error=LLMTransportError("upstream 503"))]))

    assert "superset.ai.model_call.error" in stats.counters
    assert "superset.ai.error" in stats.counters
