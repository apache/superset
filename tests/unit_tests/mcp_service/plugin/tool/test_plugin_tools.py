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
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.plugin.schemas import ListPluginsRequest, PluginColumnFilter
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def create_mock_plugin(
    plugin_id: int = 1,
    name: str = "My Plugin",
    key: str = "my_plugin",
    bundle_url: str = "https://example.com/plugin.js",
) -> MagicMock:
    plugin = MagicMock()
    plugin.id = plugin_id
    plugin.name = name
    plugin.key = key
    plugin.bundle_url = bundle_url
    plugin.changed_on = None
    plugin.created_on = None
    return plugin


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


class TestPluginColumnFilterSchema:
    def test_invalid_filter_column_rejected(self):
        with pytest.raises(ValidationError):
            PluginColumnFilter(col="bundle_url", opr="eq", value="test")

    def test_valid_name_filter(self):
        f = PluginColumnFilter(col="name", opr="eq", value="test")
        assert f.col == "name"

    def test_valid_key_filter(self):
        f = PluginColumnFilter(col="key", opr="eq", value="my_plugin")
        assert f.col == "key"


@patch("superset.mcp_service.plugin.dao.DynamicPluginDAO.list")
@pytest.mark.asyncio
async def test_list_plugins_basic(mock_list, mcp_server):
    plugin = create_mock_plugin()
    mock_list.return_value = ([plugin], 1)

    async with Client(mcp_server) as client:
        result = await client.call_tool("list_plugins", {})
        data = json.loads(result.content[0].text)
        assert "plugins" in data
        assert len(data["plugins"]) == 1
        assert data["plugins"][0]["id"] == 1
        assert data["plugins"][0]["name"] == "My Plugin"
        assert data["plugins"][0]["key"] == "my_plugin"


@patch("superset.mcp_service.plugin.dao.DynamicPluginDAO.list")
@pytest.mark.asyncio
async def test_list_plugins_with_request(mock_list, mcp_server):
    plugin = create_mock_plugin()
    mock_list.return_value = ([plugin], 1)

    async with Client(mcp_server) as client:
        request = ListPluginsRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_plugins", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["count"] == 1
        assert data["total_count"] == 1


@patch("superset.mcp_service.plugin.dao.DynamicPluginDAO.list")
@pytest.mark.asyncio
async def test_list_plugins_with_search(mock_list, mcp_server):
    plugin = create_mock_plugin(name="Custom Chart")
    mock_list.return_value = ([plugin], 1)

    async with Client(mcp_server) as client:
        request = ListPluginsRequest(page=1, page_size=10, search="custom")
        result = await client.call_tool(
            "list_plugins", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["plugins"][0]["name"] == "Custom Chart"


@patch("superset.mcp_service.plugin.dao.DynamicPluginDAO.list")
@pytest.mark.asyncio
async def test_list_plugins_empty(mock_list, mcp_server):
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        result = await client.call_tool("list_plugins", {})
        data = json.loads(result.content[0].text)
        assert data["count"] == 0
        assert data["plugins"] == []


@patch("superset.mcp_service.plugin.dao.DynamicPluginDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_plugin_info_basic(mock_find, mcp_server):
    plugin = create_mock_plugin()
    mock_find.return_value = plugin

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_plugin_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["name"] == "My Plugin"
        assert data["key"] == "my_plugin"
        assert data["bundle_url"] == "https://example.com/plugin.js"


@patch("superset.mcp_service.plugin.dao.DynamicPluginDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_plugin_info_not_found(mock_find, mcp_server):
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_plugin_info", {"request": {"identifier": 999}}
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "not_found"


def test_list_plugins_request_rejects_search_and_filters():
    with pytest.raises(ValidationError):
        ListPluginsRequest(
            search="test",
            filters=[{"col": "name", "opr": "eq", "value": "x"}],
        )
