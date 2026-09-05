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
"""Tests for turn orchestration: history trimming, outcomes, cancellation."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture


def _stored(role: str, content: str) -> SimpleNamespace:
    """A stand-in for a persisted message row."""
    return SimpleNamespace(role=role, content=content)


def test_turn_request_round_trips_through_a_broker_payload() -> None:
    """
    A queued turn survives serialisation intact.

    Worker execution hands this dict to Celery, so a field that does not
    round-trip is a turn that runs with the wrong parameters.
    """
    from superset.ai.orchestrator import TurnRequest

    original = TurnRequest(
        thread_uuid="t-1",
        user_id=7,
        run_id="r-1",
        assistant_message_uuid="m-1",
        profile_key="analyst",
        model="some-model",
    )
    restored = TurnRequest.from_payload(original.to_payload())
    assert restored == original


def test_new_run_id_is_unique() -> None:
    """Two runs never share a stream key."""
    from superset.ai.orchestrator import new_run_id

    assert new_run_id() != new_run_id()


def test_history_excludes_empty_and_system_messages(app_context: None) -> None:
    """
    Only real conversational turns are replayed to the model.

    A placeholder assistant row exists before its run produces anything, and
    sending it as an empty turn would confuse the model about whose turn it is.
    """
    from superset.ai.orchestrator import _build_history

    history = _build_history(
        [
            _stored("user", "first"),
            _stored("assistant", ""),
            _stored("system", "page context"),
            _stored("assistant", "second"),
        ]
    )
    assert [(m.role.value, m.content) for m in history] == [
        ("user", "first"),
        ("assistant", "second"),
    ]


def test_history_keeps_only_the_most_recent_messages(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """The count budget drops the oldest turns first."""
    from flask import current_app

    from superset.ai.orchestrator import _build_history

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_MAX_HISTORY_MESSAGES": 3})
    history = _build_history([_stored("user", str(index)) for index in range(10)])
    assert [m.content for m in history] == ["7", "8", "9"]


def test_history_respects_the_character_budget(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    An oversized conversation is trimmed oldest-first.

    Providers reject a request over their context limit outright, so trimming
    here is what keeps a long conversation usable rather than fatal.
    """
    from flask import current_app

    from superset.ai.orchestrator import _build_history

    mocker.patch.dict(
        current_app.config,
        {
            "AI_ASSISTANT_MAX_HISTORY_MESSAGES": 100,
            "AI_ASSISTANT_MAX_HISTORY_CHARS": 25,
        },
    )
    history = _build_history([_stored("user", "x" * 10) for _ in range(10)])
    assert len(history) == 2
    assert sum(len(m.content) for m in history) <= 25


def test_history_never_trims_below_one_message(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    A single over-budget message is still sent.

    Dropping it would leave nothing to answer; the provider's own error is more
    informative than an empty request.
    """
    from flask import current_app

    from superset.ai.orchestrator import _build_history

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_MAX_HISTORY_CHARS": 5})
    history = _build_history([_stored("user", "x" * 500)])
    assert len(history) == 1


@pytest.mark.parametrize(
    ("result", "expected"),
    [
        (SimpleNamespace(cancelled=False, timed_out=False, error=None), "success"),
        (SimpleNamespace(cancelled=True, timed_out=False, error=None), "cancelled"),
        (SimpleNamespace(cancelled=False, timed_out=True, error=None), "timeout"),
        (SimpleNamespace(cancelled=False, timed_out=False, error="x"), "error"),
        # Cancellation wins over a concurrent timeout: the user's intent is the
        # more useful thing to record.
        (SimpleNamespace(cancelled=True, timed_out=True, error="x"), "cancelled"),
    ],
)
def test_outcome_classification(result: Any, expected: str) -> None:
    """A finished run is classified from its flags."""
    from superset.ai.orchestrator import _outcome_of

    assert _outcome_of(result).value == expected


def test_every_outcome_maps_to_a_terminal_status() -> None:
    """
    No outcome leaves a message stuck in a non-terminal state.

    A message left as ``streaming`` forever would show the user a spinner that
    never resolves, on every subsequent page load.
    """
    from superset.ai.orchestrator import _status_of
    from superset.ai.types import MessageStatus, RunOutcome

    terminal = MessageStatus.terminal()
    for outcome in RunOutcome:
        assert _status_of(outcome) in terminal


def test_timeout_keeps_its_partial_answer() -> None:
    """
    A timed-out run is recorded as complete, not failed.

    It produced a real partial answer worth keeping; the nuance lives in the
    message's ``outcome`` and in the stream's ``done`` frame.
    """
    from superset.ai.orchestrator import _status_of
    from superset.ai.types import MessageStatus, RunOutcome

    assert _status_of(RunOutcome.TIMEOUT) is MessageStatus.COMPLETE
    assert _status_of(RunOutcome.ERROR) is MessageStatus.ERROR
    assert _status_of(RunOutcome.CANCELLED) is MessageStatus.CANCELLED


def test_cancellation_flag_round_trip(app_context: None) -> None:
    """A requested cancellation is observable, and clearable."""
    from superset.ai.orchestrator import clear_cancel, is_cancelled, request_cancel

    run_id = "run-cancel-1"
    assert is_cancelled(run_id) is False
    request_cancel(run_id)
    assert is_cancelled(run_id) is True
    clear_cancel(run_id)
    assert is_cancelled(run_id) is False


def test_cancellation_is_per_run(app_context: None) -> None:
    """Cancelling one run does not stop another."""
    from superset.ai.orchestrator import is_cancelled, request_cancel

    request_cancel("run-a")
    assert is_cancelled("run-a") is True
    assert is_cancelled("run-b") is False


def test_cancellation_works_without_a_usable_cache(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    Cancellation does not depend on the cache being real.

    Superset's default cache accepts a write and discards it, so a cache-only
    implementation would leave the cancel button appearing to work while nothing
    stopped. The in-process record is what makes inline execution correct on a
    default install.
    """
    from superset.ai import orchestrator

    cache = mocker.patch("superset.extensions.cache_manager")
    cache.cache.set.return_value = None
    cache.cache.get.return_value = None

    run_id = "run-no-cache"
    orchestrator.request_cancel(run_id)
    assert orchestrator.is_cancelled(run_id) is True
    orchestrator.clear_cancel(run_id)
    assert orchestrator.is_cancelled(run_id) is False


def test_worker_cancellation_uses_the_event_bus_redis(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """The web request and Celery worker observe the same cancellation flag."""
    from flask import current_app

    from superset.ai import orchestrator

    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "worker"})
    backend = mocker.Mock()
    mocker.patch("superset.ai.eventbus.get_event_bus_backend", return_value=backend)

    run_id = "run-worker-cancel"
    orchestrator.request_cancel(run_id)

    backend.set.assert_called_once_with("ai-cancel-run-worker-cancel", True, ex=900)
    assert run_id not in orchestrator._CANCELLED_LOCALLY

    backend.get.return_value = b"1"
    assert orchestrator.is_cancelled(run_id) is True

    orchestrator.clear_cancel(run_id)
    backend.delete.assert_called_once_with("ai-cancel-run-worker-cancel")


