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
Pluggable observability for assistant runs.

Superset bundles no integration with any monitoring product. A deployment
implements :class:`AITelemetry` and lists it in ``AI_TELEMETRY``, exactly as it
would a ``STATS_LOGGER`` or an ``EVENT_LOGGER``, and receives a span per run,
per model round trip and per tool call. Where those spans go — a hosted tracing
service, a collector, a warehouse table — is the deployment's decision, and
nothing in Superset core knows which product is on the other end.

Three properties are load-bearing and worth preserving through any change.

**Redaction is structural.** ``AI_TELEMETRY_REDACT_CONTENT`` is applied where
traces are built, in :class:`_ContentPolicy`, not where they are consumed. A
sink physically cannot receive a prompt, an answer, a SQL statement or a data
value while redaction is on, because the field it would read was never
populated. Leaving it to each sink would mean one careless implementation
silently shipping warehouse values to a third party, with nothing observable
from the outside to reveal it.

**Telemetry cannot fail a run.** Every sink call is wrapped, as is the
construction of every trace. A sink that raises from all five hooks costs a
warning in the log and nothing else.

**Unconfigured is free.** With no sinks configured, :func:`start_run` returns a
shared do-nothing recorder: no trace object is allocated, no clock is read, and
the call sites in the orchestrator and the runtime need no conditionals.
"""

from __future__ import annotations

import logging
import re
import time
from abc import ABC
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from typing import Any, ClassVar, Final

from superset.ai.types import RunOutcome, TokenUsage
from superset.utils import json

logger = logging.getLogger(__name__)

#: Mirrors the ``AI_TELEMETRY_REDACT_CONTENT`` default. Repeated here so that a
#: caller with no application context — a test, a management command — gets the
#: safe behaviour rather than the permissive one.
_DEFAULT_REDACT_CONTENT = True

#: Mirrors the ``AI_TELEMETRY_MAX_CONTENT_CHARS`` default.
_DEFAULT_MAX_CONTENT_CHARS = 10_000

#: ``error_type`` on a tool span the policy chain refused before it ran.
POLICY_DENIED = "PolicyDenial"

#: ``error_type`` on a tool span naming a tool the deployment does not offer.
TOOL_UNAVAILABLE = "ToolUnavailable"

#: Stand-in handed to :meth:`AITelemetry.on_error` while redaction is on.
#: Exception text routinely quotes the statement or the prompt that produced it,
#: so the class name is the most that can be shared.
REDACTED_ERROR = "redacted"


# --------------------------------------------------------------------------- #
# Trace payloads
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class _Trace:
    """Shared serialisation for the trace payloads."""

    def as_dict(self) -> dict[str, Any]:
        """Plain-dict form, for a sink that forwards JSON."""
        return asdict(self)


@dataclass(frozen=True)
class RunTrace(_Trace):
    """
    One assistant run, from the user's question to the stored answer.

    Immutable: the run is described progressively as the orchestrator resolves
    the profile and then completes, and each step produces a new instance rather
    than mutating one a sink may already have kept.

    ``question`` and ``answer`` are populated only while
    ``AI_TELEMETRY_REDACT_CONTENT`` is off.
    """

    run_id: str
    thread_uuid: str
    user_id: int | None = None
    #: Profile the run used, e.g. the key of an entry in ``AI_AGENT_PROFILES``.
    agent_key: str | None = None
    #: Concrete model identifier, not a capability tier, where the provider
    #: reported one.
    model: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_ms: int | None = None
    outcome: RunOutcome | None = None
    #: Model round trips the run consumed.
    turns: int = 0
    #: Totals across every round trip, not one of them.
    usage: TokenUsage | None = None
    error_type: str | None = None
    question: str | None = None
    answer: str | None = None


@dataclass(frozen=True)
class ModelCallTrace(_Trace):
    """
    One model round trip.

    ``system_prompt`` and ``response_text`` are populated only while
    ``AI_TELEMETRY_REDACT_CONTENT`` is off.
    """

    turn: int
    model: str | None = None
    duration_ms: int = 0
    input_tokens: int | None = None
    output_tokens: int | None = None
    stop_reason: str | None = None
    error_type: str | None = None
    system_prompt: str | None = None
    response_text: str | None = None


@dataclass(frozen=True)
class ToolCallTrace(_Trace):
    """
    One tool invocation, including one that was refused or that failed.

    ``arguments`` and ``output`` are populated only while
    ``AI_TELEMETRY_REDACT_CONTENT`` is off.
    """

    tool_name: str
    duration_ms: int = 0
    ok: bool = True
    #: :data:`POLICY_DENIED`, :data:`TOOL_UNAVAILABLE`, or the class name of the
    #: exception the tool raised.
    error_type: str | None = None
    #: Whether the tool's own result caps dropped part of the output.
    truncated: bool = False
    arguments: dict[str, Any] | None = None
    output: str | None = None


# --------------------------------------------------------------------------- #
# The sink contract
# --------------------------------------------------------------------------- #


class AITelemetry(ABC):  # noqa: B024
    """
    A destination for assistant telemetry.

    Every method has a no-op default, so a deployment overrides only what it
    cares about: a sink that wants token counts implements one method and
    inherits the other four.

    Sinks are called synchronously, on the thread answering the user. Anything
    that talks to a network should hand off to a queue or a background thread
    rather than make a user's answer wait on a monitoring system being up.

    A method that raises is logged and ignored — one broken sink affects neither
    the run nor the other sinks.

    ``agent_key``, ``model`` and ``question`` are resolved after a run has
    started, so the :class:`RunTrace` passed to :meth:`on_run_start` may carry
    less than the one passed to the later hooks. A sink that opens a span on
    start should read those fields on :meth:`on_run_end`.
    """

    # Every hook is an empty concrete method rather than an abstract one — which
    # is what the B024 and B027 suppressions are for. Making any of them
    # abstract would oblige a deployment that wants one measurement to write
    # five methods, and that cost is paid by every sink anyone ever writes.

    def on_run_start(self, run: RunTrace) -> None:  # noqa: B027
        """A run has begun. Always paired with an :meth:`on_run_end`."""

    def on_run_end(self, run: RunTrace) -> None:  # noqa: B027
        """
        A run has finished, whether it succeeded, failed, timed out or was
        cancelled. ``run.outcome`` says which, and ``run.usage`` carries the
        totals for the whole run.
        """

    def on_model_call(self, run: RunTrace, call: ModelCallTrace) -> None:  # noqa: B027
        """One model round trip completed or failed."""

    def on_tool_call(self, run: RunTrace, call: ToolCallTrace) -> None:  # noqa: B027
        """One tool invocation completed, was refused by policy, or failed."""

    def on_error(self, run: RunTrace, error: BaseException | str) -> None:  # noqa: B027
        """
        Something went wrong that the run could not absorb.

        Not called for a single failing tool call, which the loop recovers from
        and reports as a :class:`ToolCallTrace` with ``ok`` false.

        While redaction is on, ``error`` is the exception's class name rather
        than the exception, because exception text quotes the input that caused
        it often enough to be treated as content.
        """


# --------------------------------------------------------------------------- #
# Bundled sinks
# --------------------------------------------------------------------------- #


class NullAITelemetry(AITelemetry):
    """
    Discards everything.

    The default shape of ``AI_TELEMETRY`` is an empty list rather than this, so
    this exists for a deployment that wants to disable telemetry explicitly
    without deleting its configuration, and as a base for a sink under
    development.
    """


class LoggingAITelemetry(AITelemetry):
    """
    Writes one structured line per span to the Python logging system.

    Useful on its own for a small deployment, and useful as the first step for a
    larger one: the lines are shaped for a log pipeline to parse and forward, so
    the shipping problem becomes one a deployment has already solved for the
    rest of Superset.
    """

    def __init__(
        self,
        level: int = logging.INFO,
        logger_name: str = "superset.ai.telemetry",
    ) -> None:
        self.level = level
        self._log = logging.getLogger(logger_name)

    def on_run_start(self, run: RunTrace) -> None:
        self._write(self.level, "ai.run.start", run.as_dict())

    def on_run_end(self, run: RunTrace) -> None:
        self._write(self.level, "ai.run.end", run.as_dict())

    def on_model_call(self, run: RunTrace, call: ModelCallTrace) -> None:
        self._write(self.level, "ai.model_call", {**_ref(run), **call.as_dict()})

    def on_tool_call(self, run: RunTrace, call: ToolCallTrace) -> None:
        self._write(self.level, "ai.tool_call", {**_ref(run), **call.as_dict()})

    def on_error(self, run: RunTrace, error: BaseException | str) -> None:
        # Raised to warning whatever the configured level: a deployment that
        # only wants run summaries still wants to hear about failures.
        self._write(
            max(self.level, logging.WARNING),
            "ai.error",
            {**_ref(run), "error_type": type(error).__name__, "error": str(error)},
        )

    def _write(self, level: int, event: str, payload: Mapping[str, Any]) -> None:
        """One line per span: greppable by event name, parseable by a pipeline."""
        self._log.log(
            level,
            "%s %s",
            event,
            json.dumps(payload, default=json.pessimistic_json_iso_dttm_ser),
        )


class StatsLoggerAITelemetry(AITelemetry):
    """
    Emits counters and timings through the configured ``STATS_LOGGER``.

    Metric names are deliberately narrow. Tool name and outcome are drawn from
    bounded sets and appear as key segments; the run, thread and user
    identifiers are unbounded and never do, because a metric key per user is how
    a metrics backend is brought down by a feature nobody thought was expensive.
    Per-run detail belongs in a trace, which is what the other sinks carry.

    Token totals are reported with ``gauge`` rather than a counter because
    :class:`~superset.stats_logger.BaseStatsLogger` has no add-N operation;
    aggregate them in the metrics backend.
    """

    #: Leading segment on every key. Note that a statsd-backed ``STATS_LOGGER``
    #: applies its own prefix as well, so adjust this if that would duplicate.
    prefix: ClassVar[str] = "superset.ai."

    def on_run_start(self, run: RunTrace) -> None:
        self._incr("run.start")

    def on_run_end(self, run: RunTrace) -> None:
        self._incr("run.end")
        if run.outcome is not None:
            self._incr(f"run.outcome.{_segment(run.outcome.value)}")
        if run.duration_ms is not None:
            self._timing("run.duration_ms", run.duration_ms)
        self._gauge("run.turns", run.turns)
        usage = run.usage or TokenUsage()
        self._gauge("run.tokens.input", usage.get("input_tokens", 0))
        self._gauge("run.tokens.output", usage.get("output_tokens", 0))

    def on_model_call(self, run: RunTrace, call: ModelCallTrace) -> None:
        self._incr("model_call")
        self._timing("model_call.duration_ms", call.duration_ms)
        if call.error_type is not None:
            self._incr("model_call.error")

    def on_tool_call(self, run: RunTrace, call: ToolCallTrace) -> None:
        name = _segment(call.tool_name)
        self._incr(f"tool_call.{name}")
        self._timing(f"tool_call.{name}.duration_ms", call.duration_ms)
        if not call.ok:
            self._incr(f"tool_call.{name}.error")
        if call.truncated:
            self._incr(f"tool_call.{name}.truncated")

    def on_error(self, run: RunTrace, error: BaseException | str) -> None:
        self._incr("error")

    def _incr(self, key: str) -> None:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.incr(f"{self.prefix}{key}")

    def _timing(self, key: str, value: float) -> None:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.timing(f"{self.prefix}{key}", value)

    def _gauge(self, key: str, value: float) -> None:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.gauge(f"{self.prefix}{key}", value)


#: Anything a metrics backend may not accept in a key segment.
_UNSAFE_SEGMENT = re.compile(r"[^a-z0-9_]+")

#: Bound on one key segment, so an unexpected name cannot produce a key no
#: backend will store.
_MAX_SEGMENT_CHARS = 48


def _segment(value: str) -> str:
    """Normalise a bounded, non-identifying value for use in a metric key."""
    cleaned = _UNSAFE_SEGMENT.sub("_", value.lower()).strip("_")
    return cleaned[:_MAX_SEGMENT_CHARS] or "unknown"


def _ref(run: RunTrace) -> dict[str, Any]:
    """The identifiers that tie a child span back to its run."""
    return {"run_id": run.run_id, "thread_uuid": run.thread_uuid}


# --------------------------------------------------------------------------- #
# Redaction
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class _ContentPolicy:
    """
    The only route by which content reaches a trace.

    Enforced here rather than in each sink so that redaction is a property of
    the payload and not of the destination: with ``redact`` set there is no
    content in the object a sink is handed, so there is nothing for a sink to
    forward by mistake.
    """

    redact: bool = _DEFAULT_REDACT_CONTENT
    max_chars: int = _DEFAULT_MAX_CONTENT_CHARS

    def text(self, value: str | None) -> str | None:
        """A single content field, capped, or ``None`` while redacting."""
        if self.redact or value is None:
            return None
        return value[: self.max_chars] if self.max_chars > 0 else value

    def arguments(self, value: Mapping[str, Any] | None) -> dict[str, Any] | None:
        """A tool's arguments, each value capped, or ``None`` while redacting."""
        if self.redact or not value:
            return None
        return {str(key): self._render(item) for key, item in value.items()}

    def _render(self, item: Any) -> Any:
        """Reduce one argument value to something a sink can serialise."""
        if isinstance(item, str):
            return self.text(item)
        if item is None or isinstance(item, (bool, int, float)):
            return item
        # A container becomes one bounded string rather than being walked: a
        # sink should not have to defend against arbitrary nesting, and the cap
        # has to apply to something with a length.
        return self.text(json.dumps(item, default=json.pessimistic_json_iso_dttm_ser))


