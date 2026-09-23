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
from contextvars import Context
from typing import Any
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from flask import has_app_context
from sqlalchemy.orm import Session, sessionmaker

from superset.versioning.changes import listener
from superset.versioning.diff import ChangeRecord
from superset.versioning.unit_of_work import CaptureUnitOfWork


@pytest.mark.parametrize(
    "operation, declared, expected",
    [
        (0, None, "create"),
        (1, None, None),
        (2, None, None),
        (0, "import", "import"),
        (0, "clone", "clone"),
        (0, "restore", "restore"),
    ],
)
def test_transaction_provenance_uses_actual_insert_shadows(
    lifecycle_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    operation: int,
    declared: str | None,
    expected: str | None,
) -> None:
    """Only real inserts get a fallback stamp; command provenance wins."""
    from types import SimpleNamespace

    from sqlalchemy_continuum import versioning_manager

    metadata: sa.MetaData = sa.MetaData()
    transactions: sa.Table = sa.Table(
        "provenance_transactions",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("action_kind", sa.String(32)),
    )
    shadows: sa.Table = sa.Table(
        "provenance_shadows",
        metadata,
        sa.Column("transaction_id", sa.Integer),
        sa.Column("operation_type", sa.Integer),
    )
    metadata.create_all(lifecycle_session.connection())
    lifecycle_session.execute(transactions.insert().values(id=1))
    lifecycle_session.execute(
        shadows.insert().values(transaction_id=1, operation_type=operation)
    )
    monkeypatch.setattr(
        versioning_manager, "transaction_cls", SimpleNamespace(__table__=transactions)
    )
    if declared is not None:
        lifecycle_session.info[listener.ACTION_KIND_KEY] = declared
    listener._stamp_action_kind_on_transaction(lifecycle_session, 1, (shadows,))
    assert lifecycle_session.scalar(sa.select(transactions.c.action_kind)) == expected
    assert listener.ACTION_KIND_KEY not in lifecycle_session.info


Base: Any = sa.orm.declarative_base()


