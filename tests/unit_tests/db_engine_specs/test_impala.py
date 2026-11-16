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

from collections.abc import Iterator
from contextlib import nullcontext
from datetime import datetime
from typing import Any, Optional
from unittest.mock import call, MagicMock, Mock, patch, PropertyMock

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app
from pytest_mock import MockerFixture

from superset.constants import QUERY_CANCEL_KEY
from superset.db_engine_specs.impala import (
    ImpalaEngineSpec as spec,  # noqa: N813
    ImpalaFetchStoppedError,
)
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException
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


class _RejectedReplyError(_DriverError):
    """Represent impyla's error for an error status, read in full."""


@pytest.fixture(autouse=True)
def clean_transport() -> Iterator[Mock]:
    """
    Stub local transport drops for mock cursors.

    Mock cursors have no Thrift transport; resets over real impyla transports
    are covered in ``test_impala_transport.py``.
    """
    with patch.object(spec, "_reset_transport", return_value=True) as reset_transport:
        yield reset_transport


@pytest.fixture
def impala_errors(mocker: MockerFixture) -> None:
    """Provide driver errors without requiring the optional impyla package."""
    mocker.patch.dict(
        "sys.modules",
        {
            "impala.error": Mock(
                Error=_DriverError, HiveServer2Error=_RejectedReplyError
            )
        },
    )


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


@patch("superset.db_engine_specs.impala.time.monotonic", side_effect=[0, 31])
def test_fetch_data_deadline_releases_operation_when_cancel_fails(
    monotonic_mock: Mock, app_context: None, impala_errors: None
) -> None:
    """A rejected cancel must not mask the deadline or retain operation handles."""
    from flask import current_app

    cursor = Mock()
    cursor.is_executing.return_value = True
    cursor.cancel_operation.side_effect = _RejectedReplyError("cancel rejected")

    with patch.dict(current_app.config, SQLLAB_TIMEOUT=30):
        with pytest.raises(TimeoutError, match="Timed out waiting"):
            spec.fetch_data(cursor)

    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    cursor.close.assert_called_once_with()
    cursor.fetchall.assert_not_called()
    assert monotonic_mock.call_count == 2


