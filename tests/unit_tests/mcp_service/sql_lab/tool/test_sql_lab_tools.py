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
Unit tests for SQL Lab MCP tools
"""

import logging
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


def _mock_database(id: int = 1, database_name: str = "test_db") -> Mock:
    """Create a mock database object."""
    database = Mock()
    database.id = id
    database.database_name = database_name
    return database


class TestOpenSqlLabWithContext:
    """Tests for open_sql_lab_with_context MCP tool."""

    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_open_sql_lab_basic(self, mock_find_database, mcp_server):
        """Test opening SQL Lab with basic parameters."""
        mock_find_database.return_value = _mock_database(id=1, database_name="test_db")

        request = {
            "database_connection_id": 1,
            "schema": "public",
            "sql": "SELECT * FROM users LIMIT 10",
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "open_sql_lab_with_context", {"request": request}
            )

            assert result.data.error is None
            assert "/sqllab?" in result.data.url
            assert "dbid=1" in result.data.url
            assert "schema=public" in result.data.url
            assert "SELECT" in result.data.url  # SQL should be in URL
            assert result.data.database_id == 1
            # Schema value is passed correctly in URL, which is the important part

    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_open_sql_lab_database_not_found(
        self, mock_find_database, mcp_server
    ):
        """Test error handling when database is not found."""
        mock_find_database.return_value = None

        request = {"database_connection_id": 999, "sql": "SELECT 1"}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "open_sql_lab_with_context", {"request": request}
            )

            assert result.data.error is not None
            assert "Database with ID 999 not found" in result.data.error
            assert result.data.url == ""
            assert result.data.database_id == 999

    @patch("superset.daos.database.DatabaseDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_open_sql_lab_minimal_request(self, mock_find_database, mcp_server):
        """Test SQL Lab with minimal required parameters."""
        mock_find_database.return_value = _mock_database(id=5)

        request = {"database_connection_id": 5}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "open_sql_lab_with_context", {"request": request}
            )

            assert result.data.error is None
            assert "/sqllab?" in result.data.url
            assert "dbid=5" in result.data.url
            assert result.data.database_id == 5
            # Should not have schema, sql, or title parameters
            assert "schema=" not in result.data.url
            assert "sql=" not in result.data.url
            assert "title=" not in result.data.url
