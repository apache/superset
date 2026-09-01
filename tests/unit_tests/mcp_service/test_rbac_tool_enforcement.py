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

"""
End-to-end RBAC-rejection coverage for mutating MCP tools.

``tests/unit_tests/mcp_service/conftest.py`` disables RBAC for every other
test module in this package (``disable_mcp_rbac``, autouse), and
``test_auth_rbac.py`` unit-tests ``check_tool_permission`` in isolation by
calling it directly with hand-built stub functions. Neither proves that a
*real, registered* MCP tool actually enforces RBAC when invoked through the
full FastMCP tool-call path (``Client(mcp).call_tool(...)`` ->
``mcp_auth_hook`` -> ``check_tool_permission`` -> the tool body).

This module closes that gap: for each mutating tool below, it re-enables
RBAC, denies the mocked ``security_manager.can_access`` check, calls the
*actual registered tool* through ``fastmcp.Client``, and asserts the call is
rejected with a ``fastmcp.exceptions.ToolError`` before the tool body runs.
It also includes one control test proving a permitted caller is NOT blocked
by the RBAC gate, so the denial tests above cannot be a false negative caused
by the test harness itself (e.g. a client/transport error that looks like a
rejection for unrelated reasons).

Scope: only the RBAC-rejection path. General tool behavior (happy path,
validation errors, DAO error handling, etc.) is already covered by each
tool's own test module under ``tests/unit_tests/mcp_service/<module>/tool/``
and is intentionally not duplicated here.
"""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.app import mcp

# (tool_name, minimal-but-valid request payload, method_permission_name,
# class_permission_name) for each mutating tool audited for RBAC enforcement.
# The request payloads are the smallest bodies that pass each tool's Pydantic
# schema validation (which FastMCP performs while binding arguments, before
# ``mcp_auth_hook`` runs) so the call reaches the RBAC gate itself.
_MUTATING_TOOLS: list[tuple[str, dict[str, Any], str, str]] = [
    (
        "execute_sql",
        {"database_id": 1, "sql": "SELECT 1"},
        "execute_sql_query",
        "SQLLab",
    ),
    (
        "update_chart",
        {"identifier": 1},
        "write",
        "Chart",
    ),
    (
        "update_dashboard",
        {"identifier": 1},
        "write",
        "Dashboard",
    ),
    (
        "generate_chart",
        {
            "dataset_id": 1,
            "config": {"chart_type": "table", "columns": [{"name": "col1"}]},
        },
        "write",
        "Chart",
    ),
    (
        "generate_dashboard",
        {"chart_ids": [1]},
        "write",
        "Dashboard",
    ),
    (
        "manage_native_filters",
        # ``reorder: []`` satisfies ManageNativeFiltersRequest's "at least one
        # operation" validator (checked via ``is None``, not falsiness).
        {"dashboard_id": 1, "reorder": []},
        "write",
        "Dashboard",
    ),
    (
        "create_dataset",
        {"database_id": 1, "table_name": "my_table"},
        "write",
        "Dataset",
    ),
    (
        "create_virtual_dataset",
        {"database_id": 1, "sql": "SELECT 1", "dataset_name": "my_virtual_dataset"},
        "write",
        "Dataset",
    ),
    (
        "create_theme",
        {"theme_name": "Denied Theme", "json_data": {"token": {}}},
        "write",
        "Theme",
    ),
    (
        "save_sql_query",
        {"database_id": 1, "label": "my query", "sql": "SELECT 1"},
        "write",
        "SavedQuery",
    ),
]

_TOOL_IDS: list[str] = [name for name, *_ in _MUTATING_TOOLS]


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[MagicMock]:
    """Authenticate every call as a real (but unprivileged) user.

    Attributes are set explicitly rather than relying on MagicMock's
    auto-attribute generation, since ``mcp_auth_hook``/``_setup_user_context``
    reads ``username``, ``id``, ``is_active``, ``roles``, and ``groups`` off
    ``g.user``.
    """
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = MagicMock()
        mock_user.username = "unprivileged_user"
        mock_user.id = 999
        mock_user.is_active = True
        mock_user.roles = []
        mock_user.groups = []
        mock_get_user.return_value = mock_user
        yield mock_get_user


async def _assert_tool_rejected_without_permission(
    mcp_server: object,
    app: Any,
    tool_name: str,
    request_payload: dict[str, Any],
    method_permission_name: str,
    class_permission_name: str,
) -> None:
    """Call ``tool_name`` through the real tool-call path with RBAC enabled
    and ``security_manager.can_access`` mocked to deny, and assert the call
    is rejected by the RBAC gate (``mcp_auth_hook`` -> ``ToolError``) rather
    than reaching the tool body."""
    app.config["MCP_RBAC_ENABLED"] = True
    try:
        mock_sm = MagicMock()
        mock_sm.can_access = MagicMock(return_value=False)
        with patch("superset.mcp_service.auth.security_manager", mock_sm):
            async with Client(mcp_server) as client:
                with pytest.raises(ToolError, match="Permission denied"):
                    await client.call_tool(tool_name, {"request": request_payload})
        mock_sm.can_access.assert_called_with(
            f"can_{method_permission_name}", class_permission_name
        )
    finally:
        app.config.pop("MCP_RBAC_ENABLED", None)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool_name", "request_payload", "method_permission_name", "class_permission_name"),
    _MUTATING_TOOLS,
    ids=_TOOL_IDS,
)
async def test_mutating_tool_rejects_unauthorized_caller(
    mcp_server: object,
    app: Any,
    tool_name: str,
    request_payload: dict[str, Any],
    method_permission_name: str,
    class_permission_name: str,
) -> None:
    """A caller lacking the tool's required FAB permission is rejected by the
    real ``mcp_auth_hook`` gate before the tool body runs, for every mutating
    tool in the MCP service."""
    await _assert_tool_rejected_without_permission(
        mcp_server,
        app,
        tool_name,
        request_payload,
        method_permission_name,
        class_permission_name,
    )


@pytest.mark.asyncio
async def test_authorized_caller_is_not_blocked_by_rbac_gate(
    mcp_server: object, app: Any
) -> None:
    """Control test: proves the RBAC gate is the thing doing the rejecting
    above, not a false negative from the test harness itself.

    Grants ``can_access`` for ``create_theme`` (RBAC enabled) and mocks the
    downstream DAO/commit so the call fully succeeds. If the denial tests
    above were actually failing for an unrelated reason (bad payload, broken
    Client wiring, etc.), this test would fail the same way instead of
    succeeding.
    """
    import importlib

    create_theme_module = importlib.import_module(
        "superset.mcp_service.theme.tool.create_theme"
    )

    mock_theme = MagicMock()
    mock_theme.id = 1
    mock_theme.uuid = "11111111-1111-1111-1111-111111111111"
    mock_theme.theme_name = "Allowed Theme"

    app.config["MCP_RBAC_ENABLED"] = True
    try:
        mock_sm = MagicMock()
        mock_sm.can_access = MagicMock(return_value=True)
        with (
            patch("superset.mcp_service.auth.security_manager", mock_sm),
            patch.object(create_theme_module.db.session, "commit"),
            patch("superset.daos.theme.ThemeDAO.create", return_value=mock_theme),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "create_theme",
                    {
                        "request": {
                            "theme_name": "Allowed Theme",
                            "json_data": {"token": {"colorPrimary": "#1d4ed8"}},
                        }
                    },
                )
        mock_sm.can_access.assert_called_with("can_write", "Theme")
        assert result.structured_content["success"] is True
        assert result.structured_content["id"] == 1
    finally:
        app.config.pop("MCP_RBAC_ENABLED", None)
