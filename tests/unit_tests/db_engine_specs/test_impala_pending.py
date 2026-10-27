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

from contextlib import nullcontext
from unittest.mock import MagicMock, Mock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from flask import Flask
from pytest_mock import MockerFixture

from superset.constants import (
    QUERY_CANCEL_KEY,
    QUERY_DISPATCHED_KEY,
    QUERY_EARLY_CANCEL_KEY,
)
from superset.db_engine_specs.impala import ImpalaEngineSpec
from superset.sql.execution.executor import SQLExecutor
from superset.sql_lab import cancel_query, execute_query, SqlLabQueryStoppedException
from superset.utils.core import QueryStatus


@pytest.mark.parametrize("use_executor", [False, True])
def test_stop_during_poll_does_not_fail_sync_fetch(
    mocker: MockerFixture, app_context: None, use_executor: bool
) -> None:
    """A worker seeing the committed stop intent must also see STOPPED."""
    impyla = pytest.importorskip("impala.hiveserver2")

    query = MagicMock(
        id=1,
        status=QueryStatus.RUNNING,
        progress=0,
        executed_sql="SELECT 1",
        extra={QUERY_CANCEL_KEY: "0123456789abcdef:fedcba9876543210"},
        limit=None,
    )
    query.database.db_engine_spec = ImpalaEngineSpec
    query.set_extra_json_key.side_effect = lambda key, value: query.extra.update(
        {key: value}
    )
    cursor = impyla.HiveServer2Cursor(MagicMock())
    operation = MagicMock(has_result_set=True)

    def execute_async(sql: str) -> None:
        """Publish a real impyla operation backed by mocked RPCs."""
        cursor._last_operation = operation
        cursor._last_operation_active = True

    def stop_before_poll() -> str:
        """Let the worker run before the Stop caller can do another commit."""
        # The guarded stop caller publishes STOPPED before engine cancellation.
        query.status = QueryStatus.STOPPED
        session.commit()
        if use_executor:
            assert SQLExecutor._cancel_query(query.database, query)
        else:
            assert cancel_query(query)
        return "RUNNING_STATE"

    mocker.patch.object(cursor, "execute_async", side_effect=execute_async)
    operation.get_status.side_effect = stop_before_poll
    session = mocker.patch("superset.db.session")
    committed_stops: list[QueryStatus] = []

    def record_commit() -> None:
        """Capture the status published with the early-cancel flag."""
        if query.extra.get(QUERY_EARLY_CANCEL_KEY):
            committed_stops.append(query.status)

    session.commit.side_effect = record_commit
    mocker.patch.object(
        ImpalaEngineSpec,
        "get_cancel_query_id",
        return_value=query.extra[QUERY_CANCEL_KEY],
    )
    mocker.patch("superset.sql_lab.warm_and_release_connection")
    mocker.patch(
        "superset.sql_lab.event_logger.log_context", return_value=nullcontext()
    )
    post = mocker.patch("superset.db_engine_specs.impala.get_ssrf_safe_requester").return_value.post

    with pytest.raises(SqlLabQueryStoppedException):
        execute_query(query, cursor)

    # The poll publishes the flag only after the caller has recorded STOPPED.
    assert committed_stops == [QueryStatus.STOPPED]
    operation.cancel.assert_called_once_with()
    operation.close.assert_called_once_with()
    assert cursor.description is None
    post.assert_not_called()


@pytest.mark.parametrize(
    "state", ["PENDING_STATE", "INITIALIZED_STATE", "RUNNING_STATE"]
)
def test_cancel_unfinished_operation(state: str) -> None:
    """An early stop must reach the live operation in every unfinished state."""
    query: Mock = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)
    cursor: Mock = Mock()
    cursor.status.side_effect = [state, "FINISHED_STATE"]
    with patch("superset.db_engine_specs.impala.db"):
        ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
    cursor.get_log.assert_not_called()


def test_pending_operation_is_polled_without_progress() -> None:
    """Pending work must not escape the cancel/progress polling loop."""
    app: Flask = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    query: Mock = Mock(id=1, extra={}, progress=0)
    cursor: Mock = Mock()
    cursor.status.side_effect = [
        "PENDING_STATE",
        "INITIALIZED_STATE",
        "RUNNING_STATE",
        "FINISHED_STATE",
    ]
    cursor.get_log.return_value = "Query abc: 25% Complete"
    with app.app_context(), patch("superset.db_engine_specs.impala.db"):
        ImpalaEngineSpec.handle_cursor(cursor, query)
    assert cursor.status.call_count == 4
    cursor.get_log.assert_called_once_with()
    assert query.progress == 25
    cursor.cancel_operation.assert_not_called()


