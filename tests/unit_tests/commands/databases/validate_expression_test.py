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

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.commands.database.validate_expression import (
    ExpressionType,
    ValidateExpressionCommand,
)


def test_validate_expression_column_type_success(mocker: MockerFixture) -> None:
    """Test successfully validating a column expression."""
    # Setup mock database with engine spec
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": True,
        "errors": [],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command
    data = {
        "expression": "user_id * 2",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
        "schema": "public",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Assertions
    expected_result: list[dict[str, Any]] = []  # No errors means success
    assert result == expected_result
    # Verify the engine spec method was called with correct parameters
    mock_engine_spec.validate_sql_expression.assert_called_once()
    call_args = mock_engine_spec.validate_sql_expression.call_args
    assert call_args[1]["expression"] == "user_id * 2"
    assert call_args[1]["expression_type"] == "column"
    assert call_args[1]["database"] == mock_db


def test_validate_expression_metric_type_success(mocker: MockerFixture) -> None:
    """Test successfully validating a metric expression (aggregation)."""
    # Setup mock database with engine spec
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": True,
        "errors": [],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command
    data = {
        "expression": "SUM(amount)",
        "expression_type": ExpressionType.METRIC,
        "table_name": "orders",
        "schema": "public",
        "catalog": "main",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Assertions
    assert result == []
    # Verify the engine spec method was called with correct parameters
    mock_engine_spec.validate_sql_expression.assert_called_once()
    call_args = mock_engine_spec.validate_sql_expression.call_args
    assert call_args[1]["expression"] == "SUM(amount)"
    assert call_args[1]["expression_type"] == "metric"
    assert call_args[1]["database"] == mock_db


def test_validate_expression_filter_where_clause(mocker: MockerFixture) -> None:
    """Test validating a filter expression with WHERE clause."""
    # Setup mock database with engine spec
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": True,
        "errors": [],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command
    data = {
        "expression": "status = 'active' AND created_at > '2024-01-01'",
        "expression_type": ExpressionType.FILTER,
        "clause": "WHERE",
        "table_name": "users",
        "schema": "public",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Assertions
    assert result == []
    # Verify the engine spec method was called with correct parameters
    mock_engine_spec.validate_sql_expression.assert_called_once()
    call_args = mock_engine_spec.validate_sql_expression.call_args
    assert (
        call_args[1]["expression"] == "status = 'active' AND created_at > '2024-01-01'"
    )
    assert call_args[1]["expression_type"] == "where"  # Should be converted from FILTER
    assert call_args[1]["database"] == mock_db


def test_validate_expression_filter_having_clause(mocker: MockerFixture) -> None:
    """Test validating a filter expression with HAVING clause."""
    # Setup mock database with engine spec
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": True,
        "errors": [],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command
    data = {
        "expression": "COUNT(*) > 5",
        "expression_type": ExpressionType.FILTER,
        "clause": "HAVING",
        "table_name": "orders",
        "schema": "public",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Assertions
    assert result == []
    # Verify the engine spec method was called with correct parameters
    mock_engine_spec.validate_sql_expression.assert_called_once()
    call_args = mock_engine_spec.validate_sql_expression.call_args
    assert call_args[1]["expression"] == "COUNT(*) > 5"
    assert (
        call_args[1]["expression_type"] == "having"
    )  # Should be converted from FILTER
    assert call_args[1]["database"] == mock_db


def test_validate_expression_empty_expression(mocker: MockerFixture) -> None:
    """Test that empty expressions return an error."""
    # Setup mock database with engine spec
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": False,
        "errors": [
            {
                "message": "Expression cannot be empty",
                "line_number": 1,
                "start_column": 0,
                "end_column": 0,
            }
        ],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command with empty expression
    data = {
        "expression": "",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Should return an error for empty expression
    assert len(result) == 1
    assert result[0]["message"] == "Expression cannot be empty"


def test_validate_expression_database_error(mocker: MockerFixture) -> None:
    """Test that database errors are properly handled and cleaned up."""
    # Setup mock database with engine spec that returns an error
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": False,
        "errors": [
            {
                "message": (
                    "Function 'invalidfunc' does not exist or has "
                    "incorrect arguments"
                ),
                "line_number": 1,
                "start_column": 0,
                "end_column": 20,
            }
        ],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command with invalid expression
    data = {
        "expression": "INVALIDFUNC(user_id)",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
        "schema": "public",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Should return the cleaned up error
    assert len(result) == 1
    # Check that the error message is properly formatted
    assert "invalidfunc" in result[0]["message"].lower()
    assert (
        "does not exist" in result[0]["message"].lower()
        or "incorrect" in result[0]["message"].lower()
    )


def test_validate_expression_column_error_cleanup(mocker: MockerFixture) -> None:
    """Test that column errors are properly cleaned up."""
    # Setup mock database with engine spec that returns a column error
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": False,
        "errors": [
            {
                "message": "Column 'nonexistent_col' does not exist in the table",
                "line_number": 1,
                "start_column": 0,
                "end_column": 15,
            }
        ],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command with invalid column
    data = {
        "expression": "nonexistent_col",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
        "schema": "public",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Should return the cleaned up column error
    assert len(result) == 1
    assert "nonexistent_col" in result[0]["message"]
    assert "does not exist" in result[0]["message"]


def test_validate_expression_database_not_found(mocker: MockerFixture) -> None:
    """Test that DatabaseNotFoundError is raised when database doesn't exist."""
    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = None

    data = {
        "expression": "user_id",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
    }
    command = ValidateExpressionCommand(999, data)

    with pytest.raises(DatabaseNotFoundError):
        command.run()


def test_validate_expression_without_table_context(mocker: MockerFixture) -> None:
    """Test validating an expression without table context."""
    # Setup mock database with engine spec
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": True,
        "errors": [],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command without table context
    data = {
        "expression": "1 + 1",
        "expression_type": ExpressionType.COLUMN,
        # No table_name, schema, or catalog provided
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Should still validate as a standalone expression
    assert result == []
    # Verify the engine spec method was called
    mock_engine_spec.validate_sql_expression.assert_called_once()
    call_args = mock_engine_spec.validate_sql_expression.call_args
    assert call_args[1]["expression"] == "1 + 1"
    assert call_args[1]["expression_type"] == "column"
    # Dataset should be None or minimal when no table context provided
    assert call_args[1]["dataset"] is None or hasattr(
        call_args[1]["dataset"], "table_name"
    )


def test_validate_expression_wrapper_query_cleanup(mocker: MockerFixture) -> None:
    """Test that wrapper query artifacts are cleaned from error messages."""
    # Setup mock database with engine spec that returns cleaned error
    mock_engine_spec = MagicMock()
    # The engine spec should clean up the error message
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": False,
        "errors": [
            {
                # Cleaned message
                "message": "syntax error at or near invalid_syntax_here",
                "line_number": 1,
                "start_column": 0,
                "end_column": 19,
            }
        ],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command
    data = {
        "expression": "invalid_syntax_here",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Should return cleaned error message
    assert len(result) == 1
    error_message = result[0]["message"]
    # Should not contain wrapper artifacts
    assert "WHERE 0=1" not in error_message
    assert "AS test_column" not in error_message
    assert "AS test_metric" not in error_message


def test_validate_expression_timeout_handling(mocker: MockerFixture) -> None:
    """Test that validation timeout is handled properly."""
    # Setup mock database with engine spec that simulates timeout
    mock_engine_spec = MagicMock()
    mock_engine_spec.validate_sql_expression.return_value = {
        "is_valid": False,
        "errors": [
            {
                "message": "The validation query exceeded the 5 seconds timeout.",
                "line_number": 1,
                "start_column": 0,
                "end_column": 15,
            }
        ],
    }

    mock_db = MagicMock()
    mock_db.db_engine_spec = mock_engine_spec
    mock_db.quote_identifier = lambda x: f'"{x}"'

    database_dao = mocker.patch(
        "superset.commands.database.validate_expression.DatabaseDAO"
    )
    database_dao.find_by_id.return_value = mock_db

    # Execute command
    data = {
        "expression": "SLOW_FUNCTION()",
        "expression_type": ExpressionType.COLUMN,
        "table_name": "users",
    }
    command = ValidateExpressionCommand(1, data)
    result = command.run()

    # Should return timeout error
    assert len(result) == 1
    assert "timeout" in result[0]["message"].lower()
