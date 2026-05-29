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

from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from superset.mcp_service.app import mcp
from superset.mcp_service.plugin.schemas import (
    CreatePluginRequest,
    ListPluginsRequest,
    PluginColumnFilter,
    UpdatePluginRequest,
)
from superset.utils import json


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


# ---------------------------------------------------------------------------
# PluginColumnFilter schema tests
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# list_plugins / get_plugin_info tool tests
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# CreatePluginRequest / UpdatePluginRequest schema tests
# ---------------------------------------------------------------------------


def test_create_plugin_request_valid() -> None:
    req = CreatePluginRequest(
        name="My Plugin",
        key="@my-org/my-plugin",
        bundle_url="https://cdn.example.com/bundle.js",
    )
    assert req.name == "My Plugin"
    assert req.key == "@my-org/my-plugin"
    assert req.bundle_url == "https://cdn.example.com/bundle.js"


def test_create_plugin_request_blank_name_fails() -> None:
    with pytest.raises(ValidationError, match="must not be blank"):
        CreatePluginRequest(
            name="   ",
            key="@my-org/my-plugin",
            bundle_url="https://cdn.example.com/bundle.js",
        )


def test_create_plugin_request_name_too_long_fails() -> None:
    with pytest.raises(ValidationError):
        CreatePluginRequest(
            name="a" * 51,
            key="@my-org/my-plugin",
            bundle_url="https://cdn.example.com/bundle.js",
        )


def test_create_plugin_request_key_too_long_fails() -> None:
    with pytest.raises(ValidationError):
        CreatePluginRequest(
            name="My Plugin",
            key="k" * 51,
            bundle_url="https://cdn.example.com/bundle.js",
        )


def test_create_plugin_request_bundle_url_too_long_fails() -> None:
    with pytest.raises(ValidationError):
        CreatePluginRequest(
            name="My Plugin",
            key="@my-org/my-plugin",
            bundle_url="https://cdn.example.com/" + "a" * 980 + ".js",
        )


def test_create_plugin_request_invalid_url_scheme_fails() -> None:
    with pytest.raises(ValidationError, match="http or https"):
        CreatePluginRequest(
            name="My Plugin",
            key="@my-org/my-plugin",
            bundle_url="ftp://cdn.example.com/bundle.js",
        )


def test_create_plugin_request_javascript_url_fails() -> None:
    with pytest.raises(ValidationError, match="http or https"):
        CreatePluginRequest(
            name="My Plugin",
            key="@my-org/my-plugin",
            bundle_url="javascript:alert(1)",
        )


def test_update_plugin_request_valid() -> None:
    req = UpdatePluginRequest(id=1, name="Updated Name")
    assert req.id == 1
    assert req.name == "Updated Name"
    assert req.key is None
    assert req.bundle_url is None


def test_update_plugin_request_no_fields_fails() -> None:
    with pytest.raises(ValidationError, match="At least one of"):
        UpdatePluginRequest(id=1)


def test_update_plugin_request_blank_name_fails() -> None:
    with pytest.raises(ValidationError, match="must not be blank"):
        UpdatePluginRequest(id=1, name="   ")


def test_update_plugin_request_invalid_url_scheme_fails() -> None:
    with pytest.raises(ValidationError, match="http or https"):
        UpdatePluginRequest(id=1, bundle_url="data:text/javascript,alert(1)")


def test_update_plugin_request_name_too_long_fails() -> None:
    with pytest.raises(ValidationError):
        UpdatePluginRequest(id=1, name="n" * 51)


