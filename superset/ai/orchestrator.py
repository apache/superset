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
Runs one assistant turn end to end.

Sits between the HTTP layer and the runtime: loads the conversation, assembles
the prompt, resolves the tools the chosen profile allows, drives the runtime,
publishes every event to the bus, and records the outcome on the assistant
message.

Deliberately independent of *where* it runs. The same function body serves the
inline path and the Celery path, which is what makes the execution mode a
configuration choice rather than two implementations that drift apart.
"""

from __future__ import annotations

import asyncio
import logging
import uuid as uuid_module
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from typing import Any

from superset.ai.events import (
    cancelled_event,
    done_event,
    error_event,
    GENERIC_ERROR_MESSAGE,
    session_event,
    StreamEvent,
)
from superset.ai.llm.base import Message
from superset.ai.telemetry import bind_run, current_run, start_run
from superset.ai.types import MessageRole, MessageStatus, RunOutcome, StreamEventType
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

#: Cache key prefix for a run's cancellation flag. A flag rather than a signal
#: because a worker cannot be interrupted mid-call reliably; the runtime checks
#: this between steps.
_CANCEL_PREFIX = "ai-cancel-"

#: How long a cancellation request stays meaningful.
_CANCEL_TTL_SECONDS = 900

#: Stored when a run is stopped before it produced any answer, so the
#: transcript still records that the turn happened.
_STOPPED_WITHOUT_ANSWER = "_Stopped before an answer was produced._"

#: Stored when a run exhausted its time budget without saying anything. Phrased
#: as something the user can act on, because retrying is usually the right move.
_TIMED_OUT_WITHOUT_ANSWER = (
    "The assistant ran out of time before it could answer. Please try again."
)

#: Ceiling on the page context recorded on a message. Well below the prompt's own
#: limit: this is stored per turn and read back with the whole transcript.
_RECORDED_CONTEXT_LIMIT = 4_000


@dataclass
class TurnRequest:
    """One unit of work: answer the latest message on a thread."""

    thread_uuid: str
    user_id: int
    run_id: str
    #: Assistant message row to fill in. Created before the run starts so a
    #: client that reconnects has something to attach to.
    assistant_message_uuid: str
    profile_key: str | None = None
    #: Concrete model to pin, overriding the profile's tier.
    model: str | None = None
    #: What the user had on screen when they asked. Supplied by the client,
    #: which is the only party that knows which tab is open, what is typed in
    #: the editor and which filters are applied.
    page_context: dict[str, Any] | None = None

    def to_payload(self) -> dict[str, Any]:
        """Serialise for the task broker."""
        return {
            "thread_uuid": self.thread_uuid,
            "user_id": self.user_id,
            "run_id": self.run_id,
            "assistant_message_uuid": self.assistant_message_uuid,
            "profile_key": self.profile_key,
            "model": self.model,
            "page_context": self.page_context,
        }

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> TurnRequest:
        """Rebuild from a broker payload."""
        return cls(**payload)


def new_run_id() -> str:
    """Identifier for one run, used as the event-stream key."""
    return str(uuid_module.uuid4())


#: Runs cancelled in this process.
#:
#: Held alongside the cache rather than instead of it. Superset's default cache
#: is a null cache, which accepts a write and discards it — so a cache-only
#: implementation would leave cancellation silently broken on a default install,
#: with the button appearing to work and nothing stopping. This set makes inline
#: execution correct with no cache at all; the cache is what carries a
#: cancellation across processes for worker execution.
_CANCELLED_LOCALLY: set[str] = set()


def _uses_worker_cancel_store() -> bool:
    """Whether cancellation must cross from a web process to a worker."""
    from flask import current_app, has_app_context

    return bool(
        has_app_context()
        and current_app.config.get("AI_ASSISTANT_EXECUTION_MODE") == "worker"
    )


def _cancel_store(worker_mode: bool) -> Any:
    """Use the required event-bus Redis connection in worker mode."""
    if worker_mode:
        from superset.ai.eventbus import get_event_bus_backend

        return get_event_bus_backend()

    from superset.extensions import cache_manager

    return cache_manager.cache


def request_cancel(run_id: str) -> None:
    """
    Ask a run to stop.

    Cooperative by design: the flag is recorded here and observed by the runtime
    between steps. A run blocked inside a single long model call or query will
    not notice until that call returns, which is a real limit worth documenting
    rather than hiding.
    """
    worker_mode = _uses_worker_cancel_store()
    if not worker_mode:
        _CANCELLED_LOCALLY.add(run_id)
    try:
        store = _cancel_store(worker_mode)
        if worker_mode:
            store.set(f"{_CANCEL_PREFIX}{run_id}", True, ex=_CANCEL_TTL_SECONDS)
        else:
            store.set(f"{_CANCEL_PREFIX}{run_id}", True, timeout=_CANCEL_TTL_SECONDS)
    except Exception:  # pylint: disable=broad-except
        logger.warning("Could not record cancellation for AI run %s", run_id)


def is_cancelled(run_id: str) -> bool:
    """Whether a stop has been requested for this run."""
    if run_id in _CANCELLED_LOCALLY:
        return True
    try:
        return bool(
            _cancel_store(_uses_worker_cancel_store()).get(f"{_CANCEL_PREFIX}{run_id}")
        )
    except Exception:  # pylint: disable=broad-except
        # A cache that cannot be read must not make every run appear cancelled;
        # that would stop all inference the moment the cache went away.
        return False


def clear_cancel(run_id: str) -> None:
    """Drop a run's cancellation flag."""
    _CANCELLED_LOCALLY.discard(run_id)
    try:
        _cancel_store(_uses_worker_cancel_store()).delete(f"{_CANCEL_PREFIX}{run_id}")
    except Exception:  # pylint: disable=broad-except
        logger.debug("Could not clear cancellation flag for AI run %s", run_id)


