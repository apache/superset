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
"""
Error propagation for failed ClickHouse queries through SQL Lab.

The ClickHouse server's own error text must reach the user-visible query error
(``Query.error_message``, ``Query.extra["errors"]`` and the returned payload)
instead of being dropped or replaced by a generic message. These tests drive
``superset.sql_lab`` with the real ``ClickHouseConnectEngineSpec`` and a stand-in
DB-API cursor that raises the exact exception ``clickhouse-connect`` raises for a
server-side error, so only the database connection itself is faked. The error
text used here mirrors what a real server returns; the real-server counterparts
live in ``tests/testcontainers/db_engine_specs/test_clickhouse.py``.
"""

# pylint: disable=import-outside-toplevel, unused-argument

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.common.db_query_status import QueryStatus
from superset.errors import SupersetErrorType

pytest.importorskip("clickhouse_connect")

from clickhouse_connect.driver.exceptions import DatabaseError  # noqa: E402

UNKNOWN_TABLE_ERROR = (
    "Received ClickHouse exception, code: 60, server response: "
    "Code: 60. DB::Exception: Unknown table expression identifier "
    "'missing_table'. In scope SELECT * FROM missing_table. (UNKNOWN_TABLE) "
    "(for url http://clickhouse:8123)"
)
FETCH_ERROR = (
    "Received ClickHouse exception, code: 395, server response: "
    "Code: 395. DB::Exception: value is too large: while executing 'FUNCTION "
    "throwIf(...)'. (FUNCTION_THROW_IF_VALUE_IS_NON_ZERO) "
    "(for url http://clickhouse:8123)"
)


class FailingCursor:
    """
    DB-API cursor stand-in that fails either on ``execute`` or on fetching rows.
    """

    arraysize = 1

    def __init__(self, execute_error: Exception | None, fetch_error: Exception | None):
        self.execute_error = execute_error
        self.fetch_error = fetch_error
        self.description: list[tuple[Any, ...]] | None = None

    def execute(self, sql: str, *args: Any, **kwargs: Any) -> None:
        if self.execute_error:
            raise self.execute_error
        self.description = [("n", "UInt64", None, None, None, None, True)]

    def fetchmany(self, size: int | None = None) -> list[tuple[Any, ...]]:
        assert self.fetch_error
        raise self.fetch_error

    def fetchall(self) -> list[tuple[Any, ...]]:
        assert self.fetch_error
        raise self.fetch_error


