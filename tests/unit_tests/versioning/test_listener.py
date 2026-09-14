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
"""Tests for version-change listener transaction lifecycle behavior."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session, sessionmaker

from superset.versioning.changes import listener
from superset.versioning.diff import ChangeRecord

Base: Any = sa.orm.declarative_base()


class LifecycleRow(Base):
    """Minimal row used to characterize SQLAlchemy session events."""

    __tablename__ = "versioning_listener_lifecycle"

    id = sa.Column(sa.Integer, primary_key=True)
    value = sa.Column(sa.String, nullable=False)


@pytest.fixture
def lifecycle_session() -> Iterator[Session]:
    """Yield an isolated SQLAlchemy session backed by in-memory SQLite."""
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_before_commit_can_force_final_flush_without_reentry(
    lifecycle_session: Session,
) -> None:
    """A before-commit finalizer can flush once before commit preparation."""
    events: list[str] = []

    @sa.event.listens_for(lifecycle_session, "before_flush")
    def before_flush(
        _session: Session, _flush_context: object, _instances: object
    ) -> None:
        events.append("before_flush")

    @sa.event.listens_for(lifecycle_session, "after_flush")
    def after_flush(_session: Session, _flush_context: object) -> None:
        events.append("after_flush")

    @sa.event.listens_for(lifecycle_session, "before_commit")
    def before_commit(session: Session) -> None:
        events.append("before_commit:start")
        session.flush()
        events.append("before_commit:end")

    lifecycle_session.add(LifecycleRow(value="saved"))
    lifecycle_session.commit()

    assert events == [
        "before_commit:start",
        "before_flush",
        "after_flush",
        "before_commit:end",
    ]


def test_before_commit_with_no_work_does_not_flush(
    lifecycle_session: Session,
) -> None:
    """A no-work commit invokes the finalizer without a flush cycle."""
    events: list[str] = []

    @sa.event.listens_for(lifecycle_session, "before_flush")
    def before_flush(
        _session: Session, _flush_context: object, _instances: object
    ) -> None:
        events.append("before_flush")

    @sa.event.listens_for(lifecycle_session, "before_commit")
    def before_commit(session: Session) -> None:
        events.append("before_commit")
        session.flush()

    lifecycle_session.commit()

    assert events == ["before_commit"]


def test_rollback_event_can_clear_transaction_state(
    lifecycle_session: Session,
) -> None:
    """Rollback cleanup runs while session-scoped state is still accessible."""
    state_key = "_versioning_test_state"
    lifecycle_session.info[state_key] = {"pending": True}

    @sa.event.listens_for(lifecycle_session, "after_rollback")
    def after_rollback(session: Session) -> None:
        session.info.pop(state_key, None)

    lifecycle_session.add(LifecycleRow(value="rolled back"))
    lifecycle_session.flush()
    lifecycle_session.rollback()

    assert state_key not in lifecycle_session.info


def test_capture_retains_the_first_pre_flush_state(
    lifecycle_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Repeated flushes retain the entity's initial database state once."""

    class Slice:
        id = 7

    entity = Slice()
    initial = {"slice_name": "initial"}
    captures: list[object] = []

    def capture(_session: Session, obj: object) -> dict[str, str]:
        captures.append(obj)
        return initial

    monkeypatch.setattr(listener, "capture_initial_state", capture)
    states: dict[tuple[str, int], tuple[object, dict[str, object]]] = {}

    listener._capture_dirty_entity_initial_state(lifecycle_session, entity, states)
    listener._capture_dirty_entity_initial_state(lifecycle_session, entity, states)

    assert states == {("chart", 7): (entity, initial)}
    assert captures == [entity]