def stream_turn(request: TurnRequest) -> Iterator[StreamEvent]:
    """
    Answer a turn, yielding events as they happen.

    This is the primary entry point. Inline execution consumes it directly from
    inside the streaming response, which means the producer and the reader are
    the same process by construction — important because Superset runs several
    web workers, and a turn that published to one process's in-memory queue
    while the browser's stream landed on another would appear to hang forever.

    Never raises for an operational failure: a failure is an ``error`` event and
    an ``error`` message status, because the caller may already have flushed
    response headers or may be a worker with no one to report to.
    """
    recorder = start_run(
        run_id=request.run_id,
        thread_uuid=request.thread_uuid,
        user_id=request.user_id,
    )
    # Shared with ``_run`` so the ``finally`` below can see the runtime's
    # partial result and whether the message was already written.
    state: dict[str, Any] = {}
    try:
        # Bound here rather than inside ``_run`` so that a run which fails before
        # it has resolved a profile still produces a start and an end, and so
        # that the runtime can report its own spans without the runtime contract
        # growing a telemetry parameter.
        with bind_run(recorder):
            recorder.run_started()
            yield from _run(request, state)
    except Exception as ex:  # pylint: disable=broad-except
        logger.exception("AI turn failed for run %s", request.run_id)
        recorder.error(ex)
        recorder.run_ended(outcome=RunOutcome.ERROR)
        answer, extra = _partial_from_state(state)
        extra["outcome"] = RunOutcome.ERROR.value
        _finalise_message(
            request.assistant_message_uuid,
            # The generic text rather than the exception: this is persisted and
            # served back to the browser, so it must not carry internals. The
            # detail is in the log line above, keyed by run id.
            content=answer or GENERIC_ERROR_MESSAGE,
            status=MessageStatus.ERROR,
            extra=extra,
        )
        state["finalised"] = True
        yield error_event()
        yield done_event(ok=False)
    finally:
        clear_cancel(request.run_id)
        # A client that stops the run, or simply navigates away, abandons this
        # generator part-way through. Nothing above will have written the
        # message, so it would otherwise sit in ``streaming`` with no content
        # for ever — the user loses both the partial answer and any record that
        # the turn happened. Persist whatever was produced.
        _abandon_message(request.assistant_message_uuid, state)
        # Idempotent, so the ordinary paths above win.
        recorder.run_ended(outcome=RunOutcome.CANCELLED)


def execute_turn(request: TurnRequest) -> RunOutcome:
    """
    Answer a turn, publishing events to the event bus.

    Used by worker execution, where the reader is in another process. Shares its
    whole body with :func:`stream_turn` so the two execution modes cannot drift
    apart in behaviour.
    """
    from superset.ai.eventbus import get_event_bus

    bus = get_event_bus()
    outcome = RunOutcome.SUCCESS

    for event in stream_turn(request):
        bus.publish(request.run_id, event)
        if event.type is StreamEventType.ERROR:
            outcome = RunOutcome.ERROR
        elif event.type is StreamEventType.CANCELLED:
            outcome = RunOutcome.CANCELLED
        elif event.type is StreamEventType.DONE and not event.payload.get("ok"):
            # A run that ended un-ok without an explicit error frame timed out.
            if outcome is RunOutcome.SUCCESS:
                outcome = RunOutcome.TIMEOUT

    return outcome