# ---------------------------------------------------------------------------
# create_plugin tool tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_plugin_success(mcp_server: object) -> None:
    """Happy path: plugin created, all fields returned."""
    mock_plugin = MagicMock()
    mock_plugin.id = 42
    mock_plugin.name = "My Plugin"
    mock_plugin.key = "@my-org/my-plugin"
    mock_plugin.bundle_url = "https://cdn.example.com/bundle.js"

    mock_db = MagicMock()
    mock_db.session.add = MagicMock()
    mock_db.session.commit = MagicMock()

    with (
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.db",
            mock_db,
        ),
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.DynamicPlugin",
            return_value=mock_plugin,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_plugin",
                {
                    "request": {
                        "name": "My Plugin",
                        "key": "@my-org/my-plugin",
                        "bundle_url": "https://cdn.example.com/bundle.js",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["name"] == "My Plugin"
    assert data["key"] == "@my-org/my-plugin"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_create_plugin_feature_flag_disabled(mcp_server: object) -> None:
    """Returns error response when DYNAMIC_PLUGINS flag is off."""
    with patch(
        "superset.mcp_service.plugin.tool.create_plugin.is_feature_enabled",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_plugin",
                {
                    "request": {
                        "name": "My Plugin",
                        "key": "@my-org/my-plugin",
                        "bundle_url": "https://cdn.example.com/bundle.js",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "DYNAMIC_PLUGINS" in data["error"]


@pytest.mark.asyncio
async def test_create_plugin_duplicate_key(mcp_server: object) -> None:
    """IntegrityError from duplicate key is returned as structured error."""
    mock_db = MagicMock()
    mock_db.session.add = MagicMock()
    mock_db.session.commit.side_effect = IntegrityError(
        "UNIQUE constraint failed", None, None
    )

    with (
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.db",
            mock_db,
        ),
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.DynamicPlugin",
            return_value=MagicMock(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_plugin",
                {
                    "request": {
                        "name": "My Plugin",
                        "key": "@my-org/my-plugin",
                        "bundle_url": "https://cdn.example.com/bundle.js",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "already exists" in data["error"]
    mock_db.session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_create_plugin_unexpected_error_reraises(mcp_server: object) -> None:
    """Unexpected exceptions are re-raised after rollback."""
    from fastmcp.exceptions import ToolError

    mock_db = MagicMock()
    mock_db.session.commit.side_effect = RuntimeError("Unexpected DB failure")

    with (
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.db",
            mock_db,
        ),
        patch(
            "superset.mcp_service.plugin.tool.create_plugin.DynamicPlugin",
            return_value=MagicMock(),
        ),
    ):
        with pytest.raises(ToolError):
            async with Client(mcp_server) as client:
                await client.call_tool(
                    "create_plugin",
                    {
                        "request": {
                            "name": "My Plugin",
                            "key": "@my-org/my-plugin",
                            "bundle_url": "https://cdn.example.com/bundle.js",
                        }
                    },
                )

    mock_db.session.rollback.assert_called_once()


# ---------------------------------------------------------------------------
# update_plugin tool tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_plugin_success(mcp_server: object) -> None:
    """Happy path: plugin found and updated."""
    mock_plugin = MagicMock()
    mock_plugin.id = 7
    mock_plugin.name = "Updated Name"
    mock_plugin.key = "@my-org/my-plugin"
    mock_plugin.bundle_url = "https://cdn.example.com/bundle.js"

    mock_db = MagicMock()
    mock_db.session.get.return_value = mock_plugin
    mock_db.session.commit = MagicMock()

    with (
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.db",
            mock_db,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_plugin",
                {"request": {"id": 7, "name": "Updated Name"}},
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 7
    assert data["name"] == "Updated Name"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_update_plugin_feature_flag_disabled(mcp_server: object) -> None:
    """Returns error response when DYNAMIC_PLUGINS flag is off."""
    with patch(
        "superset.mcp_service.plugin.tool.update_plugin.is_feature_enabled",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_plugin",
                {"request": {"id": 1, "name": "Updated"}},
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "DYNAMIC_PLUGINS" in data["error"]


@pytest.mark.asyncio
async def test_update_plugin_not_found(mcp_server: object) -> None:
    """Returns error when plugin ID does not exist."""
    mock_db = MagicMock()
    mock_db.session.get.return_value = None

    with (
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.db",
            mock_db,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_plugin",
                {"request": {"id": 999, "name": "Updated"}},
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "No plugin found" in data["error"]
    assert "Custom Plugins" in data["error"]


@pytest.mark.asyncio
async def test_update_plugin_duplicate_field(mcp_server: object) -> None:
    """IntegrityError from conflicting update is returned as structured error."""
    mock_plugin = MagicMock()
    mock_db = MagicMock()
    mock_db.session.get.return_value = mock_plugin
    mock_db.session.commit.side_effect = IntegrityError(
        "UNIQUE constraint failed", None, None
    )

    with (
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.db",
            mock_db,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_plugin",
                {"request": {"id": 1, "name": "Duplicate Name"}},
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "already exists" in data["error"]
    mock_db.session.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_update_plugin_unexpected_error_reraises(mcp_server: object) -> None:
    """Unexpected exceptions are re-raised after rollback."""
    from fastmcp.exceptions import ToolError

    mock_db = MagicMock()
    mock_db.session.get.side_effect = RuntimeError("Session exploded")

    with (
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.plugin.tool.update_plugin.db",
            mock_db,
        ),
    ):
        with pytest.raises(ToolError):
            async with Client(mcp_server) as client:
                await client.call_tool(
                    "update_plugin",
                    {"request": {"id": 1, "name": "Test"}},
                )

    mock_db.session.rollback.assert_called_once()