def test_scalar_buffer_materializes_one_final_net_diff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Final materialization diffs each retained entity exactly once."""
    entity = object()
    initial = {"slice_name": "initial"}
    record = ChangeRecord(
        kind="property",
        operation="edit",
        path=["slice_name"],
        from_value="initial",
        to_value="final",
    )
    calls: list[tuple[object, dict[str, object]]] = []

    def compute(obj: object, pre_state: dict[str, object]) -> list[ChangeRecord]:
        calls.append((obj, pre_state))
        return [record]

    monkeypatch.setattr(listener, "compute_records_from_state", compute)

    buffer = listener._build_scalar_buffer({("chart", 7): (entity, initial)})

    assert buffer == {("chart", 7): [record]}
    assert calls == [(entity, initial)]


@pytest.mark.parametrize("terminal_event", ["commit", "rollback"])
def test_terminal_event_clears_transaction_state(
    lifecycle_session: Session, terminal_event: str
) -> None:
    """Commit and rollback cleanup discard all transaction-scoped state."""
    lifecycle_session.info.update(
        {
            listener.ACTION_KIND_KEY: "restore",
            listener.ACTION_META_KEY: {"headline": "restored"},
            listener._INITIAL_STATES_KEY: {("chart", 7): object()},
            listener._FINALIZING_KEY: True,
            listener.NORMALIZATION_CONTEXT_KEY: {"pending": True},
            "unrelated": "preserved",
        }
    )
    sa.event.listen(
        lifecycle_session,
        "after_transaction_end",
        listener._reset_after_outer_transaction,
    )
    lifecycle_session.add(LifecycleRow(value=terminal_event))
    lifecycle_session.flush()

    getattr(lifecycle_session, terminal_event)()

    assert lifecycle_session.info == {"unrelated": "preserved"}


def test_missing_table_stays_silent_during_persist(
    lifecycle_session: Session,
    mocker: Any,
) -> None:
    """The pre-migration race (version_changes not yet created) is the one
    benign persist failure; it must produce neither a log line nor a
    capture-error metric."""
    mocker.patch.object(
        listener,
        "bulk_insert_records",
        side_effect=sa.exc.OperationalError(
            "INSERT", {}, Exception("no such table: version_changes")
        ),
    )
    log_spy = mocker.patch.object(listener.logger, "exception")
    metric_spy = mocker.patch.object(listener, "incr_capture_error")

    listener._persist_buffered_records(lifecycle_session, tx_id=1, buffer={})

    log_spy.assert_not_called()
    metric_spy.assert_not_called()


def test_transient_persist_failure_is_logged_and_counted(
    lifecycle_session: Session,
    mocker: Any,
) -> None:
    """A deadlock (or any operational failure that is not the missing-table
    race) drops the save's change records; swallowing it under the
    missing-table branch made that loss invisible — no log, no metric,
    while the user's save reported success."""
    mocker.patch.object(
        listener,
        "bulk_insert_records",
        side_effect=sa.exc.OperationalError(
            "INSERT", {}, Exception("database is locked")
        ),
    )
    log_spy = mocker.patch.object(listener.logger, "exception")
    metric_spy = mocker.patch.object(listener, "incr_capture_error")

    listener._persist_buffered_records(lifecycle_session, tx_id=1, buffer={})

    log_spy.assert_called_once()
    metric_spy.assert_called_once_with("bulk_insert")


def test_capture_latency_metric_fires_on_commit(
    lifecycle_session: Session, mocker: Any
) -> None:
    """The finalizer emits the write-path latency series on every save-path
    commit — the kill-switch's own decision signal, measuring capture
    overhead only (the timer starts after the transaction's own flush).
    Driven through the real module-level finalizer on an isolated session
    (no versioning tables needed: the tx-id early return still passes the
    timing's ``finally``)."""
    sa.event.listen(
        lifecycle_session, "before_commit", listener.finalize_change_records
    )
    manager = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    lifecycle_session.add(LifecycleRow(value="timed"))
    lifecycle_session.commit()

    calls = [
        call
        for call in manager.instance.timing.call_args_list
        if call.args[0] == "superset.versioning.capture.finalize.latency"
    ]
    assert len(calls) == 1
    duration_ms = calls[0].args[1]
    assert isinstance(duration_ms, float)
    assert duration_ms >= 0


