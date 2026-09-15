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

"""Unit tests for the delete_dataset MCP tool.

Run through the async MCP Client (not direct calls); auth is mocked via the
autouse mock_auth fixture, matching the other dataset tool test files.
"""

from collections.abc import Iterator
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp

_RESOLVE = "superset.mcp_service.dataset.tool.delete_dataset.resolve_dataset"
_COUNT = "superset.mcp_service.dataset.tool.delete_dataset._count_affected_objects"
_RUN = "superset.commands.dataset.delete.DeleteDatasetCommand.run"
_FLAG = "superset.mcp_service.dataset.tool.delete_dataset.is_feature_enabled"


@pytest.fixture
def mcp_server() -> object:
    """Provide the FastMCP app instance under test."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Authenticate every tool call as a mock admin user."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _mock_dataset(dataset_id: int = 10, table_name: str = "orders") -> Mock:
    """Build a minimal dataset stand-in with the attributes the tool reads."""
    dataset = Mock()
    dataset.id = dataset_id
    dataset.table_name = table_name
    return dataset


@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_not_found(mock_resolve: Mock, mcp_server: object) -> None:
    mock_resolve.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 999}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "999" in (content["error"] or "")


@patch(_COUNT, return_value=(0, 0))
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_success(
    mock_resolve: Mock, mock_run: Mock, mock_count: Mock, mcp_server: object
) -> None:
    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_run.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["deleted_id"] == 10
    assert "orders" in content["deleted_name"]
    assert content["permission_denied"] is False
    assert content["affected_chart_count"] == 0
    mock_run.assert_called_once()
    mock_count.assert_called_once_with(10)


@patch(_COUNT, return_value=(0, 0))
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_by_uuid(
    mock_resolve: Mock, mock_run: Mock, mock_count: Mock, mcp_server: object
) -> None:
    uuid = "11111111-2222-3333-4444-555555555555"
    mock_resolve.return_value = _mock_dataset(dataset_id=10)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": uuid}}
        )

    assert result.structured_content["success"] is True
    mock_resolve.assert_called_once_with(uuid)


@patch(_COUNT, return_value=(0, 0))
@patch(_FLAG)
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_soft_delete_reports_restorable(
    mock_resolve: Mock,
    mock_run: Mock,
    mock_flag: Mock,
    mock_count: Mock,
    mcp_server: object,
) -> None:
    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_run.return_value = None
    mock_flag.side_effect = lambda flag: flag == "SOFT_DELETE"

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["soft_deleted"] is True
    assert "restor" in (content["message"] or "").lower()


@patch(_COUNT, return_value=(0, 0))
@patch(_FLAG)
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_hard_delete_reports_permanent(
    mock_resolve: Mock,
    mock_run: Mock,
    mock_flag: Mock,
    mock_count: Mock,
    mcp_server: object,
) -> None:
    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_run.return_value = None
    mock_flag.return_value = False

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["soft_deleted"] is False
    assert "permanent" in (content["message"] or "").lower()


@patch(_COUNT, return_value=(3, 2))
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_reports_affected_charts(
    mock_resolve: Mock, mock_run: Mock, mock_count: Mock, mcp_server: object
) -> None:
    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["affected_chart_count"] == 3
    assert content["affected_dashboard_count"] == 2
    assert "3 chart(s)" in (content["message"] or "")


def test_count_affected_objects_only_counts_accessible() -> None:
    """Counts must not disclose charts/dashboards the caller cannot access."""
    from superset.mcp_service.dataset.tool.delete_dataset import (
        _count_affected_objects,
    )

    visible_chart, hidden_chart = Mock(), Mock()
    visible_dashboard, hidden_dashboard = Mock(), Mock()
    security_manager = Mock()
    security_manager.can_access_chart.side_effect = lambda c: c is visible_chart
    security_manager.can_access_dashboard.side_effect = lambda d: d is visible_dashboard

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.get_related_objects",
            return_value={
                "charts": [visible_chart, hidden_chart],
                "dashboards": [visible_dashboard, hidden_dashboard],
            },
        ) as mock_related,
        patch("superset.security_manager", security_manager),
    ):
        assert _count_affected_objects(10) == (1, 1)

    mock_related.assert_called_once_with(10)


@patch(_COUNT, return_value=(0, 0))
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_permission_denied(
    mock_resolve: Mock, mock_run: Mock, mock_count: Mock, mcp_server: object
) -> None:
    from superset.commands.dataset.exceptions import DatasetForbiddenError

    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_run.side_effect = DatasetForbiddenError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert content["error_type"] == "Forbidden"
    assert "permission" in (content["error"] or "").lower()


@patch(_COUNT, return_value=(0, 0))
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_generic_command_error(
    mock_resolve: Mock, mock_run: Mock, mock_count: Mock, mcp_server: object
) -> None:
    """CommandException messages are user-facing and pass through."""
    from superset.commands.exceptions import CommandException

    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_run.side_effect = CommandException("Delete failed for domain reasons")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert "Delete failed for domain reasons" in (content["error"] or "")
    assert content["error_type"] == "CommandException"


@patch(_COUNT, return_value=(0, 0))
@patch(_RUN)
@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_sqlalchemy_error_is_generic(
    mock_resolve: Mock, mock_run: Mock, mock_count: Mock, mcp_server: object
) -> None:
    """Raw SQLAlchemy text (SQL, connection details) must not reach the client."""
    from sqlalchemy.exc import OperationalError

    mock_resolve.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_run.side_effect = OperationalError(
        "UPDATE tables SET deleted_at = now()", {}, Exception("secret-host refused")
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error"] == "Dataset delete failed due to a database error."
    assert "secret-host" not in (content["error"] or "")


@patch(_RESOLVE)
@pytest.mark.asyncio
async def test_delete_dataset_lookup_db_error_is_structured(
    mock_resolve: Mock, mcp_server: object
) -> None:
    """DB failures during identifier resolution return LookupFailed instead
    of escaping the tool."""
    from sqlalchemy.exc import OperationalError

    mock_resolve.side_effect = OperationalError("SELECT ...", {}, Exception("down"))

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "delete_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "LookupFailed"
    assert "down" not in (content["error"] or "")


@pytest.mark.asyncio
async def test_delete_dataset_rejects_boolean_identifier(mcp_server: object) -> None:
    """bool subclasses int; identifier=true must not coerce to dataset ID 1."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("delete_dataset", {"request": {"identifier": True}})