@pytest.mark.parametrize("use_executor", [False, True])
def test_stop_running_query_uses_live_cursor(use_executor: bool) -> None:
    """
    Stopping a running query with a published cancel handle cancels it through
    the live cursor only. An HTTP cancel would invalidate the handle the worker
    is still polling, failing the run instead of stopping it.
    """
    app: Flask = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    cancel_id: str = "0123456789abcdef:fedcba9876543210"
    query: MagicMock = MagicMock(
        id=1,
        extra={QUERY_CANCEL_KEY: cancel_id, QUERY_DISPATCHED_KEY: True},
        status="running",
        progress=0,
    )
    query.database.db_engine_spec = ImpalaEngineSpec
    query.database.url_object.host = "impala.example.com"

    def set_extra_json_key(key: str, value: bool) -> None:
        """Record the early-cancel flag in query.extra."""
        query.extra[key] = value

    query.set_extra_json_key.side_effect = set_extra_json_key
    requester: MagicMock
    with (
        app.app_context(),
        patch("superset.db_engine_specs.impala.db") as db,
        patch("superset.db_engine_specs.impala.get_ssrf_safe_requester") as requester,
    ):
        if use_executor:
            assert SQLExecutor._cancel_query(query.database, query)
        else:
            assert cancel_query(query)
        db.session.commit.assert_not_called()

        cursor: Mock = Mock()
        cursor.status.return_value = "RUNNING_STATE"
        ImpalaEngineSpec.handle_cursor(cursor, query)

    assert query.extra[QUERY_EARLY_CANCEL_KEY] is True
    requester.return_value.post.assert_not_called()
    cursor.get_log.assert_not_called()
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()


def test_stopped_status_cancels_pending_operation() -> None:
    """Publishing a handle must not lose Stop when no early flag is present."""
    query: Mock = Mock(id=1, extra={}, status="stopped", progress=0)
    cursor: Mock = Mock()
    cursor.status.return_value = "PENDING_STATE"
    with patch("superset.db_engine_specs.impala.db"):
        ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
    cursor.get_log.assert_not_called()


@pytest.mark.parametrize("log", ["", "Admission queued", "Query abc: 0% Complete"])
def test_non_progress_logs_keep_polling(log: str) -> None:
    """An admission log is not a progress record and must not end polling."""
    app: Flask = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    query: Mock = Mock(id=1, extra={}, progress=0)
    cursor: Mock = Mock()
    cursor.status.side_effect = ["RUNNING_STATE", "FINISHED_STATE"]
    cursor.get_log.return_value = log
    with app.app_context(), patch("superset.db_engine_specs.impala.db") as db:
        ImpalaEngineSpec.handle_cursor(cursor, query)
    assert cursor.status.call_count == 2
    assert query.progress == 0
    # Only the poll's transaction boundary commits; no progress is written.
    db.session.commit.assert_called_once_with()


def test_failed_cancel_still_releases_the_operation() -> None:
    """A cancel RPC that errors must not leave the operation and cursor open."""
    query: Mock = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)
    cursor: Mock = Mock()
    cursor.status.return_value = "PENDING_STATE"
    cursor.cancel_operation.side_effect = RuntimeError("rpc failed")
    with patch("superset.db_engine_specs.impala.db"):
        ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()


@pytest.mark.parametrize("use_executor", [False, True])
def test_stop_before_cancel_id_is_published_uses_live_cursor(
    use_executor: bool,
) -> None:
    """
    A stop that lands after dispatch but before ``execute_async`` publishes the
    cancel handle succeeds, and the polling loop then cancels the operation.
    """
    app: Flask = Flask(__name__)
    query: MagicMock = MagicMock(id=1, extra={QUERY_DISPATCHED_KEY: True}, progress=0)
    query.database.db_engine_spec = ImpalaEngineSpec

    def set_extra_json_key(key: str, value: bool) -> None:
        """Record the early-cancel flag in query.extra."""
        query.extra[key] = value

    query.set_extra_json_key.side_effect = set_extra_json_key
    requester: MagicMock
    with (
        app.app_context(),
        patch("superset.db_engine_specs.impala.db") as db,
        patch("superset.db_engine_specs.impala.get_ssrf_safe_requester") as requester,
    ):
        if use_executor:
            assert SQLExecutor._cancel_query(query.database, query)
        else:
            assert cancel_query(query)
        # The caller commits early intent together with the guarded STOPPED write.
        db.session.commit.assert_not_called()

        cursor: Mock = Mock()
        cursor.status.return_value = "PENDING_STATE"
        ImpalaEngineSpec.handle_cursor(cursor, query)

    assert query.extra[QUERY_EARLY_CANCEL_KEY] is True
    requester.return_value.post.assert_not_called()
    cursor.cancel_operation.assert_called_once_with()