# --------------------------------------------------------------------------- #
# Per-run recorder
# --------------------------------------------------------------------------- #


class RunRecorder:
    """
    The handle a run holds for the length of its lifecycle.

    This base implementation records nothing, and is what a deployment with no
    sinks configured gets from :func:`start_run`. Call sites therefore never
    branch on whether telemetry is on: they call methods that cost a function
    call and return.
    """

    #: Whether anything is listening. Call sites use this to skip assembling
    #: arguments that would be discarded, not to decide whether to call at all.
    enabled: ClassVar[bool] = False

    def run_started(self) -> None:
        """Announce the run."""

    def describe(
        self,
        *,
        agent_key: str | None = None,
        model: str | None = None,
        question: str | None = None,
    ) -> None:
        """Fill in what was only knowable once the profile was resolved."""

    def model_call(
        self,
        *,
        turn: int,
        model: str | None = None,
        duration_ms: int = 0,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        stop_reason: str | None = None,
        error_type: str | None = None,
        system_prompt: str | None = None,
        response_text: str | None = None,
    ) -> None:
        """Record one model round trip."""

    def tool_call(
        self,
        *,
        tool_name: str,
        duration_ms: int = 0,
        ok: bool = True,
        error_type: str | None = None,
        truncated: bool = False,
        arguments: Mapping[str, Any] | None = None,
        output: str | None = None,
    ) -> None:
        """Record one tool invocation."""

    def error(self, error: BaseException | str) -> None:
        """Record a failure the run could not absorb."""

    def run_ended(
        self,
        *,
        outcome: RunOutcome,
        turns: int = 0,
        answer: str | None = None,
        error_type: str | None = None,
    ) -> None:
        """Close the run. Idempotent, so a safety net may call it again."""


