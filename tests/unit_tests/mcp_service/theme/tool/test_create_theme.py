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

from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.theme.schemas import CreateThemeRequest
from superset.utils import json


@pytest.fixture()
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    from unittest.mock import Mock, patch as _patch

    with _patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


# ---------------------------------------------------------------------------
# Schema tests
# ---------------------------------------------------------------------------


def test_create_theme_request_string_json_data() -> None:
    req = CreateThemeRequest(
        theme_name="Blue Theme",
        json_data='{"token": {"colorPrimary": "#1677ff"}}',
    )
    assert req.theme_name == "Blue Theme"
    assert '"colorPrimary"' in req.json_data


def test_create_theme_request_dict_json_data() -> None:
    """json_data accepts a native dict and serializes it to a JSON string."""
    req = CreateThemeRequest(
        theme_name="Blue Theme",
        json_data={"token": {"colorPrimary": "#1677ff"}},
    )
    assert isinstance(req.json_data, str)
    parsed = json.loads(req.json_data)
    assert parsed["token"]["colorPrimary"] == "#1677ff"


def test_create_theme_request_missing_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateThemeRequest(json_data='{"token": {}}')


def test_create_theme_request_missing_json_data_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateThemeRequest(theme_name="My Theme")


# ---------------------------------------------------------------------------
# Tool logic tests
# ---------------------------------------------------------------------------


def _make_mock_theme(id: int = 42, theme_name: str = "Blue Theme") -> MagicMock:
    theme = MagicMock()
    theme.id = id
    theme.theme_name = theme_name
    theme.json_data = '{"token": {"colorPrimary": "#1677ff"}}'
    return theme


@pytest.mark.asyncio()
async def test_create_theme_success(mcp_server: object) -> None:
    """Happy path: theme created and ID returned."""
    mock_theme = _make_mock_theme()

    with (
        patch("superset.mcp_service.theme.tool.create_theme.db") as mock_db,
        patch(
            "superset.mcp_service.theme.tool.create_theme.Theme",
            return_value=mock_theme,
        ),
    ):
        mock_db.session.flush = MagicMock()

        async with Client(mcp_server) as client:
            request = CreateThemeRequest(
                theme_name="Blue Theme",
                json_data='{"token": {"colorPrimary": "#1677ff"}}',
            )
            result = await client.call_tool(
                "create_theme", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["theme_name"] == "Blue Theme"
    assert data["error"] is None


@pytest.mark.asyncio()
async def test_create_theme_with_dict_json_data(mcp_server: object) -> None:
    """Tool accepts json_data as a dict (native object) from LLM clients."""
    mock_theme = _make_mock_theme()

    with (
        patch("superset.mcp_service.theme.tool.create_theme.db") as mock_db,
        patch(
            "superset.mcp_service.theme.tool.create_theme.Theme",
            return_value=mock_theme,
        ),
    ):
        mock_db.session.flush = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_theme",
                {
                    "request": {
                        "theme_name": "Blue Theme",
                        "json_data": {"token": {"colorPrimary": "#1677ff"}},
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["error"] is None


@pytest.mark.asyncio()
async def test_create_theme_validation_error_empty_name(mcp_server: object) -> None:
    """Empty theme name is caught by ThemePostSchema and returned as error."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "create_theme",
            {
                "request": {
                    "theme_name": "   ",
                    "json_data": '{"token": {}}',
                }
            },
        )
        data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "empty" in str(data["error"]).lower()


@pytest.mark.asyncio()
async def test_create_theme_validation_error_invalid_json(mcp_server: object) -> None:
    """Malformed json_data string is caught by ThemePostSchema."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "create_theme",
            {
                "request": {
                    "theme_name": "Test",
                    "json_data": "not-valid-json{{{",
                }
            },
        )
        data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
