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
Shared fixtures and helpers for SQL execution tests.

This module provides common mocks, fixtures, and helper functions used across
test_celery_task.py and test_executor.py to reduce code duplication.
"""

from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus as QueryStatusEnum
from superset.models.core import Database

# =============================================================================
# Core Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def mock_db_session(mocker: MockerFixture) -> MagicMock:
    """Mock database session for all tests to avoid foreign key constraints."""
    mock_session = MagicMock()
    mocker.patch("superset.sql.execution.executor.db.session", mock_session)
    mocker.patch("superset.sql.execution.celery_task.db.session", mock_session)
    return mock_session


@pytest.fixture
def mock_query() -> MagicMock:
    """Create a mock Query model."""
    query = MagicMock()
    query.id = 123
    query.database_id = 1
    query.sql = "SELECT * FROM users"
    query.status = QueryStatusEnum.PENDING
    query.error_message = None
    query.progress = 0
    query.end_time = None
    query.start_running_time = None
    query.executed_sql = None
    query.tmp_table_name = None
    query.catalog = None
    query.schema = "public"
    query.extra = {}
    query.set_extra_json_key = MagicMock()
    query.results_key = None
    query.select_as_cta = False
    query.rows = 0
    query.to_dict = MagicMock(return_value={"id": 123})
    query.database = MagicMock()
    query.database.db_engine_spec.extract_errors.return_value = []
    query.database.unique_name = "test_db"
    query.database.cache_timeout = 300
    return query


@pytest.fixture
def mock_database() -> MagicMock:
    """Create a mock Database."""
    database = MagicMock()
    database.id = 1
    database.unique_name = "test_db"
    database.cache_timeout = 300
    database.sqlalchemy_uri = "postgresql://localhost/test"
    database.db_engine_spec = MagicMock()
    database.db_engine_spec.engine = "postgresql"
    database.db_engine_spec.run_multiple_statements_as_one = False
    database.db_engine_spec.allows_sql_comments = True
    database.db_engine_spec.extract_errors = MagicMock(return_value=[])
    database.db_engine_spec.execute_with_cursor = MagicMock()
    database.db_engine_spec.get_cancel_query_id = MagicMock(return_value=None)
    database.db_engine_spec.patch = MagicMock()
    database.db_engine_spec.fetch_data = MagicMock(return_value=[])
    return database


@pytest.fixture
def mock_result_set() -> MagicMock:
    """Create a mock SupersetResultSet."""
    result_set = MagicMock()
    result_set.size = 2
    result_set.columns = [{"name": "id"}, {"name": "name"}]
    result_set.pa_table = MagicMock()
    result_set.to_pandas_df = MagicMock(
        return_value=pd.DataFrame({"id": [1, 2], "name": ["Alice", "Bob"]})
    )
    return result_set


@pytest.fixture
def database() -> Database:
    """Create a real test database instance."""
    return Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="sqlite://",
        allow_dml=False,
    )


@pytest.fixture
def database_with_dml() -> Database:
    """Create a real test database instance with DML allowed."""
    return Database(
        id=2,
        database_name="test_db_dml",
        sqlalchemy_uri="sqlite://",
        allow_dml=True,
    )


# =============================================================================
# Helper Functions for Mock Creation
# =============================================================================


def create_mock_cursor(
    column_names: list[str],
    data: list[tuple[Any, ...]] | None = None,
) -> MagicMock:
    """
    Create a mock database cursor with column description.

    Args:
        column_names: List of column names
        data: Optional data to return from fetchall()

    Returns:
        Configured MagicMock cursor
    """
    mock_cursor = MagicMock()
    mock_cursor.description = [
        (name, None, None, None, None, None, None) for name in column_names
    ]
    if data is not None:
        mock_cursor.fetchall.return_value = data
    return mock_cursor


def create_mock_connection(mock_cursor: MagicMock | None = None) -> MagicMock:
    """
    Create a mock database connection.

    Args:
        mock_cursor: Optional cursor to return from cursor()

    Returns:
        Configured MagicMock connection with context manager support
    """
    if mock_cursor is None:
        mock_cursor = create_mock_cursor([])

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.close = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    return mock_conn


def setup_mock_raw_connection(
    mock_database: MagicMock,
    mock_connection: MagicMock | None = None,
) -> MagicMock:
    """
    Setup get_raw_connection as a context manager on a mock database.

    Args:
        mock_database: The database mock to configure
        mock_connection: Optional connection to yield

    Returns:
        The configured mock connection
    """
    if mock_connection is None:
        mock_connection = create_mock_connection()

    @contextmanager
    def _raw_connection(
        catalog: str | None = None,
        schema: str | None = None,
        nullpool: bool = True,
        source: Any | None = None,
    ):
        yield mock_connection

    mock_database.get_raw_connection = _raw_connection
    return mock_connection


def setup_db_session_query_mock(
    mock_db_session: MagicMock,
    return_value: Any = None,
) -> None:
    """
    Setup database session query chain for query lookup.

    Args:
        mock_db_session: The database session mock
        return_value: Value to return from one_or_none()
    """
    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = return_value


def mock_query_execution(
    mocker: MockerFixture,
    database: Database,
    return_data: list[tuple[Any, ...]],
    column_names: list[str],
) -> MagicMock:
    """
    Mock the raw connection execution path for testing.

    This helper sets up all necessary mocks for executing a query through
    the database engine spec and returning results.

    Args:
        mocker: pytest-mock fixture
        database: Database instance to mock
        return_data: Data to return from fetch_data, e.g. [(1, "Alice"), (2, "Bob")]
        column_names: Column names for the result, e.g. ["id", "name"]

    Returns:
        The mock for get_raw_connection, so tests can make assertions on it
    """
    from superset.result_set import SupersetResultSet

    # Mock cursor and connection
    mock_cursor = create_mock_cursor(column_names, return_data)
    mock_conn = create_mock_connection(mock_cursor)

    get_raw_conn_mock = mocker.patch.object(
        database, "get_raw_connection", return_value=mock_conn
    )
    mocker.patch.object(
        database, "mutate_sql_based_on_config", side_effect=lambda sql, **kw: sql
    )
    mocker.patch.object(database.db_engine_spec, "execute")
    mocker.patch.object(database.db_engine_spec, "fetch_data", return_value=return_data)

    # Create a real SupersetResultSet that converts to DataFrame properly
    mock_result_set = MagicMock(spec=SupersetResultSet)
    mock_result_set.to_pandas_df.return_value = pd.DataFrame(
        return_data, columns=column_names
    )
    mocker.patch("superset.result_set.SupersetResultSet", return_value=mock_result_set)

    return get_raw_conn_mock


# =============================================================================
# Composite Fixtures for Common Test Patterns
# =============================================================================


@pytest.fixture
def default_sql_config(mocker: MockerFixture) -> None:
    """Patch app config with default SQL execution settings."""
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )


@pytest.fixture
def mock_celery_task(mocker: MockerFixture) -> MagicMock:
    """Mock the Celery task for SQL execution."""
    return mocker.patch("superset.sql.execution.celery_task.execute_sql_task")


def setup_cache_mocks(
    mocker: MockerFixture,
    get_result: Any = None,
    store_side_effect: Any = None,
) -> tuple[MagicMock, MagicMock]:
    """
    Setup cache get/store mocks for executor tests.

    Args:
        mocker: pytest-mock fixture
        get_result: Value to return from _get_from_cache
        store_side_effect: Optional side effect for _store_in_cache

    Returns:
        Tuple of (mock_get, mock_store)
    """
    from superset.sql.execution.executor import SQLExecutor

    mock_get = mocker.patch.object(
        SQLExecutor, "_get_from_cache", return_value=get_result
    )
    mock_store = mocker.patch.object(
        SQLExecutor, "_store_in_cache", side_effect=store_side_effect
    )
    return mock_get, mock_store
