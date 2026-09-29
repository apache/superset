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
from flask import Flask

from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.impala import ImpalaEngineSpec
from superset.sql.execution.executor import SQLExecutor
from superset.sql_lab import cancel_query


@pytest.mark.parametrize(
    "state", ["PENDING_STATE", "INITIALIZED_STATE", "RUNNING_STATE"]
)
def test_cancel_unfinished_operation(state: str) -> None:
    """An early stop must reach the live operation in every unfinished state."""
    query = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)
    cursor = Mock()
    cursor.status.side_effect = [state, "FINISHED_STATE"]
    with patch("superset.db_engine_specs.impala.db") as db:
        db.session.query.return_value.filter_by.return_value.one.return_value = query
        ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
    cursor.get_log.assert_not_called()


def test_pending_operation_is_polled_without_progress() -> None:
    """Pending work must not escape the cancel/progress polling loop."""
    app = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    query = Mock(id=1, extra={}, progress=0)
    cursor = Mock()
    cursor.status.side_effect = [
        "PENDING_STATE",
        "INITIALIZED_STATE",
        "RUNNING_STATE",
        "FINISHED_STATE",
    ]
    cursor.get_log.return_value = "Query abc: 25% Complete"
    with app.app_context(), patch("superset.db_engine_specs.impala.db") as db:
        db.session.query.return_value.filter_by.return_value.one.return_value = query
        ImpalaEngineSpec.handle_cursor(cursor, query)
    assert cursor.status.call_count == 4
    cursor.get_log.assert_called_once_with()
    assert query.progress == 25
    cursor.cancel_operation.assert_not_called()


@pytest.mark.parametrize("use_executor", [False, True])
def test_stop_with_cancel_id_uses_http(use_executor: bool) -> None:
    """Stop must reach Impala even when no worker is polling the live cursor."""
    app = Flask(__name__)
    app.config["IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"] = True
    cancel_id = "0123456789abcdef:fedcba9876543210"
    query = MagicMock(extra={QUERY_CANCEL_KEY: cancel_id})
    query.database.db_engine_spec = ImpalaEngineSpec
    query.database.url_object.host = "impala.example.com"

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


@pytest.mark.parametrize("state", ["stopped", "timed_out"])
def test_stopped_status_cancels_pending_operation(state: str) -> None:
    """Publishing a handle must not lose Stop when no early flag is present."""
    query = Mock(id=1, extra={}, status=state, progress=0)
    cursor = Mock()
    cursor.status.return_value = "PENDING_STATE"
    with patch("superset.db_engine_specs.impala.db") as db:
        db.session.query.return_value.filter_by.return_value.one.return_value = query
        ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
    cursor.get_log.assert_not_called()


@pytest.mark.parametrize("log", ["", "Admission queued", "Query abc: 0% Complete"])
def test_non_progress_logs_keep_polling(log: str) -> None:
    """An admission log is not a progress record and must not end polling."""
    app = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    query = Mock(id=1, extra={}, progress=0)
    cursor = Mock()
    cursor.status.side_effect = ["RUNNING_STATE", "FINISHED_STATE"]
    cursor.get_log.return_value = log
    with app.app_context(), patch("superset.db_engine_specs.impala.db") as db:
        db.session.query.return_value.filter_by.return_value.one.return_value = query
        ImpalaEngineSpec.handle_cursor(cursor, query)
    assert cursor.status.call_count == 2
    assert query.progress == 0
    db.session.commit.assert_not_called()


def test_failed_cancel_still_releases_the_operation() -> None:
    """A cancel RPC that errors must not leave the operation and cursor open."""
    query = Mock(id=1, extra={QUERY_EARLY_CANCEL_KEY: True}, progress=0)
    cursor = Mock()
    cursor.status.return_value = "PENDING_STATE"
    cursor.cancel_operation.side_effect = RuntimeError("rpc failed")
    with patch("superset.db_engine_specs.impala.db") as db:
        db.session.query.return_value.filter_by.return_value.one.return_value = query
        ImpalaEngineSpec.handle_cursor(cursor, query)
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
