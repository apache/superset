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


import importlib
import logging
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.database.schemas import DatabaseFilter, ListDatabasesRequest
from superset.mcp_service.privacy import DATA_MODEL_METADATA_ERROR_TYPE
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
list_databases_module = importlib.import_module(
    "superset.mcp_service.database.tool.list_databases"
)
get_database_info_module = importlib.import_module(
    "superset.mcp_service.database.tool.get_database_info"
)


class TestDatabaseFilterSchema:
    """Tests for DatabaseFilter schema — filterable columns."""

    def test_created_by_fk_is_valid_filter_column(self):
        """created_by_fk must be accepted as a filter column."""
        f = DatabaseFilter(col="created_by_fk", opr="eq", value=1)
        assert f.col == "created_by_fk"

    def test_changed_by_fk_is_valid_filter_column(self):
        """changed_by_fk must be accepted as a filter column."""
        f = DatabaseFilter(col="changed_by_fk", opr="eq", value=1)
        assert f.col == "changed_by_fk"

    def test_invalid_filter_column_rejected(self):
        """Columns not in the Literal set must be rejected."""
        with pytest.raises(ValidationError):
            DatabaseFilter(col="not_a_real_column", opr="eq", value=1)


def create_mock_database(
    database_id: int = 1,
    database_name: str = "examples",
    backend: str = "postgresql",
    expose_in_sqllab: bool = True,
    allow_ctas: bool = False,
    allow_cvas: bool = False,
    allow_dml: bool = False,
    allow_file_upload: bool = False,
    allow_run_async: bool = False,
) -> MagicMock:
    """Factory function to create mock database objects with sensible defaults."""
    database = MagicMock()
    database.id = database_id
    database.database_name = database_name
    database.backend = backend
    database.verbose_name = None
    database.expose_in_sqllab = expose_in_sqllab
    database.allow_ctas = allow_ctas
    database.allow_cvas = allow_cvas
    database.allow_dml = allow_dml
    database.allow_file_upload = allow_file_upload
    database.allow_run_async = allow_run_async
    database.cache_timeout = None
    database.configuration_method = "sqlalchemy_form"
    database.force_ctas_schema = None
    database.impersonate_user = False
    database.is_managed_externally = False
    database.external_url = None
    database.extra = '{"metadata_params": {}, "engine_params": {}}'
    database.uuid = f"test-database-uuid-{database_id}"
    database.changed_by_name = "admin"
    database.changed_by = None
    database.changed_on = None
    database.created_by_name = "admin"
    database.created_by = None
    database.created_on = None
    database.owners = []
    return database


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