def _run(request: TurnRequest, state: dict[str, Any]) -> Iterator[StreamEvent]:
    """Assemble and drive the run. See :func:`stream_turn` for error policy."""
    from superset.ai.factories import (
        get_profiles,
        get_provider,
        get_runtime,
        get_tools_for_profile,
    )
    from superset.ai.policy import load_policy_chain
    from superset.ai.runtime.base import RunRequest
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO

    recorder = current_run()

    thread = AIChatThreadDAO.find_by_uuid_for_user(request.thread_uuid, request.user_id)
    if thread is None:
        # The thread vanished between accepting the message and running it.
        recorder.run_ended(outcome=RunOutcome.ERROR)
        yield error_event("That conversation is no longer available.")
        yield done_event(ok=False)
        return

    profile = get_profiles().get(request.profile_key)
    tools = get_tools_for_profile(profile)
    provider = get_provider()
    runtime = get_runtime(provider)
    state["runtime"] = runtime

    yield session_event(request.thread_uuid, request.assistant_message_uuid)

    from superset.ai.page_context import render_page_context

    history = _build_history(AIChatMessageDAO.find_for_thread(thread))
    # Recorded as well as prompted with, so the transcript can show what the
    # assistant was told about the user's screen. An answer that looks wrong is
    # usually an answer to a different question than the reader assumed, and the
    # page context is where that difference lives.
    rendered_context = render_page_context(request.page_context)
    state["page_context"] = rendered_context
    system_prompt = _build_system_prompt(tools, rendered_context)
    model = _resolved_model(provider, request.model, profile)

    recorder.describe(
        agent_key=profile.key,
        model=model,
        question=_latest_question(history),
    )

    run_request = RunRequest(
        messages=history,
        system_prompt=system_prompt,
        tools=tools,
        policies=load_policy_chain(),
        model_alias=profile.model_alias,
        max_turns=profile.max_turns or _config("AI_AGENT_MAX_TURNS", 20),
        timeout_seconds=profile.timeout_seconds
        or _config("AI_AGENT_TIMEOUT_SECONDS", 300),
        should_cancel=lambda: is_cancelled(request.run_id),
    )

    _mark_streaming(request.assistant_message_uuid)

    # The runtime is async and this is a synchronous generator, so the async
    # events are drained into a list per batch rather than bridged with a
    # thread. Collecting the whole run before yielding would defeat streaming,
    # so the loop pulls one event at a time from a dedicated event loop.
    yield from _drain(runtime.run(run_request))

    result = runtime.result
    outcome = _outcome_of(result)
    if result.error is not None:
        # The only place the provider's own words are recorded. They do not go on
        # the message: that is served back to the browser, and a transport error
        # can name internal hosts.
        logger.warning(
            "AI run %s failed: %s",
            request.run_id,
            result.error,
        )
    _finalise_message(
        request.assistant_message_uuid,
        content=_terminal_content(result, outcome),
        status=_status_of(outcome),
        extra={
            "outcome": outcome.value,
            "agent_key": profile.key,
            "model": model,
            "tool_calls": result.tool_calls,
            "turns": result.turns,
            **_recorded_context(rendered_context),
        },
    )

    recorder.run_ended(
        outcome=outcome,
        turns=result.turns,
        answer=result.answer,
    )

    state["finalised"] = True

    if outcome is RunOutcome.CANCELLED:
        yield cancelled_event()
    yield done_event(ok=outcome is RunOutcome.SUCCESS)


def _drain(source: AsyncIterator[StreamEvent]) -> Iterator[StreamEvent]:
    """
    Pull an async iterator one item at a time from a synchronous caller.

    A single event loop is kept for the whole run and stepped with
    ``__anext__``, so each event reaches the client as it is produced rather
    than after the run completes.
    """
    loop = asyncio.new_event_loop()
    try:
        iterator = source.__aiter__()
        while True:
            try:
                yield loop.run_until_complete(iterator.__anext__())
            except StopAsyncIteration:
                return
    finally:
        loop.close()