class _DispatchingRunRecorder(RunRecorder):
    """
    Builds traces and fans them out to the configured sinks.

    Holds the run's own accounting — elapsed time and token totals — so that
    neither the orchestrator nor the runtime has to carry a running total that
    exists purely for telemetry.
    """

    enabled: ClassVar[bool] = True

    def __init__(
        self,
        sinks: Sequence[AITelemetry],
        run: RunTrace,
        content: _ContentPolicy,
    ) -> None:
        self._sinks = tuple(sinks)
        self._run = run
        self._content = content
        self._started = time.monotonic()
        self._usage: TokenUsage = TokenUsage()
        self._error_type: str | None = None
        self._ended = False
        #: Sink/hook pairs already reported as broken during this run.
        self._warned: set[tuple[str, str]] = set()

    @property
    def run(self) -> RunTrace:
        """The run as currently described. Exposed for tests and diagnostics."""
        return self._run

    def run_started(self) -> None:
        self._emit("on_run_start", self._run)

    def describe(
        self,
        *,
        agent_key: str | None = None,
        model: str | None = None,
        question: str | None = None,
    ) -> None:
        try:
            self._run = replace(
                self._run,
                agent_key=agent_key if agent_key is not None else self._run.agent_key,
                model=model if model is not None else self._run.model,
                question=(
                    self._content.text(question)
                    if question is not None
                    else self._run.question
                ),
            )
        except Exception:  # pylint: disable=broad-except
            self._warn_build("describe")

    def model_call(  # pylint: disable=too-many-arguments
        self,
        *,
        turn: int,
        model: str | None = None,
        duration_ms: int = 0,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        stop_reason: str | None = None,
        error_type: str | None = None,
        system_prompt: str | None = None,
        response_text: str | None = None,
    ) -> None:
        try:
            self._accumulate(model, input_tokens, output_tokens)
            if error_type is not None:
                self._error_type = error_type
            call = ModelCallTrace(
                turn=turn,
                model=model,
                duration_ms=duration_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                stop_reason=stop_reason,
                error_type=error_type,
                system_prompt=self._content.text(system_prompt),
                response_text=self._content.text(response_text),
            )
        except Exception:  # pylint: disable=broad-except
            self._warn_build("model_call")
            return
        self._emit("on_model_call", self._run, call)

    def tool_call(
        self,
        *,
        tool_name: str,
        duration_ms: int = 0,
        ok: bool = True,
        error_type: str | None = None,
        truncated: bool = False,
        arguments: Mapping[str, Any] | None = None,
        output: str | None = None,
    ) -> None:
        try:
            call = ToolCallTrace(
                tool_name=tool_name,
                duration_ms=duration_ms,
                ok=ok,
                error_type=error_type,
                truncated=truncated,
                arguments=self._content.arguments(arguments),
                output=self._content.text(output),
            )
        except Exception:  # pylint: disable=broad-except
            self._warn_build("tool_call")
            return
        self._emit("on_tool_call", self._run, call)

    def error(self, error: BaseException | str) -> None:
        if isinstance(error, BaseException):
            self._error_type = type(error).__name__
        payload: BaseException | str = error
        if self._content.redact:
            payload = self._error_type or REDACTED_ERROR
        self._emit("on_error", self._run, payload)

    def run_ended(
        self,
        *,
        outcome: RunOutcome,
        turns: int = 0,
        answer: str | None = None,
        error_type: str | None = None,
    ) -> None:
        if self._ended:
            return
        self._ended = True
        try:
            self._run = replace(
                self._run,
                ended_at=datetime.now(timezone.utc),
                duration_ms=int((time.monotonic() - self._started) * 1000),
                outcome=outcome,
                turns=turns or self._run.turns,
                usage=self._usage if self._usage.get("requests") else None,
                error_type=error_type or self._error_type,
                answer=self._content.text(answer),
            )
        except Exception:  # pylint: disable=broad-except
            self._warn_build("run_ended")
            return
        self._emit("on_run_end", self._run)

    def _accumulate(
        self,
        model: str | None,
        input_tokens: int | None,
        output_tokens: int | None,
    ) -> None:
        """Roll one round trip into the run's totals."""
        self._usage["requests"] = self._usage.get("requests", 0) + 1
        if input_tokens:
            self._usage["input_tokens"] = (
                self._usage.get("input_tokens", 0) + input_tokens
            )
        if output_tokens:
            self._usage["output_tokens"] = (
                self._usage.get("output_tokens", 0) + output_tokens
            )
        if model and not self._usage.get("model"):
            self._usage["model"] = model

    def _emit(self, hook: str, *payload: Any) -> None:
        """Call one hook on every sink, surviving any of them failing."""
        for sink in self._sinks:
            try:
                getattr(sink, hook)(*payload)
            except Exception:  # pylint: disable=broad-except
                self._warn_sink(hook, sink)

    def _warn_sink(self, hook: str, sink: AITelemetry) -> None:
        name = type(sink).__name__
        if (name, hook) in self._warned:
            # A sink that fails on one span almost always fails on every span,
            # and a twenty-turn run must not turn one broken sink into sixty
            # identical warnings.
            logger.debug("AI telemetry sink %s failed again in %s", name, hook)
            return
        self._warned.add((name, hook))
        logger.warning(
            "AI telemetry sink %s failed in %s; the run is unaffected",
            name,
            hook,
            exc_info=True,
        )

    def _warn_build(self, hook: str) -> None:
        if ("-", hook) in self._warned:
            logger.debug("AI telemetry trace for %s could not be built again", hook)
            return
        self._warned.add(("-", hook))
        logger.warning(
            "AI telemetry trace for %s could not be built; the run is unaffected",
            hook,
            exc_info=True,
        )