def test_provenance_lookup_failure_preserves_the_user_transaction(
    lifecycle_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed provenance SELECT rolls back its savepoint, not the save."""
    from types import SimpleNamespace
    from unittest.mock import Mock

    from sqlalchemy_continuum import versioning_manager

    metadata: sa.MetaData = sa.MetaData()
    transactions: sa.Table = sa.Table(
        "provenance_failure_transactions",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("action_kind", sa.String(32)),
    )
    transactions.create(lifecycle_session.connection())
    lifecycle_session.execute(transactions.insert().values(id=1))
    missing: sa.Table = sa.Table(
        "missing_provenance_shadow",
        metadata,
        sa.Column("transaction_id", sa.Integer),
        sa.Column("operation_type", sa.Integer),
    )
    monkeypatch.setattr(
        versioning_manager, "transaction_cls", SimpleNamespace(__table__=transactions)
    )
    metric: Mock = Mock()
    monkeypatch.setattr(listener, "incr_capture_error", metric)
    listener._stamp_action_kind_on_transaction(lifecycle_session, 1, (missing,))
    metric.assert_called_once_with("action_kind_stamp")
    assert lifecycle_session.scalar(sa.select(transactions.c.action_kind)) is None
    lifecycle_session.add(LifecycleRow(value="save survives"))
    lifecycle_session.commit()
    assert lifecycle_session.scalar(sa.select(LifecycleRow.value)) == "save survives"


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


def test_unrelated_session_flush_without_app_context_skips_capture(
    lifecycle_session: Session,
) -> None:
    """A broker session must not depend on a Flask application context."""
    from sqlalchemy_continuum import versioning_manager

    unit_of_work: CaptureUnitOfWork = CaptureUnitOfWork(versioning_manager)

    def before_flush(
        session: Session, _flush_context: object, _instances: object
    ) -> None:
        unit_of_work.process_before_flush(session)

    sa.event.listen(lifecycle_session, "before_flush", before_flush)

    def commit_without_app_context() -> None:
        assert not has_app_context()
        lifecycle_session.add(LifecycleRow(value="broker queue"))
        lifecycle_session.commit()

    Context().run(commit_without_app_context)
    assert lifecycle_session.scalar(sa.select(LifecycleRow.value)) == "broker queue"


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
        id: int = 7

    entity: Slice = Slice()
    initial: dict[str, Any] = {"slice_name": "initial"}
    captures: list[object] = []

    def capture(_session: Session, obj: object) -> dict[str, str]:
        captures.append(obj)
        return initial

    monkeypatch.setattr(listener, "capture_initial_state", capture)
    monkeypatch.setattr(
        type(lifecycle_session), "dirty", property(lambda self: [entity])
    )
    monkeypatch.setattr(listener, "emit_capture_timing", MagicMock())

    listener._capture_initial_states(lifecycle_session, (Slice,))
    listener._capture_initial_states(lifecycle_session, (Slice,))

    assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {
        ("chart", 7): (entity, initial)
    }
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
    manager: MagicMock = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    lifecycle_session.add(LifecycleRow(value="timed"))
    lifecycle_session.commit()

    calls: list[Any] = [
        call
        for call in manager.instance.timing.call_args_list
        if call.args[0] == "superset.versioning.capture.finalize.latency"
    ]
    assert len(calls) == 1
    duration_ms: float = calls[0].args[1]
    assert isinstance(duration_ms, float)
    assert duration_ms >= 0


def test_capture_latency_metric_skips_reentrant_finalize(
    lifecycle_session: Session, mocker: Any
) -> None:
    """The reentrancy guard returns before the timer starts: a re-entered
    finalize must not dilute the latency series with instant zero
    samples."""
    manager: MagicMock = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    lifecycle_session.info[listener._FINALIZING_KEY] = True
    listener.finalize_change_records(lifecycle_session)

    manager.instance.timing.assert_not_called()


def test_capture_latency_metric_skips_nested_transaction(
    lifecycle_session: Session, mocker: Any
) -> None:
    """The other arm of the same guard: a nested transaction emits no
    sample either."""
    manager: MagicMock = MagicMock()
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
    manager: MagicMock = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    session: MagicMock = MagicMock()
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

    manager: MagicMock = MagicMock()
    manager.instance.timing.side_effect = RuntimeError("statsd down")
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    warning_spy: MagicMock = mocker.patch.object(metrics.logger, "warning")
    exception_spy: MagicMock = mocker.patch.object(metrics.logger, "exception")

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
    manager: MagicMock = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)

    record: ChangeRecord = ChangeRecord(
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
    reconciliation: MagicMock = mocker.patch.object(
        listener, "reconcile_parent_snapshots"
    )
    # A retained pre-flush state for one versioned entity -> non-empty buffer.
    lifecycle_session.info[listener._INITIAL_STATES_KEY] = {
        ("chart", 7): (object(), {"slice_name": "initial"})
    }

    lifecycle_session.add(LifecycleRow(value="versioned"))
    lifecycle_session.commit()

    # The real path ran: records reached persistence for tx 42.
    assert persisted == [(42, {("chart", 7): [record]})]
    reconciliation.assert_called_once_with(lifecycle_session, 42)
    calls: list[Any] = [
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
    error_spy: MagicMock = mocker.patch.object(listener, "incr_capture_error")

    def explode(session: Session) -> int:
        raise RuntimeError("continuum uow lookup failed")

    monkeypatch.setattr(listener, "_current_transaction_id", explode)

    lifecycle_session.add(LifecycleRow(value="survives"))
    lifecycle_session.commit()  # must not raise

    assert (
        lifecycle_session.query(LifecycleRow).filter_by(value="survives").count() == 1
    )
    error_spy.assert_called_once_with("transaction_lookup")


def test_capture_initial_states_stage_is_timed_only_when_a_read_is_attempted(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Emit a stage sample only when a pre-state read is attempted."""
    manager: MagicMock = MagicMock()
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
        id: int = 7

    # Nothing versioned dirty -> no sample.
    lifecycle_session.add(LifecycleRow(value="unrelated"))
    lifecycle_session.flush()
    listener._capture_initial_states(lifecycle_session, (Slice,))
    assert timing_calls() == []

    # A dirty versioned entity -> exactly one sample, and its state retained.
    entity: Slice = Slice()
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: [entity]),
    )
    listener._capture_initial_states(lifecycle_session, (Slice,))
    assert len(timing_calls()) == 1
    assert timing_calls()[0].args[1] >= 0
    assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {
        ("chart", 7): (entity, {"slice_name": "x"})
    }

    # A later flush of the SAME entity is a candidate but not a read attempt (its
    # state is already retained, no SELECT is issued): it must not emit a
    # near-zero sample that would dilute the percentiles the series is
    # alerted on (aminghadersohi's probe: 4 flushes, 1 SELECT, 4 samples).
    listener._capture_initial_states(lifecycle_session, (Slice,))
    listener._capture_initial_states(lifecycle_session, (Slice,))
    assert len(timing_calls()) == 1


