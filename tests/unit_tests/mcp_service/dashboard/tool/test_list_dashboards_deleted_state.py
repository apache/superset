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

"""Unit tests for list_dashboards ``deleted_state`` trash listing.

Mirrors the list_charts deleted_state tests: DAO custom filter pass-through,
session-scoped visibility bypass around the DAO call, and ``deleted_at``
forced into loaded columns and the serialized response.
"""

from collections.abc import Iterator
from datetime import datetime
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json

_DAO_LIST = "superset.daos.dashboard.DashboardDAO.list"
_BYPASS = "superset.mcp_service.mcp_core.skip_visibility_filter"


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _trashed_dashboard_row() -> Mock:
    row = Mock(
        spec=[
            "id",
            "dashboard_title",
            "slug",
            "published",
            "changed_on",
            "created_on",
            "uuid",
            "deleted_at",
        ]
    )
    row.id = 1
    row.dashboard_title = "Trashed Dashboard"
    row.slug = None
    row.published = False
    row.changed_on = datetime(2026, 6, 1)
    row.created_on = datetime(2026, 5, 1)
    row.uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    row.deleted_at = datetime(2026, 7, 1)
    return row


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_dashboards_deleted_state_only_passes_custom_filter(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool(
            "list_dashboards", {"request": {"deleted_state": "only"}}
        )

    kwargs = mock_list.call_args.kwargs
    assert "deleted_state" in (kwargs.get("custom_filters") or {})
    assert "deleted_at" in kwargs["columns"]


@patch(_BYPASS)
@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_dashboards_deleted_state_wraps_visibility_bypass(
    mock_list: Mock, mock_bypass: MagicMock, mcp_server: object
) -> None:
    from superset.models.dashboard import Dashboard

    mock_list.return_value = ([], 0)
    mock_bypass.return_value.__enter__ = Mock(return_value=None)
    mock_bypass.return_value.__exit__ = Mock(return_value=False)

    async with Client(mcp_server) as client:
        await client.call_tool(
            "list_dashboards", {"request": {"deleted_state": "include"}}
        )

    mock_bypass.assert_called_once()
    assert Dashboard in mock_bypass.call_args.args


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_dashboards_deleted_state_serializes_deleted_at(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([_trashed_dashboard_row()], 1)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_dashboards", {"request": {"deleted_state": "only"}}
        )

    data = json.loads(result.content[0].text)
    assert data["dashboards"][0]["id"] == 1
    assert data["dashboards"][0]["deleted_at"] is not None
    assert "deleted_at" in data["columns_loaded"]


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_dashboards_default_has_no_deleted_state_filter(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_dashboards", {})

    kwargs = mock_list.call_args.kwargs
    assert not kwargs.get("custom_filters")


@patch(_BYPASS)
@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_dashboards_no_deleted_state_no_visibility_bypass(
    mock_list: Mock, mock_bypass: MagicMock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_dashboards", {})

    mock_bypass.assert_not_called()


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_dashboards_deleted_state_invalid_value_rejected(
    mock_list: Mock, mcp_server: object
) -> None:
    from fastmcp.exceptions import ToolError

    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool(
                "list_dashboards", {"request": {"deleted_state": "everything"}}
            )