def test_capture_latency_metric_skips_reentrant_finalize(
    lifecycle_session: Session, mocker: Any
) -> None:
    """The reentrancy guard returns before the timer starts: a re-entered
    finalize must not dilute the latency series with instant zero
    samples."""
    manager = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    lifecycle_session.info[listener._FINALIZING_KEY] = True
    listener.finalize_change_records(lifecycle_session)

    manager.instance.timing.assert_not_called()


def test_capture_latency_metric_skips_nested_transaction(
    lifecycle_session: Session, mocker: Any
) -> None:
    """The other arm of the same guard: a nested transaction emits no
    sample either."""
    manager = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    lifecycle_session.add(LifecycleRow(value="outer"))
    lifecycle_session.flush()
    with lifecycle_session.begin_nested():
        listener.finalize_change_records(lifecycle_session)

    manager.instance.timing.assert_not_called()


def test_capture_latency_metric_emits_nothing_when_flush_fails(
    mocker: Any,
) -> None:
    """A flush that raises is the user's own failing write, not capture
    cost: the exception propagates and no sample lands in the series."""
    manager = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    session = MagicMock()
    session.info = {}
    session.in_nested_transaction.return_value = False
    session.flush.side_effect = RuntimeError("constraint violation")

    with pytest.raises(RuntimeError):
        listener.finalize_change_records(session)

    manager.instance.timing.assert_not_called()


def test_emit_capture_timing_is_fail_open(mocker: Any) -> None:
    """A broken stats backend must never break a user's save (the same
    posture as incr_capture_error), and the swallow stays visible in the
    logs rather than silent."""
    from superset.versioning import metrics

    manager = MagicMock()
    manager.instance.timing.side_effect = RuntimeError("statsd down")
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    warning_spy = mocker.patch.object(metrics.logger, "warning")
    exception_spy = mocker.patch.object(metrics.logger, "exception")

    metrics.emit_capture_timing("finalize", 1.0)  # must not raise

    # One warning line, no traceback: this runs on EVERY commit, so a
    # structurally broken backend must not log a full stack per commit.
    warning_spy.assert_called_once()
    exception_spy.assert_not_called()


def test_capture_latency_metric_fires_once_on_the_versioned_write_path(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The metric covers the REAL capture path, not just the no-op early
    return: with a versioned entity's initial state retained (non-empty
    buffer) and a transaction id resolved, finalize runs through stamping,
    child-record collection, and persistence, and emits exactly one
    ``finalize.latency`` sample for it (fitzee review on #44009)."""
    sa.event.listen(
        lifecycle_session, "before_commit", listener.finalize_change_records
    )
    manager = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)

    record = ChangeRecord(
        kind="property",
        operation="edit",
        path=["slice_name"],
        from_value="initial",
        to_value="final",
    )
    monkeypatch.setattr(
        listener, "compute_records_from_state", lambda obj, pre: [record]
    )
    monkeypatch.setattr(listener, "_current_transaction_id", lambda session: 42)
    monkeypatch.setattr(
        listener, "_stamp_action_kind_on_transaction", lambda session, tx: None
    )
    monkeypatch.setattr(
        listener, "_append_child_records_to_buffer", lambda session, tx, buf: None
    )
    monkeypatch.setattr(
        listener, "_inject_action_meta_record", lambda session, buf: None
    )
    persisted: list[tuple[int, dict[Any, Any]]] = []
    monkeypatch.setattr(
        listener,
        "_persist_buffered_records",
        lambda session, tx, buf: persisted.append((tx, dict(buf))),
    )
    # A retained pre-flush state for one versioned entity -> non-empty buffer.
    lifecycle_session.info[listener._INITIAL_STATES_KEY] = {
        ("chart", 7): (object(), {"slice_name": "initial"})
    }

    lifecycle_session.add(LifecycleRow(value="versioned"))
    lifecycle_session.commit()

    # The real path ran: records reached persistence for tx 42.
    assert persisted == [(42, {("chart", 7): [record]})]
    calls = [
        call
        for call in manager.instance.timing.call_args_list
        if call.args[0] == "superset.versioning.capture.finalize.latency"
    ]
    assert len(calls) == 1
    assert calls[0].args[1] >= 0


