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
from superset.mcp_service.tag.schemas import UpdateTagRequest
from superset.utils import json


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests in this module."""
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_tag(
    tag_id: int = 42, name: str = "my-tag", description: str = "", objects=None
) -> MagicMock:
    tag = MagicMock()
    tag.id = tag_id
    tag.name = name
    tag.description = description
    tag.objects = objects or []
    return tag


@pytest.mark.asyncio
async def test_update_tag_success(mcp_server) -> None:
    """Happy path: tag name is updated and new values are returned."""
    existing = _make_tag(42, "old-name", "old description")
    updated = _make_tag(42, "new-name", "old description")

    with (
        patch("superset.daos.tag.TagDAO.find_by_id", return_value=existing),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.run",
            return_value=updated,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_tag",
                {"request": {"id": 42, "name": "new-name"}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] == 42
    assert data["name"] == "new-name"
    assert data["description"] == "old description"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_update_tag_description_only(mcp_server) -> None:
    """Only the description is updated; name stays unchanged."""
    existing = _make_tag(10, "stable-name", "old desc")
    updated = _make_tag(10, "stable-name", "new desc")

    with (
        patch("superset.daos.tag.TagDAO.find_by_id", return_value=existing),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.run",
            return_value=updated,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_tag",
                {"request": {"id": 10, "description": "new desc"}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] == 10
    assert data["name"] == "stable-name"
    assert data["description"] == "new desc"
    assert data["error"] is None


@pytest.mark.asyncio
async def test_update_tag_preserves_existing_name_when_not_provided(
    mcp_server,
) -> None:
    """When name is omitted, the command receives the existing name as fallback."""

    existing = _make_tag(5, "keep-this-name", "some desc")
    updated = _make_tag(5, "keep-this-name", "some desc")

    with (
        patch("superset.daos.tag.TagDAO.find_by_id", return_value=existing),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.run",
            return_value=updated,
        ),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.__init__",
            return_value=None,
        ) as mock_init,
    ):
        async with Client(mcp_server) as client:
            await client.call_tool(
                "update_tag",
                {"request": {"id": 5}},
            )

    # Verify the command was initialised with name="keep-this-name"
    init_args = mock_init.call_args
    properties = init_args[0][1]  # second positional arg is the properties dict
    assert properties["name"] == "keep-this-name"


@pytest.mark.asyncio
async def test_update_tag_preserves_objects(mcp_server) -> None:
    """Existing object associations are passed to the command to avoid clearing them."""
    obj1 = MagicMock()
    obj1.object_type = MagicMock()
    obj1.object_type.name = "chart"
    obj1.object_id = 3

    obj2 = MagicMock()
    obj2.object_type = MagicMock()
    obj2.object_type.name = "dashboard"
    obj2.object_id = 7

    existing = _make_tag(1, "tagged", "", objects=[obj1, obj2])
    updated = _make_tag(1, "tagged", "")

    with (
        patch("superset.daos.tag.TagDAO.find_by_id", return_value=existing),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.run",
            return_value=updated,
        ),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.__init__",
            return_value=None,
        ) as mock_init,
    ):
        async with Client(mcp_server) as client:
            await client.call_tool(
                "update_tag",
                {"request": {"id": 1, "name": "tagged"}},
            )

    properties = mock_init.call_args[0][1]
    assert sorted(properties["objects_to_tag"]) == sorted(
        [("chart", 3), ("dashboard", 7)]
    )


@pytest.mark.asyncio
async def test_update_tag_not_found_returns_structured_response(mcp_server) -> None:
    """When the tag does not exist, a structured error is returned."""
    with patch("superset.daos.tag.TagDAO.find_by_id", return_value=None):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_tag",
                {"request": {"id": 999}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] is None
    assert data["error"] is not None
    assert "999" in data["error"]


@pytest.mark.asyncio
async def test_update_tag_invalid_error_returns_structured_response(
    mcp_server,
) -> None:
    """TagInvalidError is caught and returned as a structured error."""
    from superset.commands.tag.exceptions import TagInvalidError

    existing = _make_tag(20, "valid-tag", "")

    with (
        patch("superset.daos.tag.TagDAO.find_by_id", return_value=existing),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.run",
            side_effect=TagInvalidError(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_tag",
                {"request": {"id": 20, "name": "new-name"}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_update_tag_not_found_error_from_command(mcp_server) -> None:
    """TagNotFoundError raised by the command is caught as a structured error."""
    from superset.commands.tag.exceptions import TagNotFoundError

    existing = _make_tag(30, "race-tag", "")

    with (
        patch("superset.daos.tag.TagDAO.find_by_id", return_value=existing),
        patch(
            "superset.commands.tag.update.UpdateTagCommand.run",
            side_effect=TagNotFoundError(),
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_tag",
                {"request": {"id": 30}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] is None
    assert data["error"] is not None


def test_update_tag_request_rejects_blank_name() -> None:
    """Schema validation rejects whitespace-only names."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UpdateTagRequest(id=1, name="   ")


def test_update_tag_request_allows_none_name() -> None:
    """Schema allows name=None (means 'keep existing')."""
    req = UpdateTagRequest(id=1, name=None)
    assert req.name is None


def test_update_tag_request_strips_whitespace_from_name() -> None:
    """Leading/trailing whitespace is stripped from name."""
    req = UpdateTagRequest(id=1, name="  trimmed  ")
    assert req.name == "trimmed"
