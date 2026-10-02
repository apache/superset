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

from unittest.mock import MagicMock, Mock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from flask import Flask

from superset.constants import (
    QUERY_CANCEL_KEY,
    QUERY_DISPATCHED_KEY,
    QUERY_EARLY_CANCEL_KEY,
)
from superset.db_engine_specs.impala import ImpalaEngineSpec
from superset.sql.execution.executor import SQLExecutor
from superset.sql_lab import cancel_query


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
def test_stop_with_cancel_id_uses_http(use_executor: bool) -> None:
    """Stop must reach Impala even when no worker is polling the live cursor."""
    app: Flask = Flask(__name__)
    app.config["IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"] = True
    cancel_id: str = "0123456789abcdef:fedcba9876543210"
    query: MagicMock = MagicMock(extra={QUERY_CANCEL_KEY: cancel_id})
    query.database.db_engine_spec = ImpalaEngineSpec
    query.database.url_object.host = "impala.example.com"

    post: MagicMock
    with (
        app.app_context(),
        patch("superset.db_engine_specs.impala.requests.post") as post,
    ):
        post.return_value.status_code = 200
        if use_executor:
            assert SQLExecutor._cancel_query(query.database, query)
        else:
            assert cancel_query(query)

    post.assert_called_once_with(
        f"http://impala.example.com:25000/cancel_query?query_id={cancel_id}",
        timeout=3,
        allow_redirects=False,
    )


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
    db.session.commit.assert_not_called()


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
    post: MagicMock
    with (
        app.app_context(),
        patch("superset.db_engine_specs.impala.db") as db,
        patch("superset.db_engine_specs.impala.requests.post") as post,
    ):
        if use_executor:
            assert SQLExecutor._cancel_query(query.database, query)
        else:
            assert cancel_query(query)
        db.session.commit.assert_called_once_with()

        cursor: Mock = Mock()
        cursor.status.return_value = "PENDING_STATE"
        ImpalaEngineSpec.handle_cursor(cursor, query)

    assert query.extra[QUERY_EARLY_CANCEL_KEY] is True
    post.assert_not_called()
    cursor.cancel_operation.assert_called_once_with()


def test_prepare_cancel_query_keeps_a_published_cancel_id() -> None:
    """Once the handle is published, Stop goes through the HTTP cancel."""
    query: MagicMock = MagicMock(extra={QUERY_CANCEL_KEY: "abc"})
    with patch("superset.db_engine_specs.impala.db") as db:
        ImpalaEngineSpec.prepare_cancel_query(query)
    query.set_extra_json_key.assert_not_called()
    db.session.commit.assert_not_called()


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
