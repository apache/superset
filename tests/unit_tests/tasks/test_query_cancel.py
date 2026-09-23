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

from unittest.mock import MagicMock, patch

from superset.tasks.query_cancel import (
    _cancel_id_sink,
    _CancellationQuery,
    cancel_chart_query,
    capture_cancel_id,
    capture_cancel_query_id,
    notify_cursor,
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
    notify_cursor(MagicMock())


def test_capture_cancel_id_sets_and_resets_the_sink() -> None:
    sink = MagicMock()
    with capture_cancel_id(sink):
        cursor = MagicMock()
        notify_cursor(cursor)
        sink.assert_called_once_with(cursor)
    assert _cancel_id_sink.get() is None


def test_notify_cursor_swallows_sink_errors() -> None:
    with capture_cancel_id(MagicMock(side_effect=RuntimeError("boom"))):
        # A capture failure only forfeits cancellability; it must not raise.
        notify_cursor(MagicMock())


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
    qc.datasource.database.db_engine_spec.get_cancel_query_id.return_value = cancel_id
    return qc


def test_capture_registers_abort_handler_once_when_id_available() -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx = MagicMock()
    qc = _query_context("42")
    with (
        patch("superset.tasks.async_queries.get_context", return_value=ctx),
        patch("superset.tasks.async_queries.current_app"),
    ):
        with _capture_query_cancellation(qc):
            sink = _cancel_id_sink.get()
            assert sink is not None
            sink(MagicMock())  # first cursor -> registers handler
            sink(MagicMock())  # second cursor -> no double registration

    ctx.on_abort.assert_called_once()
    # The handle is persisted (for the orphan reaper) before on_abort, whose
    # write flushes it — assert both the call and the ordering.
    ctx.set_cancellation.assert_called_once_with(qc.datasource.database.id, "42")
    ordered = [c[0] for c in ctx.method_calls]
    assert ordered.index("set_cancellation") < ordered.index("on_abort")


def test_capture_skips_abort_handler_when_engine_has_no_cancel_id() -> None:
    from superset.tasks.async_queries import _capture_query_cancellation

    ctx = MagicMock()
    qc = _query_context(None)
    with (
        patch("superset.tasks.async_queries.get_context", return_value=ctx),
        patch("superset.tasks.async_queries.current_app"),
    ):
        with _capture_query_cancellation(qc):
            sink = _cancel_id_sink.get()
            assert sink is not None
            sink(MagicMock())

    ctx.on_abort.assert_not_called()
    ctx.set_cancellation.assert_not_called()


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