@pytest.fixture(autouse=True)
def allow_data_model_metadata():
    """Keep database tests in the normal metadata-allowed path by default."""
    with (
        patch.object(
            list_databases_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch.object(
            get_database_info_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        yield


@pytest.mark.asyncio
async def test_list_databases_without_request_returns_structured_privacy_error(
    mcp_server,
) -> None:
    """Restricted users are denied even when the request payload is omitted."""
    with patch.object(
        list_databases_module,
        "user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("list_databases", {})

    data = json.loads(result.content[0].text)
    assert data["error_type"] == DATA_MODEL_METADATA_ERROR_TYPE


@patch("superset.daos.database.DatabaseDAO.list")
@pytest.mark.asyncio
async def test_list_databases_basic(mock_list, mcp_server):
    """Test basic database listing functionality."""
    database = create_mock_database()
    database._mapping = {
        "id": database.id,
        "database_name": database.database_name,
        "backend": database.backend,
        "expose_in_sqllab": database.expose_in_sqllab,
    }
    mock_list.return_value = ([database], 1)
    async with Client(mcp_server) as client:
        request = ListDatabasesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_databases", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["databases"] is not None
        assert len(data["databases"]) == 1
        assert data["databases"][0]["id"] == 1
        assert data["databases"][0]["database_name"] == "examples"


@patch("superset.daos.database.DatabaseDAO.list")
@pytest.mark.asyncio
async def test_list_databases_with_search(mock_list, mcp_server):
    """Test database listing with search functionality."""
    database = create_mock_database(database_name="production_db")
    database._mapping = {
        "id": database.id,
        "database_name": database.database_name,
    }
    mock_list.return_value = ([database], 1)
    async with Client(mcp_server) as client:
        request = ListDatabasesRequest(page=1, page_size=10, search="production")
        result = await client.call_tool(
            "list_databases", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["databases"] is not None
        assert len(data["databases"]) == 1
        assert data["databases"][0]["database_name"] == "production_db"


@patch("superset.daos.database.DatabaseDAO.list")
@pytest.mark.asyncio
async def test_list_databases_with_filters(mock_list, mcp_server):
    """Test database listing with filters."""
    database = create_mock_database(expose_in_sqllab=True)
    database._mapping = {
        "id": database.id,
        "database_name": database.database_name,
        "expose_in_sqllab": database.expose_in_sqllab,
    }
    mock_list.return_value = ([database], 1)
    async with Client(mcp_server) as client:
        request = ListDatabasesRequest(
            page=1,
            page_size=10,
            filters=[
                {"col": "expose_in_sqllab", "opr": "eq", "value": True},
            ],
        )
        result = await client.call_tool(
            "list_databases", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["databases"] is not None
        assert len(data["databases"]) == 1


@patch("superset.daos.database.DatabaseDAO.list")
@pytest.mark.asyncio
async def test_list_databases_does_not_expose_user_directory_fields(
    mock_list, mcp_server
) -> None:
    """Test database listing does not expose creator/modifier fields."""
    database = create_mock_database()
    database._mapping = {
        "id": database.id,
        "database_name": database.database_name,
        "created_by": database.created_by_name,
        "created_by_fk": 1,
        "changed_by": database.changed_by_name,
        "changed_by_fk": 1,
    }
    mock_list.return_value = ([database], 1)

    async with Client(mcp_server) as client:
        request = ListDatabasesRequest(
            page=1,
            page_size=10,
            select_columns=[
                "id",
                "database_name",
                "created_by",
                "created_by_fk",
                "changed_by",
                "changed_by_fk",
            ],
        )
        result = await client.call_tool(
            "list_databases", {"request": request.model_dump()}
        )

    data = json.loads(result.content[0].text)
    assert data["columns_requested"] == ["id", "database_name"]
    assert data["columns_loaded"] == ["id", "database_name"]
    assert data["databases"] == [{"id": 1, "database_name": "examples"}]


def test_database_filter_rejects_user_directory_fields() -> None:
    """Test user directory fields cannot be used for database filters."""
    with pytest.raises(ValueError, match="created_by_fk"):
        ListDatabasesRequest(
            filters=[{"col": "created_by_fk", "opr": "eq", "value": 1}],
        )


@patch("superset.daos.database.DatabaseDAO.list")
@pytest.mark.asyncio
async def test_list_databases_api_error(mock_list, mcp_server):
    """Test error handling when DAO raises an exception."""
    mock_list.side_effect = ToolError("Database error")
    async with Client(mcp_server) as client:
        request = ListDatabasesRequest(page=1, page_size=10)
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool("list_databases", {"request": request.model_dump()})
        assert "Database error" in str(excinfo.value)


@patch("superset.daos.database.DatabaseDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_database_info_basic(mock_find, mcp_server):
    """Test basic get database info functionality."""
    database = create_mock_database()
    mock_find.return_value = database
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_database_info", {"request": {"identifier": 1}}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["database_name"] == "examples"
        assert data["backend"] == "postgresql"
        assert "created_by" not in data
        assert "changed_by" not in data


@patch("superset.daos.database.DatabaseDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_database_info_not_found(mock_find, mcp_server):
    """Test get database info when database does not exist."""
    mock_find.return_value = None
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_database_info", {"request": {"identifier": 999}}
        )
        assert result.data["error_type"] == "not_found"
