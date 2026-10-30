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
"""Unit tests for GTF chart-data query cancellation (Phase 2)."""

import copy
import sqlite3
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import ANY, call, MagicMock, patch
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.db_engine_specs.impala import ImpalaEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.models.core import Database
from superset.superset_typing import AdhocColumn
from superset.tasks.context import TaskContext
from superset.tasks.query_cancel import (
    _cancel_id_sink,
    _CancellationQuery,
    cancel_chart_query,
    capture_cancel_id,
    capture_cancel_query_id,
    ChartQueryAbortedError,
    CursorPhase,
    notify_cursor,
    tracked_cursor,
)


def _mock_database(cancel_result: bool = True):
    database = MagicMock()
    database.id = 5
    cursor = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value = cursor
    engine = MagicMock()
    engine.raw_connection.return_value = conn
    database.get_sqla_engine.return_value.__enter__ = MagicMock(return_value=engine)
    database.get_sqla_engine.return_value.__exit__ = MagicMock(return_value=None)
    database.db_engine_spec.cancel_query.return_value = cancel_result
    return database, cursor


def _app_with_stats(stats: MagicMock) -> MagicMock:
    app = MagicMock()
    app.config = {"STATS_LOGGER": stats}
    return app


# --- capture seam ---------------------------------------------------------


def test_notify_cursor_is_noop_without_a_sink() -> None:
    # No sink registered: must not raise and must not touch the cursor.
    assert _cancel_id_sink.get() is None
    notify_cursor(MagicMock(), MagicMock())


def test_capture_cancel_id_sets_and_resets_the_sink() -> None:
    sink = MagicMock()
    with capture_cancel_id(sink):
        cursor, database = MagicMock(), MagicMock()
        notify_cursor(cursor, database)
        notify_cursor(cursor, database, CursorPhase.SUBMITTED)
        assert sink.call_args_list == [
            call(cursor, database, CursorPhase.OPENED),
            call(cursor, database, CursorPhase.SUBMITTED),
        ]
    assert _cancel_id_sink.get() is None


def test_notify_cursor_swallows_sink_errors() -> None:
    with capture_cancel_id(MagicMock(side_effect=RuntimeError("boom"))):
        # A capture failure only forfeits cancellability; it must not raise.
        notify_cursor(MagicMock(), MagicMock())


def test_notify_cursor_propagates_an_accepted_abort() -> None:
    # The abort is the one signal a sink may raise: it stops the task's work.
    with capture_cancel_id(MagicMock(side_effect=ChartQueryAbortedError())):
        with pytest.raises(ChartQueryAbortedError):
            notify_cursor(MagicMock(), MagicMock(), CursorPhase.SUBMITTING)


def test_tracked_cursor_notifies_the_failure_when_the_cursor_fails() -> None:
    sink = MagicMock()
    cursor, database = MagicMock(), MagicMock()
    with capture_cancel_id(sink):
        with pytest.raises(RuntimeError):
            with tracked_cursor(cursor, database):
                raise RuntimeError("statement failed")
    assert sink.call_args_list == [
        call(cursor, database, CursorPhase.OPENED),
        call(cursor, database, CursorPhase.FAILED),
    ]


# --- cancel helper --------------------------------------------------------


def test_cancel_chart_query_success() -> None:
    stats = MagicMock()
    database, cursor = _mock_database(cancel_result=True)

    assert cancel_chart_query(database, "123", _app_with_stats(stats)) is True
    # Called with the live cursor, a Query stand-in bound to this database, and id.
    call = database.db_engine_spec.cancel_query.call_args
    assert call.args[0] is cursor
    assert isinstance(call.args[1], _CancellationQuery)
    assert call.args[1].database is database
    assert call.args[2] == "123"
    stats.incr.assert_any_call("gtf.query.cancel")


def test_cancellation_query_stub_exposes_expected_attributes() -> None:
    database = MagicMock()
    query = _CancellationQuery(database)
    # id is None so an engine that cancels by query id declines rather than raises.
    assert query.id is None
    assert query.database is database
    query.set_extra_json_key("early_cancel_query", True)
    assert query.extra["early_cancel_query"] is True


