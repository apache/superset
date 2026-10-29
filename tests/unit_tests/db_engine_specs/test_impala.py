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
from datetime import datetime
from typing import Any, Optional
from unittest.mock import MagicMock, Mock, patch, PropertyMock

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.constants import QUERY_CANCEL_KEY
from superset.db_engine_specs.impala import (
    ImpalaEngineSpec as spec,  # noqa: N813
    ImpalaFetchStoppedError,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.executor import _LimitedCursor
from superset.sql_lab import execute_query, SqlLabQueryStoppedException
from superset.utils.core import QueryStatus
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("TimeStamp", "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_cancel_query_id() -> None:
    query = Query()

    cursor_mock = Mock()
    last_operation_mock = Mock()
    cursor_mock._last_operation = last_operation_mock

    guid = bytes(reversed(bytes.fromhex("9fbdba20000000006940643a2731718b")))
    last_operation_mock.handle.operationId.guid = guid

    assert (
        spec.get_cancel_query_id(cursor_mock, query)
        == "6940643a2731718b:9fbdba2000000000"
    )


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("superset.db_engine_specs.impala.get_ssrf_safe_requester")
def test_cancel_query(requester_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 200
    post_mock = requester_mock.return_value.post
    post_mock.return_value = response_mock

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    requester_mock.assert_called_once_with(allow_unsafe_hosts=False)
    post_mock.assert_called_once_with(
        "http://impala.example.com:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is True


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("superset.db_engine_specs.impala.get_ssrf_safe_requester")
def test_cancel_query_failed(requester_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 500
    post_mock = requester_mock.return_value.post
    post_mock.return_value = response_mock

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    post_mock.assert_called_once_with(
        "http://impala.example.com:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is False


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("superset.db_engine_specs.impala.get_ssrf_safe_requester")
def test_cancel_query_exception(requester_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    requester_mock.return_value.post.side_effect = Exception("Network error")

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    assert result is False


@patch("requests.post")
def test_cancel_query_blocks_internal_host(post_mock: Mock, app_context: None) -> None:
    """A private/internal Impala host is refused by default (no HTTP call)."""
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://169.254.169.254:21050/default",
    )
    query.database = database

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    assert result is False
    post_mock.assert_not_called()


@patch("requests.post")
def test_cancel_query_allows_internal_host_with_opt_out(
    post_mock: Mock, app_context: None
) -> None:
    """IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS=True permits internal targets."""
    from flask import current_app

    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://10.0.0.5:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 200
    post_mock.return_value = response_mock

    original = current_app.config.get("IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS")
    current_app.config["IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"] = True
    try:
        result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")
    finally:
        current_app.config["IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"] = original

    post_mock.assert_called_once_with(
        "http://10.0.0.5:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is True


class _DriverError(Exception):
    """Represent impyla's optional DB-API error base in unit tests."""


@pytest.fixture
def impala_errors(mocker: MockerFixture) -> None:
    """Provide driver errors without requiring the optional impyla package."""
    mocker.patch.dict("sys.modules", {"impala.error": Mock(Error=_DriverError)})


class _AsyncCursor:
    """Public impyla API for a pending statement without rows."""

    description: None = None

    def __init__(self, error: Exception | None = None) -> None:
        """Initialize the pending operation and its optional failure."""
        self.error: Exception | None = error
        self.waited: bool = False

    def execute_async(self, query: str) -> None:
        """Expose the asynchronous execution capability."""

    def is_executing(self) -> bool:
        """Report one pending poll before completing."""
        if not self.waited:
            self.waited = True
            return True
        return False

    def execution_failed(self) -> bool:
        """Report whether the completed operation failed."""
        return self.error is not None

    def fetchall(self) -> list[tuple[int]]:
        """Surface asynchronous failures without accepting no-result fetches."""
        if self.error:
            raise self.error
        raise RuntimeError("Trying to fetch results on an operation with no results")


def test_fetch_data_waits_for_operation(app_context: None, impala_errors: None) -> None:
    """DML still pending after execute_async completes before fetch_data returns."""
    cursor = _AsyncCursor()
    assert spec.fetch_data(cursor) == []
    assert cursor.waited


def test_fetch_data_raises_operation_error(
    app_context: None, impala_errors: None
) -> None:
    """An asynchronous driver failure is not reported as an empty result."""
    cursor = _AsyncCursor(_DriverError("AnalysisException: boom"))
    with pytest.raises(_DriverError, match="AnalysisException: boom"):
        spec.fetch_data(cursor)


@patch("superset.db_engine_specs.impala.time.sleep")
@patch("superset.db_engine_specs.impala.time.monotonic", side_effect=[0, 1, 31])
def test_fetch_data_timeout(
    monotonic_mock: Mock, sleep_mock: Mock, app_context: None, impala_errors: None
) -> None:
    """A perpetually pending operation is cancelled within the query timeout."""
    from flask import current_app

    cursor = Mock()
    cursor.is_executing.return_value = True
    with patch.dict(current_app.config, SQLLAB_TIMEOUT=30):
        with pytest.raises(TimeoutError, match="Timed out waiting"):
            spec.fetch_data(cursor)
    cursor.cancel_operation.assert_called_once_with()
    cursor.fetchall.assert_not_called()
    sleep_mock.assert_called_once_with(0.1)
    assert monotonic_mock.call_count == 3


@pytest.mark.parametrize("error", [TypeError("bug"), AttributeError("bug")])
@patch.object(spec, "get_dbapi_mapped_exception")
def test_fetch_data_preserves_programming_errors(
    mapped_exception: Mock, error: Exception, app_context: None, impala_errors: None
) -> None:
    """Programming errors are not rewritten as database errors."""
    cursor = Mock()
    cursor.is_executing.side_effect = error
    with pytest.raises(type(error), match="bug"):
        spec.fetch_data(cursor)
    mapped_exception.assert_not_called()


def test_fetch_data_synchronous_cursor() -> None:
    """A synchronous DB-API cursor needs no asynchronous wait or driver import."""
    cursor = Mock(spec=["description", "fetchall"])
    cursor.description = [("a", "INTEGER", None, None, None, None, True)]
    cursor.fetchall.return_value = [(1,)]
    assert spec.fetch_data(cursor) == [(1,)]


def test_fetch_data_async_result_set(app_context: None, impala_errors: None) -> None:
    """Completed asynchronous SELECT statements still return their rows."""
    cursor = Mock()
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    cursor.description = [("a", "INTEGER", None, None, None, None, True)]
    cursor.fetchall.return_value = [(1,)]
    assert spec.fetch_data(cursor) == [(1,)]
    cursor.cancel_operation.assert_not_called()


class _Batch:
    """A driver result batch: its rows, and whether more rows may follow."""

    def __init__(self, rows: list[tuple[int]], expect_more_rows: bool) -> None:
        """Hold the rows one result RPC returned."""
        self.rows: list[tuple[int]] = list(rows)
        self.expect_more_rows: bool = expect_more_rows

    def __len__(self) -> int:
        """Count the rows left in the batch."""
        return len(self.rows)

    def pop(self) -> tuple[int]:
        """Hand out the rows in order."""
        return self.rows.pop(0)


class _Operation:
    """A driver operation that answers one result RPC at a time."""

    def __init__(self, batches: list[_Batch]) -> None:
        """Script the batches the result RPCs return."""
        self.batches: list[_Batch] = batches
        self.fetches: int = 0

    def fetch(self, *args: Any, **kwargs: Any) -> _Batch:
        """Return the next result RPC's batch, then empty ones at the end."""
        self.fetches += 1
        return self.batches.pop(0) if self.batches else _Batch([], False)


class _StreamingCursor:
    """
    A finished impyla SELECT whose rows are read through one result RPC at a
    time, retrying batches that come back empty while more rows are expected.
    """

    description = [("x", "INT", None, None, None, None, True)]
    buffersize = 1024

    def __init__(self, operation: _Operation) -> None:
        """Start reading the operation's results."""
        self._last_operation: _Operation = operation
        self._buffer: _Batch = _Batch([], True)
        self._exhausted: bool = False
        self.arraysize: int = 1
        self.calls: list[str] = []

    def execute_async(self, query: str) -> None:
        """Expose the asynchronous execution capability."""

    def status(self) -> str:
        """Report the finished state of a streaming SELECT."""
        return "FINISHED_STATE"

    def is_executing(self) -> bool:
        """Report the operation as no longer executing."""
        return False

    def execution_failed(self) -> bool:
        """Report a successful operation."""
        return False

    def _next_row(self) -> Optional[tuple[int]]:
        """Read the next row, issuing result RPCs as the driver does."""
        while not self._exhausted and not len(self._buffer):
            self._buffer = self._last_operation.fetch(self.description, self.buffersize)
            if not len(self._buffer) and not self._buffer.expect_more_rows:
                self._exhausted = True
        return None if self._exhausted else self._buffer.pop()

    def fetchmany(self, size: Optional[int] = None) -> list[tuple[int]]:
        """Read up to ``size`` rows."""
        rows: list[tuple[int]] = []
        while len(rows) < (size or self.arraysize):
            if (row := self._next_row()) is None:
                break
            rows.append(row)
        return rows

    def fetchall(self) -> list[tuple[int]]:
        """Read every remaining row."""
        rows: list[tuple[int]] = []
        while (row := self._next_row()) is not None:
            rows.append(row)
        return rows

    def cancel_operation(self) -> None:
        """Record the cancel RPC."""
        self.calls.append("cancel_operation")

    def close_operation(self) -> None:
        """Record the close RPC."""
        self.calls.append("close_operation")

    def close(self) -> None:
        """Record closing the cursor."""
        self.calls.append("close")


def _streaming_batches() -> list[_Batch]:
    """Rows, then two empty result RPCs, then the last rows."""
    return [
        _Batch([(1,)], True),
        _Batch([], True),
        _Batch([], True),
        _Batch([(2,)], False),
    ]


def test_stop_while_fetching_cancels_between_result_rpcs(
    app_context: None, impala_errors: None
) -> None:
    """A stop committed while a SQL Lab query streams results ends its fetch."""
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = Mock(id=1, extra={}, status=QueryStatus.RUNNING)

    def refresh(refreshed: Mock) -> None:
        """Another request commits the stop once the first rows have arrived."""
        if operation.fetches:
            refreshed.status = QueryStatus.STOPPED

    with (
        patch.dict(current_app.config, DB_POLL_INTERVAL_SECONDS={"impala": 0}),
        patch("superset.db_engine_specs.impala.db") as db,
    ):
        db.session.refresh.side_effect = refresh
        spec.handle_cursor(cursor, query)
        with pytest.raises(ImpalaFetchStoppedError):
            spec.fetch_data(cursor)

    assert operation.fetches == 1
    assert cursor.calls == ["cancel_operation", "close_operation", "close"]
    assert "fetch" not in vars(operation)


def test_watched_fetch_without_stop_reads_every_row(
    app_context: None, impala_errors: None
) -> None:
    """A watched fetch nobody stops returns every row, checking once per interval."""
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = Mock(id=1, extra={}, status=QueryStatus.RUNNING)

    with patch("superset.db_engine_specs.impala.db") as db:
        spec.handle_cursor(cursor, query)
        assert spec.fetch_data(cursor) == [(1,), (2,)]

    # One check once polling ends and one before the first result RPC; the
    # default poll interval spaces out the rest.
    assert db.session.refresh.call_count == 2
    # The driver confirms the end of the results with one more result RPC.
    assert operation.fetches == 5
    assert cursor.calls == []
    assert "fetch" not in vars(operation)


def test_unwatched_fetch_reads_without_stop_checks(
    app_context: None, impala_errors: None
) -> None:
    """Fetches that handle_cursor never polled, as for charts, are unchanged."""
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)

    with patch("superset.db_engine_specs.impala.db") as db:
        assert spec.fetch_data(cursor) == [(1,), (2,)]

    db.session.commit.assert_not_called()
    db.session.refresh.assert_not_called()


def test_watched_fetch_keeps_the_executor_row_budget(
    app_context: None, impala_errors: None
) -> None:
    """A fetch through SQLExecutor's row budget is watched and still bounded."""
    operation = _Operation([_Batch([(1,), (2,), (3,)], True)])
    cursor = _StreamingCursor(operation)
    query = Mock(id=1, extra={}, status=QueryStatus.RUNNING)

    with patch("superset.db_engine_specs.impala.db") as db:
        spec.handle_cursor(cursor, query)
        assert spec.fetch_data(_LimitedCursor(cursor, 2)) == [(1,), (2,)]

    assert operation.fetches == 1
    # The check before the first result RPC ran through the wrapper.
    assert db.session.refresh.call_count == 2


def test_failed_stop_check_does_not_fail_the_fetch(
    app_context: None, impala_errors: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A metadata error while checking for a stop leaves the results intact."""
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = Mock(id=1, extra={}, status=QueryStatus.RUNNING)

    with (
        patch.dict(current_app.config, DB_POLL_INTERVAL_SECONDS={"impala": 0}),
        patch("superset.db_engine_specs.impala.db") as db,
    ):
        spec.handle_cursor(cursor, query)
        db.session.commit.side_effect = RuntimeError("metadata unavailable")
        assert spec.fetch_data(cursor) == [(1,), (2,)]

    # The failed check is not retried before every remaining result RPC.
    assert db.session.commit.call_count == 2
    assert "stop check failed while fetching" in caplog.text
    assert cursor.calls == []


def test_failed_stop_check_keeps_the_rows_of_an_expired_query(
    app_context: None, impala_errors: None
) -> None:
    """A stop check that fails in a broken transaction does not fail the fetch.

    The check's commit expires the ORM query. When the refresh that follows
    fails, reading the expired query again raises until the session is rolled
    back, so the check must not read it.
    """
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = Mock(extra={}, status=QueryStatus.RUNNING)
    session_broken = False

    def read_id() -> int:
        """Loading the expired query fails inside the broken transaction."""
        if session_broken:
            raise RuntimeError("current transaction is aborted")
        return 1

    type(query).id = PropertyMock(side_effect=read_id)

    def failing_refresh(refreshed: Mock) -> None:
        """The metadata database fails the check's refresh."""
        nonlocal session_broken
        session_broken = True
        raise RuntimeError("canceling statement due to statement timeout")

    def rollback() -> None:
        nonlocal session_broken
        session_broken = False

    with (
        patch.dict(current_app.config, DB_POLL_INTERVAL_SECONDS={"impala": 0}),
        patch("superset.db_engine_specs.impala.db") as db,
    ):
        spec.handle_cursor(cursor, query)
        db.session.refresh.side_effect = failing_refresh
        db.session.rollback.side_effect = rollback
        assert spec.fetch_data(cursor) == [(1,), (2,)]

    db.session.rollback.assert_called_once_with()
    assert cursor.calls == []


def test_timeout_during_a_stop_check_is_not_swallowed(
    app_context: None, impala_errors: None
) -> None:
    """SQL Lab's timeout raised while a stop check runs still ends the query."""
    from superset.errors import ErrorLevel, SupersetErrorType
    from superset.exceptions import SupersetTimeoutException

    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = Mock(id=1, extra={}, status=QueryStatus.RUNNING)
    timeout = SupersetTimeoutException(
        error_type=SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
        message="timed out",
        level=ErrorLevel.ERROR,
    )

    with (
        patch.dict(current_app.config, DB_POLL_INTERVAL_SECONDS={"impala": 0}),
        patch("superset.db_engine_specs.impala.db") as db,
    ):
        spec.handle_cursor(cursor, query)
        db.session.refresh.side_effect = timeout
        with pytest.raises(SupersetTimeoutException):
            spec.fetch_data(cursor)

    assert operation.fetches == 0


def test_sql_lab_stop_while_fetching_ends_stopped(
    mocker: MockerFixture, app_context: None, impala_errors: None
) -> None:
    """SQL Lab reports a query stopped during its fetch as stopped, not failed."""
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = MagicMock(
        id=1,
        status=QueryStatus.RUNNING,
        progress=0,
        executed_sql="SELECT x FROM t",
        extra={},
        limit=None,
    )
    query.database.db_engine_spec = spec
    query.set_extra_json_key.side_effect = lambda key, value: query.extra.update(
        {key: value}
    )
    session = mocker.patch("superset.db.session")

    def refresh(refreshed: MagicMock, **kwargs: Any) -> None:
        """The stop request commits STOPPED once the first rows have arrived."""
        if operation.fetches:
            refreshed.status = QueryStatus.STOPPED

    session.refresh.side_effect = refresh
    mocker.patch.object(
        spec, "get_cancel_query_id", return_value="0123456789abcdef:fedcba9876543210"
    )
    mocker.patch("superset.sql_lab.warm_and_release_connection")
    mocker.patch(
        "superset.sql_lab.event_logger.log_context", return_value=nullcontext()
    )
    mocker.patch.dict(current_app.config, DB_POLL_INTERVAL_SECONDS={"impala": 0})

    with pytest.raises(SqlLabQueryStoppedException):
        execute_query(query, cursor)

    assert query.extra[QUERY_CANCEL_KEY] == "0123456789abcdef:fedcba9876543210"
    assert operation.fetches == 1
    assert cursor.calls == ["cancel_operation", "close_operation", "close"]


def test_the_partition_transform_default_is_impala_syntax() -> None:
    from superset.db_engine_specs.impala import ImpalaEngineSpec

    assert (
        ImpalaEngineSpec.partition_value_transform_default == "unix_timestamp(:value)"
    )


def test_engines_without_a_sensible_default_offer_none() -> None:
    """
    A wrong pre-fill is worse than none: it would not parse, and the owner
    would be debugging our guess rather than writing their transform.
    """
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    assert BaseEngineSpec.partition_value_transform_default is None
    assert PostgresEngineSpec.partition_value_transform_default is None
