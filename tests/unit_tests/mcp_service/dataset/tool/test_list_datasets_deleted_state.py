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

"""Unit tests for list_datasets ``deleted_state`` trash listing.

The deleted_state param opts the list query into surfacing soft-deleted
datasets: the session-scoped visibility bypass wraps the DAO call, the REST
``DatasetDeletedStateFilter`` (which owns the restore-audience scoping) is
passed through as a DAO custom filter, and ``deleted_at`` is forced into the
loaded columns so trashed rows are distinguishable in the response.
"""

import importlib
from collections.abc import Iterator
from datetime import datetime
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.app import mcp
from superset.utils import json

_DAO_LIST = "superset.daos.dataset.DatasetDAO.list"
_BYPASS = "superset.mcp_service.mcp_core.skip_visibility_filter"

list_datasets_module = importlib.import_module(
    "superset.mcp_service.dataset.tool.list_datasets"
)


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


@pytest.fixture(autouse=True)
def allow_data_model_metadata() -> Iterator[None]:
    """Keep the tests on the metadata-allowed path; privacy gating is covered
    in test_dataset_tools."""
    with patch.object(
        list_datasets_module, "user_can_view_data_model_metadata", return_value=True
    ):
        yield


def _trashed_dataset_row() -> Mock:
    row = Mock(
        spec=[
            "id",
            "table_name",
            "schema",
            "changed_on",
            "created_on",
            "uuid",
            "deleted_at",
        ]
    )
    row.id = 10
    row.table_name = "trashed_orders"
    row.schema = "public"
    row.changed_on = datetime(2026, 6, 1)
    row.created_on = datetime(2026, 5, 1)
    row.uuid = UUID("11111111-2222-3333-4444-555555555555")
    row.deleted_at = datetime(2026, 7, 1)
    return row


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_deleted_state_only_passes_custom_filter(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_datasets", {"request": {"deleted_state": "only"}})

    kwargs = mock_list.call_args.kwargs
    assert "deleted_state" in (kwargs.get("custom_filters") or {})
    assert "deleted_at" in kwargs["columns"]


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_deleted_state_combines_with_certified(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool(
            "list_datasets",
            {"request": {"deleted_state": "include", "certified": True}},
        )

    custom_filters = mock_list.call_args.kwargs.get("custom_filters") or {}
    assert {"deleted_state", "certified"} <= set(custom_filters)


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_default_has_no_deleted_state_filter(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_datasets", {})

    kwargs = mock_list.call_args.kwargs
    assert "deleted_state" not in (kwargs.get("custom_filters") or {})


@patch(_BYPASS)
@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_deleted_state_wraps_visibility_bypass(
    mock_list: Mock, mock_bypass: MagicMock, mcp_server: object
) -> None:
    from superset.connectors.sqla.models import SqlaTable

    mock_list.return_value = ([], 0)
    mock_bypass.return_value.__enter__ = Mock(return_value=None)
    mock_bypass.return_value.__exit__ = Mock(return_value=False)

    async with Client(mcp_server) as client:
        await client.call_tool(
            "list_datasets", {"request": {"deleted_state": "include"}}
        )

    mock_bypass.assert_called_once()
    assert SqlaTable in mock_bypass.call_args.args


@patch(_BYPASS)
@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_no_deleted_state_no_visibility_bypass(
    mock_list: Mock, mock_bypass: MagicMock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        await client.call_tool("list_datasets", {})

    mock_bypass.assert_not_called()


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_deleted_state_serializes_deleted_at(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([_trashed_dataset_row()], 1)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_datasets", {"request": {"deleted_state": "only"}}
        )

    data = json.loads(result.content[0].text)
    assert data["datasets"][0]["id"] == 10
    assert data["datasets"][0]["deleted_at"] is not None
    assert "deleted_at" in data["columns_loaded"]


@patch(_DAO_LIST)
@pytest.mark.asyncio
async def test_list_datasets_deleted_state_invalid_value_rejected(
    mock_list: Mock, mcp_server: object
) -> None:
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool(
                "list_datasets", {"request": {"deleted_state": "everything"}}
            )
