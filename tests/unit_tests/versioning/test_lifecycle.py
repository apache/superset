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
"""Chart archive capture through the application's native ORM listeners."""

from datetime import datetime
from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy_continuum import version_class

from superset.app import SupersetApp
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.versioning.changes.table import version_changes_table

pytestmark = pytest.mark.parametrize(
    "app", [{"SQLALCHEMY_DATABASE_URI": "sqlite://"}], indirect=True
)


def archives(session: Session) -> list[dict[str, Any]]:
    """Read only canonical archive announcements."""
    return [
        dict(row)
        for row in session.execute(
            sa.select(version_changes_table).where(
                version_changes_table.c.kind == "__archive__"
            )
        ).mappings()
    ]


def test_archive_without_content_transaction(capture_session: Session) -> None:
    """Archive writes its own activity transaction without a content snapshot."""
    chart = Slice(slice_name="original", viz_type="table", params="{}")
    dashboard = Dashboard(dashboard_title="dashboard", slices=[chart])
    capture_session.add(dashboard)
    capture_session.commit()
    before = capture_session.query(version_class(Slice)).count()
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    records = archives(capture_session)
    assert len(records) == 1
    assert records[0]["path"] == ["deleted_at"]
    assert records[0]["to_value"] == {
        "entity_uuid": str(chart.uuid),
        "entity_name": "original",
    }
    assert capture_session.query(version_class(Slice)).count() == before


@pytest.mark.parametrize("attach", [False, True])
def test_capture_gap_membership(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    attach: bool,
) -> None:
    """Live membership at archive time supersedes stale historical windows."""
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    dashboard = Dashboard(dashboard_title="dashboard", slices=[] if attach else [chart])
    capture_session.add_all([chart, dashboard])
    capture_session.commit()
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: False
    )
    dashboard.slices = [chart] if attach else []
    capture_session.commit()
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: True
    )
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    from superset.versioning.lifecycle_table import version_chart_archive_scope_table

    scopes = (
        capture_session.execute(sa.select(version_chart_archive_scope_table))
        .mappings()
        .all()
    )
    assert len(scopes) == int(attach)
    assert len(archives(capture_session)) == 1


@pytest.mark.parametrize(
    "steps,expected",
    [
        ([True], 1),
        ([True, True], 1),
        ([True, False], 0),
        ([True, False, True], 1),
    ],
)
def test_net_archive_transitions(
    capture_session: Session, steps: list[bool], expected: int
) -> None:
    """Only the initial-to-final transition survives repeated flushes."""
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    for archived in steps:
        chart.deleted_at = datetime(2026, 1, 1) if archived else None
        capture_session.flush()
    capture_session.commit()
    assert len(archives(capture_session)) == expected


@pytest.mark.parametrize("initially_archived", [False, True])
def test_insert_then_archive(
    capture_session: Session, initially_archived: bool
) -> None:
    """An inserted active row is observed only after its first flush."""
    chart = Slice(
        slice_name="chart",
        viz_type="table",
        params="{}",
        deleted_at=datetime(2026, 1, 1) if initially_archived else None,
    )
    capture_session.add(chart)
    capture_session.flush()
    chart.deleted_at = datetime(2026, 1, 2)
    capture_session.commit()
    assert len(archives(capture_session)) == int(not initially_archived)


@pytest.mark.parametrize(
    "nested,rollback", [(False, True), (True, True), (True, False)]
)
def test_archive_rollback(
    capture_session: Session, nested: bool, rollback: bool
) -> None:
    """Nested rollback drops transitions while successful nested work is retained."""
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    transaction = capture_session.begin_nested() if nested else capture_session.begin()
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.flush()
    if rollback:
        transaction.rollback()
    else:
        transaction.commit()
    capture_session.commit()
    assert len(archives(capture_session)) == int(not rollback)