def test_capture_cancel_query_id_passes_a_query_stub() -> None:
    database = MagicMock()
    database.db_engine_spec.get_cancel_query_id.return_value = "42"
    cursor = MagicMock()

    assert capture_cancel_query_id(database, cursor) == "42"
    call = database.db_engine_spec.get_cancel_query_id.call_args
    assert call.args[0] is cursor
    assert isinstance(call.args[1], _CancellationQuery)


def test_cancel_chart_query_reports_failure_when_engine_declines() -> None:
    stats = MagicMock()
    database, _ = _mock_database(cancel_result=False)

    assert cancel_chart_query(database, "123", _app_with_stats(stats)) is False
    stats.incr.assert_any_call("gtf.query.cancel_failed")


def test_cancel_chart_query_swallows_exceptions() -> None:
    stats = MagicMock()
    database, _ = _mock_database()
    database.get_sqla_engine.side_effect = RuntimeError("no connection")

    assert cancel_chart_query(database, "123", _app_with_stats(stats)) is False
    stats.incr.assert_any_call("gtf.query.cancel_failed")


# --- capture wiring in execute_chart_query --------------------------------


def _query_context(cancel_id):
    qc = MagicMock()
    spec = qc.datasource.database.db_engine_spec
    spec.get_cancel_query_id.return_value = cancel_id
    spec.has_query_id_before_execute = True
    return qc


def test_capture_registers_one_abort_handler_and_follows_each_cursor() -> None:
    """The first id registers the abort handler; each later cursor replaces it.

    For engines that expose the id before execution, every cursor's id is read
    when it opens, so a second cursor (e.g. a time comparison) replaces the first
    one's id instead of leaving the abort to cancel a session that is done.
    """
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx = MagicMock()
    qc = _query_context("42")
    database = qc.datasource.database
    with (
        patch("superset.tasks.async_queries.get_context", return_value=ctx),
        patch("superset.tasks.async_queries.current_app"),
        patch("superset.tasks.async_queries.cancel_chart_query") as cancel,
    ):
        with _capture_query_cancellation(qc):
            sink = _cancel_id_sink.get()
            assert sink is not None
            sink(MagicMock(), database, CursorPhase.OPENED)  # registers handler
            sink(MagicMock(), database, CursorPhase.RELEASED)
            database.db_engine_spec.get_cancel_query_id.return_value = "43"
            sink(MagicMock(), database, CursorPhase.OPENED)  # second cursor
            ctx.on_abort.call_args.args[0]()  # abort while it runs

    ctx.on_abort.assert_called_once()
    # The first handle is persisted (for the orphan reaper) before on_abort,
    # whose write flushes it — assert both the call and the ordering.
    ctx.set_cancellation.assert_called_once_with(database.id, "42")
    ordered = [c[0] for c in ctx.method_calls]
    assert ordered.index("set_cancellation") < ordered.index("on_abort")
    # Cleared when the first cursor was released, then replaced by the second.
    assert ctx.persist_cancellation.call_args_list == [
        call(database.id, None),
        call(database.id, "43"),
    ]
    cancel.assert_called_once_with(database, "43", ANY)


def test_capture_skips_abort_handler_when_engine_has_no_cancel_id() -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx = MagicMock()
    qc = _query_context(None)
    database = qc.datasource.database
    with (
        patch("superset.tasks.async_queries.get_context", return_value=ctx),
        patch("superset.tasks.async_queries.current_app"),
    ):
        with _capture_query_cancellation(qc):
            sink = _cancel_id_sink.get()
            assert sink is not None
            for phase in CursorPhase:
                sink(MagicMock(), database, phase)

    ctx.on_abort.assert_not_called()
    ctx.set_cancellation.assert_not_called()
    ctx.persist_cancellation.assert_not_called()


