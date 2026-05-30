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

from superset.mcp_service.annotation_layer.schemas import (
    CreateAnnotationLayerRequest,
)
from superset.mcp_service.app import mcp
from superset.utils import json

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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
# Schema validation tests
# ---------------------------------------------------------------------------


def test_create_annotation_layer_request_valid() -> None:
    req = CreateAnnotationLayerRequest(name="My Layer")
    assert req.name == "My Layer"
    assert req.descr is None


def test_create_annotation_layer_request_with_descr() -> None:
    req = CreateAnnotationLayerRequest(name="My Layer", descr="A description")
    assert req.name == "My Layer"
    assert req.descr == "A description"


def test_create_annotation_layer_request_empty_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateAnnotationLayerRequest(name="")


def test_create_annotation_layer_request_name_too_long() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateAnnotationLayerRequest(name="a" * 251)


def test_create_annotation_layer_request_max_name_accepted() -> None:
    req = CreateAnnotationLayerRequest(name="a" * 250)
    assert len(req.name) == 250


# ---------------------------------------------------------------------------
# Tool logic tests
# ---------------------------------------------------------------------------


def _make_mock_layer(id: int = 7, name: str = "Events", descr: str | None = None):
    layer = MagicMock()
    layer.id = id
    layer.name = name
    layer.descr = descr
    return layer


@pytest.mark.asyncio
async def test_create_annotation_layer_success(mcp_server: object) -> None:
    """Happy path: layer created, id and name returned."""
    mock_layer = _make_mock_layer(id=7, name="Events")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_layer

    with patch(
        "superset.commands.annotation_layer.create.CreateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateAnnotationLayerRequest(name="Events")
            result = await client.call_tool(
                "create_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 7
    assert data["name"] == "Events"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_create_annotation_layer_invalid_error(mcp_server: object) -> None:
    """AnnotationLayerInvalidError is caught and returned as an error response."""
    from superset.commands.annotation_layer.exceptions import (
        AnnotationLayerInvalidError,
        AnnotationLayerNameUniquenessValidationError,
    )

    invalid_exc = AnnotationLayerInvalidError()
    invalid_exc.append(AnnotationLayerNameUniquenessValidationError())
    mock_command = MagicMock()
    mock_command.run.side_effect = invalid_exc

    with patch(
        "superset.commands.annotation_layer.create.CreateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateAnnotationLayerRequest(name="Duplicate")
            result = await client.call_tool(
                "create_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_create_annotation_layer_create_failed(mcp_server: object) -> None:
    """AnnotationLayerCreateFailedError is caught and returned as an error response."""
    from superset.commands.annotation_layer.exceptions import (
        AnnotationLayerCreateFailedError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationLayerCreateFailedError()

    with patch(
        "superset.commands.annotation_layer.create.CreateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = CreateAnnotationLayerRequest(name="My Layer")
            result = await client.call_tool(
                "create_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to create annotation layer" in data["error"]
