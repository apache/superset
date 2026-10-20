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

"""Tests for celery_task.py - async SQL execution via Celery."""

import base64
from collections.abc import Callable
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, PropertyMock

import msgpack
import pyarrow as pa
import pytest
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus as QueryStatusEnum
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetErrorsException
from superset.utils import json as superset_json

# Note: mock_query, mock_database, mock_result_set, and mock_db_session
# fixtures are imported from conftest.py
from .conftest import _passthrough_mutate_sql_based_on_config


def _prefixing_mutator(sql: str, **kwargs: Any) -> str:
    """SQL mutator stand-in that prepends a marker comment."""
    return f"-- mutated\n{sql}"


# =============================================================================
# Query Retrieval Tests
# =============================================================================


def test_get_query_success(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test successful query retrieval."""
    from superset.sql.execution.celery_task import _get_query

    mock_session = mocker.patch("superset.sql.execution.celery_task.db.session")
    mock_session.query.return_value.filter_by.return_value.one.return_value = mock_query

    result = _get_query(123)

    assert result == mock_query


# =============================================================================
# Error Handling Tests
# =============================================================================


def test_handle_query_error_basic(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test basic error handling."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")

    ex = Exception("Something went wrong")
    payload = _handle_query_error(ex, mock_query)

    assert payload["status"] == QueryStatusEnum.FAILED
    assert "Something went wrong" in payload["error"]


def test_handle_query_error_with_end_time_set(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test error handling when end_time is already set (line 116->120)."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")

    # Set end_time to trigger the branch skip
    mock_query.end_time = 12345.0

    ex = Exception("Error with end_time set")
    payload = _handle_query_error(ex, mock_query)

    assert payload["status"] == QueryStatusEnum.FAILED
    # end_time should not be modified
    assert mock_query.end_time == 12345.0


def test_handle_query_error_sets_end_time(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test error handling sets end_time when not set."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch(
        "superset.sql.execution.celery_task.now_as_float", return_value=99999.0
    )

    # end_time is None
    mock_query.end_time = None

    ex = Exception("Error")
    _handle_query_error(ex, mock_query)

    # Should set end_time
    assert mock_query.end_time == 99999.0


def test_handle_query_error_superset_error_exception(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test error handling with SupersetErrorException."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")

    error = SupersetError(
        message="Test error",
        error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
        level=ErrorLevel.ERROR,
    )
    ex = SupersetErrorException(error)

    payload = _handle_query_error(ex, mock_query)

    assert len(payload["errors"]) == 1
    assert payload["errors"][0]["message"] == "Test error"


def test_handle_query_error_superset_errors_exception(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test error handling with SupersetErrorsException."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")

    errors = [
        SupersetError(
            message="Error 1",
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
        ),
        SupersetError(
            message="Error 2",
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
        ),
    ]
    ex = SupersetErrorsException(errors)

    payload = _handle_query_error(ex, mock_query)

    assert len(payload["errors"]) == 2


def test_handle_query_error_with_troubleshooting_link(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test error handling includes troubleshooting link."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch.dict(
        current_app.config, {"TROUBLESHOOTING_LINK": "https://help.example.com"}
    )

    ex = Exception("Error")
    payload = _handle_query_error(ex, mock_query)

    assert payload["link"] == "https://help.example.com"


def test_handle_query_error_no_stacktrace_when_format_exc_empty(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test that stacktrace key is omitted when traceback.format_exc returns empty."""
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch(
        "superset.sql.execution.celery_task.traceback.format_exc", return_value=""
    )

    ex = Exception("Error")
    payload = _handle_query_error(ex, mock_query)

    assert "stacktrace" not in payload


def test_handle_query_error_includes_stacktrace_when_show_stacktrace_enabled(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test stacktrace key is included when SHOW_STACKTRACE=True.

    Covers lines 107-108 in celery_task._handle_query_error.
    """
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch.dict(current_app.config, {"SHOW_STACKTRACE": True})

    try:
        raise RuntimeError("boom")
    except RuntimeError as ex:
        payload = _handle_query_error(ex, mock_query)

    assert "stacktrace" in payload
    assert payload["stacktrace"]


def test_handle_query_error_omits_stacktrace_when_show_stacktrace_enabled_but_empty(
    mocker: MockerFixture, app_context: None, mock_query: MagicMock
) -> None:
    """Test stacktrace key is omitted when SHOW_STACKTRACE=True but format_exc is empty.

    Covers the branch at line 107 where SHOW_STACKTRACE is True but
    traceback.format_exc() returns an empty string (no active exception context).
    """
    from superset.sql.execution.celery_task import _handle_query_error

    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch.dict(current_app.config, {"SHOW_STACKTRACE": True})
    mocker.patch(
        "superset.sql.execution.celery_task.traceback.format_exc", return_value=""
    )

    ex = Exception("Error")
    payload = _handle_query_error(ex, mock_query)

    assert "stacktrace" not in payload


# =============================================================================
# Serialization Tests
# =============================================================================


def test_serialize_payload_json(mocker: MockerFixture, app_context: None) -> None:
    """Test JSON serialization when msgpack config is False."""
    from superset.sql.execution.celery_task import _serialize_payload

    mocker.patch("superset.results_backend_use_msgpack", False)
    payload = {"status": "success", "data": [1, 2, 3]}

    result = _serialize_payload(payload)

    # Now always returns bytes (encoded UTF-8)
    assert isinstance(result, bytes)
    assert b"success" in result


def test_serialize_payload_msgpack(mocker: MockerFixture, app_context: None) -> None:
    """Test msgpack serialization when msgpack config is True."""
    from superset.sql.execution.celery_task import _serialize_payload

    mocker.patch("superset.results_backend_use_msgpack", True)
    payload = {"status": "success", "data": [1, 2, 3]}

    result = _serialize_payload(payload)

    assert isinstance(result, bytes)
    unpacked = msgpack.loads(result)
    assert unpacked["status"] == "success"


# =============================================================================
# Statement Preparation Tests
# =============================================================================


def test_prepare_statement_blocks_single_statement(
    app_context: None, mock_database: MagicMock
) -> None:
    """Test statement block preparation for single statement."""
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mock_database.mutate_sql_based_on_config = _passthrough_mutate_sql_based_on_config
    sql = "SELECT * FROM users"

    script, blocks = _prepare_statement_blocks(
        sql, mock_database.db_engine_spec, mock_database
    )

    assert len(blocks) == 1


def test_prepare_statement_blocks_multiple_statements(
    app_context: None, mock_database: MagicMock
) -> None:
    """Test statement block preparation for multiple statements."""
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mock_database.mutate_sql_based_on_config = _passthrough_mutate_sql_based_on_config
    sql = "SELECT * FROM users; SELECT * FROM orders;"

    script, blocks = _prepare_statement_blocks(
        sql, mock_database.db_engine_spec, mock_database
    )

    assert len(blocks) == 2


def test_prepare_statement_blocks_run_as_one(
    app_context: None, mock_database: MagicMock
) -> None:
    """Test statement block preparation when engine runs multiple as one."""
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mock_database.db_engine_spec.run_multiple_statements_as_one = True
    mock_database.mutate_sql_based_on_config = _passthrough_mutate_sql_based_on_config
    sql = "SELECT * FROM users; SELECT * FROM orders;"

    script, blocks = _prepare_statement_blocks(
        sql, mock_database.db_engine_spec, mock_database
    )

    assert len(blocks) == 1


def test_prepare_statement_blocks_mutates_before_split_when_configured(
    app_context: None, mock_database: MagicMock, mocker: MockerFixture
) -> None:
    """
    `MUTATE_AFTER_SPLIT=False` should mutate the whole, un-split query before
    it gets broken into per-statement blocks, for engines that execute
    statements individually. Regression guard for issue #30169.
    """
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mocker.patch.dict(current_app.config, {"MUTATE_AFTER_SPLIT": False})
    mutate_mock = mocker.patch.object(
        mock_database,
        "mutate_sql_based_on_config",
        side_effect=_prefixing_mutator,
    )
    sql = "SELECT * FROM users; SELECT * FROM orders;"

    _, blocks = _prepare_statement_blocks(
        sql, mock_database.db_engine_spec, mock_database
    )

    assert len(blocks) == 2
    assert "mutated" in blocks[0]
    mutate_mock.assert_called_once_with(mocker.ANY, is_split=False)


def test_prepare_statement_blocks_skips_pre_split_mutation_when_configured(
    app_context: None, mock_database: MagicMock, mocker: MockerFixture
) -> None:
    """
    `MUTATE_AFTER_SPLIT=True` means the mutator should see each already-split
    statement instead, so `_prepare_statement_blocks` must not mutate the
    whole, un-split query up front.
    """
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mocker.patch.dict(current_app.config, {"MUTATE_AFTER_SPLIT": True})
    mutate_mock = mocker.patch.object(
        mock_database,
        "mutate_sql_based_on_config",
        side_effect=_prefixing_mutator,
    )
    sql = "SELECT * FROM users; SELECT * FROM orders;"

    _, blocks = _prepare_statement_blocks(
        sql, mock_database.db_engine_spec, mock_database
    )

    assert len(blocks) == 2
    assert "mutated" not in blocks[0]
    mutate_mock.assert_not_called()


def test_prepare_statement_blocks_mutates_per_statement_when_run_as_one(
    app_context: None, mock_database: MagicMock, mocker: MockerFixture
) -> None:
    """
    Engines that always run statements as a single block (e.g. BigQuery, Kusto)
    never see `is_split=True` in the per-block mutation call, so with
    `MUTATE_AFTER_SPLIT=True` the mutator must instead be applied to each
    statement here, before they're joined into that single block.
    """
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mocker.patch.dict(current_app.config, {"MUTATE_AFTER_SPLIT": True})
    mock_database.db_engine_spec.run_multiple_statements_as_one = True
    mutate_mock = mocker.patch.object(
        mock_database,
        "mutate_sql_based_on_config",
        side_effect=_prefixing_mutator,
    )
    sql = "SELECT * FROM users; SELECT * FROM orders;"

    _, blocks = _prepare_statement_blocks(
        sql, mock_database.db_engine_spec, mock_database
    )

    assert len(blocks) == 1
    assert blocks[0].count("mutated") == 2
    is_split_values = [
        call.kwargs.get("is_split") for call in mutate_mock.call_args_list
    ]
    assert is_split_values == [True, True]


def test_prepare_statement_blocks_raises_when_mutator_strips_all_statements(
    app_context: None, mock_database: MagicMock, mocker: MockerFixture
) -> None:
    """
    A `SQL_QUERY_MUTATOR` that strips a query down to nothing (e.g. only
    comments/whitespace) must raise a clean error instead of silently
    producing an empty block list.
    """
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mocker.patch.dict(current_app.config, {"MUTATE_AFTER_SPLIT": False})
    mocker.patch.object(
        mock_database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: "-- just a comment",
    )
    sql = "SELECT * FROM users"

    with pytest.raises(SupersetErrorException):
        _prepare_statement_blocks(sql, mock_database.db_engine_spec, mock_database)


def test_prepare_statement_blocks_raises_when_mutator_strips_single_block(
    app_context: None, mock_database: MagicMock, mocker: MockerFixture
) -> None:
    """
    The empty-statement guard must also cover engines that run all statements
    as one block: with `MUTATE_AFTER_SPLIT=True` the per-statement mutator
    outputs are joined into a single block, and a comment-only/empty result
    must raise a clean error instead of reaching execution as an empty block.
    """
    from superset.sql.execution.celery_task import _prepare_statement_blocks

    mocker.patch.dict(current_app.config, {"MUTATE_AFTER_SPLIT": True})
    mock_database.db_engine_spec.run_multiple_statements_as_one = True
    mocker.patch.object(
        mock_database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: "-- just a comment",
    )
    sql = "SELECT * FROM users; SELECT * FROM orders;"

    with pytest.raises(SupersetErrorException):
        _prepare_statement_blocks(sql, mock_database.db_engine_spec, mock_database)


# =============================================================================
# Result Finalization Tests
# =============================================================================


def test_finalize_successful_query(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_result_set: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test successful query finalization."""
    from superset.sql.execution.celery_task import _finalize_successful_query
    from superset.sql.parse import SQLScript

    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch("superset.dataframe.df_to_records", return_value=[{"id": 1}])
    payload: dict[str, Any] = {}
    mock_result_set.truncated = True

    # Create original script
    original_script = SQLScript(
        "SELECT * FROM users", mock_database.db_engine_spec.engine
    )

    # New signature: (query, original_script, execution_results, payload,
    # total_execution_time_ms). execution_results is a list of tuples:
    # (executed_sql, result_set, exec_time, rowcount)
    execution_results = [
        ("SELECT * FROM users WHERE rls_filter", mock_result_set, 10.5, 2)
    ]
    _finalize_successful_query(
        mock_query,
        original_script,
        execution_results,  # type: ignore[arg-type]
        payload,
        10.5,
    )

    assert mock_query.rows == 2
    assert mock_query.progress == 100
    assert payload["status"] == QueryStatusEnum.SUCCESS
    assert "statements" in payload
    assert payload["statements"][0]["truncated"] is True
    # SQL is formatted by SQLScript, so we can't compare exact whitespace
    assert "SELECT" in payload["statements"][0]["original_sql"]
    assert "FROM users" in payload["statements"][0]["original_sql"]
    assert (
        payload["statements"][0]["executed_sql"]
        == "SELECT * FROM users WHERE rls_filter"
    )


def test_finalize_successful_query_statement_count_mismatch(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_result_set: MagicMock,
    mock_database: MagicMock,
) -> None:
    """
    A `SQL_QUERY_MUTATOR` that changes the number of statements (e.g. by
    prepending a statement when run on the whole, un-split query) must not
    crash finalization when `original_script`'s statement count no longer
    matches `execution_results`.
    """
    from superset.sql.execution.celery_task import _finalize_successful_query
    from superset.sql.parse import SQLScript

    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch("superset.dataframe.df_to_records", return_value=[{"id": 1}])
    payload: dict[str, Any] = {}

    # Only one statement in the un-mutated original...
    original_script = SQLScript(
        "SELECT * FROM users", mock_database.db_engine_spec.engine
    )
    # ...but the mutator turned it into two.
    execution_results = [
        ("SET ROLE 'bob'", None, 1.0, 0),
        ("SELECT * FROM users", mock_result_set, 10.5, 2),
    ]

    _finalize_successful_query(
        mock_query,
        original_script,
        execution_results,  # type: ignore[arg-type]
        payload,
        11.5,
    )

    assert mock_query.rows == 2
    assert payload["status"] == QueryStatusEnum.SUCCESS
    assert len(payload["statements"]) == 2
    # Falls back to labeling each result with its own executed SQL.
    assert payload["statements"][0]["original_sql"] == "SET ROLE 'bob'"
    assert payload["statements"][1]["original_sql"] == "SELECT * FROM users"


def test_finalize_successful_query_with_msgpack(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_result_set: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test successful query finalization with Arrow/msgpack."""
    from superset.sql.execution.celery_task import _finalize_successful_query
    from superset.sql.parse import SQLScript

    mocker.patch("superset.results_backend_use_msgpack", True)
    mock_buffer = MagicMock()
    mock_buffer.to_pybytes.return_value = b"arrow_data"
    mocker.patch(
        "superset.sql.execution.celery_task.write_ipc_buffer", return_value=mock_buffer
    )

    # Mock stats_logger to cover the stats timing branch
    mock_stats = MagicMock()
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": mock_stats})

    payload: dict[str, Any] = {}

    # Create original script
    original_script = SQLScript(
        "SELECT * FROM users", mock_database.db_engine_spec.engine
    )

    execution_results = [
        ("SELECT * FROM users WHERE rls_filter", mock_result_set, 10.5, 2)
    ]
    _finalize_successful_query(
        mock_query,
        original_script,
        execution_results,  # type: ignore[arg-type]
        payload,
        10.5,
    )

    assert payload["statements"][0]["data"] == b"arrow_data"


def test_finalize_successful_query_msgpack_no_stats(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_result_set: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test finalization with msgpack when has_app_context() is False."""
    from superset.sql.execution.celery_task import _finalize_successful_query
    from superset.sql.parse import SQLScript

    mocker.patch("superset.results_backend_use_msgpack", True)
    mocker.patch(
        "superset.sql.execution.celery_task.has_app_context", return_value=False
    )
    mock_buffer = MagicMock()
    mock_buffer.to_pybytes.return_value = b"arrow_data"
    mocker.patch(
        "superset.sql.execution.celery_task.write_ipc_buffer", return_value=mock_buffer
    )

    payload: dict[str, Any] = {}

    # Create original script
    original_script = SQLScript(
        "SELECT * FROM users", mock_database.db_engine_spec.engine
    )

    execution_results = [
        ("SELECT * FROM users WHERE rls_filter", mock_result_set, 10.5, 2)
    ]
    _finalize_successful_query(
        mock_query,
        original_script,
        execution_results,  # type: ignore[arg-type]
        payload,
        10.5,
    )

    assert payload["statements"][0]["data"] == b"arrow_data"


def test_finalize_successful_query_with_dml(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test successful query finalization with DML statement (no result_set)."""
    from superset.sql.execution.celery_task import _finalize_successful_query
    from superset.sql.parse import SQLScript

    payload: dict[str, Any] = {}

    # Create original script
    original_script = SQLScript(
        "INSERT INTO users VALUES (1)", mock_database.db_engine_spec.engine
    )

    # DML statement: result_set is None, rowcount indicates affected rows
    execution_results: list[tuple[str, None, float, int]] = [
        ("INSERT INTO users VALUES (1)", None, 5.0, 1)
    ]
    _finalize_successful_query(
        mock_query,
        original_script,
        execution_results,  # type: ignore[arg-type]
        payload,
        5.0,
    )

    assert mock_query.rows == 0  # No rows returned for DML
    assert mock_query.progress == 100
    assert payload["status"] == QueryStatusEnum.SUCCESS
    assert payload["statements"][0]["data"] is None
    assert payload["statements"][0]["row_count"] == 1
    assert payload["statements"][0]["columns"] == []


# =============================================================================
# Results Storage Tests
# =============================================================================


def test_store_results_in_backend_success(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test successful results storage."""
    from superset.sql.execution.celery_task import _store_results_in_backend

    mock_results_backend = MagicMock()
    mock_results_backend.set.return_value = True
    mocker.patch(
        "superset.sql.execution.celery_task.results_backend", mock_results_backend
    )
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch(
        "superset.sql.execution.celery_task.zlib_compress", return_value=b"compressed"
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")

    payload = {"status": "success", "data": [], "query": {}}
    _store_results_in_backend(mock_query, payload, mock_database)

    assert mock_query.results_key is not None
    mock_results_backend.set.assert_called_once()


def test_store_results_in_backend_with_size_check(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test results storage with payload size check (covers lines 232-247)."""
    from superset.sql.execution.celery_task import _store_results_in_backend

    mock_results_backend = MagicMock()
    mock_results_backend.set.return_value = True
    mocker.patch(
        "superset.sql.execution.celery_task.results_backend", mock_results_backend
    )
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch(
        "superset.sql.execution.celery_task.zlib_compress", return_value=b"compressed"
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")

    # Set a high payload max to pass the size check
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 100})

    payload = {"status": "success", "data": [], "query": {}}
    _store_results_in_backend(mock_query, payload, mock_database)

    mock_results_backend.set.assert_called_once()


def test_store_results_in_backend_payload_too_large(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test results storage with payload exceeding size limit."""
    from superset.sql.execution.celery_task import _store_results_in_backend

    mocker.patch("superset.results_backend_use_msgpack", False)
    # Set very low limit
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 0.000001})

    large_payload = {"data": "x" * 1000, "query": {}}

    with pytest.raises(SupersetErrorException) as exc_info:
        _store_results_in_backend(mock_query, large_payload, mock_database)

    assert exc_info.value.error.error_type == SupersetErrorType.RESULT_TOO_LARGE_ERROR


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize("nested_column_present", [True, False])
@pytest.mark.parametrize("nested_value", [{"value": "x"}, [b"\xff" * 17]])
@pytest.mark.parametrize("text_length", [1, 9, 17])
@pytest.mark.parametrize("bytes_over_limit", [0, 1])
def test_store_results_in_backend_raw_arrow_size_boundary(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
    use_msgpack: bool,
    text_length: int,
    nested_column_present: bool,
    nested_value: Any,
    bytes_over_limit: int,
) -> None:
    """Count raw IPC plus all metadata, with exact limits and Base64 padding."""
    from superset.sql.execution.celery_task import (
        _serialize_payload,
        _serialize_result_set,
        _store_results_in_backend,
        BYTES_IN_MB,
    )
    from superset.sql.execution.serialization import serialize_nested_columns
    from superset.utils.core import zlib_decompress

    backend = mocker.patch("superset.sql.execution.celery_task.results_backend")
    backend.set.return_value = True
    mocker.patch("superset.results_backend_use_msgpack", use_msgpack)
    mocker.patch("superset.sql.execution.celery_task.uuid.uuid4", return_value="key")
    table_data = {"text": ["x" * text_length]}
    if nested_column_present:
        table_data["nested"] = [
            superset_json.dumps(nested_value, default=superset_json.json_iso_dttm_ser)
        ]
    mock_result_set.pa_table = pa.table(table_data)
    data, columns = _serialize_result_set(mock_result_set)
    payload: dict[str, Any] = {
        "query": {"resultsKey": "key"},
        "statements": [
            {"data": None, "columns": []},
            {
                "data": data,
                "columns": columns,
                "nested_columns_arrow_nbytes": (
                    {"nested": mock_result_set.pa_table.column("nested").nbytes}
                    if nested_column_present
                    else {}
                ),
                "nested_columns_msgpack": serialize_nested_columns(
                    {"nested": [nested_value]}, use_msgpack=use_msgpack
                ),
            },
            {"data": data, "columns": columns},
        ],
        "metadata": "x" * 1000,
    }
    serialized = _serialize_payload(payload)
    sidecar = payload["statements"][1]["nested_columns_msgpack"]["nested"]
    raw_sidecar_size = len(sidecar if use_msgpack else base64.b64decode(sidecar))
    expected_size = len(serialized) - (len(sidecar) - raw_sidecar_size)
    if nested_column_present:
        expected_size -= min(
            raw_sidecar_size, mock_result_set.pa_table.column("nested").nbytes
        )
    if isinstance(data, str):
        expected_size -= 2 * (len(data) - len(base64.b64decode(data)))
    mocker.patch.dict(
        current_app.config,
        {"SQLLAB_PAYLOAD_MAX_MB": (expected_size - bytes_over_limit) / BYTES_IN_MB},
    )

    if bytes_over_limit:
        with pytest.raises(SupersetErrorException) as exc_info:
            _store_results_in_backend(mock_query, payload, mock_database)
        assert (
            exc_info.value.error.error_type == SupersetErrorType.RESULT_TOO_LARGE_ERROR
        )
        backend.set.assert_not_called()
        assert mock_query.results_key is None
    else:
        _store_results_in_backend(mock_query, payload, mock_database)
        backend.set.assert_called_once()
        assert (
            zlib_decompress(backend.set.call_args.args[1], decode=False) == serialized
        )
        assert mock_query.results_key == "key"


def test_store_results_in_backend_default_cache_timeout(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test storage uses default cache timeout when database timeout is None."""
    from superset.sql.execution.celery_task import _store_results_in_backend

    mock_results_backend = MagicMock()
    mock_results_backend.set.return_value = True
    mocker.patch(
        "superset.sql.execution.celery_task.results_backend", mock_results_backend
    )
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch(
        "superset.sql.execution.celery_task.zlib_compress", return_value=b"compressed"
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")

    # Set database cache_timeout to None
    mock_database.cache_timeout = None

    payload = {"status": "success", "data": [], "query": {}}
    _store_results_in_backend(mock_query, payload, mock_database)

    mock_results_backend.set.assert_called_once()


def test_store_results_in_backend_write_failure(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test results storage write failure."""
    from superset.sql.execution.celery_task import _store_results_in_backend

    mock_results_backend = MagicMock()
    mock_results_backend.set.return_value = False
    mocker.patch(
        "superset.sql.execution.celery_task.results_backend", mock_results_backend
    )
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch(
        "superset.sql.execution.celery_task.zlib_compress", return_value=b"compressed"
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")

    payload = {"status": "success", "data": [], "query": {}}

    with pytest.raises(SupersetErrorException) as exc_info:
        _store_results_in_backend(mock_query, payload, mock_database)

    assert exc_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR


# =============================================================================
# Data Serialization Tests
# =============================================================================


def test_serialize_result_set_msgpack(
    mocker: MockerFixture, app_context: None, mock_result_set: MagicMock
) -> None:
    """Test result set serialization with msgpack/Arrow when config is True."""
    from superset.sql.execution.celery_task import _serialize_result_set

    mocker.patch("superset.results_backend_use_msgpack", True)
    mock_buffer = MagicMock()
    mock_buffer.to_pybytes.return_value = b"arrow_data"
    mocker.patch(
        "superset.sql.execution.celery_task.write_ipc_buffer", return_value=mock_buffer
    )
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    data, columns = _serialize_result_set(mock_result_set)

    assert data == b"arrow_data"
    assert columns == mock_result_set.columns


def test_serialize_result_set_json(
    mocker: MockerFixture, app_context: None, mock_result_set: MagicMock
) -> None:
    """Test result set serialization with JSON when msgpack config is False."""
    from superset.sql.execution.celery_task import _serialize_result_set

    mocker.patch("superset.results_backend_use_msgpack", False)
    data, columns = _serialize_result_set(mock_result_set)

    assert isinstance(data, str)
    table = pa.ipc.open_stream(base64.b64decode(data)).read_all()
    assert table.equals(mock_result_set.pa_table)
    assert columns == mock_result_set.columns


def test_serialize_result_set_json_normalizes_decimal_nonfinite(
    mocker: MockerFixture, app_context: None, mock_result_set: MagicMock
) -> None:
    """Async JSON results contain null, never bare Decimal non-finite tokens."""
    from superset.sql.execution.celery_task import (
        _serialize_payload,
        _serialize_result_set,
    )

    finite = Decimal("0.10000000000000000001")
    mocker.patch("superset.results_backend_use_msgpack", False)
    # SupersetResultSet normalizes non-finite decimals before exposing its table.
    mock_result_set.pa_table = pa.table(
        {"value": [None, None, None, None, str(finite)]}
    )
    data, _ = _serialize_result_set(mock_result_set)
    assert isinstance(data, str)
    table = pa.ipc.open_stream(base64.b64decode(data)).read_all()
    assert table.to_pydict()["value"] == [None, None, None, None, str(finite)]

    payload_text = _serialize_payload({"data": data}).decode()
    assert "NaN" not in payload_text
    assert "Infinity" not in payload_text
    assert superset_json.loads(payload_text)["data"] == data


# =============================================================================
# Helper Function Tests
# =============================================================================


@pytest.mark.parametrize(
    "query_status,expected_result",
    [
        (QueryStatusEnum.STOPPED, True),
        (QueryStatusEnum.RUNNING, False),
    ],
)
def test_make_check_stopped_fn(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    query_status: QueryStatusEnum,
    expected_result: bool,
) -> None:
    """Test check_stopped function returns correct value based on query status."""
    from superset.sql.execution.celery_task import _make_check_stopped_fn

    mocker.patch("superset.sql.execution.celery_task.db.session")
    mock_query.status = query_status

    check_stopped = _make_check_stopped_fn(mock_query)
    result = check_stopped()

    assert result is expected_result


def test_make_execute_fn(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test execute function creation."""
    from superset.sql.execution.celery_task import _make_execute_fn

    mock_cursor = MagicMock()
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    execute_fn = _make_execute_fn(mock_query, mock_database.db_engine_spec)
    execute_fn(mock_cursor, "SELECT * FROM users")

    assert mock_query.executed_sql == "SELECT * FROM users"


@pytest.mark.parametrize(
    "logger_configured,should_be_called",
    [
        (True, True),
        (False, False),
    ],
    ids=["with_logger", "no_logger"],
)
def test_make_log_query_fn(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    logger_configured: bool,
    should_be_called: bool,
) -> None:
    """Test log query function with and without logger configured."""
    from superset.sql.execution.celery_task import _make_log_query_fn

    mock_logger = MagicMock() if logger_configured else None
    mocker.patch.dict(current_app.config, {"QUERY_LOGGER": mock_logger})
    mocker.patch("superset.sql.execution.celery_task.security_manager", MagicMock())

    log_fn = _make_log_query_fn(mock_database)
    log_fn("SELECT * FROM users", "public")

    if should_be_called:
        assert mock_logger is not None
        mock_logger.assert_called_once()
    # If no logger, the function should complete without error


# =============================================================================
# Main Task Execution Tests
# =============================================================================


def test_execute_sql_task_success(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test successful execute_sql_task (covers lines 339-352, 400-473)."""
    from superset.sql.execution.celery_task import execute_sql_task

    from .conftest import setup_mock_raw_connection

    mock_query.database = mock_database
    mock_query.status = QueryStatusEnum.PENDING

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("SELECT * FROM users", mock_result_set, 10.5, 2)],
    )
    mocker.patch("superset.sql.execution.celery_task.results_backend", None)
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    setup_mock_raw_connection(mock_database)

    result = execute_sql_task(123, "SELECT * FROM users", username="admin")

    assert result is not None  # Success returns payload
    assert result["status"] == QueryStatusEnum.SUCCESS
    assert mock_query.status == QueryStatusEnum.SUCCESS


def test_execute_sql_task_with_start_time(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test execute_sql_task accepts start_time parameter (covers line 400-402)."""
    import time

    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("SELECT * FROM users", mock_result_set, 10.5, 2)],
    )
    mocker.patch("superset.sql.execution.celery_task.results_backend", None)
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    start_time = time.time() - 1.0
    result = execute_sql_task(123, "SELECT * FROM users", start_time=start_time)

    # Verify task completes successfully with start_time
    assert result is not None
    assert result["status"] == QueryStatusEnum.SUCCESS


def test_execute_sql_task_with_cancel_query_id(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test execute_sql_task sets cancel_query_id when available."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database
    mock_database.db_engine_spec.get_cancel_query_id.return_value = "cancel_123"

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("SELECT * FROM users", mock_result_set, 10.5, 2)],
    )
    mocker.patch("superset.sql.execution.celery_task.results_backend", None)
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    execute_sql_task(123, "SELECT * FROM users")

    # Verify cancel_query_id was set via db_engine_spec
    mock_database.db_engine_spec.get_cancel_query_id.assert_called_once()
    mock_query.set_extra_json_key.assert_any_call("cancel_query", "cancel_123")


def test_execute_sql_task_stopped(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test execute_sql_task when query is stopped (covers lines 456-458)."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # Empty list indicates stopped (check_stopped_fn returned True mid-execution)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[],
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    result = execute_sql_task(123, "SELECT * FROM users")

    assert result["status"] == QueryStatusEnum.STOPPED


@pytest.mark.parametrize("stop_intent", ["executor", "early", "status"])
def test_cancelled_impala_cursor_is_not_finalized_as_success(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    stop_intent: str,
) -> None:
    """Cleared impyla description after a stop is not a successful DML result."""
    impyla = pytest.importorskip("impala.hiveserver2")

    from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
    from superset.db_engine_specs.impala import ImpalaEngineSpec
    from superset.sql.execution import celery_task
    from superset.sql.execution.executor import SQLExecutor

    mock_query.sql = "SELECT 1"
    mock_query.database = mock_database
    mock_database.db_engine_spec = ImpalaEngineSpec
    mock_query.extra = {QUERY_CANCEL_KEY: "0123456789abcdef:fedcba9876543210"}
    mock_query.set_extra_json_key.side_effect = lambda key, value: (
        mock_query.extra.update({key: value})
    )
    cursor = impyla.HiveServer2Cursor(MagicMock())
    operation = MagicMock(has_result_set=True)

    def execute_async(sql: str) -> None:
        """Publish a real impyla operation backed by mocked RPCs."""
        cursor._last_operation = operation
        cursor._last_operation_active = True

    def stop_before_poll() -> str:
        """Stop after dispatch, before handle_cursor checks the intent."""
        if stop_intent == "executor":
            assert SQLExecutor._cancel_query(mock_database, mock_query)
        elif stop_intent == "early":
            mock_query.extra[QUERY_EARLY_CANCEL_KEY] = True
        else:
            mock_query.status = QueryStatusEnum.STOPPED
        return "RUNNING_STATE"

    operation.get_status.side_effect = stop_before_poll
    mocker.patch.object(cursor, "execute_async", side_effect=execute_async)
    connection = mock_database.get_raw_connection.return_value.__enter__.return_value
    connection.cursor.return_value = cursor
    mocker.patch.object(ImpalaEngineSpec, "get_cancel_query_id", return_value=None)
    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    finalize = mocker.spy(celery_task, "_finalize_successful_query")
    store = mocker.patch("superset.sql.execution.celery_task._store_results_in_backend")
    mocker.patch("superset.sql.execution.celery_task.results_backend", MagicMock())
    post = mocker.patch("superset.db_engine_specs.impala.requests.post")

    payload = celery_task._execute_sql_statements(123, "SELECT 1", None)

    operation.cancel.assert_called_once_with()
    operation.close.assert_called_once_with()
    assert cursor.description is None
    assert payload is not None
    assert payload["status"] == QueryStatusEnum.STOPPED
    assert mock_query.status == QueryStatusEnum.STOPPED
    connection.commit.assert_not_called()
    finalize.assert_not_called()
    store.assert_not_called()
    post.assert_not_called()


@pytest.mark.parametrize("stop_intent", ["early", "status"])
@pytest.mark.parametrize("stop_checkpoint", ["execution", "connection_exit"])
@pytest.mark.parametrize("end_time", [None, 1234.5])
def test_stop_with_partial_results_skips_success_finalization(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    stop_intent: str,
    stop_checkpoint: str,
    end_time: float | None,
) -> None:
    """
    A stop seen by the pre-commit check skips success finalization and keeps
    the recorded end time. A stop during connection cleanup is caught by the
    guarded publish instead, after the results are prepared.
    """
    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.sql.execution import celery_task

    mock_query.database = mock_database
    mock_query.end_time = end_time
    mocker.patch.object(celery_task, "_get_query", return_value=mock_query)
    mocker.patch.object(celery_task, "now_as_float", return_value=5678.9)
    finalize = mocker.spy(celery_task, "_finalize_successful_query")
    store = mocker.patch.object(celery_task, "_store_results_in_backend")
    mocker.patch.object(celery_task, "results_backend", MagicMock())

    def record_stop(*args: Any, **kwargs: Any) -> None:
        """Expose the stop intent at the selected execution boundary."""
        if stop_intent == "early":
            mock_query.extra[QUERY_EARLY_CANCEL_KEY] = True
        else:
            mock_query.status = QueryStatusEnum.STOPPED

    results = [("SELECT * FROM users", None, 1.0, 0)]

    def execute_with_partial_results(
        **kwargs: Any,
    ) -> list[tuple[str, None, float, int]]:
        """Return completed work even if the last statement was stopped."""
        if stop_checkpoint == "execution":
            record_stop()
        return results

    mocker.patch.object(
        celery_task, "execute_sql_with_cursor", side_effect=execute_with_partial_results
    )
    if stop_checkpoint == "connection_exit":
        mock_database.get_raw_connection.return_value.__exit__.side_effect = record_stop

    payload = celery_task._execute_sql_statements(123, mock_query.sql, None)

    assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
    assert mock_query.status == QueryStatusEnum.STOPPED
    if stop_checkpoint == "execution":
        assert mock_query.end_time == (end_time if end_time is not None else 5678.9)
        finalize.assert_not_called()
        store.assert_not_called()
    else:
        finalize.assert_called_once()
        store.assert_called_once()


def test_execute_sql_task_with_mutation(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test execute_sql_task commits for mutations (covers lines 461-462)."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database
    mock_query.select_as_cta = True  # Trigger mutation commit

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("INSERT INTO users VALUES (1)", mock_result_set, 5.0, 1)],
    )
    mocker.patch("superset.sql.execution.celery_task.results_backend", None)
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    mock_conn = setup_mock_raw_connection(mock_database)

    execute_sql_task(123, "INSERT INTO users VALUES (1)")

    mock_conn.commit.assert_called()


def test_execute_sql_task_with_results_backend(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test execute_sql_task stores results in backend (covers lines 466-467)."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("SELECT * FROM users", mock_result_set, 10.5, 2)],
    )

    mock_results_backend = MagicMock()
    mock_results_backend.set.return_value = True
    mocker.patch(
        "superset.sql.execution.celery_task.results_backend", mock_results_backend
    )
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch(
        "superset.sql.execution.celery_task.zlib_compress", return_value=b"data"
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    result = execute_sql_task(123, "SELECT * FROM users")

    mock_results_backend.set.assert_called_once()
    assert result is not None
    assert result["status"] == QueryStatusEnum.SUCCESS


def test_execute_sql_task_timeout(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
) -> None:
    """Test execute_sql_task handles timeout (covers lines 438-453)."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        side_effect=SoftTimeLimitExceeded(),
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(
        current_app.config,
        {"STATS_LOGGER": MagicMock(), "SQLLAB_ASYNC_TIME_LIMIT_SEC": 300},
    )

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    result = execute_sql_task(123, "SELECT * FROM users")

    # TIMED_OUT status is preserved (not overwritten to FAILED)
    assert result["status"] == QueryStatusEnum.TIMED_OUT.value


def test_execute_sql_task_unhandled_exception(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
) -> None:
    """Test execute_sql_task handles unhandled exceptions (covers lines 347-352)."""
    from superset.sql.execution.celery_task import execute_sql_task

    # Mock _get_query to succeed first time (for override_user), then return mock_query
    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    mocker.patch(
        "superset.sql.execution.celery_task._execute_sql_statements",
        side_effect=Exception("Unexpected error"),
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    result = execute_sql_task(123, "SELECT * FROM users")

    assert result["status"] == QueryStatusEnum.FAILED


def test_execute_sql_task_success_final_commit(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test execute_sql_task final success path (covers lines 469-473)."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database
    mock_query.status = QueryStatusEnum.RUNNING  # Will be changed to SUCCESS

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("SELECT * FROM users", mock_result_set, 10.5, 2)],
    )
    mocker.patch("superset.sql.execution.celery_task.results_backend", None)
    mocker.patch("superset.results_backend_use_msgpack", False)
    mock_session = mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    result = execute_sql_task(123, "SELECT * FROM users")

    assert result is not None
    assert result["status"] == QueryStatusEnum.SUCCESS
    assert mock_query.status == QueryStatusEnum.SUCCESS
    mock_session.commit.assert_called()


def test_execute_sql_task_with_failed_status_before_final_commit(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
) -> None:
    """Test execute_sql_task final commit when query.status is already FAILED."""
    from superset.sql.execution.celery_task import execute_sql_task

    mock_query.database = mock_database

    mocker.patch(
        "superset.sql.execution.celery_task._get_query", return_value=mock_query
    )
    # execute_sql_with_cursor returns (exec_sql, result_set, time, rowcount)
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_with_cursor",
        return_value=[("SELECT * FROM users", mock_result_set, 10.5, 2)],
    )

    # Mock _store_results_in_backend to set status to FAILED without raising
    def mock_store_results(query, payload, database, on_results_key=None):
        query.status = QueryStatusEnum.FAILED

    mocker.patch("superset.sql.execution.celery_task.results_backend", MagicMock())
    mocker.patch("superset.results_backend_use_msgpack", False)
    mocker.patch(
        "superset.sql.execution.celery_task._store_results_in_backend",
        side_effect=mock_store_results,
    )
    mocker.patch("superset.sql.execution.celery_task.db.session")
    mocker.patch("superset.dataframe.df_to_records", return_value=[])
    mocker.patch("superset.sql.execution.celery_task.security_manager")
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    from .conftest import setup_mock_raw_connection

    setup_mock_raw_connection(mock_database)

    result = execute_sql_task(123, "SELECT * FROM users")

    # Verify query status remains FAILED and is not changed to SUCCESS
    assert result is not None
    assert "error" not in result
    assert mock_query.status == QueryStatusEnum.FAILED


@pytest.mark.parametrize(
    "stop_checkpoint",
    ["serialization", "backend_write", "backend_failure", "backend_error"],
)
def test_stop_during_result_finalization_stays_stopped(
    mocker: MockerFixture,
    app_context: None,
    mock_db_session: MagicMock,
    mock_query: MagicMock,
    mock_database: MagicMock,
    mock_result_set: MagicMock,
    stop_checkpoint: str,
) -> None:
    """A stop during result processing must not become a successful query."""
    from superset.sql.execution import celery_task

    mock_query.database = mock_database
    mocker.patch.object(celery_task, "_get_query", return_value=mock_query)
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[(mock_query.sql, mock_result_set, 1.0, 2)],
    )
    backend = mocker.patch.object(celery_task, "results_backend", MagicMock())
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"results")

    committed: dict[str, Any] = {}

    def record_stop() -> None:
        """Another request commits a stop after the post-execution check."""
        committed.update(status=QueryStatusEnum.STOPPED, end_time=1234.5)
        mock_query.status = QueryStatusEnum.STOPPED

    def refresh(query: MagicMock, *args: Any, **kwargs: Any) -> None:
        """A refresh reloads the committed stop over pending success fields."""
        for key, value in committed.items():
            setattr(query, key, value)

    mock_db_session.refresh.side_effect = refresh

    def serialize(result_set: MagicMock) -> tuple[list[object], list[object]]:
        """Stop while preparing the success payload."""
        if stop_checkpoint == "serialization":
            record_stop()
        return [], []

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Stop while the results backend write is in flight."""
        if stop_checkpoint != "serialization":
            record_stop()
        if stop_checkpoint == "backend_error":
            raise RuntimeError("Backend unavailable")
        return stop_checkpoint != "backend_failure"

    mocker.patch.object(celery_task, "_serialize_result_set", side_effect=serialize)
    backend.set.side_effect = store

    mocker.patch.object(celery_task, "security_manager", MagicMock())
    payload = celery_task.execute_sql_task(123, mock_query.sql)

    assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
    assert mock_query.status == QueryStatusEnum.STOPPED
    assert mock_query.end_time == 1234.5
    assert mock_query.results_key is None
    # A stop during serialization is caught after the backend write.
    backend.set.assert_called_once()


@pytest.mark.parametrize("delete_fails", [False, True], ids=["deleted", "delete_error"])
@pytest.mark.parametrize(
    "checkpoint",
    ["none", "backend_write", "backend_failure", "publish_check", "publish_commit"],
)
def test_stop_after_results_write_deletes_stored_results(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
    checkpoint: str,
    delete_fails: bool,
) -> None:
    """
    Test that results stored for a query a stop then wins are deleted from the
    results backend, and that a failed delete still ends STOPPED.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'stored.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    def deliver_stop() -> None:
        """Commit the stop in an independent transaction."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatusEnum.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob, with the stop landing while the write is in flight."""
        if checkpoint in {"backend_write", "backend_failure"}:
            deliver_stop()
        if checkpoint == "backend_failure":
            return False
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    # A failing delete behaves like an unavailable backend.
    backend.delete.side_effect = (
        RuntimeError("Backend unavailable") if delete_fails else delete
    )
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")

    original_make_check = celery_task._make_check_stopped_fn
    finalization_checks = 0

    def make_check(query: Query, preserve_pending: bool = False) -> Callable[[], bool]:
        """Deliver Stop after the post-write check or after the publish check."""
        check = original_make_check(query, preserve_pending)

        def check_then_stop() -> bool:
            nonlocal finalization_checks
            stopped = check()
            if preserve_pending:
                finalization_checks += 1
                if (checkpoint, finalization_checks) in {
                    ("publish_check", 1),
                    ("publish_commit", 2),
                }:
                    deliver_stop()
            return stopped

        return check_then_stop

    mocker.patch.object(celery_task, "_make_check_stopped_fn", side_effect=make_check)
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="stored-results",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        session.refresh(query)
        mocker.patch.object(celery_task.db, "session", session)
        mocker.patch.object(celery_task, "_get_query", return_value=query)
        mocker.patch.object(
            celery_task,
            "execute_sql_with_cursor",
            return_value=[("SELECT 1", None, 1.0, 0)],
        )

        with caplog.at_level("WARNING", logger=celery_task.logger.name):
            payload = celery_task._execute_sql_statements(123, query.sql, None)

        session.refresh(query)
        _assert_stored_results_outcome(
            payload, query, backend, stored, caplog.text, checkpoint, delete_fails
        )
    engine.dispose()


def _assert_stored_results_outcome(
    payload: dict[str, Any] | None,
    query: Any,
    backend: MagicMock,
    stored: dict[str, bytes],
    log_text: str,
    checkpoint: str,
    delete_fails: bool,
) -> None:
    """Check the query, payload and results backend after finalization."""
    backend.set.assert_called_once()
    key = backend.set.call_args.args[0]
    if checkpoint == "none":
        assert payload is not None
        assert payload["status"] == QueryStatusEnum.SUCCESS
        assert query.status == QueryStatusEnum.SUCCESS
        assert query.results_key == key
        assert key in stored
        backend.delete.assert_not_called()
        return

    assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
    assert query.status == QueryStatusEnum.STOPPED
    assert query.end_time == Decimal("1234.5")
    assert query.results_key is None
    if checkpoint == "backend_failure":
        # Nothing was stored, so there is nothing to delete.
        backend.delete.assert_not_called()
        return

    backend.delete.assert_called_once_with(key)
    assert (key in stored) is delete_fails
    assert ("Failed to delete unpublished results" in log_text) is delete_fails


@pytest.mark.parametrize("delete_fails", [False, True], ids=["deleted", "delete_error"])
@pytest.mark.parametrize(
    "failure,stop",
    [
        (failure, stop)
        for failure in ["write_timing", "status_read", "publish_update"]
        for stop in ["none", "with_failure", "error_commit"]
    ]
    # The failed flush follows the guarded UPDATE, whose SQLite write lock
    # blocks a stop committed from another connection until the rollback.
    + [("publish_flush", "none"), ("publish_flush", "error_commit")],
)
def test_error_after_results_write_deletes_stored_results_when_stopped(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
    failure: str,
    stop: str,
    delete_fails: bool,
) -> None:
    """
    Test that results stored before a task error are deleted when the error
    handler finds the query stopped, and that a failed delete still ends STOPPED.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'error-stored.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False

    def deliver_stop() -> None:
        """Commit the stop in an independent transaction."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatusEnum.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = (
        RuntimeError("Backend unavailable") if delete_fails else delete
    )
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", None, 1.0, 0)],
    )
    failed = False

    def fail_after_write() -> None:
        """Raise once the results are stored, with the stop landing first."""
        nonlocal failed
        assert stored
        failed = True
        if stop == "with_failure":
            deliver_stop()
        raise RuntimeError("Metrics or metadata database unavailable")

    _fail_after_results_write(
        mocker, engine, failure, lambda: bool(stored) and not failed, fail_after_write
    )

    original_make_check = celery_task._make_check_stopped_fn

    def make_check(query: Query, preserve_pending: bool = False) -> Callable[[], bool]:
        """Deliver the stop after the error handler's own stop check."""
        check = original_make_check(query, preserve_pending)

        def check_then_stop() -> bool:
            stopped = check()
            if stop == "error_commit" and failed and preserve_pending:
                deliver_stop()
            return stopped

        return check_then_stop

    mocker.patch.object(celery_task, "_make_check_stopped_fn", side_effect=make_check)
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="error-stored",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        with caplog.at_level("WARNING", logger=celery_task.logger.name):
            payload = celery_task.execute_sql_task(123, query.sql)

        session.refresh(query)
        assert failed
        _assert_error_results_outcome(
            payload, query, backend, stored, caplog.text, stop, delete_fails
        )
    engine.dispose()


def _fail_after_results_write(
    mocker: MockerFixture,
    engine: Any,
    failure: str,
    armed: Callable[[], bool],
    fail: Callable[[], None],
) -> None:
    """
    Raise from the write timing metric, the status read right after the write,
    the guarded publish UPDATE, or the flush committing the published metadata.
    """
    from sqlalchemy import event

    if failure == "write_timing":
        stats_logger = MagicMock()

        def timing(key: str, value: float) -> None:
            """Fail emitting the results backend write timing."""
            if key == "sqllab.query.results_backend_write" and armed():
                fail()

        stats_logger.timing.side_effect = timing
        mocker.patch.dict(current_app.config, {"STATS_LOGGER": stats_logger})
        return

    @event.listens_for(engine, "before_cursor_execute")
    def fail_publish(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Fail the selected metadata statement, after the results are stored."""
        verb = statement.lstrip().split(" ", 1)[0]
        guarded = "status !=" in statement
        failing = {
            "status_read": verb == "SELECT",
            "publish_update": verb == "UPDATE" and guarded,
            "publish_flush": verb == "UPDATE" and not guarded,
        }[failure]
        if failing and armed():
            fail()


def _assert_error_results_outcome(
    payload: dict[str, Any] | None,
    query: Any,
    backend: MagicMock,
    stored: dict[str, bytes],
    log_text: str,
    stop: str,
    delete_fails: bool,
) -> None:
    """Check the query, payload and results backend after the task error."""
    backend.set.assert_called_once()
    key = backend.set.call_args.args[0]
    if stop == "none":
        # Not a stop: the failure is reported and the row keeps its key.
        assert payload is not None
        assert payload["status"] == QueryStatusEnum.FAILED
        assert query.status == QueryStatusEnum.FAILED
        assert query.results_key == key
        assert key in stored
        backend.delete.assert_not_called()
        return

    assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
    assert query.status == QueryStatusEnum.STOPPED
    assert query.end_time == Decimal("1234.5")
    assert query.results_key is None
    backend.delete.assert_called_once_with(key)
    assert (key in stored) is delete_fails
    assert ("Failed to delete unpublished results" in log_text) is delete_fails


@pytest.mark.parametrize(
    ("delete_result", "message"),
    [
        (True, None),
        (False, "Unpublished results were not deleted"),
        (RuntimeError("Backend unavailable"), "Failed to delete unpublished results"),
    ],
    ids=["deleted", "missing", "delete_error"],
)
def test_discard_stored_results_logs_undeleted_results(
    mocker: MockerFixture,
    app_context: None,
    caplog: pytest.LogCaptureFixture,
    delete_result: bool | Exception,
    message: str | None,
) -> None:
    """Test that results the backend did not delete are logged, not raised."""
    from superset.sql.execution import celery_task

    backend = MagicMock()
    if isinstance(delete_result, Exception):
        backend.delete.side_effect = delete_result
    else:
        backend.delete.return_value = delete_result
    mocker.patch.object(celery_task, "results_backend", backend)

    with caplog.at_level("WARNING", logger="superset.sql.execution.utils"):
        celery_task._discard_stored_results(123, "results-key", backend)

    backend.delete.assert_called_once_with("results-key")
    if message is None:
        assert not caplog.records
    else:
        assert message in caplog.text


@pytest.mark.parametrize(
    ("key", "has_backend"),
    [(None, True), ("results-key", False)],
    ids=["no_key", "no_backend"],
)
def test_discard_unreferenced_results_without_stored_results(
    mocker: MockerFixture,
    app_context: None,
    key: str | None,
    has_backend: bool,
) -> None:
    """Test that nothing is read or deleted when no results were stored."""
    from superset.sql.execution import celery_task

    backend = MagicMock() if has_backend else None
    mocker.patch.object(celery_task, "results_backend", backend)
    session = mocker.patch.object(celery_task.db, "session")

    celery_task._discard_unreferenced_results(123, key, backend)

    session.rollback.assert_not_called()
    session.query.assert_not_called()
    if backend is not None:
        backend.delete.assert_not_called()


@pytest.mark.parametrize("failure", ["payload", "commit"])
def test_error_path_deletes_results_only_without_committed_failure(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    failure: str,
) -> None:
    """
    Test that the error path deletes results stored before a failure only when
    no committed row references them: a failure building the error payload or
    committing the failed row leaves the row uncommitted, so its results go.
    """
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'failed-commit.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = delete
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", None, 1.0, 0)],
    )

    stats_logger = MagicMock()

    def timing(key: str, value: float) -> None:
        """Fail emitting the write timing, once the results are stored."""
        if key == "sqllab.query.results_backend_write":
            raise RuntimeError("Metrics unavailable")

    stats_logger.timing.side_effect = timing
    mocker.patch.dict(
        current_app.config, {"STATS_LOGGER": stats_logger, "SHOW_STACKTRACE": True}
    )
    if failure == "payload":
        mocker.patch.object(
            celery_task.traceback,
            "format_exc",
            side_effect=RuntimeError("Error payload failed"),
        )

    failed_flushed = False

    @event.listens_for(engine, "commit")
    def fail_failed_commit(conn: Any) -> None:
        """Fail committing the failed row before the database commits it."""
        if failure == "commit" and failed_flushed:
            raise RuntimeError("Metadata commit failed")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="failed-commit",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        @event.listens_for(session, "after_flush")
        def flushed_failure(flushing_session: Any, context: Any) -> None:
            nonlocal failed_flushed
            failed_flushed = query.status == QueryStatusEnum.FAILED

        match = "Error payload failed" if failure == "payload" else "commit failed"
        with pytest.raises(RuntimeError, match=match):
            celery_task.execute_sql_task(123, query.sql)
        session.rollback()

        backend.set.assert_called_once()
        key = backend.set.call_args.args[0]
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatusEnum.RUNNING
            assert persisted.results_key is None
        backend.delete.assert_called_once_with(key)
        assert key not in stored
    engine.dispose()


@pytest.mark.parametrize(
    ("reread", "delete_fails"),
    [("available", False), ("available", True), ("unavailable", False)],
    ids=["reread-deleted", "reread-delete_error", "no_reread"],
)
def test_unrecorded_error_after_results_write_deletes_only_unreferenced_results(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
    reread: str,
    delete_fails: bool,
) -> None:
    """
    Test that results stored before a failure the task cannot record are
    deleted once a fresh read shows the row does not reference them, and kept
    until they expire when the metadata database cannot be read at all.
    """
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'unrecorded.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = (
        RuntimeError("Backend unavailable") if delete_fails else delete
    )
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", None, 1.0, 0)],
    )

    @event.listens_for(engine, "before_cursor_execute")
    def metadata_unavailable(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Fail every metadata statement once the results are stored."""
        cleanup_read = statement.startswith('SELECT "query".results_key ')
        if stored and not (reread == "available" and cleanup_read):
            raise RuntimeError("Metadata database unavailable")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="unrecorded",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        with caplog.at_level("WARNING", logger=celery_task.logger.name):
            with pytest.raises(RuntimeError, match="Metadata database unavailable"):
                celery_task.execute_sql_task(123, query.sql)

        backend.set.assert_called_once()
        key = backend.set.call_args.args[0]
        if reread == "available":
            backend.delete.assert_called_once_with(key)
            assert (key in stored) is delete_fails
            assert (
                "Failed to delete unpublished results" in caplog.text
            ) is delete_fails
        else:
            backend.delete.assert_not_called()
            assert key in stored
            assert "Kept results that may be referenced" in caplog.text
    engine.dispose()


@pytest.mark.parametrize("applied", ["failed_row", "published_row"])
def test_commit_that_applies_and_raises_keeps_referenced_results(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    applied: str,
) -> None:
    """
    Test that a metadata commit that reaches the database and then raises (its
    acknowledgement is lost) does not delete the results the committed row
    references: the failed row of the error handler, or the published row
    when the metadata database then stays unavailable.
    """
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'applied-commit.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = lambda key: stored.pop(key, None) is not None
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", None, 1.0, 0)],
    )
    stats_logger = MagicMock()
    if applied == "failed_row":

        def timing(key: str, value: float) -> None:
            """Fail emitting the write timing, once the results are stored."""
            if key == "sqllab.query.results_backend_write":
                raise RuntimeError("Metrics unavailable")

        stats_logger.timing.side_effect = timing
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": stats_logger})

    target = QueryStatusEnum.FAILED if applied == "failed_row" else "success"
    flushed = False
    applied_commit = False

    @event.listens_for(engine, "before_cursor_execute")
    def metadata_unavailable(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Keep the metadata database down once the published row commits."""
        if applied == "published_row" and applied_commit:
            raise RuntimeError("Metadata database unavailable")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="applied-commit",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        @event.listens_for(session, "after_flush")
        def flushed_target(flushing_session: Any, context: Any) -> None:
            nonlocal flushed
            flushed = query.status == target and query.results_key is not None

        do_commit = engine.dialect.do_commit

        def lose_acknowledgement(dbapi_connection: Any) -> None:
            """Raise after the database committed the row with the key."""
            nonlocal applied_commit
            do_commit(dbapi_connection)
            if flushed and not applied_commit:
                applied_commit = True
                raise RuntimeError("Commit acknowledgement lost")

        mocker.patch.object(
            engine.dialect, "do_commit", side_effect=lose_acknowledgement
        )

        with pytest.raises(RuntimeError):
            celery_task.execute_sql_task(123, query.sql)

        assert applied_commit
        event.remove(engine, "before_cursor_execute", metadata_unavailable)
        key = backend.set.call_args.args[0]
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == target
            assert persisted.results_key == key
        backend.delete.assert_not_called()
        assert key in stored
    engine.dispose()


@pytest.mark.parametrize("stop_at", ["before_stop_check", "before_failed_commit"])
def test_stop_after_an_applied_publish_keeps_referenced_results(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    stop_at: str,
) -> None:
    """
    Test that when the publish commit reaches the database and then raises, and
    a stop lands while the error is handled, the stop wins without deleting the
    results the committed row references, whichever stop check sees it.
    """
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'applied-publish.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = lambda key: stored.pop(key, None) is not None
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", None, 1.0, 0)],
    )
    mocker.patch.dict(current_app.config, {"STATS_LOGGER": MagicMock()})

    def stop() -> None:
        """Commit a stop from another session, as the stop request does."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatusEnum.STOPPED
            stop_session.commit()

    def extract_errors(*args: Any, **kwargs: Any) -> list[Any]:
        """Stop after the handler's first check, before its guarded commit."""
        stop()
        return []

    if stop_at == "before_failed_commit":
        mock_database.db_engine_spec.extract_errors.side_effect = extract_errors

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="applied-publish",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        published = False

        @event.listens_for(session, "after_flush")
        def published_flush(flushing_session: Any, context: Any) -> None:
            nonlocal published
            published = query.results_key is not None

        do_commit = engine.dialect.do_commit
        applied_commit = False

        def lose_acknowledgement(dbapi_connection: Any) -> None:
            """Raise after the database committed the published row."""
            nonlocal applied_commit
            do_commit(dbapi_connection)
            if published and not applied_commit:
                applied_commit = True
                if stop_at == "before_stop_check":
                    stop()
                raise RuntimeError("Commit acknowledgement lost")

        mocker.patch.object(
            engine.dialect, "do_commit", side_effect=lose_acknowledgement
        )

        payload = celery_task.execute_sql_task(123, query.sql)

        assert applied_commit
        assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
        key = backend.set.call_args.args[0]
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatusEnum.STOPPED
            assert persisted.results_key == key
        backend.delete.assert_not_called()
        assert key in stored
    engine.dispose()


@pytest.mark.parametrize("stopped", [False, True])
def test_finalization_stop_check_preserves_pending_metadata(
    mocker: MockerFixture, app_context: None, stopped: bool
) -> None:
    """A status-only refresh keeps success fields but discards them on a stop."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine("sqlite://")
    Query.__table__.create(engine)
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="stop-test",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        session.refresh(query)
        mocker.patch.object(celery_task.db, "session", session)
        if stopped:
            with engine.begin() as conn:
                conn.execute(
                    Query.__table__.update()
                    .where(Query.id == 123)
                    .values(status=QueryStatusEnum.STOPPED, end_time=1234.5)
                )
        query.rows = 42
        query.progress = 100
        query.end_time = 5678.9
        query.set_extra_json_key("columns", [{"name": "id"}])

        assert (
            celery_task._make_check_stopped_fn(query, preserve_pending=True)()
            == stopped
        )
        if stopped:
            payload = celery_task._stopped_query_payload(query)
            assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
            assert query.end_time == 1234.5
            assert query.rows != 42
            assert "columns" not in query.extra
        else:
            query.status = QueryStatusEnum.SUCCESS
            assert celery_task._commit_query_unless_stopped(query)
            session.refresh(query)
            assert query.status == QueryStatusEnum.SUCCESS
            assert query.rows == 42
            assert query.progress == 100
            assert query.end_time == Decimal("5678.9")
            assert query.extra["columns"] == [{"name": "id"}]
    engine.dispose()


@pytest.mark.parametrize(
    "checkpoint", ["serialization", "backend_error", "timeout", "timeout_oauth2_lookup"]
)
@pytest.mark.parametrize("stop_requested", [False, True])
def test_task_error_lookup_does_not_flush_over_a_stop(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    checkpoint: str,
    stop_requested: bool,
) -> None:
    """
    The task's error lookup must not flush stale metadata before checking Stop,
    including when a time-limit signal fires after the Stop.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.constants import QUERY_DISPATCHED_KEY, QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'task-stop.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False

    def interrupt_processing() -> None:
        """Optionally commit Stop independently before result processing fails."""
        if stop_requested:
            with Session(engine) as stop_session:
                stopped_query = stop_session.get(Query, 123)
                assert stopped_query is not None
                stopped_query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
                stopped_query.status = QueryStatusEnum.STOPPED
                stopped_query.end_time = 1234.5
                stop_session.commit()
        if checkpoint.startswith("timeout"):
            raise SoftTimeLimitExceeded()
        raise RuntimeError("Result processing failed")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="task-stop",
            database_id=1,
            sql="SELECT 1",
            status=QueryStatusEnum.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)
        execute = mocker.patch.object(
            celery_task,
            "execute_sql_with_cursor",
            return_value=[("SELECT 1", None, 1.0, 0)],
        )
        mocker.patch.object(celery_task, "results_backend", None)
        if checkpoint.startswith("timeout"):
            execute.side_effect = lambda **kwargs: interrupt_processing()
            if checkpoint == "timeout_oauth2_lookup":

                def load_oauth2_settings() -> bool:
                    """Model the ORM load while deciding whether to retry an error."""
                    session.query(Query).count()
                    return False

                mock_database.is_oauth2_enabled.side_effect = load_oauth2_settings
        elif checkpoint == "serialization":
            result_set = MagicMock(size=1, truncated=False)
            execute.return_value = [("SELECT 1", result_set, 1.0, 1)]
            mocker.patch.object(
                celery_task,
                "_serialize_result_set",
                side_effect=lambda _: interrupt_processing(),
            )
        else:
            backend = MagicMock()
            backend.set.side_effect = lambda *args: interrupt_processing()
            mocker.patch.object(celery_task, "results_backend", backend)
            mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")

        # Keep the real _get_query: a mocked lookup cannot expose autoflush.
        payload = celery_task.execute_sql_task(123, query.sql)

        assert payload is not None
        timed_out = checkpoint.startswith("timeout")
        if stop_requested:
            assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
        else:
            expected_status = (
                QueryStatusEnum.TIMED_OUT if timed_out else QueryStatusEnum.FAILED
            )
            assert payload["status"] == expected_status
        session.refresh(query)
        if stop_requested:
            assert query.status == QueryStatusEnum.STOPPED
            assert query.end_time == Decimal("1234.5")
            assert query.extra == {
                QUERY_EARLY_CANCEL_KEY: True,
                QUERY_DISPATCHED_KEY: True,
            }
            assert query.error_message is None
        else:
            assert query.status == expected_status
            assert query.end_time is not None
            assert query.error_message is not None
        assert query.results_key is None
    engine.dispose()


def test_timeout_is_guarded_against_a_stop(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_db_session: MagicMock,
) -> None:
    """A timeout checks and guards against a previously accepted Stop."""
    from superset.sql.execution import celery_task

    mock_query.status = QueryStatusEnum.TIMED_OUT
    mock_query.tmp_table_name = "pending_table"

    payload = celery_task._handle_query_error(RuntimeError("Timed out"), mock_query)

    assert payload["status"] == QueryStatusEnum.TIMED_OUT
    assert mock_query.status == QueryStatusEnum.TIMED_OUT
    mock_db_session.refresh.assert_called_once()
    mock_db_session.query.assert_called_once()
    mock_db_session.flush.assert_not_called()
    mock_db_session.commit.assert_called_once()


@pytest.mark.parametrize("mutation", [False, True], ids=["select", "mutation"])
@pytest.mark.parametrize(
    "checkpoint",
    ["success", "backend_failure", "error", "payload_load", "error_load"],
)
def test_stop_cannot_be_overwritten_by_terminal_metadata(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    checkpoint: str,
    mutation: bool,
) -> None:
    """A separately committed stop must win even after the worker's last read."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'stop.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    original_make_check = celery_task._make_check_stopped_fn
    stop_delivered = False

    def deliver_stop() -> None:
        """Commit the stop in an independent transaction."""
        nonlocal stop_delivered
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
            stopped_query.status = QueryStatusEnum.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()
        stop_delivered = True

    def make_check(query: Query, preserve_pending: bool = False) -> Callable[[], bool]:
        """Deliver Stop after a successful read, before any terminal writes."""
        check = original_make_check(query, preserve_pending)

        def check_then_stop() -> bool:
            """Expose the check/write race without mocking ORM operations."""
            stopped = check()
            if (
                preserve_pending
                and not stop_delivered
                and checkpoint not in {"payload_load", "error_load"}
            ):
                deliver_stop()
            return stopped

        return check_then_stop

    mocker.patch.object(celery_task, "_make_check_stopped_fn", side_effect=make_check)
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="stop-race",
            database_id=1,
            sql="INSERT INTO users VALUES (1)" if mutation else "SELECT 1",
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        session.refresh(query)
        mocker.patch.object(celery_task.db, "session", session)
        mocker.patch.object(celery_task, "_get_query", return_value=query)
        mocker.patch.object(
            celery_task,
            "execute_sql_with_cursor",
            return_value=[("SELECT 1", None, 1.0, 0)],
        )
        mocker.patch.object(celery_task, "results_backend", None)
        if checkpoint == "backend_failure":
            backend = MagicMock()
            backend.set.return_value = False
            mocker.patch.object(celery_task, "results_backend", backend)
            mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")

        def load_relationship() -> Any:
            """Model the autoflush caused by a lazy relationship lookup."""
            deliver_stop()
            session.query(Query).count()
            return {"id": 123} if checkpoint == "payload_load" else []

        if checkpoint == "payload_load":
            mocker.patch.object(Query, "to_dict", side_effect=load_relationship)
        elif checkpoint == "error_load":
            mock_database.db_engine_spec.extract_errors.side_effect = (
                lambda *args, **kwargs: load_relationship()
            )

        payload: dict[str, Any] | None
        if checkpoint in {"error", "error_load"}:
            payload = celery_task._handle_query_error(
                RuntimeError("Driver error"), query
            )
        else:
            payload = celery_task._execute_sql_statements(123, query.sql, None)

        assert stop_delivered
        assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
        session.refresh(query)
        assert query.status == QueryStatusEnum.STOPPED
        assert query.end_time == Decimal("1234.5")
        assert query.extra[QUERY_EARLY_CANCEL_KEY] is True
        assert query.error_message is None
        assert query.results_key is None
    engine.dispose()


@pytest.mark.parametrize("backend_write", [None, True, False])
def test_stop_during_mutation_commit_discards_results(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    backend_write: bool | None,
) -> None:
    """An accepted stop keeps STOPPED even if the mutation committed."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    from .conftest import setup_mock_raw_connection

    engine = create_engine(f"sqlite:///{tmp_path / 'commit.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    def deliver_stop() -> None:
        """Commit the stop after the pre-commit check, mid target commit."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatusEnum.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()

    conn = setup_mock_raw_connection(mock_database)
    conn.commit.side_effect = deliver_stop
    sql = "INSERT INTO users VALUES (1)"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="commit-race",
            database_id=1,
            sql=sql,
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        session.refresh(query)
        mocker.patch.object(celery_task.db, "session", session)
        mocker.patch.object(celery_task, "_get_query", return_value=query)
        mocker.patch.object(
            celery_task, "execute_sql_with_cursor", return_value=[(sql, None, 1.0, 1)]
        )
        backend = None
        if backend_write is not None:
            backend = MagicMock()
            backend.set.return_value = backend_write
            mocker.patch.object(celery_task, "_serialize_payload", return_value=b"x")
        mocker.patch.object(celery_task, "results_backend", backend)

        payload = celery_task._execute_sql_statements(123, sql, None)
        assert payload is not None
        assert payload["status"] == QueryStatusEnum.STOPPED
        conn.commit.assert_called_once_with()
        session.refresh(query)
        assert query.status == QueryStatusEnum.STOPPED
        assert query.results_key is None
        if backend:
            backend.set.assert_not_called()
    engine.dispose()


@pytest.mark.parametrize("ctas", [False, True], ids=["mutation", "ctas"])
@pytest.mark.parametrize("stop_intent", ["status", "early"])
@pytest.mark.parametrize("seen", [False, True], ids=["after_finish", "while_running"])
@pytest.mark.parametrize("autocommit", [True, False], ids=["autocommit", "transaction"])
def test_autocommit_work_finished_before_a_stop_is_committed(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    autocommit: bool,
    seen: bool,
    stop_intent: str,
    ctas: bool,
) -> None:
    """An accepted stop discards autocommit results even if not locally seen."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    from .conftest import setup_mock_raw_connection

    engine = create_engine(f"sqlite:///{tmp_path / 'autocommit.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    conn = setup_mock_raw_connection(mock_database)
    conn.dbapi_connection.autocommit = autocommit
    sql = "SELECT 1" if ctas else "INSERT INTO users VALUES (1)"

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="autocommit",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            status=QueryStatusEnum.PENDING,
        )
        session.add(query)
        session.commit()

        def execute_then_stop(**kwargs: Any) -> list[tuple[str, None, float, int]]:
            """Finish the last statement, with a stop committed elsewhere."""
            with Session(engine) as stop_session:
                stopped_query = stop_session.get(Query, 123)
                assert stopped_query is not None
                if stop_intent == "early":
                    stopped_query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
                else:
                    stopped_query.status = QueryStatusEnum.STOPPED
                    stopped_query.end_time = 1234.5
                stop_session.commit()
            if seen:
                # An engine polling the running statement loads the stop.
                session.refresh(query)
            return [(sql, None, 1.0, 1)]

        mocker.patch.object(celery_task.db, "session", session)
        mocker.patch.object(celery_task, "_get_query", return_value=query)
        mocker.patch.object(
            celery_task, "execute_sql_with_cursor", side_effect=execute_then_stop
        )
        mocker.patch.object(celery_task, "results_backend", None)

        payload = celery_task._execute_sql_statements(123, sql, None)

        expected = QueryStatusEnum.STOPPED
        assert payload is not None
        assert payload["status"] == expected
        session.refresh(query)
        assert query.status == expected
        assert not conn.commit.called
    engine.dispose()


@pytest.mark.parametrize("ctas", [True, False], ids=["ctas", "insert"])
def test_sqlite_ctas_finished_before_a_stop_is_committed(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    ctas: bool,
) -> None:
    """A durable SQLite CTAS remains stopped without undoing its table."""
    from contextlib import contextmanager

    from sqlalchemy import create_engine, inspect
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'metadata.db'}")
    Query.__table__.create(engine)
    target = create_engine(f"sqlite:///{tmp_path / 'target.db'}")
    with target.begin() as setup:
        setup.exec_driver_sql("CREATE TABLE existing (a INTEGER)")
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Any:
        connection = target.raw_connection()
        try:
            yield connection
        finally:
            connection.close()

    mock_database.get_raw_connection = raw_connection
    sql = "SELECT 1 AS a" if ctas else "INSERT INTO existing VALUES (1)"
    executed = "CREATE TABLE tmp_table AS SELECT 1 AS a" if ctas else sql

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="sqlite-ctas",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            status=QueryStatusEnum.PENDING,
        )
        session.add(query)
        session.commit()

        def execute_then_stop(
            *, cursor: Any, **kwargs: Any
        ) -> list[tuple[str, None, float, int]]:
            """Run the statement on SQLite, then commit a stop elsewhere."""
            cursor.execute(executed)
            with Session(engine) as stop_session:
                stopped_query = stop_session.get(Query, 123)
                assert stopped_query is not None
                stopped_query.status = QueryStatusEnum.STOPPED
                stop_session.commit()
            return [(executed, None, 1.0, 1)]

        mocker.patch.object(celery_task.db, "session", session)
        mocker.patch.object(celery_task, "_get_query", return_value=query)
        mocker.patch.object(
            celery_task, "execute_sql_with_cursor", side_effect=execute_then_stop
        )
        mocker.patch.object(celery_task, "results_backend", None)

        payload = celery_task._execute_sql_statements(123, sql, None)

        expected = QueryStatusEnum.STOPPED
        assert payload is not None
        assert payload["status"] == expected
        session.refresh(query)
        assert query.status == expected
    with target.connect() as observer:
        assert inspect(observer).has_table("tmp_table") is ctas
        rows = observer.exec_driver_sql("SELECT COUNT(*) FROM existing").scalar()
        assert rows == 0
    target.dispose()
    engine.dispose()