@pytest.mark.parametrize("denied", [False, True])
def test_untracked_dashboard_needs_no_baseline(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    denied: bool,
) -> None:
    """Capture-disabled creation needs no dashboard baseline to record an archive."""
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: False
    )
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    dashboard = Dashboard(dashboard_title="dashboard", slices=[chart])
    capture_session.add(dashboard)
    capture_session.commit()
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: not denied
    )
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert len(archives(capture_session)) == int(not denied)
    assert capture_session.query(version_class(Dashboard)).count() == 0


def test_archive_membership_is_immutable(capture_session: Session) -> None:
    """Archived dashboards participate; later detach/recovery cannot rewrite scope."""
    from superset.versioning.lifecycle_table import version_chart_archive_scope_table

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    dashboard = Dashboard(dashboard_title="dashboard", slices=[chart])
    detached = Dashboard(dashboard_title="detached", slices=[chart])
    capture_session.add_all([dashboard, detached])
    capture_session.commit()
    detached.slices = []
    dashboard.deleted_at = datetime(2026, 1, 1)
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    before = capture_session.execute(sa.select(version_chart_archive_scope_table)).all()
    assert len(before) == 1
    assert before[0].dashboard_id == dashboard.id
    dashboard.deleted_at = None
    chart.deleted_at = None
    dashboard.slices = []
    capture_session.commit()
    assert (
        capture_session.execute(sa.select(version_chart_archive_scope_table)).all()
        == before
    )