class FailingConnection:
    def __init__(self, cursor: FailingCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> FailingCursor:
        return self._cursor

    def commit(self) -> None:
        pass


def create_clickhouse_query(session: Session, sql: str) -> Any:
    """
    Persist a ClickHouse database and a pending SQL Lab query against it.
    """
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    Query.metadata.create_all(session.get_bind())
    database = Database(
        database_name="clickhouse",
        sqlalchemy_uri="clickhousedb://default:@clickhouse:8123/default",
    )
    query = Query(
        client_id="clickhouse-error",
        database=database,
        sql=sql,
        executed_sql=sql,
        limit=100,
        status=QueryStatus.PENDING,
    )
    session.add_all([database, query])
    session.flush()
    return query


@pytest.fixture
def failing_cursor(mocker: MockerFixture) -> FailingCursor:
    """
    Route every SQL Lab connection through a cursor the test controls.
    """
    from superset.models.core import Database

    cursor = FailingCursor(execute_error=None, fetch_error=None)

    @contextmanager
    def get_raw_connection(*args: Any, **kwargs: Any) -> Iterator[FailingConnection]:
        yield FailingConnection(cursor)

    mocker.patch.object(Database, "get_raw_connection", get_raw_connection)
    # The `session` fixture is a plain Session, not the app's scoped_session proxy.
    mocker.patch("superset.sql_lab.warm_and_release_connection")
    mocker.patch("superset.sql_lab.results_backend", None)
    return cursor


def run_failing_query(session: Session, sql: str, use_celery_task: bool) -> Any:
    """
    Execute ``sql`` the way the sync executor (``execute_sql_statements``) or the
    Celery worker (``get_sql_results``) does, and return the query and payload.
    """
    from superset import sql_lab

    query = create_clickhouse_query(session, sql)
    if use_celery_task:
        payload = sql_lab.get_sql_results(
            query.id, sql, return_results=True, store_results=False
        )
    else:
        payload = sql_lab.execute_sql_statements(
            query_id=query.id,
            rendered_query=sql,
            return_results=True,
            store_results=False,
            start_time=None,
            expand_data=False,
            log_params={},
        )
    return query, payload


@pytest.mark.parametrize("use_celery_task", [False, True], ids=["sync", "celery"])
def test_execute_error_text_reaches_query_error(
    session: Session,
    failing_cursor: FailingCursor,
    use_celery_task: bool,
) -> None:
    """
    The server's error text from a failed ``cursor.execute`` (e.g. unknown table)
    is what the user sees on the failed query.
    """
    failing_cursor.execute_error = DatabaseError(UNKNOWN_TABLE_ERROR)

    query, payload = run_failing_query(
        session, "SELECT * FROM missing_table", use_celery_task
    )

    assert query.status == QueryStatus.FAILED
    assert query.error_message == f"clickhousedb error: {UNKNOWN_TABLE_ERROR}"
    assert "Code: 60. DB::Exception: Unknown table expression" in query.error_message
    assert "(UNKNOWN_TABLE)" in query.error_message

    errors = query.extra["errors"]
    assert len(errors) == 1
    assert errors[0]["error_type"] == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert errors[0]["message"] == f"clickhousedb error: {UNKNOWN_TABLE_ERROR}"

    assert payload["status"] == QueryStatus.FAILED
    assert payload["error"] == query.error_message
    assert payload["errors"] == errors


@pytest.mark.parametrize("use_celery_task", [False, True], ids=["sync", "celery"])
def test_fetch_error_text_reaches_query_error(
    session: Session,
    failing_cursor: FailingCursor,
    use_celery_task: bool,
) -> None:
    """
    The server's error text from a failure while reading rows (after the
    statement was accepted) is what the user sees on the failed query.
    """
    failing_cursor.fetch_error = DatabaseError(FETCH_ERROR)

    query, payload = run_failing_query(session, "SELECT 1", use_celery_task)

    assert query.status == QueryStatus.FAILED
    assert query.error_message == f"clickhousedb error: {FETCH_ERROR}"
    assert "(FUNCTION_THROW_IF_VALUE_IS_NON_ZERO)" in query.error_message

    errors = query.extra["errors"]
    assert len(errors) == 1
    assert errors[0]["error_type"] == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert errors[0]["message"] == f"clickhousedb error: {FETCH_ERROR}"

    assert payload["status"] == QueryStatus.FAILED
    assert payload["error"] == query.error_message
    assert payload["errors"] == errors


def test_multi_statement_error_text_keeps_block_prefix(
    session: Session,
    failing_cursor: FailingCursor,
) -> None:
    """
    When one block of several fails, the block prefix is added without hiding the
    server's error text.
    """
    failing_cursor.execute_error = DatabaseError(UNKNOWN_TABLE_ERROR)

    query, payload = run_failing_query(
        session, "SELECT 1; SELECT * FROM missing_table", use_celery_task=False
    )

    assert query.status == QueryStatus.FAILED
    assert query.error_message.startswith("Block 1 out of 2 ")
    assert UNKNOWN_TABLE_ERROR in query.error_message
    assert payload["errors"][0]["message"] == (
        f"clickhousedb error: {UNKNOWN_TABLE_ERROR}"
    )


def test_generic_server_message_is_shown_when_driver_hides_detail(
    session: Session,
    failing_cursor: FailingCursor,
) -> None:
    """
    Characterization: ``clickhouse-connect`` raises a bare "The ClickHouse server
    returned an error" when the connection sets ``show_clickhouse_errors=false``.
    SQL Lab has no detail to add, so that is exactly what the query error shows.
    """
    generic = "The ClickHouse server returned an error"
    failing_cursor.execute_error = DatabaseError(generic)

    query, payload = run_failing_query(
        session, "SELECT * FROM missing_table", use_celery_task=False
    )

    assert query.status == QueryStatus.FAILED
    assert query.error_message == f"clickhousedb error: {generic}"
    assert query.extra["errors"][0]["message"] == f"clickhousedb error: {generic}"
    assert payload["errors"][0]["message"] == f"clickhousedb error: {generic}"