@patch("superset.db_engine_specs.impala.time.monotonic", side_effect=[0, 31])
def test_fetch_data_deadline_abandons_the_cursor_when_the_cancel_reply_is_unread(
    monotonic_mock: Mock,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """A cancel that failed partway through its reply ends the cleanup."""
    from flask import current_app

    cursor = Mock()
    cursor.is_executing.return_value = True
    cursor.cancel_operation.side_effect = _DriverError("connection lost")

    with patch.dict(current_app.config, SQLLAB_TIMEOUT=30):
        with pytest.raises(TimeoutError, match="Timed out waiting"):
            spec.fetch_data(cursor)

    cursor.close_operation.assert_not_called()
    cursor.close.assert_not_called()
    assert cursor._closed is True
    # The transport is dropped, not reconnected, so the next RPC opens it.
    clean_transport.assert_called_once_with(cursor, reconnect=False)


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

    def cancel_operation(self, reset_state: bool = True) -> None:
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


@pytest.mark.parametrize(
    "timeout",
    [
        SoftTimeLimitExceeded(),
        SupersetTimeoutException(
            error_type=SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
            message="timed out",
            level=ErrorLevel.ERROR,
        ),
    ],
    ids=["async", "sync"],
)
def test_timeout_during_a_stop_check_is_not_swallowed(
    app_context: None, impala_errors: None, timeout: Exception
) -> None:
    """
    SQL Lab's time limit raised while a stop check runs still ends the query,
    rather than turning off the stop checks and letting the fetch run on.
    """
    operation = _Operation(_streaming_batches())
    cursor = _StreamingCursor(operation)
    query = Mock(id=1, extra={}, status=QueryStatus.RUNNING)

    with (
        patch.dict(current_app.config, DB_POLL_INTERVAL_SECONDS={"impala": 0}),
        patch("superset.db_engine_specs.impala.db") as db,
    ):
        spec.handle_cursor(cursor, query)
        db.session.refresh.side_effect = timeout
        with pytest.raises(type(timeout)):
            spec.fetch_data(cursor)

    assert operation.fetches == 0
    # The fetch's time-limit handler cancels the operation it leaves behind.
    assert cursor.calls == ["cancel_operation"]


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


def test_impala_does_not_guess_the_epoch_partition_bucket() -> None:
    from superset.db_engine_specs.impala import ImpalaEngineSpec

    assert ImpalaEngineSpec.partition_value_transform_default is None


def test_engines_without_a_sensible_default_offer_none() -> None:
    """
    A wrong pre-fill is worse than none: it would not parse, and the owner
    would be debugging our guess rather than writing their transform.
    """
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    assert BaseEngineSpec.partition_value_transform_default is None
    assert PostgresEngineSpec.partition_value_transform_default is None


@pytest.mark.parametrize(
    "timeout",
    [
        SoftTimeLimitExceeded(),
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="The query exceeded the 30 seconds timeout.",
            level=ErrorLevel.ERROR,
        ),
    ],
    ids=["async", "sync"],
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_fetch_data_cancels_the_operation_on_time_limit(
    sleep_mock: Mock, timeout: Exception, app_context: None, impala_errors: None
) -> None:
    """A SQL Lab time limit between RPCs cancels before propagating."""
    sleep_mock.side_effect = timeout
    cursor = Mock()
    cursor.is_executing.return_value = True
    with pytest.raises(type(timeout)):
        spec.fetch_data(cursor)
    cursor.cancel_operation.assert_called_once_with(reset_state=False)
    cursor.fetchall.assert_not_called()


@pytest.mark.parametrize(
    "cancel_timeout_type", [SoftTimeLimitExceeded, SupersetTimeoutException]
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_fetch_data_preserves_time_limit_when_cancellation_times_out(
    sleep_mock: Mock,
    cancel_timeout_type: type[Exception],
    app_context: None,
    impala_errors: None,
) -> None:
    """A second limit during cancellation must not replace the polling limit."""
    original_timeout = SoftTimeLimitExceeded("waiting")
    cancel_timeout: Exception
    if cancel_timeout_type is SupersetTimeoutException:
        cancel_timeout = SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out during cancellation",
            level=ErrorLevel.ERROR,
        )
    else:
        cancel_timeout = cancel_timeout_type("cancelling")
    sleep_mock.side_effect = original_timeout
    cursor = Mock()
    cursor.is_executing.return_value = True
    cursor.cancel_operation.side_effect = cancel_timeout

    with pytest.raises(SoftTimeLimitExceeded) as raised:
        spec.fetch_data(cursor)

    assert raised.value is original_timeout
    cursor.cancel_operation.assert_called_once_with(reset_state=False)
    cursor.fetchall.assert_not_called()


@pytest.mark.parametrize("cancel_fails", [False, True])
@pytest.mark.parametrize(
    "timeout",
    [
        SoftTimeLimitExceeded(),
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out fetching rows",
            level=ErrorLevel.ERROR,
        ),
    ],
    ids=["async", "sync"],
)
def test_fetch_data_cancels_on_clean_transport_row_fetch_limit(
    timeout: Exception,
    cancel_fails: bool,
    app_context: None,
    impala_errors: None,
) -> None:
    """A time limit after polling ends cancels even when the cancel RPC fails."""
    from superset.db_engine_specs.base import BaseEngineSpec

    cursor = Mock()
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    if cancel_fails:
        cursor.cancel_operation.side_effect = RuntimeError("cancel RPC failed")

    with patch.object(BaseEngineSpec, "fetch_data", side_effect=timeout) as fetch:
        with pytest.raises(type(timeout)) as raised:
            spec.fetch_data(cursor, 10)

    assert raised.value is timeout
    fetch.assert_called_once_with(cursor, 10)
    cursor.cancel_operation.assert_called_once_with(reset_state=False)