@pytest.mark.parametrize("fail_all", [False, True])
def test_chart_failure_isolation(
    capture_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    fail_all: bool,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A rolled-back chart loses all scopes; all failures leave no transaction."""
    from sqlalchemy_continuum import versioning_manager

    from superset.versioning import lifecycle
    from superset.versioning.lifecycle_table import version_chart_archive_scope_table

    charts = [Slice(slice_name=str(i), viz_type="table", params="{}") for i in range(2)]
    dashboard = Dashboard(dashboard_title="dashboard", slices=charts)
    capture_session.add(dashboard)
    capture_session.commit()
    transaction_table = versioning_manager.transaction_cls.__table__
    before = capture_session.scalar(
        sa.select(sa.func.count()).select_from(transaction_table)
    )
    write = lifecycle._write_archive

    def fail_after_insert(
        connection: Any, transaction_id: int, archive: Any, memberships: Any
    ) -> int:
        """Exercise rollback after both the event and scope have been inserted."""
        count = write(connection, transaction_id, archive, memberships)
        if fail_all or archive.chart_id == charts[0].id:
            raise ValueError("injected optional failure")
        return count

    monkeypatch.setattr(lifecycle, "_write_archive", fail_after_insert)
    for chart in charts:
        chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert len(archives(capture_session)) == int(not fail_all)
    assert "chart archive capture failed" in caplog.text
    assert capture_session.scalar(
        sa.select(sa.func.count()).select_from(version_chart_archive_scope_table)
    ) == int(not fail_all)
    assert capture_session.scalar(
        sa.select(sa.func.count()).select_from(transaction_table)
    ) == before + int(not fail_all)


@pytest.mark.parametrize(
    "dashboard_count,chart_count,archive_count", [(20, 30, 5), (100, 10, 10)]
)
def test_lifecycle_query_budget(
    capture_session: Session, dashboard_count: int, chart_count: int, archive_count: int
) -> None:
    """Membership reads scale with archived charts rather than dashboard contents."""
    charts = [
        Slice(slice_name=str(i), viz_type="table", params="{}")
        for i in range(chart_count)
    ]
    dashboards = [
        Dashboard(dashboard_title=str(i), slices=charts) for i in range(dashboard_count)
    ]
    capture_session.add_all(dashboards)
    capture_session.commit()
    before = capture_session.query(version_class(Dashboard)).count()
    for chart in charts[:archive_count]:
        chart.deleted_at = datetime(2026, 1, 1)
    capture_session.flush()
    statements: list[str] = []
    connection = capture_session.connection()

    def track_statement(
        _conn: Any,
        _cursor: Any,
        statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        """Count lifecycle SQL after the application flush."""
        statements.append(statement)

    sa.event.listen(connection, "before_cursor_execute", track_statement)
    capture_session.commit()
    assert len(statements) < 100
    assert len(archives(capture_session)) == archive_count
    assert capture_session.query(version_class(Dashboard)).count() == before


def test_mixed_content_and_archive_use_separate_transactions(
    capture_session: Session,
) -> None:
    """Lifecycle announcements do not contaminate content snapshots or actions."""
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    chart.slice_name = "final"
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    record = archives(capture_session)[0]
    assert record["to_value"]["entity_name"] == "final"
    assert (
        capture_session.query(version_class(Slice))
        .filter_by(transaction_id=record["transaction_id"])
        .count()
        == 0
    )
    assert capture_session.query(version_class(Slice)).count() == 2


def test_lifecycle_actor_and_capture_timestamp(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Lifecycle attribution uses the current actor and UTC capture time."""
    from sqlalchemy_continuum import versioning_manager

    from superset.versioning import lifecycle

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    timestamp = datetime(2026, 10, 1)
    monkeypatch.setattr(
        lifecycle,
        "transaction_actor_args",
        lambda: {"user_id": 42, "remote_addr": "127.0.0.1"},
    )
    monkeypatch.setattr(lifecycle, "naive_utcnow", lambda: timestamp)
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    transaction = versioning_manager.transaction_cls.__table__
    row = capture_session.execute(
        sa.select(transaction).where(
            transaction.c.id == archives(capture_session)[0]["transaction_id"]
        )
    ).one()
    assert row.user_id == 42
    assert row.remote_addr == "127.0.0.1"
    assert row.issued_at == timestamp
    assert row.action_kind is None


def test_missing_scope_table_preserves_archive(
    capture_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A pre-migration write failure is quiet but counted and preserves user work."""
    from unittest.mock import MagicMock

    from superset.versioning import lifecycle
    from superset.versioning.lifecycle_table import version_chart_archive_scope_table

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    dashboard = Dashboard(dashboard_title="dashboard", slices=[chart])
    capture_session.add(dashboard)
    capture_session.commit()
    version_chart_archive_scope_table.drop(capture_session.connection())
    log = MagicMock()
    metric = MagicMock()
    monkeypatch.setattr(lifecycle.logger, "exception", log)
    monkeypatch.setattr(lifecycle, "incr_capture_error", metric)
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert chart.deleted_at == datetime(2026, 1, 1)
    assert archives(capture_session) == []
    log.assert_not_called()
    metric.assert_called_once_with("lifecycle_chart")
    version_chart_archive_scope_table.create(capture_session.connection())
    capture_session.commit()


@pytest.mark.parametrize("failure", ["invalidated", "rollback", "begin", "release"])
def test_uncertain_savepoints_are_fatal(failure: str) -> None:
    """Unsafe connection boundaries fail instead of permitting later lifecycle SQL."""
    from unittest.mock import MagicMock

    from superset.versioning.lifecycle import (
        begin_capture_savepoint,
        LifecycleCaptureFatalError,
        release_capture_savepoint,
        rollback_capture_savepoint,
    )

    connection = MagicMock(invalidated=False, closed=False)
    outer = MagicMock(is_active=True)
    savepoint = MagicMock(is_active=True)
    connection.get_transaction.return_value = outer
    original = ValueError("optional metadata failure")
    if failure == "invalidated":
        connection.invalidated = True
    elif failure == "rollback":
        savepoint.rollback.side_effect = RuntimeError("missing savepoint")
    elif failure == "begin":
        connection.begin_nested.side_effect = RuntimeError("missing transaction")
    else:
        savepoint.commit.side_effect = RuntimeError("missing savepoint")

    def recover() -> None:
        """Exercise the selected boundary failure."""
        if failure == "begin":
            begin_capture_savepoint(connection, outer)
        elif failure == "release":
            release_capture_savepoint(connection, savepoint, outer)
        else:
            rollback_capture_savepoint(connection, savepoint, outer, original)

    with pytest.raises(LifecycleCaptureFatalError):
        recover()
    if failure == "invalidated":
        savepoint.rollback.assert_not_called()


def test_manager_kill_switch_prevents_lifecycle(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The finalizer obeys the process-wide Continuum shutdown switch."""
    from sqlalchemy_continuum import versioning_manager

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    monkeypatch.setitem(versioning_manager.options, "versioning", False)
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert archives(capture_session) == []


def test_archived_marker_rewrite_is_not_an_archive(capture_session: Session) -> None:
    """An already archived chart has no active-to-archived transition."""
    chart = Slice(
        slice_name="chart",
        viz_type="table",
        params="{}",
        deleted_at=datetime(2026, 1, 1),
    )
    capture_session.add(chart)
    capture_session.commit()
    chart.deleted_at = datetime(2026, 1, 2)
    capture_session.commit()
    assert archives(capture_session) == []


@pytest.mark.parametrize("deferred", [False, True])
def test_archive_baseline_attribution(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    deferred: bool,
) -> None:
    """A deferred baseline credits stored archived attribution without backfill."""
    from sqlalchemy_continuum import versioning_manager

    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: False
    )
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    from flask_appbuilder.security.sqla.models import User

    capture_session.add_all(
        [
            User(
                id=11,
                username="editor",
                first_name="Content",
                last_name="Editor",
                email="editor@example.com",
            ),
            User(
                id=22,
                username="archiver",
                first_name="Chart",
                last_name="Archiver",
                email="archiver@example.com",
            ),
        ]
    )
    capture_session.commit()
    capture_session.execute(
        sa.update(Slice.__table__).where(Slice.id == chart.id).values(changed_by_fk=11)
    )
    capture_session.commit()
    capture_session.expire_all()
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: not deferred
    )
    chart.deleted_at = datetime(2026, 1, 1)
    chart.changed_by_fk = 22
    capture_session.commit()
    if deferred:
        monkeypatch.setitem(
            app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: True
        )
        chart.slice_name = "first captured edit"
        capture_session.commit()
    transaction = versioning_manager.transaction_cls.__table__
    actor = capture_session.scalar(
        sa.select(transaction.c.user_id).where(transaction.c.action_kind == "baseline")
    )
    assert actor == (22 if deferred else 11)
    assert len(archives(capture_session)) == int(not deferred)