@pytest.mark.parametrize("ctas", [False, True], ids=["mutation", "ctas"])
@pytest.mark.parametrize(
    "failure",
    [
        "backend_set_raises",
        "serialize_raises",
        "payload_too_large",
        "backend_write_false",
        "connection_close_raises",
    ],
)
def test_failure_after_stop_raced_commit_preserves_stopped(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    ctas: bool,
    failure: str,
) -> None:
    """Even a connection-close failure cannot overwrite an accepted stop."""
    from contextlib import contextmanager

    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    from .conftest import create_mock_connection

    engine = create_engine(f"sqlite:///{tmp_path / 'commit.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mock_database.is_oauth2_enabled.return_value = False

    def deliver_stop() -> None:
        """Commit the stop after the pre-commit check, mid target commit."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatusEnum.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()

    conn = create_mock_connection()
    conn.commit.side_effect = deliver_stop

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Any:
        yield conn
        if failure == "connection_close_raises":
            raise RuntimeError("Connection close failed")

    mock_database.get_raw_connection = raw_connection

    sql = "SELECT 1" if ctas else "INSERT INTO users VALUES (1)"
    backend = MagicMock()
    backend.set.return_value = failure != "backend_write_false"
    if failure == "backend_set_raises":
        backend.set.side_effect = RuntimeError("Backend unavailable")
    serialize = mocker.patch.object(celery_task, "_serialize_payload")
    serialize.return_value = b"x" * (2 * 1024 * 1024)
    if failure == "serialize_raises":
        serialize.side_effect = RuntimeError("Cannot serialize")
    mocker.patch.object(celery_task, "results_backend", backend)
    mocker.patch.object(celery_task, "security_manager")
    mocker.patch.dict(
        current_app.config,
        {
            "STATS_LOGGER": MagicMock(),
            "SQLLAB_PAYLOAD_MAX_MB": 1 if failure == "payload_too_large" else None,
        },
    )

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="commit-race-failure",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            status=QueryStatusEnum.RUNNING,
        )
        session.add(query)
        session.commit()
        session.refresh(query)
        mocker.patch.object(celery_task.db, "session", session)
        mocker.patch.object(celery_task, "_get_query", return_value=query)
        mocker.patch.object(
            celery_task, "execute_sql_with_cursor", return_value=[(sql, None, 1.0, 1)]
        )

        payload = celery_task.execute_sql_task(123, sql)

        conn.commit.assert_called_once_with()
        assert payload is not None
        assert payload["status"] == QueryStatusEnum.STOPPED
        session.refresh(query)
        assert query.status == QueryStatusEnum.STOPPED
        assert query.error_message is None
        assert query.results_key is None
    engine.dispose()


@pytest.mark.parametrize(
    "status",
    [QueryStatusEnum.RUNNING, QueryStatusEnum.FAILED],
    ids=["success", "failed"],
)
def test_publish_query_result_preserves_failure(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    status: QueryStatusEnum,
) -> None:
    """
    Publishing keeps a committed backend failure for reads and committed
    mutations, and otherwise publishes SUCCESS.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'publish.db'}")
    Query.__table__.create(engine)
    with Session(engine) as session:
        query = Query(
            id=123, client_id="publish", database_id=1, sql="SELECT 1", status=status
        )
        session.add(query)
        # _store_results_in_backend commits FAILED before publishing can run.
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)
        query.rows = 1
        payload = {"status": QueryStatusEnum.SUCCESS.value, "query_id": 123}

        assert celery_task._publish_query_result(query, payload) is payload

        session.expire_all()
        assert query.status == (
            QueryStatusEnum.FAILED
            if status == QueryStatusEnum.FAILED
            else QueryStatusEnum.SUCCESS
        )
        assert query.rows == 1