@pytest.mark.parametrize("cancel_fails", [False, True])
def test_fetch_data_cancels_after_mock_fetch_limit(
    cancel_fails: bool,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """A mock fetch limit leaves the transport clean, including a rejected cancel."""
    from superset.db_engine_specs.base import BaseEngineSpec

    cursor = Mock()
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    calls = MagicMock()
    calls.attach_mock(clean_transport, "reset_transport")
    calls.attach_mock(cursor.cancel_operation, "cancel_operation")
    if cancel_fails:
        cursor.cancel_operation.side_effect = _RejectedReplyError("cancel rejected")
    timeout = SoftTimeLimitExceeded()

    with patch.object(BaseEngineSpec, "fetch_data", side_effect=timeout):
        with pytest.raises(SoftTimeLimitExceeded) as raised:
            spec.fetch_data(cursor)

    assert raised.value is timeout
    assert calls.mock_calls == [
        call.cancel_operation(reset_state=False),
        call.reset_transport(cursor, reconnect=False),
    ]
    cursor.close_operation.assert_not_called()
    cursor.close.assert_not_called()


@pytest.mark.parametrize("interrupted_rpc", ["status", "get_log"])
@pytest.mark.parametrize("cancel_fails", [False, True])
@pytest.mark.parametrize(
    "timeout",
    [
        SoftTimeLimitExceeded(),
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out polling the operation",
            level=ErrorLevel.ERROR,
        ),
    ],
    ids=["async", "sync"],
)
def test_handle_cursor_cancels_after_mock_poll_limit(
    interrupted_rpc: str,
    cancel_fails: bool,
    timeout: Exception,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """Mock status/log limits leave a clean transport available for cancellation."""
    cursor = Mock()
    cursor.status.return_value = "RUNNING_STATE"
    getattr(cursor, interrupted_rpc).side_effect = timeout
    if cancel_fails:
        cursor.cancel_operation.side_effect = _RejectedReplyError("cancel rejected")
    query = Mock(id=1, extra={}, status="running", progress=0)
    calls = MagicMock()
    calls.attach_mock(clean_transport, "reset_transport")
    calls.attach_mock(cursor.cancel_operation, "cancel_operation")
    calls.attach_mock(cursor.close_operation, "close_operation")
    calls.attach_mock(cursor.close, "close")

    with patch("superset.db_engine_specs.impala.db"):
        with pytest.raises(type(timeout)) as raised:
            spec.handle_cursor(cursor, query)

    assert raised.value is timeout
    assert calls.mock_calls == [
        call.cancel_operation(),
        call.close_operation(),
        call.close(),
    ]


@pytest.mark.parametrize(
    "reset_outcome",
    [{"return_value": False}, {"side_effect": OSError("connection refused")}],
    ids=["unknown_transport", "reopen_fails"],
)
@pytest.mark.parametrize("interrupted_rpc", ["status", "get_log", "fetch"])
@pytest.mark.parametrize(
    "timeout",
    [
        SoftTimeLimitExceeded(),
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out polling the operation",
            level=ErrorLevel.ERROR,
        ),
    ],
    ids=["async", "sync"],
)
def test_time_limit_skips_cancel_rpcs_without_a_clean_transport(
    reset_outcome: dict[str, Any],
    interrupted_rpc: str,
    timeout: Exception,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """No RPC is sent on a transport that may hold an interrupted reply."""
    from superset.db_engine_specs.base import BaseEngineSpec

    clean_transport.configure_mock(**reset_outcome)
    cursor = Mock()
    cursor.status.return_value = "RUNNING_STATE"
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    query = Mock(id=1, extra={}, status="running", progress=0)
    spec.prepare_cursor(cursor)
    guard = cursor.session.service.client
    guard._client.InterruptedRPC.side_effect = timeout

    with (
        patch("superset.db_engine_specs.impala.db"),
        patch.object(BaseEngineSpec, "fetch_data", side_effect=guard.InterruptedRPC),
    ):
        if interrupted_rpc == "fetch":
            with pytest.raises(type(timeout)) as raised:
                spec.fetch_data(cursor)
        else:
            getattr(cursor, interrupted_rpc).side_effect = guard.InterruptedRPC
            with pytest.raises(type(timeout)) as raised:
                spec.handle_cursor(cursor, query)

    assert raised.value is timeout
    # The transport is dropped once without reconnecting.
    assert clean_transport.mock_calls == [call(cursor, reconnect=False)]
    cursor.cancel_operation.assert_not_called()
    cursor.close_operation.assert_not_called()
    cursor.close.assert_not_called()
    # impyla's close() and finalizer skip a cursor marked closed.
    assert cursor._closed is True


@pytest.mark.parametrize(
    "second_timeout_type",
    [SoftTimeLimitExceeded, SupersetTimeoutException],
)
def test_time_limit_during_transport_reset_propagates(
    second_timeout_type: type[Exception],
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """A second limit while resetting must not hide the original time limit."""
    from superset.db_engine_specs.base import BaseEngineSpec

    second_timeout: Exception
    if second_timeout_type is SoftTimeLimitExceeded:
        second_timeout = SoftTimeLimitExceeded("resetting")
    else:
        second_timeout = SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out resetting the transport",
            level=ErrorLevel.ERROR,
        )
    clean_transport.side_effect = second_timeout
    cursor = Mock()
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    cursor.cancel_operation.side_effect = OSError("cancel transport failed")

    original_timeout = SoftTimeLimitExceeded("fetching")
    with patch.object(BaseEngineSpec, "fetch_data", side_effect=original_timeout):
        with pytest.raises(SoftTimeLimitExceeded) as raised:
            spec.fetch_data(cursor)

    assert raised.value is original_timeout
    cursor.cancel_operation.assert_called_once_with(reset_state=False)
    assert cursor._closed is True


@pytest.mark.parametrize(
    "cleanup_rpc", ["cancel_operation", "close_operation", "close"]
)
@pytest.mark.parametrize(
    "second_timeout",
    [
        SoftTimeLimitExceeded("cleanup"),
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="Timed out during cleanup",
            level=ErrorLevel.ERROR,
        ),
    ],
    ids=["async", "sync"],
)
def test_fetch_time_limit_preserved_when_rpc_cleanup_times_out(
    cleanup_rpc: str,
    second_timeout: Exception,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """Clean-transport cancellation runs once and preserves the original limit."""
    from superset.db_engine_specs.base import BaseEngineSpec

    cursor = Mock()
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    getattr(cursor, cleanup_rpc).side_effect = second_timeout

    original_timeout = SoftTimeLimitExceeded("fetching")
    with patch.object(BaseEngineSpec, "fetch_data", side_effect=original_timeout):
        with pytest.raises(SoftTimeLimitExceeded) as raised:
            spec.fetch_data(cursor)

    assert raised.value is original_timeout
    cursor.cancel_operation.assert_called_once_with(reset_state=False)
    cursor.close_operation.assert_not_called()
    cursor.close.assert_not_called()
    assert cursor._closed is True
    assert clean_transport.mock_calls == [call(cursor, reconnect=False)]


@pytest.mark.parametrize(
    "reset_outcome",
    [{"return_value": False}, {"side_effect": OSError("connection refused")}],
    ids=["unknown_transport", "reopen_fails"],
)
def test_time_limit_abandons_the_cursor_behind_a_row_limit(
    reset_outcome: dict[str, Any],
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """The closed flag reaches the cursor that SQL Lab closes, not the wrapper."""
    from superset.db_engine_specs.base import BaseEngineSpec

    clean_transport.configure_mock(**reset_outcome)
    cursor = Mock()
    cursor.is_executing.return_value = False
    cursor.execution_failed.return_value = False
    limited = _LimitedCursor(cursor, 10)
    spec.prepare_cursor(cursor)
    guard = cursor.session.service.client
    guard._client.InterruptedRPC.side_effect = SoftTimeLimitExceeded()

    with patch.object(BaseEngineSpec, "fetch_data", side_effect=guard.InterruptedRPC):
        with pytest.raises(SoftTimeLimitExceeded):
            spec.fetch_data(limited)

    assert cursor._closed is True
    assert "_closed" not in vars(limited)


def test_closed_cursor_is_not_cancelled_again(
    clean_transport: Mock, app_context: None
) -> None:
    """An abandoned or closed cursor sends nothing after a later time limit."""
    cursor = Mock(_closed=True)

    spec._abandon_cursor(cursor, 1)

    clean_transport.assert_not_called()
    cursor.cancel_operation.assert_not_called()


@pytest.mark.parametrize("state", ["abandoned", "closed", "interrupted"])
def test_time_limit_does_not_cancel_unusable_cursor(state: str) -> None:
    """Skip cancellation for each cursor or client state that prohibits RPCs."""
    from superset.utils.hive import ThriftClientGuard

    cursor = Mock(_superset_abandoned=state == "abandoned", _closed=state == "closed")
    guard = ThriftClientGuard(Mock())
    cursor.session.service.client = guard
    if state == "interrupted":
        guard.abandon(SoftTimeLimitExceeded())
        assert guard.interrupted

    spec._cancel_operation_on_time_limit(cursor)

    cursor.cancel_operation.assert_not_called()
    cursor.close_operation.assert_not_called()
    cursor.close.assert_not_called()


@pytest.mark.parametrize("phase", ["poll", "rows"])
@pytest.mark.parametrize(
    "timeout",
    [SoftTimeLimitExceeded(), KeyboardInterrupt()],
    ids=["soft-limit", "timer-interrupt"],
)
def test_fetch_limit_cancels_without_close_rpcs(
    phase: str,
    timeout: BaseException,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """Only CancelOperation may consume the soft-to-hard time-limit gap."""
    from superset.db_engine_specs.base import BaseEngineSpec

    cursor = Mock()
    cursor.is_executing.return_value = phase == "poll"
    cursor.execution_failed.return_value = False
    with (
        patch("superset.db_engine_specs.impala.time.sleep", side_effect=timeout),
        patch.object(BaseEngineSpec, "fetch_data", side_effect=timeout),
    ):
        with pytest.raises(type(timeout)) as raised:
            spec.fetch_data(cursor)

    assert raised.value is timeout
    cursor.cancel_operation.assert_called_once_with(reset_state=False)
    cursor.close_operation.assert_not_called()
    cursor.close.assert_not_called()
    clean_transport.assert_called_once_with(cursor, reconnect=False)
    assert cursor._closed is True