def _build_history(messages: list[Any]) -> list[Message]:
    """
    Convert stored rows into provider messages, trimmed to the configured budget.

    Trimming is newest-first by count and then by total characters, because an
    old turn is less useful than a recent one and an oversized request is
    rejected outright by every provider.
    """
    max_messages = _config("AI_ASSISTANT_MAX_HISTORY_MESSAGES", 25)
    max_chars = _config("AI_ASSISTANT_MAX_HISTORY_CHARS", 100_000)

    usable = [
        message
        for message in messages
        if message.content and message.role != MessageRole.SYSTEM.value
    ]
    window = usable[-max_messages:]

    # Trimmed to the budget, but never to nothing: a single over-budget message
    # is still sent, because the provider's own error about it is more useful
    # than a request with no question in it.
    total = sum(len(message.content) for message in window)
    while len(window) > 1 and total > max_chars:
        dropped = window.pop(0)
        total -= len(dropped.content)

    return [
        Message(role=MessageRole(message.role), content=message.content)
        for message in window
    ]


def _latest_question(history: list[Message]) -> str | None:
    """
    The question this turn is answering.

    Offered to telemetry, which drops it unless a deployment has turned
    redaction off. ``None`` when the turn was somehow queued with no user
    message, which is a state worth being able to see rather than crash on.
    """
    for message in reversed(history):
        if message.role is MessageRole.USER and message.content:
            return message.content
    return None


def _build_system_prompt(tools: Any, rendered_context: str) -> str:
    """
    Assemble the system prompt for the tools actually on offer.

    The page context arrives already rendered, and is appended after assembly
    rather than joining the section list, because it is per-request data rather
    than a configured section — and because the layering rules deliberately
    refuse content from anywhere but ``superset.core`` in the prompt's own
    sections. Rendering happens in the caller so the same text can be recorded on
    the message without rendering it twice.
    """
    from flask import current_app

    from superset.ai.prompts import assemble_system_prompt
    from superset.ai.prompts.core import core_sections

    prompt = assemble_system_prompt(
        core_sections(),
        tool_names=list(tools.names()) if tools is not None else [],
        mutator=current_app.config.get("AI_SYSTEM_PROMPT_MUTATOR"),
    )
    if rendered_context:
        prompt = f"{prompt}\n\n{rendered_context}"
    return prompt


@transaction()
def _mark_streaming(message_uuid: str) -> None:
    """Move the placeholder assistant message into its in-flight state."""
    from superset.daos.ai import AIChatMessageDAO

    message = AIChatMessageDAO.find_one_or_none(uuid=uuid_module.UUID(message_uuid))
    if message is None:
        return
    message.status = MessageStatus.STREAMING.value


def _finalise_message(
    message_uuid: str,
    content: str,
    status: MessageStatus,
    extra: dict[str, Any],
) -> None:
    """
    Write the answer and outcome onto the assistant message.

    Committed even for a failed run, so the transcript records that a turn was
    attempted rather than leaving a message stuck in ``streaming`` forever.
    """
    try:
        _write_terminal_message(message_uuid, content, status, extra)
    except Exception:  # pylint: disable=broad-except
        # Reached from a ``finally`` block and from the failure path, so this must
        # not raise whatever the write does. The decorator has already rolled the
        # transaction back.
        logger.exception("Could not finalise AI message %s", message_uuid)


@transaction()
def _write_terminal_message(
    message_uuid: str,
    content: str,
    status: MessageStatus,
    extra: dict[str, Any],
) -> None:
    """The write half of :func:`_finalise_message`, as one unit of work."""
    from superset.daos.ai import AIChatMessageDAO

    message = AIChatMessageDAO.find_one_or_none(uuid=uuid_module.UUID(message_uuid))
    if message is None:
        return
    message.content = content
    message.status = status.value
    message.update_extra(extra)  # type: ignore[arg-type]


