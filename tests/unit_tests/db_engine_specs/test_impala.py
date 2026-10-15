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

from datetime import datetime
from typing import Optional
from unittest.mock import Mock, patch

import pytest
from pytest_mock import MockerFixture

from superset.db_engine_specs.impala import ImpalaEngineSpec as spec  # noqa: N813
from superset.models.core import Database
from superset.models.sql_lab import Query
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
@patch("requests.post")
def test_cancel_query(post_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 200
    post_mock.return_value = response_mock

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    post_mock.assert_called_once_with(
        "http://impala.example.com:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is True


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("requests.post")
def test_cancel_query_failed(post_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    response_mock = Mock()
    response_mock.status_code = 500
    post_mock.return_value = response_mock

    result = spec.cancel_query(None, query, "6940643a2731718b:9fbdba2000000000")

    post_mock.assert_called_once_with(
        "http://impala.example.com:25000/cancel_query?query_id=6940643a2731718b:9fbdba2000000000",
        timeout=3,
        allow_redirects=False,
    )
    assert result is False


@patch("superset.db_engine_specs.impala.is_safe_host", return_value=True)
@patch("requests.post")
def test_cancel_query_exception(post_mock: Mock, _safe_host: Mock) -> None:  # noqa: PT019
    query = Query()
    database = Database(
        database_name="test_impala",
        sqlalchemy_uri="impala://impala.example.com:21050/default",
    )
    query.database = database

    post_mock.side_effect = Exception("Network error")

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