def test_unreadable_cache_reports_not_cancelled(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    A broken cache must not make every run appear cancelled.

    Treating a cache failure as "cancelled" would silently stop all inference
    the moment the cache went away.
    """
    from superset.ai import orchestrator

    cache = mocker.patch("superset.extensions.cache_manager")
    cache.cache.get.side_effect = RuntimeError("cache down")
    assert orchestrator.is_cancelled("run-never-cancelled") is False


def test_failed_cancellation_write_does_not_raise(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A cache failure while cancelling is logged, not surfaced."""
    from superset.ai.orchestrator import request_cancel

    cache = mocker.patch("superset.extensions.cache_manager")
    cache.cache.set.side_effect = RuntimeError("cache down")
    request_cancel("run-y")  # must not raise


def test_a_failed_turn_persists_the_message_the_user_was_shown(
    mocker: MockerFixture,
) -> None:
    """
    An unexpected failure leaves a readable message behind, not an empty row.

    The panel already shows the generic apology, but the row was written with
    empty content — so reloading the conversation lost both the answer and the
    fact that the turn had happened, leaving a blank assistant bubble.
    """
    from superset.ai.events import GENERIC_ERROR_MESSAGE
    from superset.ai.orchestrator import stream_turn, TurnRequest
    from superset.ai.types import MessageStatus, StreamEventType

    finalise = mocker.patch("superset.ai.orchestrator._finalise_message")
    mocker.patch(
        "superset.ai.orchestrator._run",
        side_effect=RuntimeError("the gateway returned nonsense"),
    )

    events = list(
        stream_turn(
            TurnRequest(
                thread_uuid="t-1",
                user_id=7,
                run_id="r-1",
                assistant_message_uuid="m-1",
            )
        )
    )

    assert [event.type for event in events] == [
        StreamEventType.ERROR,
        StreamEventType.DONE,
    ]
    finalise.assert_called_once()
    _, kwargs = finalise.call_args
    assert kwargs["content"] == GENERIC_ERROR_MESSAGE
    assert kwargs["status"] is MessageStatus.ERROR


def test_a_failed_turn_does_not_persist_the_exception(
    mocker: MockerFixture,
) -> None:
    """
    The stored message must not carry internals.

    It is served straight back to the browser on the next read, so a provider's
    exception text there would be a disclosure to every reader of the thread.
    """
    from superset.ai.orchestrator import stream_turn, TurnRequest

    leaky = "postgresql://user:hunter2@db-host.example/db"  # noqa: S105
    finalise = mocker.patch("superset.ai.orchestrator._finalise_message")
    mocker.patch("superset.ai.orchestrator._run", side_effect=RuntimeError(leaky))

    list(
        stream_turn(
            TurnRequest(
                thread_uuid="t-1",
                user_id=7,
                run_id="r-1",
                assistant_message_uuid="m-1",
            )
        )
    )

    _, kwargs = finalise.call_args
    assert leaky not in kwargs["content"]
    assert leaky not in str(kwargs["extra"])


def test_a_failed_turn_keeps_the_partial_answer_it_had_produced(
    mocker: MockerFixture,
) -> None:
    """
    Work already done survives a failure.

    A run that answered two of three questions before the provider fell over
    should not throw the two away.
    """
    from superset.ai.orchestrator import stream_turn, TurnRequest

    finalise = mocker.patch("superset.ai.orchestrator._finalise_message")

    def fail_after_partial(request: Any, state: dict[str, Any]) -> Any:
        state["runtime"] = SimpleNamespace(
            result=SimpleNamespace(
                answer="Revenue was 41,000.",
                thoughts="Checked the orders table.",
                tool_calls=[{"name": "execute_sql", "ok": True}],
                turns=2,
            )
        )
        raise RuntimeError("provider hung up")
        yield  # pragma: no cover - makes this a generator

    mocker.patch("superset.ai.orchestrator._run", fail_after_partial)

    list(
        stream_turn(
            TurnRequest(
                thread_uuid="t-1",
                user_id=7,
                run_id="r-1",
                assistant_message_uuid="m-1",
            )
        )
    )

    _, kwargs = finalise.call_args
    assert kwargs["content"] == "Revenue was 41,000."
    assert kwargs["extra"]["thoughts"] == "Checked the orders table."
    assert kwargs["extra"]["tool_calls"] == [{"name": "execute_sql", "ok": True}]


def test_recorded_page_context_is_bounded() -> None:
    """
    What is stored per turn has its own ceiling.

    It is read back with the whole transcript, so the prompt's much larger limit
    is the wrong one to apply here.
    """
    from superset.ai.orchestrator import _recorded_context, _RECORDED_CONTEXT_LIMIT

    assert _recorded_context("") == {}
    recorded = _recorded_context("x" * (_RECORDED_CONTEXT_LIMIT + 500))
    assert len(recorded["page_context"]) == _RECORDED_CONTEXT_LIMIT


def test_an_unreachable_provider_is_recorded_on_the_message(
    mocker: MockerFixture,
) -> None:
    """
    A provider that cannot be reached leaves a readable message behind.

    This is the common failure and it took the *other* path: the runtime catches a
    transport error itself and reports it on the result, so the failure handler in
    ``stream_turn`` never runs and the message was stored with empty content. The
    user saw an error while it happened and then found a blank bubble on reload.
    """
    from superset.ai.events import GENERIC_ERROR_MESSAGE
    from superset.ai.orchestrator import _terminal_content
    from superset.ai.types import RunOutcome

    failed = SimpleNamespace(
        answer="",
        error="Connection refused: model-host.example:443",
        cancelled=False,
        timed_out=False,
    )
    assert _terminal_content(failed, RunOutcome.ERROR) == GENERIC_ERROR_MESSAGE


def test_the_stored_message_never_carries_the_provider_error(
    mocker: MockerFixture,
) -> None:
    """
    The detail stays in the log.

    The stored message is served straight back to the browser on the next read,
    and a transport error names internal hosts.
    """
    from superset.ai.orchestrator import _terminal_content
    from superset.ai.types import RunOutcome

    leaky = "model-host.example:443 rejected token not-a-real-key"  # noqa: S105
    failed = SimpleNamespace(answer="", error=leaky, cancelled=False, timed_out=False)
    assert leaky not in _terminal_content(failed, RunOutcome.ERROR)


def test_a_partial_answer_outranks_the_error_text(mocker: MockerFixture) -> None:
    """What the assistant managed to say is worth more than an apology."""
    from superset.ai.orchestrator import _terminal_content
    from superset.ai.types import RunOutcome

    partial = SimpleNamespace(
        answer="Revenue was 41,000 last week.",
        error="stream closed early",
        cancelled=False,
        timed_out=False,
    )
    assert (
        _terminal_content(partial, RunOutcome.ERROR) == "Revenue was 41,000 last week."
    )


def test_a_timeout_without_an_answer_says_so() -> None:
    """A run that ran out of time is distinguishable from one that broke."""
    from superset.ai.orchestrator import _terminal_content, _TIMED_OUT_WITHOUT_ANSWER
    from superset.ai.types import RunOutcome

    timed_out = SimpleNamespace(answer="", error=None, cancelled=False, timed_out=True)
    assert _terminal_content(timed_out, RunOutcome.TIMEOUT) == _TIMED_OUT_WITHOUT_ANSWER


def test_a_silent_success_is_not_given_an_invented_error() -> None:
    """Nothing went wrong, so nothing claims it did."""
    from superset.ai.orchestrator import _terminal_content
    from superset.ai.types import RunOutcome

    quiet = SimpleNamespace(answer="", error=None, cancelled=False, timed_out=False)
    assert _terminal_content(quiet, RunOutcome.SUCCESS) == ""