def test_successful_select_reads_stop_state_once_per_checkpoint(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
) -> None:
    """
    A successful SELECT reads stop state before results are serialized, after
    the results backend write and in the guarded publish, not again in between.
    """
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'task-reads.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False
    result_set = MagicMock(size=1, truncated=False, columns=[])
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", result_set, 1.0, 1)],
    )
    mocker.patch.object(celery_task, "_serialize_result_set", return_value=([], []))
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    backend = MagicMock()
    backend.set.return_value = True
    mocker.patch.object(celery_task, "results_backend", backend)

    with Session(engine) as session:
        session.add(
            Query(
                id=123,
                client_id="task-reads",
                database_id=1,
                sql="SELECT 1",
                status=QueryStatusEnum.PENDING,
            )
        )
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)
        statements: list[str] = []
        event.listen(
            engine,
            "before_cursor_execute",
            lambda conn, cursor, statement, *args: statements.append(statement),
        )

        payload = celery_task.execute_sql_task(123, "SELECT 1")

        assert payload is not None
        assert payload["status"] == QueryStatusEnum.SUCCESS
        full_refreshes = [
            sql
            for sql in statements
            if sql.startswith('SELECT "query".id, "query".client_id')
        ]
        status_reads = [
            sql for sql in statements if sql.startswith('SELECT "query".status')
        ]
        # One refresh before the pre-commit decision; status-only reads after
        # the backend write and before the guarded publish.
        assert len(full_refreshes) == 1
        assert len(status_reads) == 2


