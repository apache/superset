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
"""

import logging
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.app import mcp

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

    # Mock raw connection context manager
    mock_cursor = Mock()
    mock_cursor.description = [
        ("id", "INTEGER", None, None, None, None, False),
        ("name", "VARCHAR", None, None, None, None, True),
    ]
    mock_cursor.fetchmany.return_value = [(1, "test_name")]
    mock_cursor.rowcount = 1

    mock_conn = Mock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.commit = Mock()

    mock_context = MagicMock()
    mock_context.__enter__.return_value = mock_conn
    mock_context.__exit__.return_value = None

    database.get_raw_connection.return_value = mock_context

    return database


def _mock_multi_statement_database(
    statement_results: list[dict[str, Any]],
    allow_dml: bool = False,
) -> Mock:
    """Create a mock database for multi-statement SQL.

    Each entry in statement_results should have:
      - description: cursor.description value (None for DML)
      - fetchmany: return value of cursor.fetchmany (list of tuples)
      - rowcount: cursor.rowcount value
    """
    database = Mock()
    database.id = 1
    database.database_name = "test_db"
    database.allow_dml = allow_dml

    mock_cursor = Mock()

    # Track which statement we're on
    call_count = {"n": 0}

    def execute_side_effect(sql: str) -> None:
        idx = call_count["n"]
        sr = statement_results[idx]
        mock_cursor.description = sr.get("description")
        mock_cursor.fetchmany.return_value = sr.get("fetchmany", [])
        mock_cursor.rowcount = sr.get("rowcount", 0)
        call_count["n"] += 1

    mock_cursor.execute.side_effect = execute_side_effect

    mock_conn = Mock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.commit = Mock()

    mock_context = MagicMock()
    mock_context.__enter__.return_value = mock_conn
    mock_context.__exit__.return_value = None

    database.get_raw_connection.return_value = mock_context

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
        # Setup mocks
        mock_database = _mock_database()
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

            assert result.data.success is True
            assert result.data.error is None
            assert result.data.row_count == 1
            assert len(result.data.rows) == 1
            assert result.data.rows[0]["id"] == 1
            assert result.data.rows[0]["name"] == "test_name"
            assert len(result.data.columns) == 2
            assert result.data.columns[0].name == "id"
            assert result.data.columns[0].type == "INTEGER"
            assert result.data.execution_time > 0

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_with_parameters(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test SQL execution with parameter substitution."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM {table} WHERE status = '{status}' LIMIT {limit}",
            "parameters": {"table": "orders", "status": "active", "limit": "5"},
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            assert result.data.error is None
            # Verify parameter substitution happened
            mock_database.get_raw_connection.assert_called_once()
            cursor = (  # fmt: skip
                mock_database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value
            )
            # Check that the SQL was formatted with parameters
            executed_sql = cursor.execute.call_args[0][0]
            assert "orders" in executed_sql
            assert "active" in executed_sql

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_database_not_found(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test error when database is not found."""
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

            assert result.data.success is False
            assert result.data.error is not None
            assert "Database with ID 999 not found" in result.data.error
            assert result.data.error_type == "DATABASE_NOT_FOUND_ERROR"
            assert result.data.rows is None

    @patch("superset.security_manager")
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
        # Use Mock instead of AsyncMock for synchronous call
        from unittest.mock import Mock

        mock_security_manager.can_access_database = Mock(return_value=False)

        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is False
            assert result.data.error is not None
            assert "Access denied to database" in result.data.error
            assert result.data.error_type == "SECURITY_ERROR"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_dml_not_allowed(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test error when DML operations are not allowed."""
        mock_database = _mock_database(allow_dml=False)
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "UPDATE users SET name = 'test' WHERE id = 1",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is False
            assert result.data.error is not None
            assert result.data.error_type == "DML_NOT_ALLOWED"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_dml_allowed(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test successful DML execution when allowed."""
        mock_database = _mock_database(allow_dml=True)
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        # Mock cursor for DML operation - description is None per DB-API 2.0
        cursor = (  # fmt: skip
            mock_database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value
        )
        cursor.description = None  # DML statements have no result set
        cursor.rowcount = 3  # 3 rows affected

        request = {
            "database_id": 1,
            "sql": "UPDATE users SET active = true WHERE last_login > '2024-01-01'",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            assert result.data.error is None
            assert result.data.affected_rows == 3
            assert result.data.rows == []  # Empty rows for DML
            assert result.data.row_count == 0
            # Verify commit was called
            (
                mock_database.get_raw_connection.return_value.__enter__.return_value.commit.assert_called_once()
            )

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_empty_results(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test query that returns no results."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        # Mock empty results
        cursor = (  # fmt: skip
            mock_database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value
        )
        cursor.fetchmany.return_value = []

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM users WHERE id = 999999",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            assert result.data.error is None
            assert result.data.row_count == 0
            assert len(result.data.rows) == 0
            assert len(result.data.columns) == 2  # Column metadata still returned

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_missing_parameter(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test error when required parameter is missing."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM {table_name} WHERE id = {user_id}",
            "parameters": {"table_name": "users"},  # Missing user_id
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is False
            assert result.data.error is not None
            assert "user_id" in result.data.error  # Error contains parameter name
            assert result.data.error_type == "INVALID_PAYLOAD_FORMAT_ERROR"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_empty_parameters_with_placeholders(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test error when empty parameters dict is provided but SQL has
        placeholders."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM {table_name} LIMIT 5",
            "parameters": {},  # Empty dict but SQL has {table_name}
            "limit": 5,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is False
            assert result.data.error is not None
            assert "Missing parameter: table_name" in result.data.error
            assert result.data.error_type == "INVALID_PAYLOAD_FORMAT_ERROR"

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_with_schema(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test SQL execution with schema specification."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT COUNT(*) as total FROM orders",
            "schema": "sales",
            "limit": 1,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            assert result.data.error is None
            # Verify schema was passed to get_raw_connection
            # Verify schema was passed
            call_args = mock_database.get_raw_connection.call_args
            assert call_args[1]["schema"] == "sales"
            assert call_args[1]["catalog"] is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_limit_enforcement(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that LIMIT is added to SELECT queries without one."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM users",  # No LIMIT
            "limit": 50,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            # Verify LIMIT was added
            cursor = (  # fmt: skip
                mock_database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value
            )
            executed_sql = cursor.execute.call_args[0][0]
            assert "LIMIT 50" in executed_sql

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_sql_injection_prevention(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Test that SQL injection attempts are handled safely."""
        mock_database = _mock_database()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        # Mock execute to raise an exception
        cursor = (  # fmt: skip
            mock_database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value
        )
        cursor.execute.side_effect = Exception("Syntax error")

        request = {
            "database_id": 1,
            "sql": "SELECT * FROM users WHERE id = 1; DROP TABLE users;--",
            "limit": 10,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is False
            assert result.data.error is not None
            assert "Syntax error" in result.data.error  # Contains actual error
            assert result.data.error_type == "EXECUTION_ERROR"

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
    async def test_execute_sql_multi_statement(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Two SELECTs: both have per-statement data, warning present."""
        mock_database = _mock_multi_statement_database(
            statement_results=[
                {
                    "description": [
                        ("id", "INTEGER", None, None, None, None, False),
                    ],
                    "fetchmany": [(1,), (2,)],
                    "rowcount": 2,
                },
                {
                    "description": [
                        ("name", "VARCHAR", None, None, None, None, True),
                    ],
                    "fetchmany": [("alice",), ("bob",), ("charlie",)],
                    "rowcount": 3,
                },
            ],
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT id FROM t1; SELECT name FROM t2",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            # Top-level has last data-bearing statement's results
            assert result.data.row_count == 3
            assert len(result.data.rows) == 3
            assert result.data.rows[0]["name"] == "alice"

            # Per-statement info
            assert result.data.statements is not None
            assert len(result.data.statements) == 2

            stmt0 = result.data.statements[0]
            assert stmt0.original_sql == "SELECT id FROM t1"
            assert stmt0.data is not None
            assert len(stmt0.data.rows) == 2
            assert stmt0.data.rows[0]["id"] == 1

            stmt1 = result.data.statements[1]
            assert stmt1.original_sql == "SELECT name FROM t2"
            assert stmt1.data is not None
            assert len(stmt1.data.rows) == 3

            # Warning present for multiple data-bearing statements
            assert result.data.multi_statement_warning is not None
            assert "2 data-bearing" in result.data.multi_statement_warning

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement_preserves_all_data(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Regression: first statement's rows are NOT lost."""
        mock_database = _mock_multi_statement_database(
            statement_results=[
                {
                    "description": [
                        ("val", "INTEGER", None, None, None, None, False),
                    ],
                    "fetchmany": [(10,), (20,)],
                    "rowcount": 2,
                },
                {
                    "description": [
                        ("val", "INTEGER", None, None, None, None, False),
                    ],
                    "fetchmany": [(30,)],
                    "rowcount": 1,
                },
            ],
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SELECT 10 as val UNION SELECT 20 as val; SELECT 30 as val",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            # First statement data preserved in statements array
            stmt0 = result.data.statements[0]
            assert stmt0.data is not None
            assert len(stmt0.data.rows) == 2
            assert stmt0.data.rows[0]["val"] == 10
            assert stmt0.data.rows[1]["val"] == 20

            # Top-level has last statement only
            assert result.data.row_count == 1
            assert result.data.rows[0]["val"] == 30

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement_set_then_select(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """SET + SELECT: only SELECT has data, no warning."""
        mock_database = _mock_multi_statement_database(
            statement_results=[
                {
                    "description": None,  # SET produces no result set
                    "fetchmany": [],
                    "rowcount": 0,
                },
                {
                    "description": [
                        ("x", "INTEGER", None, None, None, None, False),
                    ],
                    "fetchmany": [(42,)],
                    "rowcount": 1,
                },
            ],
            allow_dml=True,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "SET @foo = 1; SELECT 42 as x",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            assert result.data.row_count == 1
            assert result.data.rows[0]["x"] == 42

            # Per-statement info
            assert len(result.data.statements) == 2
            assert result.data.statements[0].data is None  # SET has no data
            assert result.data.statements[1].data is not None

            # Only one data-bearing statement — no warning
            assert result.data.multi_statement_warning is None

    @patch("superset.security_manager")
    @patch("superset.db")
    @pytest.mark.asyncio
    async def test_execute_sql_multi_statement_all_dml(
        self, mock_db, mock_security_manager, mcp_server
    ):
        """Two DMLs: no per-statement data, no warning."""
        mock_database = _mock_multi_statement_database(
            statement_results=[
                {
                    "description": None,
                    "fetchmany": [],
                    "rowcount": 5,
                },
                {
                    "description": None,
                    "fetchmany": [],
                    "rowcount": 3,
                },
            ],
            allow_dml=True,
        )
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        request = {
            "database_id": 1,
            "sql": "UPDATE t1 SET x=1; UPDATE t2 SET y=2",
            "limit": 100,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool("execute_sql", {"request": request})

            assert result.data.success is True
            assert result.data.affected_rows == 3  # Last DML's rowcount
            assert result.data.rows == []  # No data-bearing results

            # Per-statement info present but no data
            assert len(result.data.statements) == 2
            assert result.data.statements[0].data is None
            assert result.data.statements[1].data is None
            assert result.data.statements[0].row_count == 5
            assert result.data.statements[1].row_count == 3

            # No data-bearing statements — no warning
            assert result.data.multi_statement_warning is None


class TestSanitizeRowValues:
    """Tests for _sanitize_row_values helper."""

    def test_sanitize_utf8_bytes(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"data": b"hello"}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "hello"

    def test_sanitize_non_utf8_bytes(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"data": b"\x00\x01\x02\xff"}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "000102ff"

    def test_sanitize_memoryview(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"data": memoryview(b"hello")}]
        _sanitize_row_values(rows)
        assert rows[0]["data"] == "hello"

    def test_sanitize_decimal(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        rows = [{"price": Decimal("9.99")}]
        _sanitize_row_values(rows)
        assert rows[0]["price"] == 9.99

    def test_sanitize_custom_type_uses_str(self):
        from superset.mcp_service.sql_lab.tool.execute_sql import _sanitize_row_values

        class CustomType:
            def __str__(self) -> str:
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
        # Raise OAuth2RedirectError from get_raw_connection, which is the
        # actual code path used by execute_sql_query (not database.execute).
        mock_database.get_raw_connection.side_effect = OAuth2RedirectError(
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
        # Raise OAuth2Error from get_raw_connection, which is the actual
        # code path used by execute_sql_query (not database.execute).
        mock_database.get_raw_connection.side_effect = OAuth2Error(
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
