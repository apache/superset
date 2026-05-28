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

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.annotation_layer.schemas import (
    CreateLayerAnnotationRequest,
)
from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_request(**kwargs) -> CreateLayerAnnotationRequest:
    defaults = {
        "layer_id": 1,
        "short_descr": "Deploy v2.0",
        "start_dttm": datetime(2024, 1, 15, 8, 0, tzinfo=timezone.utc),
        "end_dttm": datetime(2024, 1, 15, 9, 0, tzinfo=timezone.utc),
    }
    defaults.update(kwargs)
    return CreateLayerAnnotationRequest(**defaults)


def _make_mock_annotation(
    id: int = 42,
    short_descr: str = "Deploy v2.0",
    long_descr: str | None = None,
) -> MagicMock:
    annotation = MagicMock()
    annotation.id = id
    annotation.short_descr = short_descr
    annotation.long_descr = long_descr
    annotation.start_dttm = datetime(2024, 1, 15, 8, 0, tzinfo=timezone.utc)
    annotation.end_dttm = datetime(2024, 1, 15, 9, 0, tzinfo=timezone.utc)
    return annotation


# --- Schema tests ---


def test_request_valid() -> None:
    req = _make_request()
    assert req.layer_id == 1
    assert req.short_descr == "Deploy v2.0"
    assert req.long_descr is None
    assert req.json_metadata is None


def test_request_short_descr_too_long() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        _make_request(short_descr="x" * 501)


def test_request_end_before_start_is_allowed_at_schema_level() -> None:
    # Date ordering is enforced by the command, not the Pydantic schema
    req = _make_request(
        start_dttm=datetime(2024, 1, 15, 10, 0),
        end_dttm=datetime(2024, 1, 15, 8, 0),
    )
    assert req.start_dttm > req.end_dttm


def test_request_invalid_json_metadata_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="json_metadata must be valid JSON"):
        _make_request(json_metadata="not-json{")


def test_request_valid_json_metadata() -> None:
    req = _make_request(json_metadata='{"key": "value"}')
    assert req.json_metadata == '{"key": "value"}'


# --- Tool logic tests ---