@pytest.mark.parametrize("extra_json", [None, b"{}", MagicMock(), "", "{}"])
@pytest.mark.parametrize("mapped", [False, True])
def test_stop_seen_during_execution_ignores_non_text_extra_json(
    extra_json: Any,
    mapped: bool,
) -> None:
    """Only loaded text JSON is decoded, including when the query is a double."""
    from superset.models.sql_lab import Query
    from superset.sql.execution.celery_task import stop_seen_during_execution

    query_type = Query if mapped else MagicMock
    query = query_type(status=QueryStatusEnum.RUNNING, extra_json=extra_json)
    assert not stop_seen_during_execution(query)


@pytest.mark.parametrize("intent", ["status", "early", "none"])
@pytest.mark.parametrize("expired", [False, True])
def test_stop_seen_during_execution_reads_only_loaded_attributes(
    intent: str, expired: bool, mocker: MockerFixture
) -> None:
    """Expired stop attributes stay unseen without triggering a database read."""
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import Session

    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.sql.execution.celery_task import stop_seen_during_execution

    engine = create_engine("sqlite://")
    Query.__table__.create(engine)
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="loaded-stop",
            database_id=1,
            sql="SELECT 1",
            status=(
                QueryStatusEnum.STOPPED
                if intent == "status"
                else QueryStatusEnum.RUNNING
            ),
            extra_json=superset_json.dumps({QUERY_EARLY_CANCEL_KEY: intent == "early"}),
        )
        session.add(query)
        session.flush()
        if expired:
            session.expire(query, ["status", "extra_json"])
        execute = mocker.Mock()
        event.listen(engine, "before_cursor_execute", execute)
        assert stop_seen_during_execution(query) is (not expired and intent != "none")
        execute.assert_not_called()
    engine.dispose()