def test_membership_chunk_failure_skips_complete_chunk(
    capture_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Partially read destinations never produce a misleading canonical event."""
    from superset.versioning import lifecycle

    charts = [Slice(slice_name=str(i), viz_type="table", params="{}") for i in range(3)]
    dashboard = Dashboard(dashboard_title="dashboard", slices=charts)
    capture_session.add(dashboard)
    capture_session.commit()
    monkeypatch.setattr(lifecycle, "_BATCH_SIZE", 2)
    memberships = lifecycle._memberships
    calls = 0

    def fail_first_chunk(connection: Any, chart_ids: list[int]) -> Any:
        """Fail after reading an entire chunk to exercise atomic discard."""
        nonlocal calls
        calls += 1
        result = memberships(connection, chart_ids)
        if calls == 1:
            raise ValueError("injected membership read failure")
        return result

    monkeypatch.setattr(lifecycle, "_memberships", fail_first_chunk)
    for chart in charts:
        chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert len(archives(capture_session)) == 1
    assert calls == 2
    assert "archive membership capture failed" in caplog.text


@pytest.mark.parametrize("detached", [False, True])
def test_nonpersistent_archive_is_not_captured(
    capture_session: Session, detached: bool
) -> None:
    """Deleted and detached instances cannot produce surviving archive events."""
    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.flush()
    if detached:
        capture_session.expunge(chart)
    else:
        capture_session.delete(chart)
    capture_session.commit()
    assert archives(capture_session) == []


@pytest.mark.parametrize("boundary", ["rollback", "release"])
def test_fatal_chart_boundary_stops_the_capture_loop(
    monkeypatch: pytest.MonkeyPatch, boundary: str
) -> None:
    """No later chart is attempted after a lost savepoint, preserving both errors."""
    from unittest.mock import MagicMock
    from uuid import uuid4

    from superset.versioning import lifecycle

    connection = MagicMock(invalidated=False, closed=False)
    outer = MagicMock(is_active=True)
    connection.get_transaction.return_value = outer
    membership_savepoint = MagicMock(is_active=True)
    chart_savepoint = MagicMock(is_active=True)
    connection.begin_nested.side_effect = [membership_savepoint, chart_savepoint]
    monkeypatch.setattr(
        lifecycle, "_memberships", lambda connection, chart_ids: {1: [], 2: []}
    )
    original = ValueError("chart insert failed")
    failed_boundary = RuntimeError("savepoint lost")
    write = MagicMock(return_value=0)
    monkeypatch.setattr(lifecycle, "_write_archive", write)
    if boundary == "rollback":
        write.side_effect = original
        chart_savepoint.rollback.side_effect = failed_boundary
    else:
        chart_savepoint.commit.side_effect = failed_boundary
    charts = [lifecycle.ChartArchive(i, uuid4(), "chart") for i in (1, 2)]
    with pytest.raises(lifecycle.LifecycleCaptureFatalError) as error:
        lifecycle._capture_chunk(connection, outer, 1, charts)
    assert write.call_count == 1
    assert connection.begin_nested.call_count == 2
    assert error.value.__cause__ is failed_boundary
    if boundary == "rollback":
        assert failed_boundary.__cause__ is original


def test_lifecycle_import_before_app_initialization() -> None:
    """Standalone migration and backend tooling can import capture without a cycle."""
    import subprocess
    import sys

    subprocess.run(  # noqa: S603 — fixed interpreter and import-only command
        [sys.executable, "-c", "import superset.versioning.lifecycle"],
        check=True,
        capture_output=True,
        timeout=30,
    )


@pytest.mark.parametrize("site", ["stamp", "persist"])
def test_lost_content_savepoint_prevents_lifecycle_capture(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch, site: str
) -> None:
    """Mixed content/archive commits stop before lifecycle SQL after MySQL1305."""
    from unittest.mock import MagicMock

    from superset.versioning import lifecycle
    from superset.versioning.changes import listener

    chart = Slice(slice_name="before", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    error = sa.exc.OperationalError(
        "SAVEPOINT", {}, Exception(1305, "missing savepoint")
    )
    monkeypatch.setattr(
        listener,
        "_write_action_kind" if site == "stamp" else "bulk_insert_records",
        MagicMock(side_effect=error),
    )
    capture = MagicMock()
    monkeypatch.setattr(lifecycle, "capture_chart_archives", capture)
    chart.slice_name = "after"
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.info[listener.ACTION_KIND_KEY] = listener.ACTION_KIND_RESTORE
    with pytest.raises(sa.exc.OperationalError) as raised:
        capture_session.commit()
    assert raised.value is error
    capture.assert_not_called()
    capture_session.rollback()
    assert chart.slice_name == "before"
    assert chart.deleted_at is None
    assert archives(capture_session) == []


@pytest.mark.parametrize("code", [1305, "3B001"])
def test_missing_savepoint_backstop_after_successful_rollback(code: int | str) -> None:
    """A successful rollback cannot override a driver-reported missing savepoint."""
    from unittest.mock import MagicMock

    from superset.versioning.lifecycle import (
        LifecycleCaptureFatalError,
        rollback_capture_savepoint,
    )

    connection = MagicMock(invalidated=False, closed=False)
    outer = MagicMock(is_active=True)
    savepoint = MagicMock(is_active=True)
    connection.get_transaction.return_value = outer
    diagnostic = Exception(code)
    if isinstance(code, str):
        diagnostic.sqlstate = code  # type: ignore[attr-defined]
    original = sa.exc.OperationalError("SELECT", {}, diagnostic)
    with pytest.raises(LifecycleCaptureFatalError) as raised:
        rollback_capture_savepoint(connection, savepoint, outer, original)
    savepoint.rollback.assert_called_once()
    assert raised.value.__cause__ is original


def test_finalizer_manager_kill_switch_does_not_evaluate_capture_policy(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Direct finalization stops even when a retained unit would allow capture."""
    from unittest.mock import MagicMock

    from sqlalchemy_continuum import versioning_manager

    from superset.versioning.changes import listener

    monkeypatch.setitem(versioning_manager.options, "versioning", False)
    policy = MagicMock(return_value=True)
    flush = MagicMock()
    lifecycle = MagicMock()
    monkeypatch.setattr(listener, "capture_for_write", policy)
    monkeypatch.setattr(capture_session, "flush", flush)
    monkeypatch.setattr(listener, "_capture_lifecycle", lifecycle)
    listener.finalize_change_records(capture_session)
    policy.assert_not_called()
    flush.assert_not_called()
    lifecycle.assert_not_called()


def test_expired_hard_deleted_chart_does_not_break_commit(
    capture_session: Session,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A Core deletion after retained archive state drops optional collection."""
    from unittest.mock import MagicMock

    from superset.versioning.changes import listener

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    chart_id = chart.id
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.flush()
    capture_session.expire(chart)
    capture_session.connection().execute(
        sa.delete(Slice.__table__).where(Slice.__table__.c.id == chart_id)
    )
    metric = MagicMock()
    monkeypatch.setattr(listener, "incr_capture_error", metric)
    capture_session.commit()
    assert archives(capture_session) == []
    metric.assert_any_call("lifecycle_collect")
    assert "archive transition collection failed" in caplog.text


@pytest.mark.parametrize("failure", ["lost", "invalidated", "statement", "fatal"])
def test_unsafe_collection_failures_propagate(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    """Collection has no savepoint, so database failures cannot be swallowed."""
    from unittest.mock import MagicMock

    from superset.versioning import lifecycle
    from superset.versioning.changes import listener

    if failure == "fatal":
        error = lifecycle.LifecycleCaptureFatalError("failed rollback")
    else:
        error = sa.exc.OperationalError(
            "SELECT",
            {},
            Exception(1305 if failure == "lost" else "failed read"),
            connection_invalidated=failure == "invalidated",
        )
    monkeypatch.setattr(
        lifecycle, "collect_chart_archives", MagicMock(side_effect=error)
    )
    capture = MagicMock()
    monkeypatch.setattr(lifecycle, "capture_chart_archives", capture)
    with pytest.raises(type(error)) as raised:
        listener._capture_lifecycle(capture_session, {})
    assert raised.value is error
    capture.assert_not_called()


def test_fatal_capture_is_handled_by_chart_command_transaction(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fatal capture rolls back and maps to the chart command's public error."""
    from superset.commands.chart.delete import DeleteChartCommand
    from superset.commands.chart.exceptions import ChartDeleteFailedError
    from superset.daos.chart import ChartDAO
    from superset.versioning.lifecycle import LifecycleCaptureFatalError

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    command = DeleteChartCommand([chart.id])

    def validate() -> None:
        """Use the persisted chart without unrelated authorization setup."""
        command._models = [chart]

    def delete(_models: list[Slice]) -> None:
        """Mutate caller data before the failed metadata boundary."""
        chart.deleted_at = datetime(2026, 1, 1)

    def fail_commit() -> None:
        """Model the fatal database boundary raised during commit finalization."""
        raise LifecycleCaptureFatalError("private savepoint state")

    monkeypatch.setattr(command, "validate", validate)
    monkeypatch.setattr(ChartDAO, "delete", delete)
    from superset.extensions import db

    monkeypatch.setattr(db.session, "commit", fail_commit)
    with pytest.raises(ChartDeleteFailedError) as raised:
        command.run()
    assert isinstance(raised.value.__cause__, LifecycleCaptureFatalError)
    assert chart.deleted_at is None
    assert "private savepoint" not in str(raised.value)


def test_recoverable_lifecycle_allocation_failure_is_logged(
    capture_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Optional allocation failures remain visible without a metrics backend."""
    from unittest.mock import MagicMock

    from superset.versioning import lifecycle

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    monkeypatch.setattr(
        lifecycle,
        "transaction_actor_args",
        MagicMock(side_effect=ValueError("invalid actor")),
    )
    metric = MagicMock()
    monkeypatch.setattr(lifecycle, "incr_capture_error", metric)
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert chart.deleted_at is not None
    assert archives(capture_session) == []
    metric.assert_called_once_with("lifecycle")
    assert "archive transaction capture failed" in caplog.text


@pytest.mark.parametrize("stage", ["scalar", "child", "lookup"])
@pytest.mark.parametrize("archive", [False, True])
def test_unisolated_content_read_failure_stops_before_lifecycle(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch, stage: str, archive: bool
) -> None:
    """An unisolated failed read is not made safe by a recoverable SQLSTATE."""
    from unittest.mock import MagicMock

    from superset.versioning import lifecycle
    from superset.versioning.changes import listener

    chart = Slice(slice_name="before", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    diagnostic = Exception("deadlock during unisolated read")
    diagnostic.sqlstate = "40P01"  # type: ignore[attr-defined]
    error = sa.exc.OperationalError("SELECT", {}, diagnostic)
    helpers = {
        "scalar": "compute_records_from_state",
        "child": "_dataset_child_records_for_tx_from_shadows",
        "lookup": "_current_transaction_id",
    }
    monkeypatch.setattr(listener, helpers[stage], MagicMock(side_effect=error))
    capture = MagicMock()
    monkeypatch.setattr(lifecycle, "capture_chart_archives", capture)
    chart.slice_name = "after"
    if archive:
        chart.deleted_at = datetime(2026, 1, 1)
    with pytest.raises(sa.exc.OperationalError) as raised:
        capture_session.commit()
    assert raised.value is error
    capture.assert_not_called()
    capture_session.rollback()
    assert chart.slice_name == "before"
    assert chart.deleted_at is None


def test_null_dashboard_uuid_does_not_drop_other_archive_memberships(
    capture_session: Session,
) -> None:
    """An invalid dashboard identity cannot suppress valid scopes for the chart."""
    from superset.versioning.lifecycle_table import version_chart_archive_scope_table

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    invalid = Dashboard(dashboard_title="missing UUID", slices=[chart])
    valid = Dashboard(dashboard_title="valid UUID", slices=[chart])
    capture_session.add_all([invalid, valid])
    capture_session.commit()
    capture_session.connection().execute(
        sa.update(Dashboard.__table__)
        .where(Dashboard.__table__.c.id == invalid.id)
        .values(uuid=None)
    )
    chart.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    assert len(archives(capture_session)) == 1
    scopes = capture_session.execute(sa.select(version_chart_archive_scope_table)).all()
    assert len(scopes) == 1
    assert scopes[0].dashboard_id == valid.id
    assert scopes[0].dashboard_uuid == valid.uuid


def test_fatal_lifecycle_capture_is_logged_and_counted_once(
    capture_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fatal metadata failures stay observable when the API returns a public error."""
    from unittest.mock import MagicMock

    from superset.versioning import lifecycle
    from superset.versioning.changes import listener

    chart = Slice(slice_name="chart", viz_type="table", params="{}")
    capture_session.add(chart)
    capture_session.commit()
    failure = lifecycle.LifecycleCaptureFatalError("lost transaction")
    monkeypatch.setattr(lifecycle, "_write_archive", MagicMock(side_effect=failure))
    log = MagicMock()
    metric = MagicMock()
    monkeypatch.setattr(listener.logger, "exception", log)
    monkeypatch.setattr(listener, "incr_capture_error", metric)
    chart.deleted_at = datetime(2026, 1, 1)
    with pytest.raises(lifecycle.LifecycleCaptureFatalError) as raised:
        capture_session.commit()
    assert raised.value is failure
    log.assert_called_once_with("version_changes: fatal archive capture failure")
    metric.assert_called_once_with("lifecycle_fatal")
    capture_session.rollback()
    assert chart.deleted_at is None
    assert archives(capture_session) == []
