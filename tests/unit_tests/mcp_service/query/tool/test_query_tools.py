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


import logging
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.query.schemas import (
    ListQueriesRequest,
    QueryFilter,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class TestQueryFilterSchema:
    """Tests for QueryFilter schema — filterable columns."""

    def test_invalid_filter_column_rejected(self):
        """Columns not in the Literal set must be rejected."""
        with pytest.raises(ValidationError):
            QueryFilter(col="not_a_real_column", opr="eq", value="test")

    def test_valid_status_filter_accepted(self):
        """status is a valid filter column."""
        f = QueryFilter(col="status", opr="eq", value="success")
        assert f.col == "status"

    def test_valid_database_id_filter_accepted(self):
        """database_id is a valid filter column."""
        f = QueryFilter(col="database_id", opr="eq", value=1)
        assert f.col == "database_id"

    def test_valid_schema_filter_accepted(self):
        """schema is a valid filter column."""
        f = QueryFilter(col="schema", opr="eq", value="public")
        assert f.col == "schema"

    def test_valid_user_id_filter_accepted(self):
        """user_id filter enables admin-level filtering by user."""
        f = QueryFilter(col="user_id", opr="eq", value=42)
        assert f.col == "user_id"

    def test_valid_start_time_filter_accepted(self):
        """start_time filter enables time-range queries."""
        f = QueryFilter(col="start_time", opr="gt", value=1700000000.0)
        assert f.col == "start_time"


def create_mock_query(
    query_id: int = 1,
    sql: str = "SELECT * FROM table",
    executed_sql: str | None = None,
    status: str = "success",
    start_time: float = 1700000000.0,
    end_time: float = 1700000001.0,
    rows: int = 100,
    database_id: int = 1,
    schema: str = "public",
    catalog: str | None = None,
    tab_name: str = "SQL Lab 1",
    error_message: str | None = None,
    client_id: str = "abc123",
    user_id: int | None = 1,
) -> MagicMock:
    """Factory function to create mock query objects with sensible defaults."""
    query = MagicMock()
    query.id = query_id
    query.sql = sql
    query.executed_sql = executed_sql
    query.status = status
    query.start_time = start_time
    query.end_time = end_time
    query.rows = rows
    query.database_id = database_id
    query.schema = schema
    query.catalog = catalog
    query.tab_name = tab_name
    query.error_message = error_message
    query.client_id = client_id
    query.limit = 1000
    query.progress = 100
    query.changed_on = None
    query.user_id = user_id
    return query


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    from unittest.mock import Mock, patch

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_basic(mock_list, mcp_server):
    """Test basic query listing functionality."""
    query = create_mock_query()
    query._mapping = {
        "id": query.id,
        "sql": query.sql,
        "status": query.status,
        "start_time": query.start_time,
        "database_id": query.database_id,
        "schema": query.schema,
    }
    mock_list.return_value = ([query], 1)
    async with Client(mcp_server) as client:
        request = ListQueriesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["queries"] is not None
        assert len(data["queries"]) == 1
        assert data["queries"][0]["id"] == 1
        assert data["queries"][0]["status"] == "success"


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_with_status_filter(mock_list, mcp_server):
    """Test query listing with status filter."""
    query = create_mock_query(status="failed", error_message="Syntax error")
    query._mapping = {
        "id": query.id,
        "sql": query.sql,
        "status": query.status,
        "error_message": query.error_message,
    }
    mock_list.return_value = ([query], 1)
    async with Client(mcp_server) as client:
        request = ListQueriesRequest(
            page=1,
            page_size=10,
            filters=[
                {"col": "status", "opr": "eq", "value": "failed"},
            ],
        )
        result = await client.call_tool(
            "list_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["queries"] is not None
        assert len(data["queries"]) == 1
        assert data["queries"][0]["status"] == "failed"


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_default_page_size(mock_list, mcp_server):
    """Test that default page size is 25 for query history."""
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_queries", {})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["page_size"] == 25


def test_list_queries_request_rejects_both_search_and_filters():
    """Cannot use search and filters simultaneously."""
    with pytest.raises(ValidationError):
        ListQueriesRequest(
            search="test",
            filters=[{"col": "status", "opr": "eq", "value": "success"}],
        )


@patch("superset.daos.query.QueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_query_info_basic(mock_find, mcp_server):
    """Test basic get query info functionality."""
    query = create_mock_query()
    mock_find.return_value = query
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_query_info", {"request": {"identifier": 1}}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["status"] == "success"
        assert data["database_id"] == 1


@patch("superset.daos.query.QueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_query_info_not_found(mock_find, mcp_server):
    """Test get query info when query does not exist."""
    mock_find.return_value = None
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_query_info", {"request": {"identifier": 999}}
        )
        assert result.data["error_type"] == "not_found"


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_empty(mock_list, mcp_server):
    """Test query listing returns empty list when no results."""
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        request = ListQueriesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["queries"] == []
        assert data["count"] == 0
        assert data["total_count"] == 0


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_pagination_info(mock_list, mcp_server):
    """Test that pagination info is correctly returned."""
    queries = [create_mock_query(query_id=i) for i in range(1, 4)]
    for q in queries:
        q._mapping = {"id": q.id, "sql": q.sql, "status": q.status}
    mock_list.return_value = (queries, 100)
    async with Client(mcp_server) as client:
        request = ListQueriesRequest(page=1, page_size=3)
        result = await client.call_tool(
            "list_queries", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["total_count"] == 100
        assert data["page_size"] == 3
        assert data["has_next"] is True
        assert data["has_previous"] is False


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_default_order_is_changed_on_desc(mock_list, mcp_server):
    """Test that default ordering is changed_on descending."""
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_queries", {})
        assert result.content is not None
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs.kwargs.get("order_column") == "changed_on"
        assert call_kwargs.kwargs.get("order_direction") == "desc"


@patch("superset.daos.query.QueryDAO.list")
@pytest.mark.asyncio
async def test_list_queries_select_columns_projects_fields(mock_list, mcp_server):
    """select_columns limits which fields appear in each query result."""
    query = create_mock_query()
    query._mapping = {"id": query.id, "status": query.status}
    mock_list.return_value = ([query], 1)
    async with Client(mcp_server) as client:
        request = ListQueriesRequest(
            page=1, page_size=10, select_columns=["id", "status"]
        )
        result = await client.call_tool(
            "list_queries", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["queries"] is not None
        q = data["queries"][0]
        assert set(q.keys()) == {"id", "status"}
        assert q["id"] == 1
        assert q["status"] == "success"


@pytest.mark.asyncio
async def test_list_queries_invalid_order_column_raises(mcp_server):
    """order_column not in SORTABLE_QUERY_COLUMNS must be rejected."""
    request = ListQueriesRequest(page=1, page_size=10, order_column="tab_name")
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="Invalid order_column"):
            await client.call_tool("list_queries", {"request": request.model_dump()})


@patch("superset.daos.query.QueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_query_info_internal_error(mock_find, mcp_server):
    """When an unexpected exception is raised, get_query_info returns InternalError."""
    mock_find.side_effect = RuntimeError("unexpected db failure")
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_query_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "InternalError"
        assert data["error"] == "Failed to get query info"