@pytest.mark.parametrize("has_query_id_before_execute", [True, False])
def test_cursor_on_another_database_is_never_captured(
    has_query_id_before_execute: bool,
) -> None:
    """A query on another database (e.g. an annotation layer's) is never the handle.

    Its id would be cancelled against the task's database, so it must neither be
    read nor make the task abortable, whichever phase the engine is read in.
    """
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx = MagicMock()
    qc = _query_context("42")
    database = qc.datasource.database
    database.id = 7
    database.db_engine_spec.has_query_id_before_execute = has_query_id_before_execute
    other_database = MagicMock()
    other_database.id = 8
    with (
        patch("superset.tasks.async_queries.get_context", return_value=ctx),
        patch("superset.tasks.async_queries.current_app"),
    ):
        with _capture_query_cancellation(qc):
            sink = _cancel_id_sink.get()
            assert sink is not None
            for phase in CursorPhase:
                sink(MagicMock(), other_database, phase)

    database.db_engine_spec.get_cancel_query_id.assert_not_called()
    other_database.db_engine_spec.get_cancel_query_id.assert_not_called()
    ctx.on_abort.assert_not_called()
    ctx.set_cancellation.assert_not_called()
    ctx.persist_cancellation.assert_not_called()


def test_task_context_set_cancellation_merges_into_properties_cache() -> None:
    from superset.tasks.context import TaskContext

    task = MagicMock()
    task.uuid = "u"
    task.properties_dict = {"is_abortable": False}
    task.payload_dict = {}
    ctx = TaskContext(task)

    ctx.set_cancellation(7, "42")

    # Merged into the cache's private.task namespace (no write); a later
    # _set_abortable flush persists them together, and existing cached keys and
    # the framework namespace are preserved.
    assert ctx._properties_cache["private"]["task"]["cancel_database_id"] == 7
    assert ctx._properties_cache["private"]["task"]["cancel_query_id"] == "42"
    assert ctx._properties_cache["is_abortable"] is False


def test_capture_is_noop_without_a_database() -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    qc = MagicMock()
    qc.datasource.database = None
    with patch("superset.tasks.async_queries.get_context") as get_context:
        with _capture_query_cancellation(qc):
            assert _cancel_id_sink.get() is None
    get_context.assert_not_called()


def _record_writes(mocker: MockerFixture) -> list[dict[str, Any]]:
    """Record the properties of each task metastore write instead of running it."""
    writes: list[dict[str, Any]] = []

    class RecordingUpdate:
        def __init__(
            self, task_uuid: Any, properties: Any = None, payload: Any = None
        ) -> None:
            writes.append(copy.deepcopy(properties))

        def run(self) -> bool:
            return True

    mocker.patch(
        "superset.commands.tasks.internal_update.InternalUpdateTaskCommand",
        RecordingUpdate,
    )
    return writes


def test_task_context_persist_cancellation_writes_and_clears_the_handle(
    mocker: MockerFixture,
) -> None:
    writes = _record_writes(mocker)
    task = MagicMock()
    task.uuid = "u"
    task.properties_dict = {
        "is_abortable": True,
        "private": {"framework": {"celery_task_id": "c1"}},
    }
    task.payload_dict = {}
    ctx = TaskContext(task)

    ctx.persist_cancellation(7, "42")
    ctx.persist_cancellation(7, None)

    # Each call writes at once and keeps the rest of the cache; a cleared handle
    # is written as None, which the orphan reaper skips.
    assert [write["private"] for write in writes] == [
        {
            "framework": {"celery_task_id": "c1"},
            "task": {"cancel_database_id": 7, "cancel_query_id": "42"},
        },
        {
            "framework": {"celery_task_id": "c1"},
            "task": {"cancel_database_id": 7, "cancel_query_id": None},
        },
    ]
    assert all(write["is_abortable"] is True for write in writes)


# --- chart-data queries through Database.get_df -----------------------------


@pytest.fixture
def task_context(mocker: MockerFixture) -> tuple[TaskContext, list[dict[str, Any]]]:
    """The running chart task's real TaskContext, with its metastore writes recorded.

    Its abort is fired by calling ``_on_abort_detected``, as the abort listener
    does; abort handlers then run once, in the calling thread.
    """
    writes = _record_writes(mocker)
    mocker.patch("superset.tasks.manager.TaskManager.listen_for_abort")
    task = MagicMock()
    task.uuid = UUID("b8b61b7b-1cd3-4a31-a74a-0a95341afc06")
    task.properties_dict = {}
    task.payload_dict = {}
    ctx = TaskContext(task)
    mocker.patch("superset.tasks.async_queries.get_context", return_value=ctx)
    return ctx, writes


