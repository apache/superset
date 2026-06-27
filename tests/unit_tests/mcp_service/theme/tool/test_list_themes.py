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

"""Unit tests for the list_themes MCP tool."""

from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.theme.schemas import ListThemesRequest, ThemeFilter
from superset.utils import json


def create_mock_theme(
    theme_id: int = 1,
    theme_name: str = "Corporate Blue",
    json_data: str = '{"token": {"colorPrimary": "#1d4ed8"}}',
    uuid: str = "11111111-1111-1111-1111-111111111111",
) -> MagicMock:
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
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestThemeFilterSchema:
    """Tests for ThemeFilter schema — filterable columns."""

    def test_invalid_filter_column_rejected(self):
        with pytest.raises(ValidationError):
            ThemeFilter(col="not_a_real_column", opr="eq", value="x")

    def test_valid_theme_name_filter(self):
        f = ThemeFilter(col="theme_name", opr="ct", value="blue")
        assert f.col == "theme_name"


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_basic(mock_list, mcp_server):
    """Basic theme listing returns the mocked theme."""
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
        assert "Corporate Blue" in data["themes"][0]["theme_name"]


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_without_request(mock_list, mcp_server):
    """Listing with no request payload uses defaults."""
    theme = create_mock_theme()
    mock_list.return_value = ([theme], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_themes", {})
        data = json.loads(result.content[0].text)
        assert data["themes"] is not None
        assert len(data["themes"]) == 1


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_multiple(mock_list, mcp_server):
    """Multiple themes are returned."""
    themes = [
        create_mock_theme(theme_id=1, theme_name="Light"),
        create_mock_theme(theme_id=2, theme_name="Dark"),
    ]
    mock_list.return_value = (themes, 2)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_themes", {})
        data = json.loads(result.content[0].text)
        assert data["total_count"] == 2
        assert len(data["themes"]) == 2
        names = {t["theme_name"] for t in data["themes"]}
        assert any("Light" in n for n in names)
        assert any("Dark" in n for n in names)