@pytest.mark.parametrize("extra", [{}, {QUERY_CANCEL_KEY: "abc"}])
def test_prepare_cancel_query_flags_stop(extra: dict[str, str]) -> None:
    """Stop is flagged for the live cursor whether or not a handle is published."""
    query: MagicMock = MagicMock(extra=extra, status=QueryStatus.RUNNING)
    with patch("superset.db_engine_specs.impala.db") as db:
        ImpalaEngineSpec.prepare_cancel_query(query)
    query.set_extra_json_key.assert_called_once_with(QUERY_EARLY_CANCEL_KEY, True)
    db.session.commit.assert_not_called()
    assert query.status == QueryStatus.RUNNING


def test_pending_operation_polls_with_backoff() -> None:
    """A pending operation is polled quickly, backing off to the poll interval."""
    app: Flask = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0.3}
    query: Mock = Mock(id=1, extra={}, progress=0)
    cursor: Mock = Mock()
    cursor.status.side_effect = [
        "PENDING_STATE",
        "PENDING_STATE",
        "INITIALIZED_STATE",
        "RUNNING_STATE",
        "FINISHED_STATE",
    ]
    cursor.get_log.return_value = ""
    sleep: MagicMock
    with (
        app.app_context(),
        patch("superset.db_engine_specs.impala.db") as db,
        patch("superset.db_engine_specs.impala.time.sleep") as sleep,
    ):
        ImpalaEngineSpec.handle_cursor(cursor, query)
    assert [call.args[0] for call in sleep.call_args_list] == [0.1, 0.2, 0.3, 0.3]
    assert db.session.refresh.call_count == 4
    db.session.query.assert_not_called()


@pytest.mark.parametrize("state", ["PENDING_STATE", "RUNNING_STATE"])
def test_soft_time_limit_cancels_the_operation(state: str) -> None:
    """
    The soft time limit firing while the loop polls cancels the operation and
    propagates, so SQL Lab marks the query timed out instead of waiting on it.
    """
    app: Flask = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 5}
    query: Mock = Mock(id=1, extra={}, status="running", progress=0)
    cursor: Mock = Mock()
    cursor.status.return_value = state
    cursor.get_log.return_value = ""
    with (
        app.app_context(),
        patch("superset.db_engine_specs.impala.db"),
        patch(
            "superset.db_engine_specs.impala.time.sleep",
            side_effect=SoftTimeLimitExceeded(),
        ),
    ):
        with pytest.raises(SoftTimeLimitExceeded):
            ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()


@pytest.mark.parametrize("method", ["cancel_operation", "close_operation", "close"])
def test_cancel_operation_propagates_soft_time_limit(method: str) -> None:
    """Timeouts in each cleanup RPC must escape the cancellation helper."""
    cursor: Mock = Mock()
    getattr(cursor, method).side_effect = SoftTimeLimitExceeded()

    with pytest.raises(SoftTimeLimitExceeded):
        ImpalaEngineSpec._cancel_operation(cursor, 1)


@pytest.mark.parametrize("method", ["cancel_operation", "close_operation", "close"])
@pytest.mark.parametrize("repeat_timeout", [False, True])
def test_stop_cleanup_propagates_soft_time_limit(
    method: str, repeat_timeout: bool
) -> None:
    """A timeout during Stop must escape whether or not cleanup also times out."""
    query: Mock = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)
    cursor: Mock = Mock()
    cursor.status.return_value = "PENDING_STATE"
    timeout: SoftTimeLimitExceeded = SoftTimeLimitExceeded()
    getattr(cursor, method).side_effect = timeout if repeat_timeout else [timeout, None]

    with patch("superset.db_engine_specs.impala.db"):
        with pytest.raises(SoftTimeLimitExceeded):
            ImpalaEngineSpec.handle_cursor(cursor, query)
    if not repeat_timeout:
        cursor.close.assert_called()


@pytest.mark.parametrize("method", ["cancel_operation", "close_operation", "close"])
def test_cancel_operation_tolerates_rpc_failures(method: str) -> None:
    """Ordinary RPC failures must not prevent the remaining cleanup calls."""
    cursor: Mock = Mock()
    getattr(cursor, method).side_effect = RuntimeError("rpc failed")

    ImpalaEngineSpec._cancel_operation(cursor, 1)

    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()


def test_pending_refresh_observes_stop() -> None:
    """Refreshing the existing query must observe a Stop without a second SELECT."""
    app: Flask = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    query: Mock = Mock(id=1, extra={}, status="running", progress=0)
    cursor: Mock = Mock()
    cursor.status.return_value = "PENDING_STATE"

    def refresh_query(refreshed_query: Mock) -> None:
        """Simulate a stop arriving on the second metadata refresh."""
        if db.session.refresh.call_count == 2:
            refreshed_query.status = "stopped"

    with app.app_context(), patch("superset.db_engine_specs.impala.db") as db:
        db.session.refresh.side_effect = refresh_query
        ImpalaEngineSpec.handle_cursor(cursor, query)

    assert db.session.refresh.call_count == 2
    db.session.query.assert_not_called()
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
