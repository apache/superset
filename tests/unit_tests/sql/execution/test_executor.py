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

import msgpack
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

# Note: database, database_with_dml, mock_db_session fixtures and
# mock_query_execution helper are imported from conftest.py
from .conftest import mock_query_execution

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
    assert len(result.statements) == 1
    assert result.statements[0].data is not None
    assert result.statements[0].row_count == 2
    assert result.error_message is None


def test_execute_with_options(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test query execution with custom options."""
    get_raw_conn_mock = mock_query_execution(
        mocker, database, return_data=[(100,)], column_names=["count"]
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
    assert result.total_execution_time_ms is not None
    assert result.total_execution_time_ms >= 0


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

    # Mock _apply_rls_to_script to verify it's always called
    mock_apply_rls = mocker.patch.object(SQLExecutor, "_apply_rls_to_script")

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
    assert sum(s.row_count for s in result.statements) == 1  # Fresh result
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

    # Mock db.session.add to set query.id (simulating database auto-increment)
    def set_query_id(query: Any) -> None:
        if not hasattr(query, "id") or query.id is None:
            query.id = 123

    mock_db_session.add.side_effect = set_query_id

    mock_celery_task = mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task"
    )

    result = database.execute_async("SELECT * FROM users")

    assert result.status == QueryStatus.PENDING
    assert result.query_id is not None
    assert result.query_id == 123
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

    status = result.get_status()
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

    cancelled = result.cancel()
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


# =============================================================================
# Dry Run Tests
# =============================================================================


def test_execute_dry_run_returns_transformed_sql(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test dry run returns transformed SQL without execution."""
    from superset.sql.execution.executor import SQLExecutor

    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30, "SQL_MAX_ROW": 100},
    )

    # Mock _apply_rls_to_script to verify it's called even in dry run
    mock_apply_rls = mocker.patch.object(SQLExecutor, "_apply_rls_to_script")

    # get_raw_connection should NOT be called in dry run
    get_conn_mock = mocker.patch.object(database, "get_raw_connection")

    options = QueryOptions(dry_run=True, limit=50)
    result = database.execute("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    assert len(result.statements) > 0  # Transformed SQL returned in statements
    assert result.statements[0].original_sql is not None  # Has original SQL
    assert result.statements[0].executed_sql is not None  # Has transformed SQL
    assert result.statements[0].data is None  # No data in dry run
    assert result.query_id is None  # No Query model created
    mock_apply_rls.assert_called()  # RLS still applied
    get_conn_mock.assert_not_called()  # No execution


def test_execute_async_dry_run_returns_transformed_sql(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test async dry run returns transformed SQL without Celery submission."""
    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30},
    )

    # Mock Celery task - should NOT be called
    mock_celery_task = mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task"
    )

    options = QueryOptions(dry_run=True)
    result = database.execute_async("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    assert result.query_id is None  # None for cached/dry-run results
    mock_celery_task.delay.assert_not_called()

    # Handle should return the dry run result
    status = result.get_status()
    assert status == QueryStatus.SUCCESS


def test_execute_async_cached_result_returns_immediately(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test async execution with cached result returns immediately."""
    from superset.sql.execution.executor import SQLExecutor

    cached_df = pd.DataFrame({"id": [1, 2]})
    cached_result = MagicMock()
    cached_result.status = QueryStatus.SUCCESS
    cached_result.data = cached_df
    cached_result.is_cached = True

    mocker.patch.dict(
        current_app.config,
        {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30},
    )
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=cached_result)

    # Mock Celery task - should NOT be called
    mock_celery_task = mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task"
    )

    result = database.execute_async("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    assert result.query_id is None
    mock_celery_task.delay.assert_not_called()


# =============================================================================
# Empty Statement Tests
# =============================================================================


def test_execute_empty_sql(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test execution with empty SQL."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[], column_names=[])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    # Mock _create_query_record
    mock_query = MagicMock()
    mock_query.id = 123
    mocker.patch.object(SQLExecutor, "_create_query_record", return_value=mock_query)

    result = database.execute("")

    assert result.status == QueryStatus.SUCCESS
    assert sum(s.row_count for s in result.statements) == 0


def test_execute_sql_with_cursor_empty_statements(app_context: None) -> None:
    """Test execute_sql_with_cursor with empty statement list."""
    from superset.sql.execution.executor import execute_sql_with_cursor

    mock_database = MagicMock()
    mock_cursor = MagicMock()
    mock_query = MagicMock()

    result = execute_sql_with_cursor(
        database=mock_database,
        cursor=mock_cursor,
        statements=[],
        query=mock_query,
    )

    assert result == []  # Returns empty list for empty statements


def test_execute_sql_with_cursor_stopped_mid_execution(
    mocker: MockerFixture, app_context: None
) -> None:
    """Test execute_sql_with_cursor when query is stopped mid-execution."""
    from superset.sql.execution.executor import execute_sql_with_cursor

    mock_database = MagicMock()
    mock_database.mutate_sql_based_on_config = lambda sql, **kw: sql
    mock_database.db_engine_spec.execute = MagicMock()
    mock_database.db_engine_spec.fetch_data = MagicMock(return_value=[])

    mock_cursor = MagicMock()
    mock_cursor.description = [("id",)]
    mock_cursor.fetchall = MagicMock()

    mock_query = MagicMock()
    mock_query.schema = "public"
    mock_query.progress = 0
    mock_query.set_extra_json_key = MagicMock()

    mocker.patch("superset.sql.execution.executor.db.session")

    # Check stopped function returns True after first statement
    call_count = {"count": 0}

    def check_stopped():
        call_count["count"] += 1
        return call_count["count"] > 1

    result = execute_sql_with_cursor(
        database=mock_database,
        cursor=mock_cursor,
        statements=["SELECT 1", "SELECT 2", "SELECT 3"],
        query=mock_query,
        check_stopped_fn=check_stopped,
    )

    # Returns results collected before stopped (first statement completed)
    assert len(result) == 1  # Only first statement completed before stop


def test_execute_sql_with_cursor_custom_execute_fn(
    mocker: MockerFixture, app_context: None
) -> None:
    """Test execute_sql_with_cursor with custom execute function."""
    from superset.sql.execution.executor import execute_sql_with_cursor

    mock_database = MagicMock()
    mock_database.mutate_sql_based_on_config = lambda sql, **kw: sql
    mock_database.db_engine_spec = MagicMock()

    mock_cursor = MagicMock()
    mock_cursor.description = [("count",)]
    mock_cursor.fetchall = MagicMock()

    mock_query = MagicMock()
    mock_query.schema = "public"
    mock_query.progress = 0
    mock_query.set_extra_json_key = MagicMock()

    mocker.patch("superset.sql.execution.executor.db.session")
    mock_database.db_engine_spec.fetch_data = MagicMock(return_value=[(100,)])

    custom_execute_calls = []

    def custom_execute(cursor, sql):
        custom_execute_calls.append(sql)

    result = execute_sql_with_cursor(
        database=mock_database,
        cursor=mock_cursor,
        statements=["SELECT COUNT(*) FROM users"],
        query=mock_query,
        execute_fn=custom_execute,
    )

    assert len(custom_execute_calls) == 1
    assert result is not None


# =============================================================================
# Limit Application Tests
# =============================================================================


def test_execute_applies_limit(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that limit is applied to SELECT queries."""
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

    # Mock _apply_limit_to_script
    apply_limit_mock = mocker.patch.object(SQLExecutor, "_apply_limit_to_script")

    options = QueryOptions(limit=50)
    result = database.execute("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    # Verify limit was applied
    assert apply_limit_mock.called


def test_execute_respects_sql_max_row(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that SQL_MAX_ROW config limits the effective limit."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": 100,
            "QUERY_LOGGER": None,
        },
    )

    apply_limit_mock = mocker.patch.object(SQLExecutor, "_apply_limit_to_script")

    # Request 1000 but should be capped at 100
    options = QueryOptions(limit=1000)
    result = database.execute("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    # Verify limit was applied
    assert apply_limit_mock.called


def test_execute_no_limit_for_dml(
    mocker: MockerFixture, database_with_dml: Database, app_context: None
) -> None:
    """Test that limit is not applied to DML queries."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database_with_dml, return_data=[], column_names=[])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": 100,
            "QUERY_LOGGER": None,
        },
    )

    apply_limit_mock = mocker.patch.object(SQLExecutor, "_apply_limit_to_script")

    options = QueryOptions(limit=50)
    database_with_dml.execute("INSERT INTO users VALUES (1)", options=options)

    # Should not apply limit to DML
    apply_limit_mock.assert_not_called()


def test_apply_limit_to_script_respects_sql_max_row(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that _apply_limit_to_script caps limit at SQL_MAX_ROW."""
    from superset.sql.execution.executor import SQLExecutor
    from superset.sql.parse import SQLScript

    mocker.patch.dict(
        current_app.config,
        {
            "SQL_MAX_ROW": 100,
        },
    )

    executor = SQLExecutor(database)

    # Create a script with a statement
    script = SQLScript("SELECT * FROM users", database.db_engine_spec.engine)

    # Mock set_limit_value on the first statement
    set_limit_mock = mocker.patch.object(script.statements[0], "set_limit_value")

    options = QueryOptions(limit=1000)  # Request 1000 but should be capped at 100
    executor._apply_limit_to_script(script, options)

    # Verify limit was capped at SQL_MAX_ROW (100)
    set_limit_mock.assert_called_once_with(100, database.db_engine_spec.limit_method)


def test_apply_limit_to_script_with_empty_statements(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that _apply_limit_to_script handles empty script.statements."""
    from superset.sql.execution.executor import SQLExecutor
    from superset.sql.parse import SQLScript

    mocker.patch.dict(
        current_app.config,
        {
            "SQL_MAX_ROW": 100,
        },
    )

    executor = SQLExecutor(database)

    # Create a script with no statements (empty string)
    script = SQLScript("", database.db_engine_spec.engine)

    options = QueryOptions(limit=50)
    # Should not raise any errors when statements is empty
    executor._apply_limit_to_script(script, options)

    # Verify no error occurred and statements is still empty
    assert script.statements == []


# =============================================================================
# Catalog/Schema Resolution Tests
# =============================================================================


def test_execute_uses_default_catalog_and_schema(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that default catalog and schema are used when not specified."""
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    get_default_catalog_mock = mocker.patch.object(
        database, "get_default_catalog", return_value="main"
    )
    get_default_schema_mock = mocker.patch.object(
        database, "get_default_schema", return_value="public"
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

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    # Verify default catalog/schema were fetched
    get_default_catalog_mock.assert_called()
    get_default_schema_mock.assert_called()


# =============================================================================
# Async Query Status and Result Tests
# =============================================================================


def test_async_handle_get_result_query_not_found(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting result for non-existent query."""

    # Query not found
    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = None

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    # Try to get result
    query_result = result.get_result()

    assert query_result.status == QueryStatus.FAILED
    assert "not found" in query_result.error_message.lower()  # type: ignore[union-attr]


def test_async_handle_get_result_pending(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting result for pending query."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "pending"
    mock_query.error_message = None
    mock_query.executed_sql = "SELECT * FROM users"
    mock_query.results_key = None

    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    query_result = result.get_result()

    assert query_result.status == QueryStatus.PENDING


def test_async_handle_get_result_with_results_backend(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting result from results backend."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "success"
    mock_query.error_message = None
    mock_query.executed_sql = "SELECT * FROM users"
    mock_query.results_key = "result_key_123"

    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    # Mock results backend with new multi-statement format
    payload = msgpack.dumps(
        {
            "statements": [
                {
                    "original_sql": "SELECT * FROM users",
                    "executed_sql": "SELECT * FROM users",
                    "data": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}],
                    "columns": [
                        {"column_name": "id", "name": "id"},
                        {"column_name": "name", "name": "name"},
                    ],
                    "row_count": 2,
                    "execution_time_ms": 10.0,
                }
            ],
            "total_execution_time_ms": 10.0,
        }
    )
    compressed_payload = b"compressed_data"

    mock_results_backend = MagicMock()
    mock_results_backend.get.return_value = compressed_payload

    mock_results_backend_manager = MagicMock()
    mock_results_backend_manager.results_backend = mock_results_backend

    mocker.patch(
        "superset.results_backend_manager",
        mock_results_backend_manager,
    )
    mocker.patch("superset.utils.core.zlib_decompress", return_value=payload)
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    query_result = result.get_result()

    assert query_result.status == QueryStatus.SUCCESS
    assert len(query_result.statements) > 0
    assert query_result.statements[0].data is not None
    assert sum(s.row_count for s in query_result.statements) == 2


def test_async_handle_get_result_backend_load_error(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test error handling when loading results from backend."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "success"
    mock_query.error_message = None
    mock_query.executed_sql = "SELECT * FROM users"
    mock_query.results_key = "result_key_123"

    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    # Mock results backend with error
    mock_results_backend = MagicMock()
    mock_results_backend.get.return_value = b"invalid_data"

    mock_results_backend_manager = MagicMock()
    mock_results_backend_manager.results_backend = mock_results_backend

    mocker.patch(
        "superset.results_backend_manager",
        mock_results_backend_manager,
    )
    mocker.patch(
        "superset.utils.core.zlib_decompress",
        side_effect=Exception("Decompression failed"),
    )
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    query_result = result.get_result()

    assert query_result.status == QueryStatus.FAILED
    assert "Error loading results" in query_result.error_message  # type: ignore[operator]


def test_async_handle_get_result_no_results_key(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting result when results_key is missing."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "success"
    mock_query.error_message = None
    mock_query.executed_sql = "SELECT * FROM users"
    mock_query.results_key = None  # No results key

    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    query_result = result.get_result()

    assert query_result.status == QueryStatus.FAILED
    assert "Results not available" in query_result.error_message  # type: ignore[operator]


def test_async_handle_get_status_query_not_found(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting status for non-existent query."""
    # Query not found
    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = None

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    # Override the query_id to simulate looking up a non-existent query
    object.__setattr__(result, "query_id", 999999)

    status = result.get_status()

    assert status == QueryStatus.FAILED


# =============================================================================
# Query Cancellation Tests
# =============================================================================


def test_cancel_query_implicit_cancel(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test cancel_query with implicit cancellation."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query = MagicMock()
    mock_query.extra = {}

    mocker.patch.object(
        database.db_engine_spec, "has_implicit_cancel", return_value=True
    )

    result = SQLExecutor._cancel_query(database, mock_query)

    assert result is True


def test_cancel_query_early_cancel_flag(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test cancel_query with early cancel flag set."""
    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.sql.execution.executor import SQLExecutor

    mock_query = MagicMock()
    mock_query.extra = {QUERY_EARLY_CANCEL_KEY: True}

    mocker.patch.object(
        database.db_engine_spec, "has_implicit_cancel", return_value=False
    )
    prepare_cancel_mock = mocker.patch.object(
        database.db_engine_spec, "prepare_cancel_query"
    )

    result = SQLExecutor._cancel_query(database, mock_query)

    assert result is True
    prepare_cancel_mock.assert_called_with(mock_query)


def test_cancel_query_no_cancel_id(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test cancel_query when no cancel ID is available."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query = MagicMock()
    mock_query.extra = {}

    mocker.patch.object(
        database.db_engine_spec, "has_implicit_cancel", return_value=False
    )
    mocker.patch.object(database.db_engine_spec, "prepare_cancel_query")

    result = SQLExecutor._cancel_query(database, mock_query)

    assert result is False


def test_cancel_query_with_cancel_id(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test cancel_query executes cancellation with cancel ID."""
    from superset.constants import QUERY_CANCEL_KEY
    from superset.sql.execution.executor import SQLExecutor
    from superset.utils.core import QuerySource

    mock_query = MagicMock()
    mock_query.extra = {QUERY_CANCEL_KEY: "cancel_123"}
    mock_query.catalog = "main"
    mock_query.schema = "public"

    mocker.patch.object(
        database.db_engine_spec, "has_implicit_cancel", return_value=False
    )
    mocker.patch.object(database.db_engine_spec, "prepare_cancel_query")
    cancel_query_mock = mocker.patch.object(
        database.db_engine_spec, "cancel_query", return_value=True
    )

    # Mock engine and connection
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)

    mock_engine = MagicMock()
    mock_engine.raw_connection.return_value.__enter__ = MagicMock(
        return_value=mock_conn
    )
    mock_engine.raw_connection.return_value.__exit__ = MagicMock(return_value=False)
    mock_engine.__enter__ = MagicMock(return_value=mock_engine)
    mock_engine.__exit__ = MagicMock(return_value=False)

    get_sqla_engine_mock = mocker.patch.object(
        database, "get_sqla_engine", return_value=mock_engine
    )

    result = SQLExecutor._cancel_query(database, mock_query)

    assert result is True
    get_sqla_engine_mock.assert_called_with(
        catalog="main", schema="public", source=QuerySource.SQL_LAB
    )
    cancel_query_mock.assert_called_once()


def test_async_handle_cancel_query_not_found(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test cancelling non-existent query."""

    # Query not found
    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = None

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    # Override to simulate non-existent query
    object.__setattr__(result, "query_id", 999999)

    cancelled = result.cancel()

    assert cancelled is False


# =============================================================================
# Cache Timeout Tests
# =============================================================================


def test_execute_uses_database_cache_timeout(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that database cache timeout is used when available."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
            "CACHE_DEFAULT_TIMEOUT": 300,
        },
    )

    database.cache_timeout = 600  # Custom timeout

    # Mock cache operations
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=None)
    mock_cache_set = mocker.patch("superset.extensions.cache_manager.data_cache.set")

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    # Verify cache timeout used
    if mock_cache_set.called:
        call_kwargs = mock_cache_set.call_args[1]
        assert call_kwargs.get("timeout") == 600


def test_execute_uses_custom_cache_timeout_option(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that custom cache timeout from options is used."""
    from superset.sql.execution.executor import SQLExecutor

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
            "CACHE_DEFAULT_TIMEOUT": 300,
        },
    )

    # Mock cache operations
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=None)
    mock_cache_set = mocker.patch("superset.extensions.cache_manager.data_cache.set")

    options = QueryOptions(cache=CacheOptions(timeout=1200))
    result = database.execute("SELECT * FROM users", options=options)

    assert result.status == QueryStatus.SUCCESS
    # Verify custom timeout used
    if mock_cache_set.called:
        call_kwargs = mock_cache_set.call_args[1]
        assert call_kwargs.get("timeout") == 1200


# =============================================================================
# Celery Submission Error Tests
# =============================================================================


def test_execute_async_celery_submission_error(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test error handling when Celery submission fails."""
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )

    # Mock Celery task to raise exception
    mock_celery_task = mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task"
    )
    mock_celery_task.delay.side_effect = Exception("Celery connection failed")

    with pytest.raises(Exception, match="Celery connection failed"):
        database.execute_async("SELECT * FROM users")


# =============================================================================
# Additional Edge Case Tests for 100% Coverage
# =============================================================================


def test_execute_sql_with_cursor_no_rows_or_description(
    mocker: MockerFixture, app_context: None
) -> None:
    """Test execute_sql_with_cursor when cursor returns no rows and description."""
    from superset.sql.execution.executor import execute_sql_with_cursor

    mock_database = MagicMock()
    mock_database.mutate_sql_based_on_config = lambda sql, **kw: sql
    mock_database.db_engine_spec.execute = MagicMock()
    mock_database.db_engine_spec.fetch_data = MagicMock(return_value=None)

    mock_cursor = MagicMock()
    mock_cursor.description = None  # No description
    mock_cursor.fetchall = MagicMock()

    mock_query = MagicMock()
    mock_query.schema = "public"
    mock_query.progress = 0
    mock_query.set_extra_json_key = MagicMock()

    mocker.patch("superset.sql.execution.executor.db.session")

    result = execute_sql_with_cursor(
        database=mock_database,
        cursor=mock_cursor,
        statements=["INSERT INTO users VALUES (1)"],
        query=mock_query,
    )

    # DML statement returns result with result_set=None
    assert len(result) == 1
    assert result[0][1] is None  # result_set is None for DML


def test_execute_with_exception_on_execute(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that _execute_statements returns empty DataFrame on None result."""
    from superset.sql.execution.executor import SQLExecutor

    # Mock to simulate None result_set
    mocker.patch(
        "superset.sql.execution.executor.execute_sql_with_cursor",
        return_value=[],  # Empty list for no results
    )

    mock_query = MagicMock()
    mock_query.id = 123
    mocker.patch.object(SQLExecutor, "_create_query_record", return_value=mock_query)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mocker.patch.object(database, "get_raw_connection", return_value=mock_conn)

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

    # Should handle None result_set gracefully
    assert result.status == QueryStatus.SUCCESS
    assert sum(s.row_count for s in result.statements) == 0


def test_check_disallowed_functions_no_config(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test disallowed functions check when no config exists."""
    from superset.sql.execution.executor import SQLExecutor

    mocker.patch.dict(current_app.config, {"DISALLOWED_SQL_FUNCTIONS": {}})

    executor = SQLExecutor(database)
    script = MagicMock()
    result = executor._check_disallowed_functions(script)

    assert result is None


def test_try_get_cached_result_with_mutation(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that cache is skipped for mutation queries."""
    from superset.sql.execution.executor import SQLExecutor

    executor = SQLExecutor(database)

    script = MagicMock()
    script.has_mutation.return_value = True

    result = executor._try_get_cached_result(script, "INSERT INTO foo", MagicMock())

    # Should skip cache for mutations
    assert result is None


def test_store_in_cache_with_failed_status(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that failed queries are not cached."""
    from superset_core.api.types import QueryResult as QueryResultType

    from superset.sql.execution.executor import SQLExecutor

    executor = SQLExecutor(database)

    failed_result = QueryResultType(
        status=QueryStatus.FAILED,
        error_message="Test error",
    )

    mock_cache_set = mocker.patch("superset.extensions.cache_manager.data_cache.set")

    executor._store_in_cache(failed_result, "SELECT 1", QueryOptions())

    # Should not cache failed queries
    mock_cache_set.assert_not_called()


def test_store_in_cache_with_no_data(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that DML queries (with no data) are cached."""
    from superset_core.api.types import QueryResult as QueryResultType, StatementResult

    from superset.sql.execution.executor import SQLExecutor

    executor = SQLExecutor(database)

    result_no_data = QueryResultType(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql="INSERT INTO t VALUES (1)",
                executed_sql="INSERT INTO t VALUES (1)",
                data=None,
                row_count=1,
            )
        ],
    )

    mock_cache_set = mocker.patch("superset.extensions.cache_manager.data_cache.set")

    executor._store_in_cache(result_no_data, "INSERT INTO t VALUES (1)", QueryOptions())

    # DML queries are cached too
    mock_cache_set.assert_called_once()


def test_create_cached_async_result_cancel(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that cached async result cancel returns False."""
    from superset_core.api.types import QueryResult as QueryResultType, StatementResult

    from superset.sql.execution.executor import SQLExecutor

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )

    executor = SQLExecutor(database)

    cached_result = QueryResultType(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql="SELECT 1",
                executed_sql="SELECT 1",
                data=pd.DataFrame({"id": [1]}),
                row_count=1,
            )
        ],
    )

    async_result = executor._create_cached_handle(cached_result)

    # Try to cancel a cached result
    cancelled = async_result.cancel()

    # Should return False (nothing to cancel)
    assert cancelled is False


def test_async_handle_get_result_with_empty_blob(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting result when backend returns None for blob."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "success"
    mock_query.error_message = None
    mock_query.executed_sql = "SELECT * FROM users"
    mock_query.results_key = "result_key_123"

    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    # Mock results backend returning None for blob
    mock_results_backend = MagicMock()
    mock_results_backend.get.return_value = None  # No blob found

    mock_results_backend_manager = MagicMock()
    mock_results_backend_manager.results_backend = mock_results_backend

    mocker.patch(
        "superset.results_backend_manager",
        mock_results_backend_manager,
    )
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    query_result = result.get_result()

    # Should return failure when blob not found
    assert query_result.status == QueryStatus.FAILED
    assert "Results not available" in query_result.error_message  # type: ignore[operator]


def test_async_handle_get_result_no_results_backend(
    mocker: MockerFixture,
    database: Database,
    app_context: None,
    mock_db_session: MagicMock,
) -> None:
    """Test getting result when results_backend is None."""
    from superset.models.sql_lab import Query

    mock_query = MagicMock(spec=Query)
    mock_query.status = "success"
    mock_query.error_message = None
    mock_query.executed_sql = "SELECT * FROM users"
    mock_query.results_key = "result_key_123"

    filter_mock = mock_db_session.query.return_value.filter_by.return_value
    filter_mock.one_or_none.return_value = mock_query

    # Mock results_backend_manager with None backend
    mock_results_backend_manager = MagicMock()
    mock_results_backend_manager.results_backend = None  # No backend configured

    mocker.patch(
        "superset.results_backend_manager",
        mock_results_backend_manager,
    )
    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )
    mocker.patch("superset.sql.execution.celery_task.execute_sql_task")

    result = database.execute_async("SELECT * FROM users")

    query_result = result.get_result()

    # Should return failure when no results backend
    assert query_result.status == QueryStatus.FAILED
    assert "Results not available" in query_result.error_message  # type: ignore[operator]


def test_create_query_record_with_user(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that _create_query_record captures user_id when user exists."""
    from flask import g

    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["id"])

    # Mock a user with get_id
    mock_user = MagicMock()
    mock_user.get_id.return_value = 42

    mocker.patch("superset.sql.execution.executor.has_app_context", return_value=True)
    mocker.patch.object(g, "user", mock_user, create=True)

    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )

    result = database.execute("SELECT * FROM users")

    assert result.status == QueryStatus.SUCCESS
    mock_user.get_id.assert_called_once()


def test_get_from_cache_returns_cached_result(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that _get_from_cache returns cached result when available."""
    from superset.extensions import cache_manager
    from superset.sql.execution.executor import SQLExecutor

    executor = SQLExecutor(database)

    cached_data = {
        "statements": [
            {
                "original_sql": "SELECT * FROM users",
                "executed_sql": "SELECT * FROM users",
                "data": pd.DataFrame({"id": [1, 2]}),
                "row_count": 2,
                "execution_time_ms": 10.0,
            }
        ],
        "total_execution_time_ms": 10.0,
    }

    mocker.patch.object(cache_manager.data_cache, "get", return_value=cached_data)

    options = QueryOptions()
    result = executor._get_from_cache("SELECT * FROM users", options)

    assert result is not None
    assert result.status == QueryStatus.SUCCESS
    assert result.is_cached is True
    assert sum(s.row_count for s in result.statements) == 2


def test_cached_async_result_get_result_returns_cached(
    mocker: MockerFixture, database: Database, app_context: None
) -> None:
    """Test that cached async result returns the original cached result."""
    from superset_core.api.types import QueryResult as QueryResultType, StatementResult

    from superset.sql.execution.executor import SQLExecutor

    mocker.patch.dict(
        current_app.config, {"SQL_QUERY_MUTATOR": None, "SQLLAB_TIMEOUT": 30}
    )

    executor = SQLExecutor(database)

    cached_result = QueryResultType(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql="SELECT 1",
                executed_sql="SELECT 1",
                data=pd.DataFrame({"id": [1, 2, 3]}),
                row_count=3,
            )
        ],
    )

    async_result = executor._create_cached_handle(cached_result)

    # Get the result back
    retrieved_result = async_result.get_result()

    # Should return the same cached result
    assert retrieved_result.status == QueryStatus.SUCCESS
    assert sum(s.row_count for s in retrieved_result.statements) == 3
    assert retrieved_result is cached_result
