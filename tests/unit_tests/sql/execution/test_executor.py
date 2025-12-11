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
Tests for SQLExecutor.

These tests cover the SQL execution API including:
- Basic execution
- DML handling
- Jinja2 template rendering
- CTAS/CVAS support
- Security features (RLS, disallowed functions)
- Result caching
- Query model persistence
- Async execution
"""

from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from flask import current_app
from pytest_mock import MockerFixture
from superset_core.api.types import (
    CacheOptions,
    QueryOptions,
    QueryStatus,
)

from superset.models.core import Database


@pytest.fixture
def database() -> Database:
    """Create a test database instance."""
    return Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="sqlite://",
        allow_dml=False,
    )


@pytest.fixture
def database_with_dml() -> Database:
    """Create a test database instance with DML allowed."""
    return Database(
        id=2,
        database_name="test_db_dml",
        sqlalchemy_uri="sqlite://",
        allow_dml=True,
    )


@pytest.fixture(autouse=True)
def mock_db_session(mocker: MockerFixture) -> MagicMock:
    """Mock database session for all tests to avoid foreign key constraints."""
    mock_session = MagicMock()
    mocker.patch("superset.sql.execution.executor.db.session", mock_session)
    return mock_session


def mock_query_execution(
    mocker: MockerFixture,
    database: Database,
    return_data: list[tuple[Any, ...]],
    column_names: list[str],
) -> None:
    """
    Mock the raw connection execution path for testing.

    :param mocker: pytest-mock fixture
    :param database: Database instance to mock
    :param return_data: Data to return from fetch_data, e.g. [(1, "Alice"), (2, "Bob")]
    :param column_names: Column names for the result, e.g. ["id", "name"]
    """
    from superset.result_set import SupersetResultSet

    # Mock cursor and connection
    mock_cursor = MagicMock()
    mock_cursor.description = [(name,) for name in column_names]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    mocker.patch.object(database, "get_raw_connection", return_value=mock_conn)
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


# =============================================================================
# Basic Execution Tests
# =============================================================================


def test_execute_select_success(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test successful SELECT query execution."""
    mock_query_execution(
        mocker,
        database,
        return_data=[(1, "Alice"), (2, "Bob")],
        column_names=["id", "name"],
    )
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT id, name FROM users")

    assert result.status == QueryStatus.SUCCESS
    assert result.data is not None
    assert result.row_count == 2
    assert result.error_message is None


def test_execute_with_options(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test query execution with custom options."""
    mock_query_execution(mocker, database, return_data=[(100,)], column_names=["count"])
    get_raw_conn_mock = mocker.patch.object(
        database,
        "get_raw_connection",
        wraps=database.get_raw_connection,
    )
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    options = QueryOptions(catalog="main", schema="public", limit=50)
    result = database.execute("SELECT COUNT(*) FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    get_raw_conn_mock.assert_called_once()
    call_kwargs = get_raw_conn_mock.call_args[1]
    assert call_kwargs["catalog"] == "main"
    assert call_kwargs["schema"] == "public"


def test_execute_records_execution_time(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that execution time is recorded."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT id FROM users")

    assert result.status == QueryStatus.SUCCESS
    assert result.execution_time_ms is not None
    assert result.execution_time_ms >= 0


def test_execute_creates_query_record(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test that execute creates a Query record for audit."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _create_query_record to return a mock query with ID
    mock_query = MagicMock()
    mock_query.id = 123
    mock_create_query = mocker.patch.object(
        SQLExecutor, "_create_query_record", return_value=mock_query
    )

    result = database.execute("SELECT id FROM users")

    assert result.status == QueryStatus.SUCCESS
    assert result.query_id == 123
    mock_create_query.assert_called_once()


# =============================================================================
# DML Handling Tests
# =============================================================================


def test_execute_dml_without_permission(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that DML queries fail when database.allow_dml is False."""
    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30},
    )

    result = database.execute("INSERT INTO users (name) VALUES ('test')")

    assert result.status == QueryStatus.FAILED
    assert result.error_message is not None
    assert "DML queries are not allowed" in result.error_message