def test_transaction_lookup_failure_does_not_break_the_commit(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The module's invariant — a versioning bug must never break a user's
    save — holds at ``_current_transaction_id`` too. With the lookup raising
    (a dropped connection, a Continuum internal error), the commit still
    succeeds and the user's row is persisted; the failure is counted, not
    propagated (fitzee finding on #44009, confirmed by aminghadersohi's probe:
    before this guard the RuntimeError unwound out of before_commit and 0 rows
    persisted)."""
    sa.event.listen(
        lifecycle_session, "before_commit", listener.finalize_change_records
    )
    mocker.patch("superset.extensions.stats_logger_manager", MagicMock())
    error_spy = mocker.patch.object(listener, "incr_capture_error")

    def explode(session: Session) -> int:
        raise RuntimeError("continuum uow lookup failed")

    monkeypatch.setattr(listener, "_current_transaction_id", explode)

    lifecycle_session.add(LifecycleRow(value="survives"))
    lifecycle_session.commit()  # must not raise

    assert (
        lifecycle_session.query(LifecycleRow).filter_by(value="survives").count() == 1
    )
    error_spy.assert_called_once_with("transaction_lookup")


def test_capture_initial_states_stage_is_timed_only_when_an_entity_is_captured(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The before-flush stage — the per-entity pre-state reads that scale with
    dirty versioned entities and sit outside finalize's timer — emits its own
    ``capture_initial_states.latency`` sample, but only when at least one
    versioned entity was captured, so unrelated autoflushes do not flood the
    series (fitzee review on #44009)."""
    manager = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    monkeypatch.setattr(
        listener, "capture_initial_state", lambda session, obj: {"slice_name": "x"}
    )

    def timing_calls() -> list[Any]:
        return [
            call
            for call in manager.instance.timing.call_args_list
            if call.args[0]
            == "superset.versioning.capture.capture_initial_states.latency"
        ]

    class Slice:  # the class NAME maps to the 'chart' entity kind
        id = 7

    # Nothing versioned dirty -> no sample.
    lifecycle_session.add(LifecycleRow(value="unrelated"))
    lifecycle_session.flush()
    listener._capture_initial_states(lifecycle_session, (Slice,))
    assert timing_calls() == []

    # A dirty versioned entity -> exactly one sample, and its state retained.
    entity = Slice()
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: {entity}),
    )
    listener._capture_initial_states(lifecycle_session, (Slice,))
    assert len(timing_calls()) == 1
    assert timing_calls()[0].args[1] >= 0
    assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {
        ("chart", 7): (entity, {"slice_name": "x"})
    }

    # A later flush of the SAME entity is a candidate but not a capture (its
    # state is already retained, no SELECT is issued): it must not emit a
    # near-zero sample that would dilute the percentiles the series is
    # alerted on (aminghadersohi's probe: 4 flushes, 1 SELECT, 4 samples).
    listener._capture_initial_states(lifecycle_session, (Slice,))
    listener._capture_initial_states(lifecycle_session, (Slice,))
    assert len(timing_calls()) == 1


def test_initial_state_capture_failure_does_not_break_the_flush(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A raise in the per-entity pre-state capture is logged and counted, not
    propagated out of ``before_flush`` — the twin of the transaction-lookup
    guard in finalize, under the same "never break a user's save" invariant
    (aminghadersohi probed the unguarded form failing the save)."""
    mocker.patch("superset.extensions.stats_logger_manager", MagicMock())
    error_spy = mocker.patch.object(listener, "incr_capture_error")

    def explode(session: Session, obj: object) -> dict[str, str]:
        raise RuntimeError("pre-state SELECT failed")

    monkeypatch.setattr(listener, "capture_initial_state", explode)

    class Slice:  # the class NAME maps to the 'chart' entity kind
        id = 7

    entity = Slice()
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: {entity}),
    )

    listener._capture_initial_states(lifecycle_session, (Slice,))  # must not raise

    error_spy.assert_called_once_with("capture_initial_states")
    assert lifecycle_session.info.get(listener._INITIAL_STATES_KEY, {}) == {}
