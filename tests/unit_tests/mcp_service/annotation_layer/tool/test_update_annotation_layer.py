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
    UpdateAnnotationLayerRequest,
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


def test_update_annotation_layer_request_valid() -> None:
    req = UpdateAnnotationLayerRequest(id=1, name="New Name")
    assert req.id == 1
    assert req.name == "New Name"
    assert req.descr is None


def test_update_annotation_layer_request_descr_only() -> None:
    req = UpdateAnnotationLayerRequest(id=5, descr="Updated description")
    assert req.id == 5
    assert req.name is None
    assert req.descr == "Updated description"


def test_update_annotation_layer_request_name_too_long() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UpdateAnnotationLayerRequest(id=1, name="a" * 251)


def test_update_annotation_layer_request_empty_name_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UpdateAnnotationLayerRequest(id=1, name="")


def test_update_annotation_layer_request_max_name_accepted() -> None:
    req = UpdateAnnotationLayerRequest(id=1, name="a" * 250)
    assert req.name is not None
    assert len(req.name) == 250


def test_update_annotation_layer_request_no_fields_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UpdateAnnotationLayerRequest(id=1)


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
async def test_update_annotation_layer_success(mcp_server: object) -> None:
    """Happy path: layer updated, id and name returned."""
    mock_layer = _make_mock_layer(id=7, name="Renamed Layer")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_layer

    with patch(
        "superset.commands.annotation_layer.update.UpdateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateAnnotationLayerRequest(id=7, name="Renamed Layer")
            result = await client.call_tool(
                "update_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 7
    assert data["name"] == "Renamed Layer"
    assert data["descr"] is None
    assert data["error"] is None


@pytest.mark.asyncio
async def test_update_annotation_layer_not_found(mcp_server: object) -> None:
    """AnnotationLayerNotFoundError is caught and returned as an error response."""
    from superset.commands.annotation_layer.exceptions import (
        AnnotationLayerNotFoundError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationLayerNotFoundError()

    with patch(
        "superset.commands.annotation_layer.update.UpdateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateAnnotationLayerRequest(id=999, name="Ghost")
            result = await client.call_tool(
                "update_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_update_annotation_layer_invalid_error(mcp_server: object) -> None:
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
        "superset.commands.annotation_layer.update.UpdateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateAnnotationLayerRequest(id=7, name="Duplicate")
            result = await client.call_tool(
                "update_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_update_annotation_layer_update_failed(mcp_server: object) -> None:
    """AnnotationLayerUpdateFailedError is caught and returned as an error response."""
    from superset.commands.annotation_layer.exceptions import (
        AnnotationLayerUpdateFailedError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationLayerUpdateFailedError()

    with patch(
        "superset.commands.annotation_layer.update.UpdateAnnotationLayerCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = UpdateAnnotationLayerRequest(id=7, name="My Layer")
            result = await client.call_tool(
                "update_annotation_layer", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to update annotation layer" in data["error"]
