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
from superset.mcp_service.css_template.schemas import CreateCssTemplateRequest
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


def test_create_css_template_request_valid() -> None:
    req = CreateCssTemplateRequest(
        template_name="My Theme",
        css=".header { color: red; }",
    )
    assert req.template_name == "My Theme"
    assert req.css == ".header { color: red; }"


def test_create_css_template_request_strips_name_whitespace() -> None:
    req = CreateCssTemplateRequest(
        template_name="  My Theme  ",
        css=".header { color: red; }",
    )
    assert req.template_name == "My Theme"


def test_create_css_template_request_empty_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="template_name must not be empty"):
        CreateCssTemplateRequest(template_name="   ", css=".header { color: red; }")


def test_create_css_template_request_name_too_long() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateCssTemplateRequest(template_name="a" * 251, css="")


# ---------------------------------------------------------------------------
# Tool logic tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_css_template_success(mcp_server: object) -> None:
    """Happy path: template created, id and fields returned."""
    mock_template = MagicMock()
    mock_template.id = 7
    mock_template.template_name = "Dark Theme"
    mock_template.css = "body { background: #000; }"

    mock_command = MagicMock()
    mock_command.run.return_value = mock_template

    with patch(
        "superset.commands.css.create.CreateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateCssTemplateRequest(
                template_name="Dark Theme",
                css="body { background: #000; }",
            )
            result = await client.call_tool(
                "create_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 7
    assert data["template_name"] == "Dark Theme"
    assert data["css"] == "body { background: #000; }"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_create_css_template_invalid_error(mcp_server: object) -> None:
    """CssTemplateInvalidError is caught and returned as an error response."""
    from superset.commands.css.exceptions import CssTemplateInvalidError

    mock_command = MagicMock()
    mock_command.run.side_effect = CssTemplateInvalidError()

    with patch(
        "superset.commands.css.create.CreateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateCssTemplateRequest(
                template_name="Bad Template",
                css="",
            )
            result = await client.call_tool(
                "create_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_create_css_template_create_failed(mcp_server: object) -> None:
    """CssTemplateCreateFailedError is caught and returned as an error response."""
    from superset.commands.css.exceptions import CssTemplateCreateFailedError

    mock_command = MagicMock()
    mock_command.run.side_effect = CssTemplateCreateFailedError()

    with patch(
        "superset.commands.css.create.CreateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateCssTemplateRequest(
                template_name="Failing Template",
                css=".x { color: blue; }",
            )
            result = await client.call_tool(
                "create_css_template", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to create CSS template" in data["error"]


@pytest.mark.asyncio
async def test_create_css_template_unexpected_exception_is_reraised(
    mcp_server: object,
) -> None:
    """Unexpected exceptions are re-raised (not swallowed as error responses)."""
    from fastmcp.exceptions import ToolError

    mock_command = MagicMock()
    mock_command.run.side_effect = RuntimeError("unexpected database error")

    with patch(
        "superset.commands.css.create.CreateCssTemplateCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            with pytest.raises((RuntimeError, ToolError)):
                await client.call_tool(
                    "create_css_template",
                    {
                        "request": {
                            "template_name": "Theme",
                            "css": ".x { color: red; }",
                        }
                    },
                )
