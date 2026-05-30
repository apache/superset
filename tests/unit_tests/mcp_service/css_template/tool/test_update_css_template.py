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

from superset.mcp_service.app import mcp
from superset.mcp_service.css_template.schemas import UpdateCssTemplateRequest
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=Mock(is_authenticated=True),
    ):
        yield


# ---------------------------------------------------------------------------
# Schema tests
# ---------------------------------------------------------------------------


def test_update_css_template_request_valid_name_only() -> None:
    req = UpdateCssTemplateRequest(id=1, template_name="New Name")
    assert req.id == 1
    assert req.template_name == "New Name"
    assert req.css is None


def test_update_css_template_request_valid_css_only() -> None:
    req = UpdateCssTemplateRequest(id=5, css=".body { color: blue; }")
    assert req.id == 5
    assert req.css == ".body { color: blue; }"
    assert req.template_name is None


def test_update_css_template_request_strips_name_whitespace() -> None:
    req = UpdateCssTemplateRequest(id=1, template_name="  Padded  ")
    assert req.template_name == "Padded"


def test_update_css_template_request_empty_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="template_name must not be empty"):
        UpdateCssTemplateRequest(id=1, template_name="   ")


def test_update_css_template_request_name_too_long() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UpdateCssTemplateRequest(id=1, template_name="x" * 251)


# ---------------------------------------------------------------------------
# Tool logic tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_css_template_success(mcp_server: object) -> None:
    """Happy path: template updated, all fields returned."""
    mock_template = MagicMock()
    mock_template.id = 3
    mock_template.template_name = "Updated Theme"
    mock_template.css = "body { background: #fff; }"

    mock_command = MagicMock()
    mock_command.run.return_value = mock_template

    with patch(
        "superset.commands.css.update.UpdateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateCssTemplateRequest(
                id=3,
                template_name="Updated Theme",
                css="body { background: #fff; }",
            )
            result = await client.call_tool(
                "update_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 3
    assert data["template_name"] == "Updated Theme"
    assert data["css"] == "body { background: #fff; }"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_update_css_template_no_fields_returns_error(
    mcp_server: object,
) -> None:
    """Calling with neither template_name nor css returns a structured error."""
    async with Client(mcp_server) as client:
        result = await client.call_tool("update_css_template", {"request": {"id": 1}})
        data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert "At least one" in data["error"]


@pytest.mark.asyncio
async def test_update_css_template_not_found(mcp_server: object) -> None:
    """CssTemplateNotFoundError is caught and returned as an error response."""
    from superset.commands.css.exceptions import CssTemplateNotFoundError

    mock_command = MagicMock()
    mock_command.run.side_effect = CssTemplateNotFoundError()

    with patch(
        "superset.commands.css.update.UpdateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateCssTemplateRequest(id=999, template_name="Ghost")
            result = await client.call_tool(
                "update_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert "not found" in data["error"]


@pytest.mark.asyncio
async def test_update_css_template_invalid_error(mcp_server: object) -> None:
    """CssTemplateInvalidError is caught and returned as an error response."""
    from superset.commands.css.exceptions import CssTemplateInvalidError

    mock_command = MagicMock()
    mock_command.run.side_effect = CssTemplateInvalidError()

    with patch(
        "superset.commands.css.update.UpdateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateCssTemplateRequest(id=1, template_name="Valid Name")
            result = await client.call_tool(
                "update_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_update_css_template_update_failed(mcp_server: object) -> None:
    """CssTemplateUpdateFailedError is caught and returned as an error response."""
    from superset.commands.css.exceptions import CssTemplateUpdateFailedError

    mock_command = MagicMock()
    mock_command.run.side_effect = CssTemplateUpdateFailedError()

    with patch(
        "superset.commands.css.update.UpdateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateCssTemplateRequest(id=1, css=".x { color: red; }")
            result = await client.call_tool(
                "update_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert "Failed to update CSS template" in data["error"]


@pytest.mark.asyncio
async def test_update_css_template_unexpected_exception_is_reraised(
    mcp_server: object,
) -> None:
    """Unexpected exceptions are re-raised (not swallowed as error responses)."""
    from fastmcp.exceptions import ToolError

    mock_command = MagicMock()
    mock_command.run.side_effect = RuntimeError("unexpected database error")

    with patch(
        "superset.commands.css.update.UpdateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            with pytest.raises((RuntimeError, ToolError)):
                await client.call_tool(
                    "update_css_template",
                    {"request": {"id": 1, "css": ".x { color: red; }"}},
                )