#: Shared recorder for a deployment with no sinks configured. Safe to share
#: because it holds no state.
NO_TELEMETRY: Final[RunRecorder] = RunRecorder()


# --------------------------------------------------------------------------- #
# Binding a run to the code that reports about it
# --------------------------------------------------------------------------- #

#: The run in flight on this context.
#:
#: A context variable rather than a field on
#: :class:`~superset.ai.runtime.base.RunRequest` because that dataclass is part
#: of the runtime contract a deployment may implement itself, and it should not
#: have to grow an observability parameter that a custom runtime is then obliged
#: to thread through. The orchestrator binds the run; whichever runtime is
#: configured reports against it if it chooses to, and works unchanged if not.
_ACTIVE_RUN: ContextVar[RunRecorder] = ContextVar(
    "superset_ai_active_run",
    default=NO_TELEMETRY,
)


def current_run() -> RunRecorder:
    """The recorder for the run in flight, or a do-nothing one."""
    return _ACTIVE_RUN.get()


@contextmanager
def bind_run(recorder: RunRecorder) -> Iterator[RunRecorder]:
    """Make ``recorder`` the one :func:`current_run` returns."""
    token = _ACTIVE_RUN.set(recorder)
    try:
        yield recorder
    finally:
        _ACTIVE_RUN.reset(token)


