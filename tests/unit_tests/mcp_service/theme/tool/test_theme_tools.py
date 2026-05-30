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
from superset.mcp_service.theme.schemas import (
    ListThemesRequest,
    ThemeFilter,
)
from superset.mcp_service.utils.sanitization import (
    LLM_CONTEXT_CLOSE_DELIMITER,
    LLM_CONTEXT_OPEN_DELIMITER,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def _wrapped(value: str) -> str:
    return f"{LLM_CONTEXT_OPEN_DELIMITER}\n{value}\n{LLM_CONTEXT_CLOSE_DELIMITER}"


class TestThemeFilterSchema:
    """Tests for ThemeFilter schema — filterable columns."""

    def test_invalid_filter_column_rejected(self):
        """Columns not in the Literal set must be rejected."""
        with pytest.raises(ValidationError):
            ThemeFilter(col="not_a_real_column", opr="eq", value="test")

    def test_valid_filter_column_accepted(self):
        """theme_name is a valid filter column."""
        f = ThemeFilter(col="theme_name", opr="eq", value="my_theme")
        assert f.col == "theme_name"

    def test_json_data_column_not_filterable(self):
        """json_data is not a public filter column."""
        with pytest.raises(ValidationError):
            ThemeFilter(col="json_data", opr="eq", value="{}")

    def test_is_system_filter_accepted(self):
        """is_system is a valid filter column for distinguishing system themes."""
        f = ThemeFilter(col="is_system", opr="eq", value=True)
        assert f.col == "is_system"

    def test_is_system_default_filter_accepted(self):
        """is_system_default is a valid filter column."""
        f = ThemeFilter(col="is_system_default", opr="eq", value=True)
        assert f.col == "is_system_default"

    def test_is_system_dark_filter_accepted(self):
        """is_system_dark is a valid filter column."""
        f = ThemeFilter(col="is_system_dark", opr="eq", value=False)
        assert f.col == "is_system_dark"

    def test_created_by_fk_filter_accepted(self):
        """created_by_fk is a valid filter column for filtering by creator."""
        f = ThemeFilter(col="created_by_fk", opr="eq", value=1)
        assert f.col == "created_by_fk"


def create_mock_theme(
    theme_id: int = 1,
    theme_name: str = "light_theme",
    json_data: str = '{"primaryColor": "#1890ff"}',
    uuid: str = "test-theme-uuid-1",
) -> MagicMock:
    """Factory function to create mock theme objects."""
    theme = MagicMock()
    theme.id = theme_id
    theme.theme_name = theme_name
    theme.json_data = json_data
    theme.uuid = uuid
    theme.is_system = False
    theme.is_system_default = False
    theme.is_system_dark = False
    theme.changed_on = None
    theme.created_on = None
    return theme


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


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_basic(mock_list, mcp_server):
    """Test basic theme listing functionality."""
    theme = create_mock_theme()
    mock_list.return_value = ([theme], 1)

    async with Client(mcp_server) as client:
        request = ListThemesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_themes", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["themes"] is not None
        assert len(data["themes"]) == 1
        assert data["themes"][0]["id"] == 1
        assert data["themes"][0]["theme_name"] == _wrapped("light_theme")
        assert data["themes"][0]["uuid"] == "test-theme-uuid-1"


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_default_columns_include_uuid(mock_list, mcp_server):
    """Test that uuid is included in default columns for themes."""
    theme = create_mock_theme()
    mock_list.return_value = ([theme], 1)

    async with Client(mcp_server) as client:
        result = await client.call_tool("list_themes", {})
        data = json.loads(result.content[0].text)

    assert data["columns_requested"] == ["id", "theme_name", "uuid"]
    assert data["themes"][0]["uuid"] == "test-theme-uuid-1"


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_with_search(mock_list, mcp_server):
    """Test theme listing with search functionality."""
    theme = create_mock_theme(theme_name="dark_theme")
    mock_list.return_value = ([theme], 1)

    async with Client(mcp_server) as client:
        request = ListThemesRequest(page=1, page_size=10, search="dark")
        result = await client.call_tool(
            "list_themes", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert len(data["themes"]) == 1
        assert data["themes"][0]["theme_name"] == _wrapped("dark_theme")


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_with_filters(mock_list, mcp_server):
    """Test theme listing with filters."""
    theme = create_mock_theme(theme_name="custom_theme")
    mock_list.return_value = ([theme], 1)

    async with Client(mcp_server) as client:
        request = ListThemesRequest(
            page=1,
            page_size=10,
            filters=[{"col": "theme_name", "opr": "eq", "value": "custom_theme"}],
        )
        result = await client.call_tool(
            "list_themes", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert len(data["themes"]) == 1


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_api_error(mock_list, mcp_server):
    """Test error handling when DAO raises an exception."""
    mock_list.side_effect = ToolError("Theme error")

    async with Client(mcp_server) as client:
        request = ListThemesRequest(page=1, page_size=10)
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool("list_themes", {"request": request.model_dump()})
        assert "Theme error" in str(excinfo.value)


@patch("superset.daos.theme.ThemeDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_theme_info_basic(mock_find, mcp_server):
    """Test basic get theme info functionality."""
    theme = create_mock_theme()
    mock_find.return_value = theme

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_theme_info", {"request": {"identifier": 1}}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["theme_name"] == _wrapped("light_theme")
        assert data["uuid"] == "test-theme-uuid-1"
        assert data["json_data"]["primaryColor"] == _wrapped("#1890ff")


@patch("superset.daos.theme.ThemeDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_theme_info_by_uuid(mock_find, mcp_server):
    """Test get theme info by UUID."""
    theme = create_mock_theme(uuid="a1b2c3d4-5678-90ab-cdef-1234567890ab")
    mock_find.return_value = theme

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_theme_info",
            {"request": {"identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"}},
        )
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["uuid"] == "a1b2c3d4-5678-90ab-cdef-1234567890ab"

    mock_find.assert_called_once_with(
        "a1b2c3d4-5678-90ab-cdef-1234567890ab", id_column="uuid", query_options=None
    )


@patch("superset.daos.theme.ThemeDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_theme_info_not_found(mock_find, mcp_server):
    """Test get theme info when theme does not exist."""
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_theme_info", {"request": {"identifier": 999}}
        )
        assert json.loads(result.content[0].text)["error_type"] == "not_found"


def test_list_themes_request_search_and_filters_conflict():
    """Cannot use search and filters simultaneously."""
    with pytest.raises(ValidationError):
        ListThemesRequest(
            search="something",
            filters=[{"col": "theme_name", "opr": "eq", "value": "test"}],
        )