@pytest.mark.asyncio
async def test_create_layer_annotation_success(mcp_server: object) -> None:
    """Happy path: annotation created, id and fields returned."""
    mock_annotation = _make_mock_annotation(id=42, short_descr="Deploy v2.0")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_annotation

    with patch(
        "superset.commands.annotation_layer.annotation.create.CreateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_request()
            result = await client.call_tool(
                "create_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["layer_id"] == 1
    assert data["short_descr"] == "Deploy v2.0"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_create_layer_annotation_layer_not_found(mcp_server: object) -> None:
    """AnnotationLayerNotFoundError returns structured error response."""
    from superset.commands.annotation_layer.exceptions import (
        AnnotationLayerNotFoundError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationLayerNotFoundError()

    with patch(
        "superset.commands.annotation_layer.annotation.create.CreateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_request(layer_id=999)
            result = await client.call_tool(
                "create_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["layer_id"] == 999
    assert data["error"] is not None
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_create_layer_annotation_invalid_error(mcp_server: object) -> None:
    """AnnotationInvalidError (e.g. duplicate short_descr) returns structured error."""
    from superset.commands.annotation_layer.annotation.exceptions import (
        AnnotationInvalidError,
        AnnotationUniquenessValidationError,
    )

    invalid_exc = AnnotationInvalidError()
    invalid_exc.append(AnnotationUniquenessValidationError())
    mock_command = MagicMock()
    mock_command.run.side_effect = invalid_exc

    with patch(
        "superset.commands.annotation_layer.annotation.create.CreateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_request()
            result = await client.call_tool(
                "create_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_create_layer_annotation_create_failed(mcp_server: object) -> None:
    """AnnotationCreateFailedError is caught and returned as error response."""
    from superset.commands.annotation_layer.annotation.exceptions import (
        AnnotationCreateFailedError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationCreateFailedError()

    with patch(
        "superset.commands.annotation_layer.annotation.create.CreateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_request()
            result = await client.call_tool(
                "create_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to create annotation" in data["error"]


@pytest.mark.asyncio
async def test_create_layer_annotation_optional_fields_forwarded(
    mcp_server: object,
) -> None:
    """long_descr and json_metadata are forwarded to CreateAnnotationCommand."""
    mock_annotation = _make_mock_annotation(
        id=5, short_descr="Outage", long_descr="DB connectivity lost"
    )
    mock_command_instance = MagicMock()
    mock_command_instance.run.return_value = mock_annotation
    mock_command_cls = MagicMock(return_value=mock_command_instance)

    with patch(
        "superset.commands.annotation_layer.annotation.create.CreateAnnotationCommand",
        mock_command_cls,
    ):
        async with Client(mcp_server) as client:
            request = _make_request(
                short_descr="Outage",
                long_descr="DB connectivity lost",
                json_metadata='{"severity": "high"}',
            )
            await client.call_tool(
                "create_layer_annotation", {"request": request.model_dump()}
            )

    props = mock_command_cls.call_args[0][0]
    assert props["long_descr"] == "DB connectivity lost"
    assert props["json_metadata"] == '{"severity": "high"}'


# ---------------------------------------------------------------------------
# update_layer_annotation tests
# ---------------------------------------------------------------------------


from superset.mcp_service.annotation_layer.schemas import (  # noqa: E402
    UpdateLayerAnnotationRequest,
)


def _make_update_request(**kwargs) -> UpdateLayerAnnotationRequest:
    defaults: dict[str, object] = {
        "layer_id": 1,
        "annotation_id": 42,
    }
    defaults.update(kwargs)
    return UpdateLayerAnnotationRequest(**defaults)


# --- Schema tests ---


def test_update_request_valid() -> None:
    req = _make_update_request()
    assert req.layer_id == 1
    assert req.annotation_id == 42
    assert req.short_descr is None


def test_update_request_short_descr_too_long() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        _make_update_request(short_descr="x" * 501)


def test_update_request_invalid_json_metadata_fails() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="json_metadata must be valid JSON"):
        _make_update_request(json_metadata="not-json{")


def test_update_request_valid_json_metadata() -> None:
    req = _make_update_request(json_metadata='{"key": "value"}')
    assert req.json_metadata == '{"key": "value"}'


# --- Tool logic tests ---


@pytest.mark.asyncio
async def test_update_layer_annotation_success(mcp_server: object) -> None:
    """Happy path: annotation updated, id and fields returned."""
    mock_annotation = _make_mock_annotation(id=42, short_descr="Fixed title")
    mock_command = MagicMock()
    mock_command.run.return_value = mock_annotation

    with patch(
        "superset.commands.annotation_layer.annotation.update.UpdateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_update_request(short_descr="Fixed title")
            result = await client.call_tool(
                "update_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["layer_id"] == 1
    assert data["short_descr"] == "Fixed title"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_update_layer_annotation_not_found(mcp_server: object) -> None:
    """AnnotationNotFoundError returns structured error response."""
    from superset.commands.annotation_layer.annotation.exceptions import (
        AnnotationNotFoundError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationNotFoundError()

    with patch(
        "superset.commands.annotation_layer.annotation.update.UpdateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_update_request(annotation_id=999)
            result = await client.call_tool(
                "update_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_update_layer_annotation_layer_not_found(mcp_server: object) -> None:
    """AnnotationLayerNotFoundError returns structured error response."""
    from superset.commands.annotation_layer.exceptions import (
        AnnotationLayerNotFoundError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationLayerNotFoundError()

    with patch(
        "superset.commands.annotation_layer.annotation.update.UpdateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_update_request(layer_id=999)
            result = await client.call_tool(
                "update_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_update_layer_annotation_invalid_error(mcp_server: object) -> None:
    """AnnotationInvalidError (e.g. duplicate short_descr) returns structured error."""
    from superset.commands.annotation_layer.annotation.exceptions import (
        AnnotationInvalidError,
        AnnotationUniquenessValidationError,
    )

    invalid_exc = AnnotationInvalidError()
    invalid_exc.append(AnnotationUniquenessValidationError())
    mock_command = MagicMock()
    mock_command.run.side_effect = invalid_exc

    with patch(
        "superset.commands.annotation_layer.annotation.update.UpdateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_update_request(short_descr="Duplicate")
            result = await client.call_tool(
                "update_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_update_layer_annotation_update_failed(mcp_server: object) -> None:
    """AnnotationUpdateFailedError is caught and returned as error response."""
    from superset.commands.annotation_layer.annotation.exceptions import (
        AnnotationUpdateFailedError,
    )

    mock_command = MagicMock()
    mock_command.run.side_effect = AnnotationUpdateFailedError()

    with patch(
        "superset.commands.annotation_layer.annotation.update.UpdateAnnotationCommand",
        return_value=mock_command,
    ):
        async with Client(mcp_server) as client:
            request = _make_update_request()
            result = await client.call_tool(
                "update_layer_annotation", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

    assert data["id"] is None
    assert data["error"] is not None
    assert "Failed to update annotation" in data["error"]


@pytest.mark.asyncio
async def test_update_layer_annotation_only_provided_fields_forwarded(
    mcp_server: object,
) -> None:
    """Only non-None fields are forwarded to UpdateAnnotationCommand."""
    mock_annotation = _make_mock_annotation(id=42)
    mock_command_instance = MagicMock()
    mock_command_instance.run.return_value = mock_annotation
    mock_command_cls = MagicMock(return_value=mock_command_instance)

    with patch(
        "superset.commands.annotation_layer.annotation.update.UpdateAnnotationCommand",
        mock_command_cls,
    ):
        async with Client(mcp_server) as client:
            request = _make_update_request(
                short_descr="New title",
                long_descr="Updated description",
            )
            await client.call_tool(
                "update_layer_annotation", {"request": request.model_dump()}
            )

    # annotation_id is the first positional arg, properties is the second
    call_args = mock_command_cls.call_args
    annotation_id_arg = call_args[0][0]
    props = call_args[0][1]

    assert annotation_id_arg == 42
    assert props["short_descr"] == "New title"
    assert props["long_descr"] == "Updated description"
    # Fields not provided should not be in properties
    assert "start_dttm" not in props
    assert "end_dttm" not in props
    assert "json_metadata" not in props