def start_run(
    *,
    run_id: str,
    thread_uuid: str,
    user_id: int | None = None,
) -> RunRecorder:
    """
    Open a run's telemetry, or return the do-nothing recorder if nobody listens.

    The early return is the point: with ``AI_TELEMETRY`` empty this reads one
    config key and allocates nothing.
    """
    sinks = resolve_sinks()
    if not sinks:
        return NO_TELEMETRY
    return _DispatchingRunRecorder(
        sinks,
        RunTrace(
            run_id=run_id,
            thread_uuid=thread_uuid,
            user_id=user_id,
            started_at=datetime.now(timezone.utc),
        ),
        content_policy(),
    )


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #


def resolve_sinks(entries: Sequence[Any] | None = None) -> tuple[AITelemetry, ...]:
    """
    Turn ``AI_TELEMETRY`` into sink instances.

    Accepts configured instances and dotted paths alike, mirroring
    ``EVENT_LOGGER`` and ``STATS_LOGGER``.

    An entry that cannot be loaded is logged and skipped. This is the opposite
    of ``AI_AGENT_TOOL_POLICIES``, where a bad path is fatal, and the difference
    is deliberate: a policy that fails to load silently removes a guard, whereas
    an observer that fails to load removes only the record of what happened.
    Taking the assistant down over a mistyped monitoring integration would trade
    a working feature for a missing dashboard.
    """
    if entries is None:
        entries = _configured_entries()
    sinks: list[AITelemetry] = []
    for entry in entries:
        if (sink := _as_sink(entry)) is not None:
            sinks.append(sink)
    return tuple(sinks)


