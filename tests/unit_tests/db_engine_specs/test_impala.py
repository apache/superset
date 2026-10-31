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
from datetime import datetime
from typing import Any, Optional
from unittest.mock import call, MagicMock, Mock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from pytest_mock import MockerFixture

from superset.db_engine_specs.impala import ImpalaEngineSpec as spec  # noqa: N813
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.executor import _LimitedCursor
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
def test_fetch_data_abandons_the_operation_on_time_limit(
    sleep_mock: Mock, timeout: Exception, app_context: None, impala_errors: None
) -> None:
    """A SQL Lab time limit disables RPC cleanup before propagating."""
    sleep_mock.side_effect = timeout
    cursor = Mock()
    cursor.is_executing.return_value = True
    with pytest.raises(type(timeout)):
        spec.fetch_data(cursor)
    cursor.cancel_operation.assert_not_called()
    cursor.fetchall.assert_not_called()


@pytest.mark.parametrize(
    "cancel_timeout_type", [SoftTimeLimitExceeded, SupersetTimeoutException]
)
@patch("superset.db_engine_specs.impala.time.sleep")
def test_fetch_data_propagates_time_limit_during_cancel(
    sleep_mock: Mock,
    cancel_timeout_type: type[Exception],
    app_context: None,
    impala_errors: None,
) -> None:
    """An expired wait never enters RPC cancellation, even if it would time out."""
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
    cursor.cancel_operation.assert_not_called()
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
def test_fetch_data_abandons_on_time_limit_during_row_fetch(
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
    cursor.cancel_operation.assert_not_called()


@pytest.mark.parametrize("cancel_fails", [False, True])
def test_fetch_data_drops_transport_without_cancelling_an_interrupted_fetch(
    cancel_fails: bool,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """Abandon an interrupted response without issuing any cleanup RPC."""
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
    assert calls.mock_calls == [call.reset_transport(cursor, reconnect=False)]
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
def test_handle_cursor_drops_transport_without_cancelling_an_interrupted_poll(
    interrupted_rpc: str,
    cancel_fails: bool,
    timeout: Exception,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """Discard interrupted status/log replies before cancelling and releasing."""
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
        call.reset_transport(cursor, reconnect=False),
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

    with (
        patch("superset.db_engine_specs.impala.db"),
        patch.object(BaseEngineSpec, "fetch_data", side_effect=timeout),
    ):
        if interrupted_rpc == "fetch":
            with pytest.raises(type(timeout)) as raised:
                spec.fetch_data(cursor)
        else:
            getattr(cursor, interrupted_rpc).side_effect = timeout
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

    original_timeout = SoftTimeLimitExceeded("fetching")
    with patch.object(BaseEngineSpec, "fetch_data", side_effect=original_timeout):
        with pytest.raises(SoftTimeLimitExceeded) as raised:
            spec.fetch_data(cursor)

    assert raised.value is original_timeout
    cursor.cancel_operation.assert_not_called()
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
def test_time_limit_during_cleanup_abandons_the_cursor(
    cleanup_rpc: str,
    second_timeout: Exception,
    clean_transport: Mock,
    app_context: None,
    impala_errors: None,
) -> None:
    """An expired fetch never enters RPC cleanup, even if it would time out."""
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

    with patch.object(
        BaseEngineSpec, "fetch_data", side_effect=SoftTimeLimitExceeded()
    ):
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