def _persisted(writes: list[dict[str, Any]]) -> list[Any]:
    """The cancel id each metastore write carried for the orphan reaper, in order."""
    return [
        write["private"]["task"]["cancel_query_id"]
        for write in writes
        if "task" in (write.get("private") or {})
    ]


def _chart_query(database: Database) -> Any:
    return SimpleNamespace(datasource=SimpleNamespace(database=database))


class _FakeImpala:
    """Hands out HS2 operations, and records the statements and fetches."""

    def __init__(self) -> None:
        self.operations: list[SimpleNamespace] = []
        self.statements = 0
        self.fetches = 0
        # Runs while the n-th statement (1-based, not counting ``USE``) is being
        # submitted, which is when Impala plans it: the cursor does not hold its
        # operation yet.
        self.while_submitting: dict[int, Callable[[], None]] = {}
        # Runs while the n-th fetch (1-based) waits on its statement.
        self.while_fetching: dict[int, Callable[[], None]] = {}

    def submit(self, sql: str) -> SimpleNamespace:
        if not sql.startswith("USE "):
            self.statements += 1
            if self.statements in self.while_submitting:
                self.while_submitting[self.statements]()
        number = len(self.operations) + 1
        high, low = f"{number:016x}", f"{number + 0xA0:016x}"
        operation = SimpleNamespace(
            sql=sql,
            cancel_id=f"{high}:{low}",
            # The inverse of ImpalaEngineSpec.get_cancel_query_id's formatting.
            handle=SimpleNamespace(
                operationId=SimpleNamespace(guid=bytes.fromhex(low + high)[::-1])
            ),
        )
        self.operations.append(operation)
        return operation

    def fetch(self) -> list[tuple[Any, ...]]:
        self.fetches += 1
        if self.fetches in self.while_fetching:
            self.while_fetching[self.fetches]()
        return [(1,)]


class _FakeImpalaCursor:
    """An impyla-like cursor (impyla is an optional extra, absent in CI).

    Like ``HiveServer2Connection.cursor()``, opening a cursor on a URL that names
    a database runs ``USE <db>``, which leaves that finished operation in
    ``_last_operation``. ``execute_async`` clears it, and assigns the new
    operation only once the statement has been submitted.
    """

    description = [("one", "INT", None, None, None, None, None)]

    def __init__(self, impala: _FakeImpala, default_db: str | None) -> None:
        self._impala = impala
        self._last_operation: SimpleNamespace | None = None
        if default_db is not None:
            self.execute_async(f"USE {default_db}")

    def execute_async(self, sql: str) -> None:
        self._last_operation = None
        self._last_operation = self._impala.submit(sql)

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self._impala.fetch()


def _impala_database(
    mocker: MockerFixture,
    impala: _FakeImpala,
    *,
    database_id: int = 7,
    default_db: str | None = "sales",
) -> Database:
    """An Impala database whose connections open impyla-like cursors."""
    uri = "impala://coordinator:21050" + (f"/{default_db}" if default_db else "")
    database = Database(
        id=database_id, database_name=f"impala_{database_id}", sqlalchemy_uri=uri
    )
    # The execution event names the database's driver, which needs impyla.
    mocker.patch("superset.models.core.event_logger", new=MagicMock())
    mocker.patch.object(database, "get_sqla_engine")
    connection = MagicMock()
    connection.cursor.side_effect = lambda: _FakeImpalaCursor(impala, default_db)
    get_raw_connection = mocker.patch.object(database, "get_raw_connection")
    get_raw_connection.return_value.__enter__.return_value = connection
    # The engine's own fetch_data waits on the operation through impyla.
    mocker.patch.object(
        ImpalaEngineSpec,
        "fetch_data",
        side_effect=lambda cursor, limit=None: cursor.fetchall(),
    )
    return database