def test_initial_state_identity_failure_does_not_skip_later_entities(
    lifecycle_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An ID property failure must not discard another entity's pre-state."""

    class Slice:
        """Expose the failure before the per-entity state read begins."""

        def __init__(self, entity_id: int) -> None:
            self.entity_id: int = entity_id

        @property
        def id(self) -> int:
            """Fail identity lookup for the middle entity only."""
            if self.entity_id == 2:
                raise RuntimeError("identity lookup failed")
            return self.entity_id

    entities: list[Slice] = [Slice(1), Slice(2), Slice(3)]
    attempts: list[int] = []
    error_spy: MagicMock = MagicMock()
    timing_spy: MagicMock = MagicMock()
    monkeypatch.setattr(listener, "incr_capture_error", error_spy)
    monkeypatch.setattr(listener, "emit_capture_timing", timing_spy)
    monkeypatch.setattr(
        type(lifecycle_session), "dirty", property(lambda self: entities)
    )

    def capture(session: Session, obj: Slice) -> dict[str, Any]:
        """Record only entities whose identity allowed a state read."""
        attempts.append(obj.id)
        return {"slice_name": str(obj.id)}

    monkeypatch.setattr(listener, "capture_initial_state", capture)
    listener._capture_initial_states(lifecycle_session, (Slice,))

    assert attempts == [1, 3]
    assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {
        ("chart", 1): (entities[0], {"slice_name": "1"}),
        ("chart", 3): (entities[2], {"slice_name": "3"}),
    }
    error_spy.assert_called_once_with("capture_initial_states")
    timing_spy.assert_called_once()
    assert timing_spy.call_args.args[0] == "capture_initial_states"


def test_initial_state_capture_isolates_each_entity(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Keep earlier states and attempt later entities after a capture raises."""

    class Slice:
        id: int

        def __init__(self, entity_id: int) -> None:
            self.id = entity_id

    entities: list[Slice] = [Slice(1), Slice(2), Slice(3)]
    attempts: list[int] = []
    error_spy: MagicMock = mocker.patch.object(listener, "incr_capture_error")
    log_spy: MagicMock = mocker.patch.object(listener.logger, "exception")
    mocker.patch("superset.extensions.stats_logger_manager", MagicMock())
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: entities),
    )

    def capture(session: Session, obj: Slice) -> dict[str, Any]:
        """Fail the middle read while recording every attempted entity."""
        attempts.append(obj.id)
        if obj.id == 2:
            raise RuntimeError("middle read failed")
        return {"slice_name": str(obj.id)}

    monkeypatch.setattr(listener, "capture_initial_state", capture)
    listener._capture_initial_states(lifecycle_session, (Slice,))

    assert attempts == [1, 2, 3]
    assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {
        ("chart", 1): (entities[0], {"slice_name": "1"}),
        ("chart", 3): (entities[2], {"slice_name": "3"}),
    }
    error_spy.assert_called_once_with("capture_initial_states")
    log_spy.assert_called_once_with(
        "version_changes: initial-state capture failed for %s id=%s", "chart", 2
    )


@pytest.mark.parametrize("outcome", ["swallowed", "mixed", "escaping"])
def test_initial_state_read_attempts_emit_one_timing_sample(
    lifecycle_session: Session,
    mocker: Any,
    monkeypatch: pytest.MonkeyPatch,
    outcome: str,
) -> None:
    """Time attempted reads even when no pre-state survives a failure."""

    class Slice:
        id: int

        def __init__(self, entity_id: int) -> None:
            self.id = entity_id

    entities: list[Slice] = [Slice(1), Slice(2)]
    manager: MagicMock = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    mocker.patch.object(listener, "perf_counter", side_effect=[10.0, 10.125])
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: entities),
    )
    read_spy: MagicMock
    if outcome == "swallowed":
        # Keep the real capture function, including its fail-open read handler.
        read_spy = mocker.patch(
            "superset.versioning.changes.state._read_pre_state",
            side_effect=RuntimeError("read failed"),
        )
    elif outcome == "mixed":
        read_spy = MagicMock(side_effect=[{"slice_name": "first"}, None])
        monkeypatch.setattr(listener, "capture_initial_state", read_spy)
    else:
        read_spy = MagicMock(side_effect=RuntimeError("capture failed"))
        monkeypatch.setattr(listener, "capture_initial_state", read_spy)

    listener._capture_initial_states(lifecycle_session, (Slice,))

    assert read_spy.call_count == 2
    manager.instance.timing.assert_called_once_with(
        "superset.versioning.capture.capture_initial_states.latency", 125.0
    )
    if outcome == "mixed":
        assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {
            ("chart", 1): (entities[0], {"slice_name": "first"})
        }
    else:
        assert lifecycle_session.info[listener._INITIAL_STATES_KEY] == {}


def test_initial_state_ineligible_entities_emit_no_timing(
    lifecycle_session: Session, mocker: Any
) -> None:
    """Skip unknown kinds and missing IDs without attempting a read."""

    class Unknown:
        id: int = 1

    class Slice:
        id: None = None

    manager: MagicMock = MagicMock()
    capture_spy: MagicMock = mocker.patch.object(listener, "capture_initial_state")
    mocker.patch("superset.extensions.stats_logger_manager", manager)
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: [Unknown(), Slice()]),
    )

    listener._capture_initial_states(lifecycle_session, (Unknown, Slice))

    capture_spy.assert_not_called()
    manager.instance.timing.assert_not_called()


def test_initial_state_iteration_failure_does_not_break_the_flush(
    lifecycle_session: Session, mocker: Any
) -> None:
    """Retain the outer fail-open backstop when obtaining dirty entities fails."""
    manager: MagicMock = MagicMock()
    error_spy: MagicMock = mocker.patch.object(listener, "incr_capture_error")
    mocker.patch("superset.extensions.stats_logger_manager", manager)

    def broken_dirty(session: Session) -> list[object]:
        """Simulate failure before a dirty entity can be selected."""
        raise RuntimeError("dirty iteration failed")

    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(broken_dirty),
    )
    listener._capture_initial_states(lifecycle_session, (LifecycleRow,))

    error_spy.assert_called_once_with("capture_initial_states")
    manager.instance.timing.assert_not_called()


def test_initial_state_capture_failure_does_not_break_the_flush(
    lifecycle_session: Session, mocker: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A raise in the per-entity pre-state capture is logged and counted, not
    propagated out of ``before_flush`` — the twin of the transaction-lookup
    guard in finalize, under the same "never break a user's save" invariant
    (aminghadersohi probed the unguarded form failing the save)."""
    mocker.patch("superset.extensions.stats_logger_manager", MagicMock())
    error_spy: MagicMock = mocker.patch.object(listener, "incr_capture_error")

    def explode(session: Session, obj: object) -> dict[str, str]:
        raise RuntimeError("pre-state SELECT failed")

    monkeypatch.setattr(listener, "capture_initial_state", explode)

    class Slice:  # the class NAME maps to the 'chart' entity kind
        id: int = 7

    entity: Slice = Slice()
    mocker.patch.object(
        type(lifecycle_session),
        "dirty",
        new_callable=lambda: property(lambda self: {entity}),
    )

    listener._capture_initial_states(lifecycle_session, (Slice,))  # must not raise

    error_spy.assert_called_once_with("capture_initial_states")
    assert lifecycle_session.info.get(listener._INITIAL_STATES_KEY, {}) == {}