def _partial_from_state(state: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """
    Whatever the runtime produced before a run ended abnormally.

    Shared by the stop and failure paths so a transcript records the same detail
    either way: the answer so far, the reasoning, and the tool calls that ran.
    Reads defensively because a run can fail before it has a runtime at all.
    """
    runtime = state.get("runtime")
    result = getattr(runtime, "result", None)
    answer = (getattr(result, "answer", "") or "").strip()

    extra: dict[str, Any] = {}
    if thoughts := (getattr(result, "thoughts", "") or "").strip():
        extra["thoughts"] = thoughts
    if result is not None:
        extra["tool_calls"] = list(getattr(result, "tool_calls", []) or [])
        extra["turns"] = getattr(result, "turns", 0)
    extra.update(_recorded_context(state.get("page_context", "")))
    return answer, extra


def _recorded_context(rendered_context: str) -> dict[str, str]:
    """
    The page context as it goes onto the message, or nothing.

    Bounded well below the prompt's own ceiling: this is stored on every turn and
    read back with the transcript, and the value of showing it is knowing what
    the assistant was told, which the opening section already conveys.
    """
    if not rendered_context:
        return {}
    return {"page_context": rendered_context[:_RECORDED_CONTEXT_LIMIT]}


def _abandon_message(message_uuid: str, state: dict[str, Any]) -> None:
    """
    Record a run that was stopped before it finished.

    Reached when the user presses stop, closes the panel, or navigates away: the
    generator producing the turn is closed and no ordinary path has written the
    message. Without this the row stays non-terminal with no content, so the
    transcript loses both the partial answer and the fact that the turn ever
    happened — and the panel shows a spinner that never resolves on reload.

    Whatever the runtime produced is kept. A user who stops a long answer
    half-way through still wants the half they read.
    """
    if state.get("finalised"):
        return

    answer, extra = _partial_from_state(state)
    extra["outcome"] = RunOutcome.CANCELLED.value

    _finalise_message(
        message_uuid,
        content=answer or _STOPPED_WITHOUT_ANSWER,
        status=MessageStatus.CANCELLED,
        extra=extra,
    )
    state["finalised"] = True


def _terminal_content(result: Any, outcome: RunOutcome) -> str:
    """
    What to store as the assistant's turn.

    A run that ends without producing text would otherwise be stored empty, and
    the transcript then shows a blank bubble on reload: the user saw an error
    while it happened, and nothing was kept. This is the common case for a
    provider that cannot be reached — the runtime catches that internally and
    reports it on the result, so it never reaches the failure handler in
    :func:`stream_turn`.

    The stored text is what the user was already shown, not ``result.error``.
    The message is served straight back to the browser on the next read, so it
    must not carry provider internals; the detail is logged by the caller.
    """
    if answer := (result.answer or "").strip():
        return answer
    if outcome is RunOutcome.SUCCESS:
        # Nothing went wrong and nothing was said. Rare, and inventing an error
        # for it would be a lie.
        return ""
    if outcome is RunOutcome.CANCELLED:
        return _STOPPED_WITHOUT_ANSWER
    if outcome is RunOutcome.TIMEOUT:
        return _TIMED_OUT_WITHOUT_ANSWER
    return GENERIC_ERROR_MESSAGE


def _outcome_of(result: Any) -> RunOutcome:
    """Classify a finished run."""
    if result.cancelled:
        return RunOutcome.CANCELLED
    if result.timed_out:
        return RunOutcome.TIMEOUT
    if result.error is not None:
        return RunOutcome.ERROR
    return RunOutcome.SUCCESS


#: Terminal message status for each outcome. A timeout is recorded as complete
#: because the partial answer it produced is real and worth keeping; the
#: ``outcome`` key in the message's extra carries the nuance, and the stream's
#: ``done`` frame still reports failure.
_TERMINAL_STATUS: dict[RunOutcome, MessageStatus] = {
    RunOutcome.SUCCESS: MessageStatus.COMPLETE,
    RunOutcome.TIMEOUT: MessageStatus.COMPLETE,
    RunOutcome.CANCELLED: MessageStatus.CANCELLED,
    RunOutcome.ERROR: MessageStatus.ERROR,
}


def _status_of(outcome: RunOutcome) -> MessageStatus:
    """Terminal message status for an outcome."""
    return _TERMINAL_STATUS[outcome]


def _resolved_model(provider: Any, pinned: str | None, profile: Any) -> str:
    """
    Which model the run used, for the audit trail.

    Best-effort: a provider that cannot resolve the tier has already failed the
    run, and a missing model name should not also break the record of it.
    """
    if pinned:
        return pinned
    try:
        return str(provider.resolve_model(profile.model_alias))
    except Exception:  # pylint: disable=broad-except
        return ""


def _config(key: str, default: Any) -> Any:
    """Read a config value, tolerating its absence."""
    from flask import current_app

    return current_app.config.get(key, default)
