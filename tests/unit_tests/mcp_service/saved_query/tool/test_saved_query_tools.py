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
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.saved_query.schemas import (
    ListSavedQueriesRequest,
    SavedQueryFilter,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class TestSavedQueryFilterSchema:
    """Tests for SavedQueryFilter schema — filterable columns."""

    def test_invalid_filter_column_rejected(self):
        """Columns not in the Literal set must be rejected."""
        with pytest.raises(ValidationError):
            SavedQueryFilter(col="not_a_real_column", opr="eq", value="test")

    def test_user_id_is_rejected_as_filter_column(self):
        """user_id is not a filter column; use created_by_fk instead."""
        with pytest.raises(ValidationError):
            SavedQueryFilter(col="user_id", opr="eq", value=1)

    def test_valid_label_filter_accepted(self):
        """label is a valid filter column."""
        f = SavedQueryFilter(col="label", opr="eq", value="my query")
        assert f.col == "label"

    def test_valid_db_id_filter_accepted(self):
        """db_id is a valid filter column."""
        f = SavedQueryFilter(col="db_id", opr="eq", value=1)
        assert f.col == "db_id"

    def test_valid_schema_filter_accepted(self):
        """schema is a valid filter column."""
        f = SavedQueryFilter(col="schema", opr="eq", value="public")
        assert f.col == "schema"

    def test_valid_catalog_filter_accepted(self):
        """catalog is a valid filter column."""
        f = SavedQueryFilter(col="catalog", opr="eq", value="my_catalog")
        assert f.col == "catalog"

    def test_valid_created_by_fk_filter_accepted(self):
        """created_by_fk enables filtering by the creator user ID."""
        f = SavedQueryFilter(col="created_by_fk", opr="eq", value=42)
        assert f.col == "created_by_fk"


def create_mock_saved_query(
    saved_query_id: int = 1,
    label: str = "My Query",
    sql: str = "SELECT 1",
    db_id: int = 1,
    schema: str = "public",
    catalog: str | None = None,
    description: str = "Test query",
    uuid: str = "test-uuid-1234",
    last_run: datetime | None = None,
) -> MagicMock:
    """Factory function to create mock saved query objects with sensible defaults."""
    saved_query = MagicMock()
    saved_query.id = saved_query_id
    saved_query.label = label
    saved_query.sql = sql
    saved_query.db_id = db_id
    saved_query.schema = schema
    saved_query.catalog = catalog
    saved_query.description = description
    saved_query.uuid = uuid
    saved_query.changed_on = None
    saved_query.created_on = None
    saved_query.last_run = last_run
    return saved_query


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


@patch("superset.daos.query.SavedQueryDAO.list")
@pytest.mark.asyncio
async def test_list_saved_queries_basic(mock_list, mcp_server):
    """Test basic saved query listing functionality."""
    saved_query = create_mock_saved_query()
    saved_query._mapping = {
        "id": saved_query.id,
        "label": saved_query.label,
        "db_id": saved_query.db_id,
        "schema": saved_query.schema,
        "uuid": saved_query.uuid,
    }
    mock_list.return_value = ([saved_query], 1)
    async with Client(mcp_server) as client:
        request = ListSavedQueriesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_saved_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["saved_queries"] is not None
        assert len(data["saved_queries"]) == 1
        assert data["saved_queries"][0]["id"] == 1
        assert data["saved_queries"][0]["label"] == "My Query"


@patch("superset.daos.query.SavedQueryDAO.list")
@pytest.mark.asyncio
async def test_list_saved_queries_with_search(mock_list, mcp_server):
    """Test saved query listing with search functionality."""
    saved_query = create_mock_saved_query(label="Production Query")
    saved_query._mapping = {
        "id": saved_query.id,
        "label": saved_query.label,
    }
    mock_list.return_value = ([saved_query], 1)
    async with Client(mcp_server) as client:
        request = ListSavedQueriesRequest(page=1, page_size=10, search="Production")
        result = await client.call_tool(
            "list_saved_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["saved_queries"] is not None
        assert len(data["saved_queries"]) == 1
        assert data["saved_queries"][0]["label"] == "Production Query"


@patch("superset.daos.query.SavedQueryDAO.list")
@pytest.mark.asyncio
async def test_list_saved_queries_with_filters(mock_list, mcp_server):
    """Test saved query listing with filters."""
    saved_query = create_mock_saved_query(db_id=2)
    saved_query._mapping = {
        "id": saved_query.id,
        "label": saved_query.label,
        "db_id": saved_query.db_id,
    }
    mock_list.return_value = ([saved_query], 1)
    async with Client(mcp_server) as client:
        request = ListSavedQueriesRequest(
            page=1,
            page_size=10,
            filters=[
                {"col": "db_id", "opr": "eq", "value": 2},
            ],
        )
        result = await client.call_tool(
            "list_saved_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["saved_queries"] is not None
        assert len(data["saved_queries"]) == 1


def test_list_saved_queries_request_rejects_both_search_and_filters():
    """Cannot use search and filters simultaneously."""
    with pytest.raises(ValidationError):
        ListSavedQueriesRequest(
            search="test",
            filters=[{"col": "label", "opr": "eq", "value": "test"}],
        )


@patch("superset.daos.query.SavedQueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_saved_query_info_basic(mock_find, mcp_server):
    """Test basic get saved query info functionality."""
    saved_query = create_mock_saved_query()
    mock_find.return_value = saved_query
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_saved_query_info", {"request": {"identifier": 1}}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["label"] == "My Query"
        assert data["sql"] == "SELECT 1"
        assert data["db_id"] == 1


@patch("superset.daos.query.SavedQueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_saved_query_info_not_found(mock_find, mcp_server):
    """Test get saved query info when saved query does not exist."""
    mock_find.return_value = None
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_saved_query_info", {"request": {"identifier": 999}}
        )
        assert result.data["error_type"] == "not_found"


@patch("superset.daos.query.SavedQueryDAO.list")
@pytest.mark.asyncio
async def test_list_saved_queries_empty(mock_list, mcp_server):
    """Test saved query listing returns empty list when no results."""
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        request = ListSavedQueriesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_saved_queries", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["saved_queries"] == []
        assert data["count"] == 0
        assert data["total_count"] == 0


@patch("superset.daos.query.SavedQueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_saved_query_info_by_uuid(mock_find, mcp_server):
    """Test get saved query info by UUID string."""
    saved_query = create_mock_saved_query(uuid="a1b2c3d4-5678-90ab-cdef-1234567890ab")
    mock_find.return_value = saved_query
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_saved_query_info",
            {"request": {"identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"}},
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["uuid"] == "a1b2c3d4-5678-90ab-cdef-1234567890ab"


@patch("superset.daos.query.SavedQueryDAO.list")
@pytest.mark.asyncio
async def test_list_saved_queries_pagination_info(mock_list, mcp_server):
    """Test that pagination info is correctly returned."""
    saved_queries = [create_mock_saved_query(saved_query_id=i) for i in range(1, 4)]
    for sq in saved_queries:
        sq._mapping = {"id": sq.id, "label": sq.label}
    mock_list.return_value = (saved_queries, 25)
    async with Client(mcp_server) as client:
        request = ListSavedQueriesRequest(page=1, page_size=3)
        result = await client.call_tool(
            "list_saved_queries", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["total_count"] == 25
        assert data["count"] == 3
        assert data["page_size"] == 3
        assert data["has_next"] is True
        assert data["has_previous"] is False


@patch("superset.daos.query.SavedQueryDAO.list")
@pytest.mark.asyncio
async def test_list_saved_queries_select_columns_projects_fields(mock_list, mcp_server):
    """select_columns limits which fields appear in each saved query result."""
    saved_query = create_mock_saved_query()
    saved_query._mapping = {"id": saved_query.id, "label": saved_query.label}
    mock_list.return_value = ([saved_query], 1)
    async with Client(mcp_server) as client:
        request = ListSavedQueriesRequest(
            page=1, page_size=10, select_columns=["id", "label"]
        )
        result = await client.call_tool(
            "list_saved_queries", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["saved_queries"] is not None
        sq = data["saved_queries"][0]
        assert set(sq.keys()) == {"id", "label"}
        assert sq["id"] == 1
        assert sq["label"] == "My Query"


@pytest.mark.asyncio
async def test_list_saved_queries_invalid_order_column_raises(mcp_server):
    """order_column not in SORTABLE_SAVED_QUERY_COLUMNS must be rejected."""
    request = ListSavedQueriesRequest(page=1, page_size=10, order_column="sql")
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError, match="Invalid order_column"):
            await client.call_tool(
                "list_saved_queries", {"request": request.model_dump()}
            )


@patch("superset.daos.query.SavedQueryDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_saved_query_info_internal_error(mock_find, mcp_server):
    """Unexpected exception in get_saved_query_info returns InternalError."""
    mock_find.side_effect = RuntimeError("unexpected db failure")
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_saved_query_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "InternalError"
        assert data["error"] == "Failed to get saved query info"
