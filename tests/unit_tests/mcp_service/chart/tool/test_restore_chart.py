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

"""Unit tests for the restore_chart MCP tool.

Run through the async MCP Client (not direct calls); auth is mocked via the
autouse mock_auth fixture, matching the other chart tool test files.
"""

from collections.abc import Iterator
from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp

_FIND = "superset.daos.chart.ChartDAO.find_by_id_or_uuid"
_COMMAND = "superset.commands.chart.restore.RestoreChartCommand"

_UUID = UUID("11111111-2222-3333-4444-555555555555")


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        # The tool's editorship gate calls the real security manager; default
        # it to a no-op (caller is an editor) so unrelated tests keep passing.
        # The disclosure regression tests below re-patch it to raise.
        with patch("superset.security_manager.raise_for_editorship"):
            mock_user = Mock()
            mock_user.id = 1
            mock_user.username = "admin"
            mock_get_user.return_value = mock_user
            yield mock_get_user


def _mock_chart(
    chart_id: int = 10,
    slice_name: str = "Sales",
    deleted: bool = True,
) -> Mock:
    chart = Mock()
    chart.id = chart_id
    chart.slice_name = slice_name
    chart.uuid = _UUID
    chart.deleted_at = datetime(2026, 7, 1) if deleted else None
    return chart


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_not_found(mock_find: Mock, mcp_server: object) -> None:
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 999}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "999" in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_not_in_trash(mock_find: Mock, mcp_server: object) -> None:
    mock_find.return_value = _mock_chart(deleted=False)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotDeleted"
    assert "not in trash" in (content["error"] or "").lower()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_success_by_numeric_id(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["restored_id"] == 10
    assert "Sales" in content["restored_name"]
    assert content["permission_denied"] is False
    mock_command.assert_called_once_with(str(_UUID))
    mock_command.return_value.run.assert_called_once()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_success_by_uuid(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": str(_UUID)}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["restored_id"] == 10
    mock_find.assert_called_once_with(
        str(_UUID), skip_base_filter=True, skip_visibility_filter=True
    )
    mock_command.assert_called_once_with(str(_UUID))


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_permission_denied(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    from superset.commands.chart.exceptions import ChartForbiddenError

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_command.return_value.run.side_effect = ChartForbiddenError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert "permission" in (content["error"] or "").lower()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_restore_failed(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    from superset.commands.chart.exceptions import ChartRestoreFailedError

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_command.return_value.run.side_effect = ChartRestoreFailedError("boom")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is False
    assert content["error_type"] == "ChartRestoreFailedError"


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_sqlalchemy_error_is_generic(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    """Raw SQLAlchemy text (SQL, connection details) must not reach the client."""
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")
    mock_command.return_value.run.side_effect = OperationalError(
        "UPDATE slices SET deleted_at = NULL", {}, Exception("secret-host refused")
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error"] == "Chart restore failed due to a database error."
    assert "secret-host" not in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_lookup_db_error_is_structured(
    mock_find: Mock, mcp_server: object
) -> None:
    """DB failures during identifier resolution return LookupFailed instead
    of escaping the tool."""
    from sqlalchemy.exc import OperationalError

    mock_find.side_effect = OperationalError("SELECT ...", {}, Exception("down"))

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_chart", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "LookupFailed"
    assert "down" not in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_editorship_check_db_error_is_structured(
    mock_find: Mock, mcp_server: object
) -> None:
    """DB failures during the editorship check (not just the initial lookup)
    must return the structured LookupFailed response instead of escaping the
    tool as an unhandled error."""
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_chart(chart_id=10, slice_name="Sales")

    with patch(
        "superset.security_manager.raise_for_editorship",
        side_effect=OperationalError("SELECT ...", {}, Exception("down")),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "restore_chart", {"request": {"identifier": 10}}
            )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "LookupFailed"
    assert "down" not in (content["error"] or "")


@pytest.mark.asyncio
async def test_restore_chart_rejects_boolean_identifier(mcp_server: object) -> None:
    """bool subclasses int; identifier=true must not coerce to chart ID 1."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("restore_chart", {"request": {"identifier": True}})


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_inaccessible_chart_reads_as_not_found(
    mock_find: Mock, mcp_server: object
) -> None:
    """A chart outside the caller's RBAC scope must not leak its existence or
    title: the unfiltered restore lookup finds it, the base-filtered re-lookup
    does not, so the tool must answer exactly as if it does not exist.

    The mock's return value is keyed on the actual ``skip_base_filter`` kwarg
    of each call rather than call order, so a regression that accidentally
    keeps ``skip_base_filter=True`` on the re-lookup (turning the intended
    NotFound response into a disclosure) is caught by a call-order-based
    mock returning the chart on both calls, not masked by it."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    def _find_side_effect(*args: Any, **kwargs: Any) -> Any | None:
        # Mirrors the real DAO contract: only an explicit skip_base_filter=True
        # (the initial unfiltered restore lookup) sees the chart; the
        # re-lookup omits it, so it defaults to False and must see nothing.
        if kwargs.get("skip_base_filter"):
            return _mock_chart(chart_id=10, slice_name="Secret KPI")
        return None

    mock_find.side_effect = _find_side_effect
    forbidden = SupersetSecurityException(
        SupersetError(
            message="forbidden",
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    with patch("superset.security_manager.raise_for_editorship", side_effect=forbidden):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "restore_chart", {"request": {"identifier": 10}}
            )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "Secret KPI" not in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_chart_visible_non_editor_gets_nameless_forbidden(
    mock_find: Mock, mcp_server: object
) -> None:
    """A caller who can see the chart but cannot edit it gets a permission
    error naming the id only, never the title."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    chart = _mock_chart(chart_id=10, slice_name="Secret KPI")
    mock_find.side_effect = [chart, chart]
    forbidden = SupersetSecurityException(
        SupersetError(
            message="forbidden",
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    with patch("superset.security_manager.raise_for_editorship", side_effect=forbidden):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "restore_chart", {"request": {"identifier": 10}}
            )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert content["error_type"] == "Forbidden"
    assert "Secret KPI" not in (content["error"] or "")
    assert "10" in (content["error"] or "")