def test_replayed_task_stop_keeps_results_the_committed_row_references(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
) -> None:
    """A redelivered task that a stop wins keeps the earlier attempt's results."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'replay.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task, "_serialize_payload", return_value=b"data")
    mocker.patch.object(celery_task.security_manager, "find_user", return_value=None)
    mock_database.is_oauth2_enabled.return_value = False
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT 1", None, 1.0, 0)],
    )
    stored = {"prior-attempt-key": b"old data"}

    def store_then_stop(key: str, value: bytes, timeout: int) -> bool:
        stored[key] = value
        with Session(engine) as stopper:
            stopped = stopper.get(Query, 123)
            stopped.status = QueryStatusEnum.STOPPED
            stopper.commit()
        return True

    backend = MagicMock()
    backend.set.side_effect = store_then_stop
    backend.delete.side_effect = lambda key: stored.pop(key, None) is not None
    mocker.patch.object(celery_task, "results_backend", backend)
    with Session(engine) as session:
        session.add(
            Query(
                id=123,
                client_id="replayed",
                database_id=1,
                sql="SELECT 1",
                status=QueryStatusEnum.SUCCESS,
                results_key="prior-attempt-key",
            )
        )
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        payload = celery_task.execute_sql_task(123, "SELECT 1")
        assert payload is not None

        assert payload["status"] == QueryStatusEnum.STOPPED
        with Session(engine) as observer:
            row = observer.get(Query, 123)
            assert row.status == QueryStatusEnum.STOPPED
            assert row.results_key == "prior-attempt-key"
        # Only this attempt's unpublished blob is deleted.
        assert list(stored) == ["prior-attempt-key"]
        assert backend.delete.call_count == 1
    engine.dispose()


@pytest.mark.parametrize("autocommit", [False, True], ids=["transaction", "autocommit"])
@pytest.mark.parametrize("intent", ["status", "early"])
def test_stop_seen_by_engine_survives_progress_commit(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    autocommit: bool,
    intent: str,
) -> None:
    """
    An engine that cancels a running mutation on a stop ends STOPPED, even
    though the shared executor's progress commit expires the loaded stop.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    from .conftest import setup_mock_raw_connection

    engine = create_engine(f"sqlite:///{tmp_path / 'cancel-progress.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task, "results_backend", None)
    conn = setup_mock_raw_connection(mock_database)
    cursor = conn.cursor.return_value
    cursor.description = None
    cursor.rowcount = 0
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="cancel-progress",
            database_id=1,
            sql="INSERT INTO users VALUES (1)",
            status=QueryStatusEnum.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        def poll_and_cancel(cursor: Any, sql: str, observed: Query) -> None:
            with Session(engine) as stopper:
                stopped = stopper.get(Query, 123)
                if intent == "status":
                    stopped.status = QueryStatusEnum.STOPPED
                else:
                    stopped.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
                stopper.commit()
            # A polling engine loads the stop, cancels the operation and
            # returns with no cursor description.
            session.refresh(observed)
            cursor.cancel()

        mock_database.db_engine_spec.execute_with_cursor.side_effect = poll_and_cancel

        payload = celery_task._execute_sql_statements(123, query.sql, None)
        assert payload is not None

        cursor.cancel.assert_called_once()
        assert payload["status"] == QueryStatusEnum.STOPPED
        with Session(engine) as observer:
            assert observer.get(Query, 123).status == QueryStatusEnum.STOPPED
        conn.commit.assert_not_called()
    engine.dispose()


@pytest.mark.parametrize("intent", ["status", "early"])
def test_impala_cancel_survives_progress_commit(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
    intent: str,
) -> None:
    """Impala's own polling cancel of an autocommit INSERT ends STOPPED."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.db_engine_specs.impala import ImpalaEngineSpec
    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    from .conftest import setup_mock_raw_connection

    engine = create_engine(f"sqlite:///{tmp_path / 'impala-cancel.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task, "results_backend", None)
    mock_database.db_engine_spec = ImpalaEngineSpec
    conn = setup_mock_raw_connection(mock_database)
    # Only the RPC cursor is a double: execute_with_cursor, handle_cursor and
    # cancellation are Impala's own.
    cursor = conn.cursor.return_value
    cursor.description = None
    cursor.rowcount = 0
    cursor.status.return_value = "RUNNING_STATE"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="impala-cancel",
            database_id=1,
            sql="INSERT INTO users VALUES (1)",
            status=QueryStatusEnum.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        def start_then_stop(sql: str) -> None:
            with Session(engine) as stopper:
                stopped = stopper.get(Query, 123)
                if intent == "status":
                    stopped.status = QueryStatusEnum.STOPPED
                else:
                    stopped.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
                stopper.commit()

        cursor.execute_async.side_effect = start_then_stop

        payload = celery_task._execute_sql_statements(123, query.sql, None)
        assert payload is not None

        cursor.cancel_operation.assert_called_once()
        cursor.close_operation.assert_called_once()
        assert payload["status"] == QueryStatusEnum.STOPPED
        with Session(engine) as observer:
            assert observer.get(Query, 123).status == QueryStatusEnum.STOPPED
        conn.commit.assert_not_called()
    engine.dispose()


def test_stop_seen_between_autocommit_statements_ends_stopped(
    mocker: MockerFixture,
    app_context: None,
    mock_database: MagicMock,
    tmp_path: Path,
) -> None:
    """A stop the check before the next statement loads ends the script STOPPED."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    from .conftest import setup_mock_raw_connection

    engine = create_engine(f"sqlite:///{tmp_path / 'between-statements.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(celery_task, "results_backend", None)
    mock_database.db_engine_spec.run_multiple_statements_as_one = False
    conn = setup_mock_raw_connection(mock_database)
    cursor = conn.cursor.return_value
    cursor.description = None
    cursor.rowcount = 1
    sql = "INSERT INTO users VALUES (1);\nINSERT INTO users VALUES (2)"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="between-statements",
            database_id=1,
            sql=sql,
            status=QueryStatusEnum.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(celery_task.db, "session", session)

        def finish_then_stop(cursor: Any, sql: str, observed: Query) -> None:
            # The first statement finishes; a stop lands before the next one.
            with Session(engine) as stopper:
                stopper.get(Query, 123).status = QueryStatusEnum.STOPPED
                stopper.commit()

        execute = mock_database.db_engine_spec.execute_with_cursor
        execute.side_effect = finish_then_stop

        payload = celery_task._execute_sql_statements(123, sql, None)
        assert payload is not None

        execute.assert_called_once()
        assert payload["status"] == QueryStatusEnum.STOPPED
        with Session(engine) as observer:
            assert observer.get(Query, 123).status == QueryStatusEnum.STOPPED
        conn.commit.assert_not_called()
    engine.dispose()


@pytest.mark.parametrize("stop_before_read", [False, True])
def test_celery_startup_preserves_stop_before_running_write(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    mock_database: MagicMock,
    stop_before_read: bool,
) -> None:
    """Celery startup must not replace a committed Stop with RUNNING."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from superset.models.sql_lab import Query
    from superset.sql.execution import celery_task

    engine = create_engine(f"sqlite:///{tmp_path / 'celery-startup.db'}")
    Query.__table__.create(engine)
    mocker.patch.object(Query, "database", PropertyMock(return_value=mock_database))

    def stop() -> None:
        """Commit after retrieval but before the startup status write."""
        with Session(engine) as stop_session:
            stopped = stop_session.get(Query, 123)
            assert stopped is not None
            stopped.status = QueryStatusEnum.STOPPED
            stopped.end_time = 1234.5
            stop_session.commit()

    if not stop_before_read:
        mock_database.db_engine_spec.patch.side_effect = stop
    parse = mocker.patch.object(
        celery_task,
        "SQLScript",
        side_effect=AssertionError("Stopped query reached parsing"),
    )
    with Session(engine) as worker_session:
        worker_session.add(
            Query(
                id=123,
                client_id="startup",
                database_id=1,
                status=QueryStatusEnum.PENDING,
            )
        )
        worker_session.commit()
        if stop_before_read:
            stop()
        mocker.patch.object(celery_task.db, "session", worker_session)
        payload = celery_task._execute_sql_statements(123, "SELECT 1", None)
        assert payload == {"query_id": 123, "status": QueryStatusEnum.STOPPED}
        parse.assert_not_called()
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatusEnum.STOPPED
            assert persisted.end_time == 1234.5
    engine.dispose()


@pytest.mark.parametrize("cancel_id", [None, "cancel-123"])
def test_celery_records_dispatch_before_execution_without_cancel_handle(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    cancel_id: str | None,
) -> None:
    """A dispatched connector without a cancel ID must not claim early cancel."""
    from superset.constants import QUERY_DISPATCHED_KEY
    from superset.sql.execution import celery_task

    from .conftest import setup_mock_raw_connection

    mock_query.database = mock_database
    mock_database.db_engine_spec.get_cancel_query_id.return_value = cancel_id
    setup_mock_raw_connection(mock_database)
    mocker.patch.object(celery_task, "_get_query", return_value=mock_query)

    def execute(**kwargs: Any) -> list[Any]:
        """Check dispatch metadata at the executor boundary."""
        mock_query.set_extra_json_key.assert_any_call(QUERY_DISPATCHED_KEY, True)
        return []

    mocker.patch.object(celery_task, "execute_sql_with_cursor", side_effect=execute)
    celery_task._execute_sql_statements(123, "SELECT 1", None)
