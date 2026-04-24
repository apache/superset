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
Unit tests for execute_sql MCP tool

These tests mock Database.execute() to test the MCP tool's parameter mapping
and response conversion logic.
"""

import logging
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pandas as pd
import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from superset_core.queries.types import QueryResult, QueryStatus, StatementResult

from superset.mcp_service.app import mcp
from superset.mcp_service.sql_lab.schemas import ColumnInfo

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _create_select_result(
    rows: list[dict[str, Any]],
    columns: list[str],
    original_sql: str = "SELECT * FROM users",
    executed_sql: str | None = None,
    execution_time_ms: float = 10.0,
) -> QueryResult:
    """Create a mock QueryResult for SELECT queries."""
    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=columns)
    return QueryResult(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql=original_sql,
                executed_sql=executed_sql or original_sql,
                data=df,
                row_count=len(df),
                execution_time_ms=execution_time_ms,
            )
        ],
        query_id=None,
        total_execution_time_ms=execution_time_ms,
        is_cached=False,
    )


def _create_dml_result(
    affected_rows: int,
    original_sql: str = "UPDATE users SET active = true",
    executed_sql: str | None = None,
    execution_time_ms: float = 5.0,
) -> QueryResult:
    """Create a mock QueryResult for DML queries."""
    return QueryResult(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql=original_sql,
                executed_sql=executed_sql or original_sql,
                data=None,
                row_count=affected_rows,
                execution_time_ms=execution_time_ms,
            )
        ],
        query_id=None,
        total_execution_time_ms=execution_time_ms,
        is_cached=False,
    )


def _create_error_result(
    error_message: str,
    status: QueryStatus = QueryStatus.FAILED,
) -> QueryResult:
    """Create a mock QueryResult for failed queries."""
    return QueryResult(
        status=status,
        statements=[],
        query_id=None,
        total_execution_time_ms=0,
        is_cached=False,
        error_message=error_message,
    )


def _mock_database(
    id: int = 1,
    database_name: str = "test_db",
    allow_dml: bool = False,
) -> Mock:
    """Create a mock database object."""
    database = Mock()
    database.id = id
    database.database_name = database_name
    database.allow_dml = allow_dml
    return database


class TestExecuteSql:
    """Tests for execute_sql MCP tool."""

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_basic_select(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test basic SELECT query execution."""
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_select_result(
            rows=[{"id": 1, "name": "test_name"}],
            columns=["id", "name"],
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT id, name FROM users LIMIT 10",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True
            assert data["error"] is None
            assert data["row_count"] == 1
            assert len(data["rows"]) == 1
            assert data["rows"][0]["id"] == 1
            assert data["rows"][0]["name"] == "test_name"
            assert len(data["columns"]) == 2
            assert data["columns"][0]["name"] == "id"
            assert data["execution_time"] > 0

            # Verify Database.execute() was called with correct QueryOptions
            mock_database.execute.assert_called_once()
            call_args = mock_database.execute.call_args
            assert call_args[0][0] == request["sql"]
            options = call_args[0][1]
            assert options.limit == 10
            # Caching is enabled by default (force_refresh=False means cache=None)
            assert options.cache is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_with_template_params(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test SQL execution with Jinja2 template parameters."""
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_select_result(
            rows=[{"order_id": 1, "status": "active"}],
            columns=["order_id", "status"],
            original_sql="SELECT * FROM {{ table }} WHERE status = '{{ status }}'",
            executed_sql="SELECT * FROM orders WHERE status = 'active'",
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM {{ table }} WHERE status = '{{ status }}'",
            "template_params": {"table": "orders", "status": "active"},
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True
            assert data["error"] is None

            # Verify template_params were passed to QueryOptions
            call_args = mock_database.execute.call_args
            options = call_args[0][1]
            assert options.template_params == {"table": "orders", "status": "active"}

            # Verify statements contain both original and executed SQL
            assert data["statements"] is not None
            assert len(data["statements"]) == 1
            assert "{{ table }}" in data["statements"][0]["original_sql"]
            assert "orders" in data["statements"][0]["executed_sql"]

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_database_not_found(
        self,
        mock_db,
        mock_security_manager,  # noqa: PT019
        mcp_server,
    ):
        """Test graceful error when database is not found."""
        # mock_security_manager is patched but not used (error happens first)
        del mock_security_manager  # Silence unused variable warning
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            None
        )

        request = {
            "database_id": 999,
            "sql": "SELECT 1",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Database with ID 999 not found" in data["error"]

    @patch("superset.security_manager", new_callable=MagicMock)
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_access_denied(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test error when user lacks database access."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = False

        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Access denied to database" in data["error"]

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_dml_success(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test successful DML execution."""
        mock_database = _mock_database(allow_dml=True)
        dml_sql = "UPDATE users SET active = true WHERE last_login > '2024-01-01'"
        mock_database.execute.return_value = _create_dml_result(
            affected_rows=3,
            original_sql=dml_sql,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "UPDATE users SET active = true WHERE last_login > '2024-01-01'",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True
            assert data["error"] is None
            assert data["affected_rows"] == 3
            assert data["rows"] is None  # None for DML
            assert data["row_count"] is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_empty_results(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test query that returns no results."""
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_select_result(
            rows=[],
            columns=["id", "name"],
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM users WHERE id = 999999",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True
            assert data["error"] is None
            assert data["row_count"] == 0
            assert len(data["rows"]) == 0
            assert len(data["columns"]) == 2  # Column metadata still returned

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_with_schema_and_catalog(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test SQL execution with schema and catalog specification."""
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_select_result(
            rows=[{"total": 100}],
            columns=["total"],
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT COUNT(*) as total FROM orders",
            "schema": "sales",
            "catalog": "prod_catalog",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True

            # Verify schema and catalog were passed to QueryOptions
            call_args = mock_database.execute.call_args
            options = call_args[0][1]
            assert options.schema == "sales"
            assert options.catalog == "prod_catalog"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_dry_run(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test dry_run mode returns transformed SQL without executing."""
        mock_database = _mock_database()
        executed_sql = "SELECT * FROM users WHERE user_id IN (SELECT ...) LIMIT 100"
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SELECT * FROM {{ table }}",
                    executed_sql=executed_sql,
                    data=None,
                    row_count=0,
                    execution_time_ms=0,
                )
            ],
            query_id=None,
            total_execution_time_ms=0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM {{ table }}",
            "template_params": {"table": "users"},
            "dry_run": True,
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True
            # Verify dry_run was passed
            call_args = mock_database.execute.call_args
            options = call_args[0][1]
            assert options.dry_run is True

            # Verify statements show transformed SQL
            assert data["statements"] is not None
            assert "{{ table }}" in data["statements"][0]["original_sql"]
            assert "users" in data["statements"][0]["executed_sql"]

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_timeout_error(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that SQL injection attempts are handled safely.

        SQLScript detects the DROP TABLE as a mutation and blocks it
        before execution when DML is not allowed on the database.
        """
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_error_result(
            error_message="Query exceeded the timeout limit",
            status=QueryStatus.TIMED_OUT,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM large_table",
            "timeout": 5,
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is False
            assert data["error"] == "Query exceeded the timeout limit"
            assert data["error_type"] == "timed_out"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test multi-statement SQL execution."""
        mock_database = _mock_database()
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SELECT 1 as a",
                    executed_sql="SELECT 1 as a",
                    data=pd.DataFrame([{"a": 1}]),
                    row_count=1,
                    execution_time_ms=5.0,
                ),
                StatementResult(
                    original_sql="SELECT 2 as b",
                    executed_sql="SELECT 2 as b",
                    data=pd.DataFrame([{"b": 2}]),
                    row_count=1,
                    execution_time_ms=3.0,
                ),
            ],
            query_id=None,
            total_execution_time_ms=8.0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT 1 as a; SELECT 2 as b;",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            # Use structured_content for dictionary access (Pydantic model responses)
            data = result.structured_content
            assert data["success"] is True
            # Statements should contain both
            assert data["statements"] is not None
            assert len(data["statements"]) == 2
            assert data["statements"][0]["original_sql"] == "SELECT 1 as a"
            assert data["statements"][1]["original_sql"] == "SELECT 2 as b"

            # rows/columns should be from last data-bearing statement
            assert data["rows"] == [{"b": 2}]
            assert data["row_count"] == 1

            # Per-statement data should be present for both statements
            assert data["statements"][0]["data"] is not None
            assert data["statements"][0]["data"]["rows"] == [{"a": 1}]
            assert len(data["statements"][0]["data"]["columns"]) == 1
            assert data["statements"][0]["data"]["columns"][0]["name"] == "a"

            assert data["statements"][1]["data"] is not None
            assert data["statements"][1]["data"]["rows"] == [{"b": 2}]
            assert len(data["statements"][1]["data"]["columns"]) == 1
            assert data["statements"][1]["data"]["columns"][0]["name"] == "b"

            # Warning should be present for multi-data-bearing queries
            assert data["multi_statement_warning"] is not None
            assert "2 data-bearing statements" in data["multi_statement_warning"]

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement_set_then_select(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test multi-statement where first stmt is SET (no data) and second is SELECT.

        This covers the edge case where a SET command (e.g., SET search_path)
        precedes the actual query. The response should contain the SELECT
        results, not the SET's affected_rows.
        """
        mock_database = _mock_database()
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SET search_path TO sales",
                    executed_sql="SET search_path TO sales",
                    data=None,
                    row_count=0,
                    execution_time_ms=1.0,
                ),
                StatementResult(
                    original_sql=(
                        "WITH cte AS (SELECT id, amount FROM orders) SELECT * FROM cte"
                    ),
                    executed_sql=(
                        "WITH cte AS (SELECT id, amount FROM orders) SELECT * FROM cte"
                    ),
                    data=pd.DataFrame(
                        [{"id": 1, "amount": 99.99}, {"id": 2, "amount": 150.00}]
                    ),
                    row_count=2,
                    execution_time_ms=12.0,
                ),
            ],
            query_id=None,
            total_execution_time_ms=13.0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": (
                "SET search_path TO sales;"
                " WITH cte AS (SELECT id, amount FROM orders)"
                " SELECT * FROM cte"
            ),
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True
            assert data["statements"] is not None
            assert len(data["statements"]) == 2

            # The response should contain the SELECT results, not affected_rows
            assert data["rows"] is not None
            assert len(data["rows"]) == 2
            assert data["rows"][0]["id"] == 1
            assert data["rows"][0]["amount"] == 99.99
            assert data["row_count"] == 2
            assert data["affected_rows"] is None

            # Verify columns come from the SELECT statement
            assert data["columns"] is not None
            assert len(data["columns"]) == 2
            column_names = [c["name"] for c in data["columns"]]
            assert "id" in column_names
            assert "amount" in column_names

            # SET statement should have no data, SELECT should have data
            assert data["statements"][0]["data"] is None
            assert data["statements"][1]["data"] is not None
            assert len(data["statements"][1]["data"]["rows"]) == 2

            # No warning since only one data-bearing statement
            assert data["multi_statement_warning"] is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement_all_dml(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test multi-statement where all statements are DML (no data).

        When no statement has data, the response should use affected_rows
        from the last statement.
        """
        mock_database = _mock_database(allow_dml=True)
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SET search_path TO sales",
                    executed_sql="SET search_path TO sales",
                    data=None,
                    row_count=0,
                    execution_time_ms=1.0,
                ),
                StatementResult(
                    original_sql="UPDATE orders SET status = 'shipped'",
                    executed_sql="UPDATE orders SET status = 'shipped'",
                    data=None,
                    row_count=5,
                    execution_time_ms=8.0,
                ),
            ],
            query_id=None,
            total_execution_time_ms=9.0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SET search_path TO sales; UPDATE orders SET status = 'shipped'",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True
            assert data["rows"] is None
            assert data["row_count"] is None
            # affected_rows should come from the last statement
            assert data["affected_rows"] == 5

            # DML statements should have no per-statement data
            assert data["statements"][0]["data"] is None
            assert data["statements"][1]["data"] is None

            # No warning for DML-only queries
            assert data["multi_statement_warning"] is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement_preserves_all_data(
        self, mock_db, mock_security_manager, mcp_server
    ) -> None:
        """Test that multi-statement SQL returns per-statement data for ALL results.

        Regression test: previously, running two SELECT statements would only
        return the last statement's rows in the top-level response and
        completely lose the first statement's row data.
        """
        mock_database = _mock_database()
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SELECT COUNT(*) AS order_count FROM orders",
                    executed_sql="SELECT COUNT(*) AS order_count FROM orders",
                    data=pd.DataFrame([{"order_count": 42}]),
                    row_count=1,
                    execution_time_ms=5.0,
                ),
                StatementResult(
                    original_sql="SELECT SUM(revenue) AS total_revenue FROM orders",
                    executed_sql="SELECT SUM(revenue) AS total_revenue FROM orders",
                    data=pd.DataFrame([{"total_revenue": 12345.67}]),
                    row_count=1,
                    execution_time_ms=7.0,
                ),
            ],
            query_id=None,
            total_execution_time_ms=12.0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": (
                "SELECT COUNT(*) AS order_count FROM orders;"
                " SELECT SUM(revenue) AS total_revenue FROM orders"
            ),
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True

            # Top-level rows/columns should be from the LAST data-bearing stmt
            assert data["rows"] == [{"total_revenue": 12345.67}]
            assert data["row_count"] == 1

            # Both statements should have per-statement data
            assert len(data["statements"]) == 2

            # First statement's data is accessible
            first_stmt = data["statements"][0]
            assert first_stmt["data"] is not None
            assert first_stmt["data"]["rows"] == [{"order_count": 42}]
            assert len(first_stmt["data"]["columns"]) == 1
            assert first_stmt["data"]["columns"][0]["name"] == "order_count"

            # Second statement's data is accessible
            second_stmt = data["statements"][1]
            assert second_stmt["data"] is not None
            assert second_stmt["data"]["rows"] == [{"total_revenue": 12345.67}]
            assert len(second_stmt["data"]["columns"]) == 1
            assert second_stmt["data"]["columns"][0]["name"] == "total_revenue"

            # Warning should tell LLM to check statements array
            assert data["multi_statement_warning"] is not None
            assert "2 data-bearing statements" in data["multi_statement_warning"]
            assert "statements" in data["multi_statement_warning"]

    @pytest.mark.asyncio
    async def test_execute_sql_empty_query_validation(self, mcp_server):
        """Test validation of empty SQL query."""
        request = {
            "database_id": 1,
            "sql": "   ",  # Empty/whitespace only
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="SQL query cannot be empty"):
                await client.call_tool("execute_sql", {"request": request})

    @pytest.mark.asyncio
    async def test_execute_sql_invalid_limit(self, mcp_server):
        """Test validation of invalid limit values."""
        # Test limit too low
        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 0,
        }

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="greater than or equal to 1"):
                await client.call_tool("execute_sql", {"request": request})

        # Test limit too high
        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 20000,
        }

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="less than or equal to 10000"):
                await client.call_tool("execute_sql", {"request": request})

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_no_limit_respects_sql(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that omitting limit lets the SQL LIMIT clause be respected."""
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_select_result(
            rows=[{"id": i} for i in range(5)],
            columns=["id"],
            original_sql="SELECT id FROM users LIMIT 5",
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        # No 'limit' key — should default to None (no override)
        request = {
            "database_id": 1,
            "sql": "SELECT id FROM users LIMIT 5",
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True

            # Verify limit=None was passed to QueryOptions (no override)
            call_args = mock_database.execute.call_args
            options = call_args[0][1]
            assert options.limit is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_force_refresh(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test force_refresh bypasses cache."""
        mock_database = _mock_database()
        mock_database.execute.return_value = _create_select_result(
            rows=[{"id": 1}],
            columns=["id"],
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT id FROM users",
            "limit": 10,
            "force_refresh": True,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True

            # Verify force_refresh was passed to CacheOptions
            call_args = mock_database.execute.call_args
            options = call_args[0][1]
            assert options.cache is not None
            assert options.cache.force_refresh is True

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_bytes_in_dataframe(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that bytes/memoryview values in DataFrame are sanitized for JSON.

        Regression test: execute_sql fails with 'encoding without a string
        argument' when queries return binary/bytea data.
        """
        mock_database = _mock_database()
        df = pd.DataFrame(
            [
                {
                    "id": 1,
                    "name": "test",
                    "utf8_data": b"hello world",
                    "binary_data": b"\x00\x01\x02\xff",
                },
            ]
        )
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SELECT * FROM files",
                    executed_sql="SELECT * FROM files",
                    data=df,
                    row_count=1,
                    execution_time_ms=5.0,
                )
            ],
            query_id=None,
            total_execution_time_ms=5.0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM files",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True
            assert data["row_count"] == 1
            row = data["rows"][0]
            # UTF-8 decodable bytes should become string
            assert row["utf8_data"] == "hello world"
            # Non-UTF-8 bytes should become hex
            assert row["binary_data"] == "000102ff"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_decimal_in_dataframe(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that Decimal values in DataFrame are converted to float for JSON.

        Regression test: execute_sql fails with 'encoding without a string
        argument' when queries return Decimal types (common with SUM/AVG).
        """
        mock_database = _mock_database()
        df = pd.DataFrame(
            [
                {
                    "id": 1,
                    "price": Decimal("19.99"),
                    "total": Decimal("1234567.89"),
                },
            ]
        )
        mock_database.execute.return_value = QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SELECT * FROM orders",
                    executed_sql="SELECT * FROM orders",
                    data=df,
                    row_count=1,
                    execution_time_ms=5.0,
                )
            ],
            query_id=None,
            total_execution_time_ms=5.0,
            is_cached=False,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM orders",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is True
            assert data["row_count"] == 1
            row = data["rows"][0]
            assert row["price"] == 19.99
            assert row["total"] == 1234567.89
            assert isinstance(row["price"], float)


class TestSanitizeRowValues:
    """Unit tests for _sanitize_row_values helper function."""

    def test_sanitize_utf8_bytes(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"data": b"hello"}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "hello"

    def test_sanitize_non_utf8_bytes(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"data": b"\x00\xff"}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "00ff"

    def test_sanitize_memoryview(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"data": memoryview(b"test")}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "test"

    def test_sanitize_decimal(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"price": Decimal("19.99"), "count": Decimal("42")}]
        _sanitize_row_values(rows)
        assert rows[0]["price"] == 19.99
        assert isinstance(rows[0]["price"], float)
        assert rows[0]["count"] == 42.0

    def test_sanitize_custom_type_uses_str(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        class CustomType:
            def __str__(self):
                return "custom_value"

        rows = [{"data": CustomType()}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "custom_value"

    def test_preserves_json_serializable_types(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [
            {
                "str_val": "hello",
                "int_val": 42,
                "float_val": 3.14,
                "bool_val": True,
                "none_val": None,
                "list_val": [1, 2],
                "dict_val": {"a": 1},
            }
        ]
        original = [dict(row) for row in rows]
        _sanitize_row_values(rows)
        assert rows == original

    def test_sanitize_empty_rows(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows: list[dict[str, Any]] = []
        _sanitize_row_values(rows)
        assert rows == []

    def test_sanitize_mixed_types_in_single_row(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [
            {
                "id": 1,
                "name": "test",
                "price": Decimal("9.99"),
                "blob": b"\x00\x01\x02\xff",
            }
        ]
        _sanitize_row_values(rows)
        assert rows[0]["id"] == 1
        assert rows[0]["name"] == "test"
        assert rows[0]["price"] == 9.99
        assert rows[0]["blob"] == "000102ff"


class TestExecuteSqlOAuth2:
    """Tests for OAuth2 error handling in execute_sql."""

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_oauth2_redirect_error(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that OAuth2RedirectError is caught and returns a clear message."""
        from superset.exceptions import OAuth2RedirectError

        mock_database = _mock_database()
        mock_database.execute.side_effect = OAuth2RedirectError(
            url="https://oauth.example.com/authorize",
            tab_id="test-tab-id",
            redirect_uri="https://superset.example.com/callback",
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is False
            assert "OAuth" in data["error"]
            assert "https://oauth.example.com/authorize" in data["error"]
            assert data["error_type"] == "OAUTH2_REDIRECT"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_oauth2_error(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that OAuth2Error is caught and returns a clear message."""
        from superset.exceptions import OAuth2Error

        mock_database = _mock_database()
        mock_database.execute.side_effect = OAuth2Error(
            "Unable to determine the OAuth2 redirect URI."
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            data = result.structured_content
            assert data["success"] is False
            assert "configuration" in data["error"]
            assert data["error_type"] == "OAUTH2_REDIRECT_ERROR"


class TestColumnInfoIsNullable:
    """Tests for ColumnInfo.is_nullable coercion (Athena returns 'UNKNOWN')."""

    def test_unknown_string_becomes_none(self):
        assert (
            ColumnInfo(name="c", type="int", is_nullable="UNKNOWN").is_nullable is None
        )

    def test_arbitrary_string_becomes_none(self):
        assert ColumnInfo(name="c", type="int", is_nullable="maybe").is_nullable is None

    def test_true_bool(self):
        assert ColumnInfo(name="c", type="int", is_nullable=True).is_nullable is True

    def test_false_bool(self):
        assert ColumnInfo(name="c", type="int", is_nullable=False).is_nullable is False

    def test_none(self):
        assert ColumnInfo(name="c", type="int", is_nullable=None).is_nullable is None

    def test_default_is_none(self):
        assert ColumnInfo(name="c", type="int").is_nullable is None

    def test_true_string(self):
        assert ColumnInfo(name="c", type="int", is_nullable="true").is_nullable is True

    def test_false_string(self):
        assert (
            ColumnInfo(name="c", type="int", is_nullable="false").is_nullable is False
        )

    def test_one_string(self):
        assert ColumnInfo(name="c", type="int", is_nullable="1").is_nullable is True

    def test_zero_string(self):
        assert ColumnInfo(name="c", type="int", is_nullable="0").is_nullable is False

    def test_integer_one(self):
        assert ColumnInfo(name="c", type="int", is_nullable=1).is_nullable is True

    def test_integer_zero(self):
        assert ColumnInfo(name="c", type="int", is_nullable=0).is_nullable is False

    def test_integer_two_becomes_none(self):
        assert ColumnInfo(name="c", type="int", is_nullable=2).is_nullable is None

    def test_model_validate_unknown(self):
        col = ColumnInfo.model_validate(
            {"name": "c", "type": "int", "is_nullable": "UNKNOWN"}
        )
        assert col.is_nullable is None


class TestDestructiveDDLBlocking:
    """Tests for destructive DDL blocking in execute_sql."""

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_drop_table_blocked(self, mock_db, mock_security_manager, mcp_server):
        """DROP TABLE is blocked before reaching the executor."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {"database_id": 1, "sql": "DROP TABLE birth_names"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Destructive DDL" in data["error"]
            assert "DROP" in data["error"]
            mock_database.execute.assert_not_called()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_truncate_blocked(self, mock_db, mock_security_manager, mcp_server):
        """TRUNCATE TABLE is blocked before reaching the executor."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {"database_id": 1, "sql": "TRUNCATE TABLE birth_names"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Destructive DDL" in data["error"]
            mock_database.execute.assert_not_called()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_alter_table_blocked(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """ALTER TABLE is blocked before reaching the executor."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "ALTER TABLE birth_names ADD COLUMN x INT",
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Destructive DDL" in data["error"]
            mock_database.execute.assert_not_called()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_drop_in_multi_statement_blocked(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """DROP TABLE hidden in a multi-statement query is blocked."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "DROP TABLE birth_names; SELECT 1",
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Destructive DDL" in data["error"]
            mock_database.execute.assert_not_called()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_select_allowed(self, mock_db, mock_security_manager, mcp_server):
        """SELECT queries pass through the DDL check."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_database.execute.return_value = _create_select_result(
            rows=[{"x": 1}], columns=["x"], original_sql="SELECT 1"
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {"database_id": 1, "sql": "SELECT 1"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is True
            mock_database.execute.assert_called_once()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_insert_allowed(self, mock_db, mock_security_manager, mcp_server):
        """INSERT queries pass through the DDL check (DML is allowed)."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_database.execute.return_value = _create_dml_result(
            affected_rows=1,
            original_sql="INSERT INTO t VALUES (1)",
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {"database_id": 1, "sql": "INSERT INTO t VALUES (1)"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is True
            mock_database.execute.assert_called_once()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_parse_failure_blocks_query(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """When SQL parsing fails, the query is blocked (fail-closed)."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "postgresql"
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {"database_id": 1, "sql": "DROP TABLE birth_names"}

        import sys

        execute_sql_mod = sys.modules["superset.mcp_service.sql_lab.tool.execute_sql"]
        with patch.object(
            execute_sql_mod,
            "SQLScript",
            side_effect=Exception("parse error"),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool("execute_sql", {"request": request})
                data = result.structured_content
                assert data["success"] is False
                assert "could not be parsed" in data["error"]
                mock_database.execute.assert_not_called()

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_drop_table_blocked_mysql(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """DROP TABLE is blocked for non-PostgreSQL dialects too."""
        mock_database = _mock_database()
        mock_database.db_engine_spec.engine = "mysql"
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {"database_id": 1, "sql": "DROP TABLE users"}

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})
            data = result.structured_content
            assert data["success"] is False
            assert "Destructive DDL" in data["error"]
            mock_database.execute.assert_not_called()
