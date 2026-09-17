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

"""Unit tests for the restore_dataset MCP tool.

Run through the async MCP Client (not direct calls); auth is mocked via the
autouse mock_auth fixture, matching the other dataset tool test files.
"""

from collections.abc import Iterator
from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp

_FIND = "superset.daos.dataset.DatasetDAO.find_by_id_or_uuid"
_COMMAND = "superset.commands.dataset.restore.RestoreDatasetCommand"

_UUID = UUID("11111111-2222-3333-4444-555555555555")


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        # The tool's editorship gate calls the real security manager; default
        # it to a no-op (caller is an editor) so unrelated tests keep passing.
        # The disclosure tests below re-patch it to raise.
        with patch("superset.security_manager.raise_for_editorship"):
            mock_user = Mock()
            mock_user.id = 1
            mock_user.username = "admin"
            mock_get_user.return_value = mock_user
            yield mock_get_user


def _mock_dataset(
    dataset_id: int = 10,
    table_name: str = "orders",
    deleted: bool = True,
) -> Mock:
    dataset = Mock()
    dataset.id = dataset_id
    dataset.table_name = table_name
    dataset.uuid = _UUID
    dataset.deleted_at = datetime(2026, 7, 1) if deleted else None
    return dataset


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_not_found(mock_find: Mock, mcp_server: object) -> None:
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 999}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "999" in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_not_in_trash(
    mock_find: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dataset(deleted=False)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotDeleted"
    assert "not in trash" in (content["error"] or "").lower()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_success_by_numeric_id(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dataset(dataset_id=10, table_name="orders")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is True
    assert content["restored_id"] == 10
    assert "orders" in content["restored_name"]
    assert content["permission_denied"] is False
    mock_command.assert_called_once_with(str(_UUID))
    mock_command.return_value.run.assert_called_once()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_success_by_uuid(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    mock_find.return_value = _mock_dataset(dataset_id=10, table_name="orders")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": str(_UUID)}}
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
async def test_restore_dataset_permission_denied(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    from superset.commands.dataset.exceptions import DatasetForbiddenError

    mock_find.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_command.return_value.run.side_effect = DatasetForbiddenError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert "permission" in (content["error"] or "").lower()


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_logical_duplicate(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    """Another active dataset on the same physical table blocks the restore."""
    from superset.commands.dataset.exceptions import DatasetLogicalDuplicateError

    mock_find.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_command.return_value.run.side_effect = DatasetLogicalDuplicateError()

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is False
    assert content["error_type"] == "LogicalDuplicate"
    assert "same physical table" in (content["error"] or "")


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_restore_failed(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    from superset.commands.dataset.exceptions import DatasetRestoreFailedError

    mock_find.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_command.return_value.run.side_effect = DatasetRestoreFailedError("boom")

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is False
    assert content["error_type"] == "DatasetRestoreFailedError"


@patch(_COMMAND)
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_sqlalchemy_error_is_generic(
    mock_find: Mock, mock_command: Mock, mcp_server: object
) -> None:
    """Raw SQLAlchemy text (SQL, connection details) must not reach the client."""
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_dataset(dataset_id=10, table_name="orders")
    mock_command.return_value.run.side_effect = OperationalError(
        "UPDATE tables SET deleted_at = NULL", {}, Exception("secret-host refused")
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error"] == "Dataset restore failed due to a database error."
    assert "secret-host" not in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_lookup_db_error_is_structured(
    mock_find: Mock, mcp_server: object
) -> None:
    """DB failures during identifier resolution return LookupFailed instead
    of escaping the tool."""
    from sqlalchemy.exc import OperationalError

    mock_find.side_effect = OperationalError("SELECT ...", {}, Exception("down"))

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "restore_dataset", {"request": {"identifier": 10}}
        )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "LookupFailed"
    assert "down" not in (content["error"] or "")


@pytest.mark.asyncio
async def test_restore_dataset_rejects_boolean_identifier(mcp_server: object) -> None:
    """bool subclasses int; identifier=true must not coerce to dataset ID 1."""
    from fastmcp.exceptions import ToolError

    async with Client(mcp_server) as client:
        with pytest.raises(ToolError):
            await client.call_tool("restore_dataset", {"request": {"identifier": True}})


def _forbidden() -> Exception:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    return SupersetSecurityException(
        SupersetError(
            message="forbidden",
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


@pytest.mark.parametrize("deleted", [True, False])
@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_inaccessible_dataset_reads_as_not_found(
    mock_find: Mock, mcp_server: object, deleted: bool
) -> None:
    """A dataset outside the caller's RBAC scope must not leak its existence or
    name, whether it is in trash or not: the unfiltered restore lookup finds
    it, the base-filtered re-lookup does not.

    The mock keys on the ``skip_base_filter`` kwarg rather than call order, so
    a re-lookup that wrongly keeps ``skip_base_filter=True`` is caught."""

    def _find_side_effect(*args: Any, **kwargs: Any) -> Any | None:
        if kwargs.get("skip_base_filter"):
            return _mock_dataset(table_name="secret_orders", deleted=deleted)
        return None

    from superset.commands.dataset.exceptions import DatasetForbiddenError

    mock_find.side_effect = _find_side_effect
    command = Mock()
    # What the real command does for a non-editor.
    command.return_value.run.side_effect = DatasetForbiddenError()
    with (
        patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=_forbidden(),
        ),
        patch(_COMMAND, command),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "restore_dataset", {"request": {"identifier": 10}}
            )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "NotFound"
    assert "secret_orders" not in (content["error"] or "")
    command.assert_not_called()


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_visible_non_editor_gets_nameless_forbidden(
    mock_find: Mock, mcp_server: object
) -> None:
    """A caller who can see the dataset but cannot edit it gets a permission
    error naming the id only, never the table name."""
    dataset = _mock_dataset(table_name="secret_orders")
    mock_find.side_effect = [dataset, dataset]
    with patch(
        "superset.security_manager.raise_for_editorship", side_effect=_forbidden()
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "restore_dataset", {"request": {"identifier": 10}}
            )

    content = result.structured_content
    assert content["success"] is False
    assert content["permission_denied"] is True
    assert content["error_type"] == "Forbidden"
    assert "secret_orders" not in (content["error"] or "")
    assert "10" in (content["error"] or "")


@patch(_FIND)
@pytest.mark.asyncio
async def test_restore_dataset_editorship_check_db_error_is_structured(
    mock_find: Mock, mcp_server: object
) -> None:
    from sqlalchemy.exc import OperationalError

    mock_find.return_value = _mock_dataset()
    with patch(
        "superset.security_manager.raise_for_editorship",
        side_effect=OperationalError("SELECT ...", {}, Exception("down")),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "restore_dataset", {"request": {"identifier": 10}}
            )

    content = result.structured_content
    assert content["success"] is False
    assert content["error_type"] == "LookupFailed"
    assert "down" not in (content["error"] or "")