def content_policy() -> _ContentPolicy:
    """Read the redaction settings, defaulting to the safe side."""
    config = _config()
    return _ContentPolicy(
        redact=bool(config.get("AI_TELEMETRY_REDACT_CONTENT", _DEFAULT_REDACT_CONTENT)),
        max_chars=int(
            config.get("AI_TELEMETRY_MAX_CONTENT_CHARS", _DEFAULT_MAX_CONTENT_CHARS)
        ),
    )


def _as_sink(entry: Any) -> AITelemetry | None:
    """One ``AI_TELEMETRY`` entry as a sink, or ``None`` with a reason logged."""
    if isinstance(entry, AITelemetry):
        return entry
    if not isinstance(entry, str):
        logger.warning(
            "Ignoring AI_TELEMETRY entry of type %s: expected an AITelemetry "
            "instance or a dotted path to one.",
            type(entry).__name__,
        )
        return None

    from superset.utils.class_utils import load_class_from_name

    try:
        loaded = load_class_from_name(entry)
        # A path may name either a class to construct or an already-configured
        # instance, which is how a sink needing constructor arguments is shared
        # between config files.
        candidate = loaded() if isinstance(loaded, type) else loaded
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Ignoring AI_TELEMETRY entry %r: it could not be loaded. Assistant "
            "runs continue untraced.",
            entry,
            exc_info=True,
        )
        return None

    if not isinstance(candidate, AITelemetry):
        logger.warning(
            "Ignoring AI_TELEMETRY entry %r: %s is not an AITelemetry subclass.",
            entry,
            type(candidate).__name__,
        )
        return None
    return candidate


def _configured_entries() -> Sequence[Any]:
    """``AI_TELEMETRY`` as configured, or nothing outside an app context."""
    return _config().get("AI_TELEMETRY") or ()


def _config() -> Mapping[str, Any]:
    """
    The application config, or an empty mapping when there is none.

    Telemetry is reached from a Celery worker and from tests as well as from a
    request, and being unable to read configuration is a reason to record
    nothing rather than a reason to fail.
    """
    try:
        from flask import current_app

        return current_app.config
    except Exception:  # pylint: disable=broad-except
        return {}
