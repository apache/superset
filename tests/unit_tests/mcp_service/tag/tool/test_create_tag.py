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
from superset.mcp_service.tag.schemas import CreateTagRequest
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
    tag_id: int = 42, name: str = "my-tag", description: str = ""
) -> MagicMock:
    tag = MagicMock()
    tag.id = tag_id
    tag.name = name
    tag.description = description
    return tag


@pytest.mark.asyncio
async def test_create_tag_success(mcp_server) -> None:
    """Happy path: tag is created and ID is returned."""
    mock_tag = _make_tag(42, "my-tag", "A test tag")

    with (
        patch(
            "superset.commands.tag.create.CreateCustomTagWithRelationshipsCommand.run",
            return_value=(set(), set()),
        ),
        patch(
            "superset.daos.tag.TagDAO.find_by_name",
            return_value=mock_tag,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_tag",
                {"request": {"name": "my-tag", "description": "A test tag"}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] == 42
    assert data["name"] == "my-tag"
    assert data["description"] == "A test tag"
    assert data["objects_tagged"] == []
    assert data["objects_skipped"] == []
    assert data["error"] is None


@pytest.mark.asyncio
async def test_create_tag_with_objects(mcp_server) -> None:
    """Tag is created and objects_tagged is populated and sorted."""
    mock_tag = _make_tag(10, "org-tag", "")

    with (
        patch(
            "superset.commands.tag.create.CreateCustomTagWithRelationshipsCommand.run",
            return_value=({("chart", 2), ("dashboard", 1)}, set()),
        ),
        patch(
            "superset.daos.tag.TagDAO.find_by_name",
            return_value=mock_tag,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_tag",
                {
                    "request": {
                        "name": "org-tag",
                        "objects_to_tag": [["chart", 2], ["dashboard", 1]],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["id"] == 10
    assert data["error"] is None
    # Response lists must be deterministically sorted
    assert data["objects_tagged"] == sorted([["chart", 2], ["dashboard", 1]])


@pytest.mark.asyncio
async def test_create_tag_objects_skipped(mcp_server) -> None:
    """Skipped objects (insufficient ownership) are reported separately."""
    mock_tag = _make_tag(7, "skip-tag", "")

    with (
        patch(
            "superset.commands.tag.create.CreateCustomTagWithRelationshipsCommand.run",
            return_value=(set(), {("chart", 5)}),
        ),
        patch(
            "superset.daos.tag.TagDAO.find_by_name",
            return_value=mock_tag,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_tag",
                {
                    "request": {
                        "name": "skip-tag",
                        "objects_to_tag": [["chart", 5]],
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["id"] == 7
    assert data["objects_tagged"] == []
    assert data["objects_skipped"] == [["chart", 5]]
    assert data["error"] is None


@pytest.mark.asyncio
async def test_create_tag_strips_whitespace_from_name(mcp_server) -> None:
    """Leading/trailing whitespace is stripped from the tag name."""
    mock_tag = _make_tag(1, "trimmed", "")

    with (
        patch(
            "superset.commands.tag.create.CreateCustomTagWithRelationshipsCommand.run",
            return_value=(set(), set()),
        ),
        patch(
            "superset.daos.tag.TagDAO.find_by_name",
            return_value=mock_tag,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_tag",
                {"request": {"name": "  trimmed  "}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] == 1
    assert data["name"] == "trimmed"


@pytest.mark.asyncio
async def test_create_tag_invalid_error_returns_structured_response(
    mcp_server,
) -> None:
    """TagInvalidError is caught and returned as a structured error."""
    from superset.commands.tag.exceptions import TagInvalidError

    with patch(
        "superset.commands.tag.create.CreateCustomTagWithRelationshipsCommand.run",
        side_effect=TagInvalidError(),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_tag",
                {"request": {"name": "bad-tag"}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_create_tag_create_failed_error_returns_structured_response(
    mcp_server,
) -> None:
    """TagCreateFailedError is caught and returned as a structured error."""
    from superset.commands.tag.exceptions import TagCreateFailedError

    with patch(
        "superset.commands.tag.create.CreateCustomTagWithRelationshipsCommand.run",
        side_effect=TagCreateFailedError(),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_tag",
                {"request": {"name": "fail-tag"}},
            )

    data = json.loads(result.content[0].text)
    assert data["id"] is None
    assert "Failed to create tag" in data["error"]


def test_create_tag_request_rejects_blank_name() -> None:
    """Schema validation rejects whitespace-only names."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateTagRequest(name="   ")


def test_create_tag_request_rejects_invalid_object_id() -> None:
    """Schema validation rejects object IDs less than 1."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateTagRequest(name="valid", objects_to_tag=[("chart", 0)])


def test_create_tag_request_rejects_negative_object_id() -> None:
    """Schema validation rejects negative object IDs."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CreateTagRequest(name="valid", objects_to_tag=[("dashboard", -1)])