def test_execute_dml_with_permission(
    mocker: MockerFixture, database_with_dml: Database, app_context: None
) -> None:
    """Test that DML queries succeed when database.allow_dml is True."""
    mock_query_execution(mocker, database_with_dml, return_data=[], column_names=[])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database_with_dml.execute("INSERT INTO users (name) VALUES ('test')")

    assert result.status == QueryStatus.SUCCESS


def test_execute_update_without_permission(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that UPDATE queries fail when database.allow_dml is False."""
    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30},
    )

    result = database.execute("UPDATE users SET name = 'test' WHERE id = 1")

    assert result.status == QueryStatus.FAILED
    assert result.error_message is not None
    assert "DML queries are not allowed" in result.error_message


def test_execute_delete_without_permission(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that DELETE queries fail when database.allow_dml is False."""
    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30},
    )

    result = database.execute("DELETE FROM users WHERE id = 1")

    assert result.status == QueryStatus.FAILED
    assert result.error_message is not None
    assert "DML queries are not allowed" in result.error_message


# =============================================================================
# Jinja2 Template Rendering Tests
# =============================================================================


def test_execute_with_template_params(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test query execution with Jinja2 template parameters."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock the template processor
    mock_tp = MagicMock()
    mock_tp.process_template.return_value = (
        "SELECT * FROM events WHERE date > '2024-01-01'"
    )
    mocker.patch(
        "superset.jinja_context.get_template_processor",
        return_value=mock_tp,
    )

    options = QueryOptions(
        template_params={"table": "events", "start_date": "2024-01-01"}
    )
    result = database.execute(
        "SELECT * FROM {{ table }} WHERE date > '{{ start_date }}'",
        options=options,
    )

    assert result.status == QueryStatus.SUCCESS
    mock_tp.process_template.assert_called_once()


def test_execute_without_template_params_no_rendering(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that template rendering is skipped when no params provided."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    mock_get_tp = mocker.patch("superset.jinja_context.get_template_processor")

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    mock_get_tp.assert_not_called()


# =============================================================================
# Disallowed Functions Tests
# =============================================================================


def test_execute_disallowed_functions(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that disallowed SQL functions are blocked."""
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "DISALLOWED_SQL_FUNCTIONS": {"sqlite": {"LOAD_EXTENSION"}},
        },
    )

    result = database.execute("SELECT LOAD_EXTENSION('malicious.so')")

    assert result.status == QueryStatus.FAILED
    assert result.error_message is not None
    assert "Disallowed SQL functions" in result.error_message


def test_execute_allowed_functions(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that allowed SQL functions work normally."""
    mock_query_execution(mocker, database, return_data=[(5,)], column_names=["count"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "DISALLOWED_SQL_FUNCTIONS": {"sqlite": {"LOAD_EXTENSION"}},
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT COUNT(*) FROM users")

    assert result.status == QueryStatus.SUCCESS


# =============================================================================
# Row-Level Security Tests
# =============================================================================


def test_execute_rls_applied(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that RLS is always applied."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _apply_rls_to_sql to verify it's always called
    mock_apply_rls = mocker.patch.object(
        SQLExecutor, "_apply_rls_to_sql", return_value="SELECT * FROM users WHERE 1=1"
    )

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    mock_apply_rls.assert_called()


def test_execute_rls_always_applied(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that RLS is always applied."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _apply_rls_to_sql to verify it's always called
    mock_apply_rls = mocker.patch.object(
        SQLExecutor, "_apply_rls_to_sql", return_value="SELECT * FROM users WHERE 1=1"
    )

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    mock_apply_rls.assert_called()


# =============================================================================
# Result Caching Tests
# =============================================================================


def test_execute_returns_cached_result(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that cached results are returned when available."""
    from superset.sql.execution.executor import SQLExecutor

    cached_df = pd.DataFrame({"id": [1, 2]})

    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _get_from_cache to simulate a cache hit
    cached_result = MagicMock()
    cached_result.status = QueryStatus.SUCCESS
    cached_result.data = cached_df
    cached_result.is_cached = True
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=cached_result)

    # get_raw_connection should NOT be called if cache hit
    get_conn_mock = mocker.patch.object(database, "get_raw_connection")

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    assert result.is_cached is True
    get_conn_mock.assert_not_called()


def test_execute_force_cache_refresh(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that force_cache_refresh bypasses the cache."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _get_from_cache - should NOT be called when force_refresh=True
    mock_get_cache = mocker.patch.object(SQLExecutor, "_get_from_cache")

    options = QueryOptions(cache=CacheOptions(force_refresh=True))
    result = database.execute("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    assert result.is_cached is False
    assert result.row_count == 1  # Fresh result
    mock_get_cache.assert_not_called()


def test_execute_stores_in_cache(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that results are stored in cache."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "CACHE_DEFAULT_TIMEOUT": 300,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _get_from_cache to return None (cache miss)
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=None)
    # Mock _store_in_cache to verify it gets called
    mock_store_cache = mocker.patch.object(SQLExecutor, "_store_in_cache")

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    mock_store_cache.assert_called_once()


# =============================================================================
# Timeout Tests
# =============================================================================


def test_execute_timeout(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test query timeout handling."""
    from superset.errors import ErrorLevel, SupersetErrorType
    from superset.exceptions import SupersetTimeoutException

    # Mock get_raw_connection to raise timeout
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(
        side_effect=SupersetTimeoutException(
            error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
            message="Query timed out",
            level=ErrorLevel.ERROR,
        )
    )
    mock_conn.__exit__ = MagicMock(return_value=False)
    mocker.patch.object(database, "get_raw_connection", return_value=mock_conn)
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 1,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT * FROM large_table")

    assert result.status == QueryStatus.TIMED_OUT
    assert result.error_message is not None


def test_execute_custom_timeout(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test query with custom timeout option."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    mock_timeout = mocker.patch("superset.sql.execution.executor.utils.timeout")
    mock_timeout.return_value.__enter__ = MagicMock()
    mock_timeout.return_value.__exit__ = MagicMock(return_value=False)

    options = QueryOptions(timeout_seconds=60)
    result = database.execute("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    mock_timeout.assert_called_with(
        seconds=60,
        error_message="Query exceeded the 60 seconds timeout.",
    )


# =============================================================================
# Error Handling Tests
# =============================================================================


def test_execute_error(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test general error handling."""
    # Mock get_raw_connection to raise an error
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mocker.patch.object(database, "get_raw_connection", return_value=mock_conn)
    mocker.patch.object(
        database, "mutate_sql_based_on_config", side_effect=lambda sql, **kw: sql
    )
    mocker.patch.object(
        database.db_engine_spec, "execute", side_effect=Exception("Database error")
    )
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT * FROM nonexistent")

    assert result.status == QueryStatus.FAILED
    assert result.error_message is not None
    assert "Database error" in result.error_message


# =============================================================================
# Async Execution Tests
# =============================================================================


def test_execute_async_creates_query(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test that execute_async creates a Query record and submits to Celery."""
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )

    mock_celery_task = mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task"
    )

    result = database.execute_async("SELECT * FROM users")

    assert result.status == QueryStatus.PENDING
    assert result.handle is not None
    assert result.handle.query_id is not None
    mock_db_session.add.assert_called()
    mock_celery_task.delay.assert_called()


def test_execute_async_with_options(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test async execution with custom options."""
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )

    mock_celery_task = mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task"
    )

    options = QueryOptions(catalog="analytics", schema="reports")
    result = database.execute_async("SELECT * FROM sales", options=options)

    assert result.status == QueryStatus.PENDING
    mock_celery_task.delay.assert_called_once()


def test_execute_async_dml_without_permission_raises(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that async DML queries raise exception when not allowed."""
    from superset.exceptions import SupersetSecurityException

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )

    with pytest.raises(SupersetSecurityException, match="DML queries are not allowed"):
        database.execute_async("INSERT INTO users (name) VALUES ('test')")


def test_async_handle_get_status(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test that async handle can retrieve query status."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "success"
    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    status = result.handle.get_status()
    assert status == QueryStatus.SUCCESS


def test_async_handle_cancel(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test that async handle can cancel a query."""
    from superset.models.sql_lab import Query
    from superset.sql.execution.executor import SQLExecutor

    mock_query = MagicMock(spec=Query)
    mock_query.status = "running"
    mock_query.database = database
    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")
    mock_cancel = mocker.patch.object(SQLExecutor, "_cancel_query", return_value=True)

    result = database.execute_async("SELECT * FROM users")

    cancelled = result.handle.cancel()
    assert cancelled is True
    mock_cancel.assert_called_once()


# =============================================================================
# SQL Mutation Tests
# =============================================================================


def test_execute_applies_sql_mutator(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that SQL mutator is applied internally."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])

    # Track what SQL gets mutated
    mutate_mock = mocker.patch.object(
        database, "mutate_sql_based_on_config", side_effect=lambda sql, **kw: sql
    )
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": lambda sql, **kwargs: f"/* mutated */ {sql}",
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT id FROM users")

    assert result.status == QueryStatus.SUCCESS
    # Verify mutate_sql_based_on_config was called
    mutate_mock.assert_called()


# =============================================================================
# Progress Tracking Tests
# =============================================================================


def test_execute_multi_statement_updates_query_progress(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test that multi-statement execution updates Query.progress."""
    from superset.models.sql_lab import Query as QueryModel
    from superset.result_set import SupersetResultSet

    # Mock raw connection for multi-statement execution
    mock_cursor = MagicMock()
    mock_cursor.description = [("id",), ("name",)]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    mocker.patch.object(database, "get_raw_connection", return_value=mock_conn)
    mocker.patch.object(
        database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: sql,
    )
    mocker.patch.object(database.db_engine_spec, "execute")
    mocker.patch.object(
        database.db_engine_spec, "fetch_data", return_value=[("1", "Alice")]
    )

    mock_result_set = MagicMock(spec=SupersetResultSet)
    mock_result_set.to_pandas_df.return_value = pd.DataFrame(
        {"id": ["1"], "name": ["Alice"]}
    )
    mocker.patch("superset.result_set.SupersetResultSet", return_value=mock_result_set)

    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Track progress updates on the Query model
    mock_query = MagicMock(spec=QueryModel)
    mock_query.id = 123
    mocker.patch("superset.models.sql_lab.Query", return_value=mock_query)

    # Execute multiple statements
    result = database.execute("SELECT 1; SELECT 2;")

    assert result.status == QueryStatus.SUCCESS
    # Query.progress should have been updated
    assert mock_query.progress == 100  # Final progress after completion
    # set_extra_json_key should have been called for progress messages
    assert mock_query.set_extra_json_key.call_count >= 2


# =============================================================================
# Query Logging Tests
# =============================================================================


def test_execute_calls_query_logger(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that QUERY_LOGGER is called when configured."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    log_calls: list[tuple[str, str, str | None]] = []

    def mock_logger(db, sql, schema, module, security_manager, context) -> None:  # noqa: ARG001
        log_calls.append((db.database_name, sql, schema))

    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": mock_logger,
        },
    )

    result = database.execute(
        "SELECT * FROM users", options=QueryOptions(schema="public")
    )

    assert result.status == QueryStatus.SUCCESS
    assert len(log_calls) == 1
    assert log_calls[0][0] == "test_db"
    # SQL may be formatted/prettified, so check for key parts
    logged_sql = log_calls[0][1]
    assert "SELECT" in logged_sql
    assert "FROM users" in logged_sql
    assert log_calls[0][2] == "public"


def test_execute_no_query_logger_configured(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that execution works when QUERY_LOGGER is not configured."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Should not raise any errors
    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