def test_impala_abort_cancels_the_running_select_not_the_use(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """Opening the cursor ran ``USE``; the abort cancels the chart's SELECT."""
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    impala = _FakeImpala()
    impala.while_fetching[1] = ctx._on_abort_detected
    database = _impala_database(mocker, impala)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS one")

    use, select = impala.operations
    assert use.sql == "USE sales"
    cancel.assert_called_once_with(database, select.cancel_id, ANY)
    # Persisted while the SELECT ran, cleared once its cursor was released.
    assert _persisted(writes) == [select.cancel_id, None]


def test_impala_without_a_url_database_is_abortable_once_the_cursor_opens(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """Without ``USE`` there is no id before execute; the task is abortable anyway."""
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, _ = task_context
    impala = _FakeImpala()
    abortable_while_submitting: list[bool] = []
    impala.while_submitting[1] = lambda: abortable_while_submitting.append(
        ctx._properties_cache.get("is_abortable", False)
    )
    impala.while_fetching[1] = ctx._on_abort_detected
    database = _impala_database(mocker, impala, default_db=None)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS one")

    (select,) = impala.operations
    assert abortable_while_submitting == [True]
    assert len(ctx._abort_handlers) == 1
    cancel.assert_called_once_with(database, select.cancel_id, ANY)


@pytest.mark.parametrize("statement", [1, 2])
def test_impala_abort_while_submitting_is_honored_once_the_id_is_published(
    mocker: MockerFixture,
    task_context: tuple[TaskContext, list[dict[str, Any]]],
    statement: int,
) -> None:
    """An abort while Impala plans a statement cancels it once its id exists.

    The handler runs once and finds nothing to cancel (the previous statement's
    id was retired), so the worker cancels the id it publishes, then stops
    before fetching or running the next statement.
    """
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, _ = task_context
    impala = _FakeImpala()
    impala.while_submitting[statement] = ctx._on_abort_detected
    database = _impala_database(mocker, impala)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with pytest.raises(ChartQueryAbortedError):
        with _capture_query_cancellation(_chart_query(database)):
            database.get_df("SELECT 1 AS a;\nSELECT 2 AS b;\nSELECT 3 AS c")

    # Nothing after the aborted statement was submitted or fetched.
    *_, aborted = impala.operations
    assert impala.statements == statement
    assert impala.fetches == statement - 1
    cancel.assert_called_once_with(database, aborted.cancel_id, ANY)


def test_impala_multi_statement_cancels_the_statement_that_is_running(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, _ = task_context
    impala = _FakeImpala()
    impala.while_fetching[2] = ctx._on_abort_detected  # the second statement's
    database = _impala_database(mocker, impala)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS a;\nSELECT 2 AS b")

    _, _, second = impala.operations
    cancel.assert_called_once_with(database, second.cancel_id, ANY)


def test_impala_abort_stops_before_the_next_statement(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, _ = task_context
    impala = _FakeImpala()
    impala.while_fetching[1] = ctx._on_abort_detected  # the first statement's
    database = _impala_database(mocker, impala)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with pytest.raises(ChartQueryAbortedError):
        with _capture_query_cancellation(_chart_query(database)):
            database.get_df("SELECT 1 AS a;\nSELECT 2 AS b")

    _, first = impala.operations  # the second statement was never submitted
    cancel.assert_called_once_with(database, first.cancel_id, ANY)


def test_impala_second_cursor_replaces_the_handle(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """A time comparison runs a second query, on its own cursor (and ``USE``)."""
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, _ = task_context
    impala = _FakeImpala()
    impala.while_fetching[2] = ctx._on_abort_detected  # the second query's
    database = _impala_database(mocker, impala)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS main")
        database.get_df("SELECT 1 AS shifted")

    _, _, _, shifted = impala.operations
    assert len(ctx._abort_handlers) == 1
    cancel.assert_called_once_with(database, shifted.cancel_id, ANY)


def test_impala_cursor_on_another_database_does_not_replace_the_handle(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """An annotation layer's query on another database runs in the same task."""
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    impala, annotation_impala = _FakeImpala(), _FakeImpala()
    annotation_impala.while_fetching[1] = ctx._on_abort_detected
    database = _impala_database(mocker, impala)
    annotation_database = _impala_database(mocker, annotation_impala, database_id=8)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS one")
        annotation_database.get_df("SELECT 1 AS annotation")
        # Once aborting, the task stops before its next statement.
        with pytest.raises(ChartQueryAbortedError):
            database.get_df("SELECT 1 AS one")

    _, select = impala.operations[:2]
    # Only the task's own operations were persisted, and the annotation query's
    # id was never cancelled against the task's database.
    assert _persisted(writes) == [select.cancel_id, None]
    cancel.assert_not_called()


def test_impala_persisted_handle_follows_the_running_operation(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    _, writes = task_context
    impala = _FakeImpala()
    database = _impala_database(mocker, impala)

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS a;\nSELECT 2 AS b")
        database.get_df("SELECT 1 AS shifted")

    _, first, second, _, shifted = impala.operations
    # Abortable from the first cursor's opening, before any id existed.
    assert writes[0] == {"is_abortable": True}
    # Each id is persisted once its statement is submitted, and cleared before
    # the next statement and when the cursor is released.
    assert _persisted(writes) == [
        first.cancel_id,
        None,
        second.cancel_id,
        None,
        shifted.cancel_id,
        None,
    ]


def test_impala_capture_failure_leaves_no_stale_handle(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    impala = _FakeImpala()
    impala.while_fetching[2] = ctx._on_abort_detected  # the second statement's
    database = _impala_database(mocker, impala)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")
    get_cancel_query_id = ImpalaEngineSpec.get_cancel_query_id

    def fail_for_the_second_statement(cursor: Any, query: Any) -> str | None:
        if len(impala.operations) == 3:  # ``USE`` and both statements
            raise RuntimeError("capture failed")
        return get_cancel_query_id(cursor, query)

    mocker.patch.object(
        ImpalaEngineSpec,
        "get_cancel_query_id",
        side_effect=fail_for_the_second_statement,
    )

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 1 AS a;\nSELECT 2 AS b")

    _, first, _ = impala.operations
    # The first statement's id was retired: nothing stale is cancelled or reaped.
    cancel.assert_not_called()
    assert _persisted(writes) == [first.cancel_id, None]


def _postgres_database(
    mocker: MockerFixture, pids: list[int | None]
) -> tuple[Database, list[list[str]]]:
    """A PostgreSQL database whose connections are in-memory SQLite ones.

    Each connection reports the next of ``pids`` from ``pg_backend_pid()`` (None:
    the probe fails) and records the statements that run on it, in order.
    """
    database = Database(
        id=9,
        database_name="postgres",
        sqlalchemy_uri="postgresql://user:password@postgres:5432/db",
    )
    mocker.patch.object(database, "get_sqla_engine")
    statements: list[list[str]] = []
    remaining = iter(pids)

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Iterator[sqlite3.Connection]:
        pid = next(remaining)
        connection = sqlite3.connect(":memory:")
        log: list[str] = []
        statements.append(log)
        connection.set_trace_callback(log.append)

        def pg_backend_pid() -> int:
            if pid is None:
                raise RuntimeError("probe failed")
            return pid

        connection.create_function("pg_backend_pid", 0, pg_backend_pid)
        try:
            yield connection
        finally:
            connection.close()

    mocker.patch.object(database, "get_raw_connection", side_effect=raw_connection)
    return database, statements


def _abort_while_fetching_query(
    mocker: MockerFixture, ctx: TaskContext, statements: list[list[str]], number: int
) -> None:
    """Fire the task's abort while the ``number``-th query fetches its results."""
    fetch_data = PostgresEngineSpec.fetch_data

    def fetch_and_abort(cursor: Any, limit: int | None = None) -> list[Any]:
        rows = fetch_data(cursor, limit)
        if len(statements) == number:
            ctx._on_abort_detected()
        return rows

    mocker.patch.object(PostgresEngineSpec, "fetch_data", side_effect=fetch_and_abort)


def test_postgres_id_is_captured_once_per_cursor_before_execute(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """``pg_backend_pid()`` runs on the chart's cursor, so only before its query.

    Read after the query it would replace the rows about to be fetched. Each
    cursor is read once, so a time comparison's second query is the one an abort
    cancels.
    """
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    database, statements = _postgres_database(mocker, [4242, 5353])
    _abort_while_fetching_query(mocker, ctx, statements, number=2)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        main = database.get_df("SELECT 'user-row' AS v")
        shifted = database.get_df("SELECT 'user-row' AS v")

    assert statements == [["SELECT pg_backend_pid()", "SELECT 'user-row' AS v"]] * 2
    assert main["v"].tolist() == shifted["v"].tolist() == ["user-row"]
    assert len(ctx._abort_handlers) == 1
    cancel.assert_called_once_with(database, 5353, ANY)
    assert _persisted(writes) == [4242, None, 5353, None]


def test_postgres_capture_failure_leaves_no_stale_handle(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """A failed probe on the second cursor must not leave the first cursor's PID."""
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    database, statements = _postgres_database(mocker, [4242, None])
    _abort_while_fetching_query(mocker, ctx, statements, number=2)
    cancel = mocker.patch("superset.tasks.async_queries.cancel_chart_query")

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 'user-row' AS v")
        shifted = database.get_df("SELECT 'user-row' AS v")

    assert shifted["v"].tolist() == ["user-row"]
    cancel.assert_not_called()
    assert _persisted(writes) == [4242, None]


def test_timeout_keeps_its_error_message(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """The task's later writes replace its properties, but keep the timeout's error.

    The timeout records ``error_message`` with the ABORTING status. The handle is
    cleared afterwards, by a write of the whole properties column from the cache,
    which must still carry that message for the TIMED_OUT task to report it.
    """
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    database, _ = _postgres_database(mocker, [4242])
    mocker.patch("superset.commands.tasks.update.UpdateTaskCommand")
    mocker.patch("superset.tasks.async_queries.cancel_chart_query")
    fetch_data = PostgresEngineSpec.fetch_data

    def time_out_while_fetching(cursor: Any, limit: int | None = None) -> list[Any]:
        # What the timeout timer does while the query runs.
        with ctx._abort_lock:
            ctx._timeout_triggered = True
        ctx._abort_locally("Task timed out")
        return fetch_data(cursor, limit)

    mocker.patch.object(
        PostgresEngineSpec, "fetch_data", side_effect=time_out_while_fetching
    )

    with _capture_query_cancellation(_chart_query(database)):
        database.get_df("SELECT 'user-row' AS v")

    cleared = writes[-1]
    assert cleared["private"]["task"]["cancel_query_id"] is None
    assert cleared["error_message"] == "Task timed out"


def _time_comparison(path: str) -> tuple[QueryContext, QueryObject]:
    """A chart comparing each month's revenue with a year earlier."""
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE sales (ds TEXT, revenue INTEGER)")
    connection.executemany(
        "INSERT INTO sales VALUES (?, ?)",
        [
            (f"{year}-{month:02d}-01", 100 + month)
            for year in (2024, 2025)
            for month in range(1, 13)
        ],
    )
    connection.commit()
    connection.close()
    database = Database(id=1, database_name="sales", sqlalchemy_uri=f"sqlite:///{path}")
    table = SqlaTable(id=1, table_name="sales", database=database)
    table.columns = [
        TableColumn(column_name="ds", is_dttm=True, type="DATETIME"),
        TableColumn(column_name="revenue", type="INTEGER"),
    ]
    table.metrics = [SqlMetric(metric_name="sum_revenue", expression="SUM(revenue)")]
    x_axis: AdhocColumn = {
        "label": "ds",
        "sqlExpression": "ds",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
        "isColumnReference": True,
    }
    query_object = QueryObject(
        datasource=table,
        columns=[x_axis],
        metrics=["sum_revenue"],
        granularity="ds",
        row_limit=10000,
        time_offsets=["1 year ago"],
        time_range="2025-01-01 : 2026-01-01",
        from_dttm=datetime(2025, 1, 1),
        to_dttm=datetime(2026, 1, 1),
        filters=[
            {"col": "ds", "op": "TEMPORAL_RANGE", "val": "2025-01-01 : 2026-01-01"}
        ],
        extras={"time_grain_sqla": "P1M"},
    )
    query_context = QueryContext(
        datasource=table,
        queries=[query_object],
        slice_=None,
        form_data={},
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        cache_values={},
    )
    return query_context, query_object


@pytest.mark.parametrize("fetch", [1, 2])
def test_abort_during_a_time_comparison_caches_nothing(
    mocker: MockerFixture,
    task_context: tuple[TaskContext, list[dict[str, Any]]],
    tmp_path: Any,
    fetch: int,
) -> None:
    """An aborted time comparison must not be cached without its shifted series.

    The abort lands once the main query has fetched its rows (the shifted query
    is never submitted) or while the shifted query fetches (its cancel fails it).
    Either way the abort ends the acquisition instead of becoming a failed shifted
    query whose empty result is merged into a cached, successful one.
    """
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, _ = task_context
    query_context, query_object = _time_comparison(str(tmp_path / "sales.db"))
    mocker.patch(
        "superset.common.query_context_processor.security_manager.get_rls_cache_key",
        return_value=[],
    )
    cached = mocker.patch(
        "superset.common.utils.query_cache_manager.set_and_log_cache",
        return_value=True,
    )
    # A session id per connection, as on PostgreSQL; a cancel fails its fetch.
    sessions: dict[int, str] = {}
    cancelled: list[str] = []
    mocker.patch.object(
        SqliteEngineSpec,
        "get_cancel_query_id",
        side_effect=lambda cursor, query: sessions.setdefault(
            id(cursor), str(len(sessions) + 1)
        ),
    )
    mocker.patch(
        "superset.tasks.async_queries.cancel_chart_query",
        side_effect=lambda database, cancel_id, app: cancelled.append(cancel_id),
    )
    fetch_data = SqliteEngineSpec.fetch_data
    fetches: list[int] = []

    def fetch_and_abort(cursor: Any, limit: int | None = None) -> list[Any]:
        fetches.append(1)
        if len(fetches) == fetch == 2:
            ctx._on_abort_detected()
        if sessions[id(cursor)] in cancelled:
            raise sqlite3.OperationalError("canceling statement due to user request")
        rows = fetch_data(cursor, limit)
        if len(fetches) == fetch == 1:
            ctx._on_abort_detected()
        return rows

    mocker.patch.object(SqliteEngineSpec, "fetch_data", side_effect=fetch_and_abort)

    with pytest.raises(ChartQueryAbortedError):
        with _capture_query_cancellation(query_context):
            query_context.get_df_payload_result(query_object)

    # The abort cancelled the session that was fetching, and nothing ran after.
    assert len(fetches) == fetch
    assert cancelled == [str(fetch)]
    cached.assert_not_called()


class _FakeTrinoCursor:
    """A Trino-like cursor: the query id is assigned once execution starts."""

    description = [("v", "varchar", None, None, None, None, None)]

    def __init__(self) -> None:
        self.query_id: str | None = None

    def execute(self, sql: str) -> None:
        self.query_id = "20261029_000000_00001_abcde"

    def fetchall(self) -> list[tuple[Any, ...]]:
        return [("user-row",)]


def test_engine_with_an_id_only_after_execute_is_unchanged(
    mocker: MockerFixture, task_context: tuple[TaskContext, list[dict[str, Any]]]
) -> None:
    """Trino's id is read when the cursor opens, as before, so it is never found.

    Engines that expose the id before execution are never read after it, so the
    task stays non-abortable, as it was.
    """
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx, writes = task_context
    database = Database(
        id=9, database_name="trino", sqlalchemy_uri="trino://user@trino:8080/hive"
    )
    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=TrinoEngineSpec,
    )
    # The execution event names the database's driver, which needs trino.
    mocker.patch("superset.models.core.event_logger", new=MagicMock())
    mocker.patch.object(database, "get_sqla_engine")
    cursor = _FakeTrinoCursor()
    get_raw_connection = mocker.patch.object(database, "get_raw_connection")
    get_raw_connection.return_value.__enter__.return_value.cursor.return_value = cursor
    get_cancel_query_id = mocker.spy(TrinoEngineSpec, "get_cancel_query_id")

    with _capture_query_cancellation(_chart_query(database)):
        df = database.get_df("SELECT 'user-row' AS v")

    assert df["v"].tolist() == ["user-row"]
    assert cursor.query_id is not None
    assert get_cancel_query_id.call_count == 1
    assert get_cancel_query_id.spy_return is None
    assert ctx._abort_handlers == []
    assert writes == []
