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

        # Mock cursor for DML operation
        cursor = (  # fmt: skip
            mock_database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value
        )
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
            with pytest.raises(ToolError, match="minimum of 1"):
                await client.call_tool("execute_sql", {"request": request})

        # Test limit too high
        request = {
            "database_id": 1,
            "sql": "SELECT 1",
            "limit": 20000,
        }

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="maximum of 10000"):
                await client.call_tool("execute_sql", {"request": request})
