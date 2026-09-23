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

from contextlib import contextmanager
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


# --- synchronous Explore cancellation registry ----------------------------


class _FakeCache:
    """Minimal dict-backed stand-in for ``cache_manager.cache``.

    Real storage (rather than a MagicMock) so the user-scoping of the registry
    keys is genuinely exercised end to end.
    """

    def __init__(self) -> None:
        self.store: dict[str, object] = {}

    def set(self, key: str, value: object, timeout: int | None = None) -> None:
        self.store[key] = value

    def get(self, key: str) -> object | None:
        return self.store.get(key)

    def delete(self, key: str) -> None:
        self.store.pop(key, None)


@contextmanager
def _registry_env(user_id: int | None, cache: "_FakeCache"):
    """Run with a given current user and a shared fake cache backend."""
    # ``cache_manager.cache`` is a read-only property; swap the backing attribute.
    with (
        patch("superset.utils.core.get_user_id", return_value=user_id),
        patch("superset.extensions.cache_manager._cache", cache),
        patch("superset.tasks.query_cancel._registry_ttl", return_value=60),
    ):
        yield


def _run_cancellable(client_id, database, cache, user_id, cancel_id="engine-1"):
    """Drive one cancellable query, returning whether a handle was live inside it."""
    from superset.tasks.query_cancel import cancellable_chart_query

    with _registry_env(user_id, cache):
        with patch(
            "superset.tasks.query_cancel.capture_cancel_query_id",
            return_value=cancel_id,
        ):
            with cancellable_chart_query(client_id, database):
                # Stands in for Database._execute_sql_with_mutation_and_logging
                # handing the live cursor to the active sink before executing.
                notify_cursor(MagicMock())
                inside = dict(cache.store)
    return inside


def test_registry_key_is_scoped_by_user() -> None:
    from superset.tasks.query_cancel import _registry_key

    # Same client_id under two users must not collide.
    assert _registry_key(1, "abc") != _registry_key(2, "abc")
    assert "abc" in _registry_key(1, "abc")


def test_cancellable_chart_query_publishes_then_discards_the_handle() -> None:
    cache = _FakeCache()
    database = MagicMock()
    database.id = 5

    inside = _run_cancellable("client-1", database, cache, user_id=1)

    # Live for the duration of the query...
    assert inside == {
        "chart-query-cancel:1:client-1": {
            "database_id": 5,
            "cancel_query_id": "engine-1",
        }
    }
    # ...and cleaned up once it returns.
    assert cache.store == {}


def test_cancellable_chart_query_is_noop_without_a_client_id() -> None:
    cache = _FakeCache()
    database = MagicMock()
    database.id = 5

    assert _run_cancellable(None, database, cache, user_id=1) == {}


def test_cancellable_chart_query_is_noop_without_a_database() -> None:
    cache = _FakeCache()

    assert _run_cancellable("client-1", None, cache, user_id=1) == {}


def test_cancellable_chart_query_is_noop_for_an_anonymous_request() -> None:
    # An anonymous viewer has no user id to scope the handle to, and an unscoped
    # handle would be cancellable by any other anonymous visitor.
    cache = _FakeCache()
    database = MagicMock()
    database.id = 5

    assert _run_cancellable("client-1", database, cache, user_id=None) == {}


def test_cancellable_chart_query_publishes_nothing_when_engine_has_no_cancel_id() -> (
    None
):
    cache = _FakeCache()
    database = MagicMock()
    database.id = 5

    assert _run_cancellable("client-1", database, cache, 1, cancel_id=None) == {}


def test_cancel_chart_query_for_user_cancels_its_own_query() -> None:
    from superset.tasks.query_cancel import cancel_chart_query_for_user

    cache = _FakeCache()
    cache.store["chart-query-cancel:1:client-1"] = {
        "database_id": 5,
        "cancel_query_id": "engine-1",
    }
    database = MagicMock()

    with _registry_env(1, cache):
        with (
            patch(
                "superset.daos.database.DatabaseDAO.find_by_id", return_value=database
            ),
            patch(
                "superset.tasks.query_cancel.cancel_chart_query", return_value=True
            ) as cancel,
        ):
            assert cancel_chart_query_for_user("client-1") is True

    cancel.assert_called_once_with(database, "engine-1")
    # A cancelled query's handle is dropped rather than left to expire.
    assert cache.store == {}


def test_cancel_chart_query_for_user_cannot_reach_another_users_query() -> None:
    """Regression test: ``client_id`` is untrusted, client-supplied input.

    User 1 has a running, cancellable query. User 2 asks to cancel that exact
    ``client_id``. Because the registry key embeds the requesting user, the
    lookup misses: no engine cancellation is attempted and user 1's handle is
    left untouched.
    """
    from superset.tasks.query_cancel import cancel_chart_query_for_user

    cache = _FakeCache()
    victim_handle = {"database_id": 5, "cancel_query_id": "engine-1"}
    cache.store["chart-query-cancel:1:client-1"] = victim_handle

    with _registry_env(2, cache):
        with (
            patch("superset.daos.database.DatabaseDAO.find_by_id") as find_by_id,
            patch("superset.tasks.query_cancel.cancel_chart_query") as cancel,
        ):
            assert cancel_chart_query_for_user("client-1") is False

    cancel.assert_not_called()
    find_by_id.assert_not_called()
    assert cache.store == {"chart-query-cancel:1:client-1": victim_handle}


def test_cancellable_chart_query_cannot_overwrite_another_users_handle() -> None:
    """A client_id colliding with another user's lands in its own namespace."""
    cache = _FakeCache()
    victim_handle = {"database_id": 5, "cancel_query_id": "engine-victim"}
    cache.store["chart-query-cancel:1:client-1"] = victim_handle

    database = MagicMock()
    database.id = 9
    inside = _run_cancellable(
        "client-1", database, cache, user_id=2, cancel_id="engine-attacker"
    )

    # The attacker's own entry is separate; the victim's is intact throughout.
    assert inside["chart-query-cancel:1:client-1"] == victim_handle
    assert inside["chart-query-cancel:2:client-1"] == {
        "database_id": 9,
        "cancel_query_id": "engine-attacker",
    }
    assert cache.store == {"chart-query-cancel:1:client-1": victim_handle}


def test_cancel_chart_query_for_user_returns_false_for_anonymous() -> None:
    from superset.tasks.query_cancel import cancel_chart_query_for_user

    cache = _FakeCache()
    with _registry_env(None, cache):
        with patch("superset.tasks.query_cancel.cancel_chart_query") as cancel:
            assert cancel_chart_query_for_user("client-1") is False
    cancel.assert_not_called()


def test_cancel_chart_query_for_user_returns_false_when_nothing_registered() -> None:
    from superset.tasks.query_cancel import cancel_chart_query_for_user

    cache = _FakeCache()
    with _registry_env(1, cache):
        with patch("superset.tasks.query_cancel.cancel_chart_query") as cancel:
            assert cancel_chart_query_for_user("missing") is False
    cancel.assert_not_called()
