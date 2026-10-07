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

"""Every MCP mutation of an externally managed dashboard refuses the write."""

from collections.abc import Iterator
from contextlib import nullcontext
from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch
from uuid import UUID

import pytest
from fastmcp import Client
from sqlalchemy.exc import SQLAlchemyError

from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[None]:
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_user,
        patch("superset.security_manager.raise_for_editorship"),
    ):
        mock_user.return_value = Mock(id=1, username="admin")
        yield


@pytest.mark.parametrize(
    ("tool_name", "tool_request"),
    [
        ("manage_dashboard_owners", {"identifier": 42, "add_owner_ids": [7]}),
        ("manage_dashboard_roles", {"identifier": 42, "add_role_ids": [5]}),
        ("manage_dashboard_certification", {"identifier": 42, "certified_by": "QA"}),
        ("manage_dashboard_markdown", {"dashboard_id": 42, "remove": ["HEADER-1"]}),
        ("update_dashboard", {"identifier": 42, "dashboard_title": "Changed"}),
        ("add_chart_to_existing_dashboard", {"dashboard_id": 42, "chart_id": 9}),
        ("remove_chart_from_dashboard", {"dashboard_id": 42, "chart_id": 9}),
        ("manage_native_filters", {"dashboard_id": 42, "reorder": []}),
        ("delete_dashboard", {"identifier": 42}),
        ("restore_dashboard", {"identifier": 42}),
    ],
)
@pytest.mark.asyncio
async def test_managed_dashboard_mutation_refused(
    tool_name: str, tool_request: dict[str, Any]
) -> None:
    dashboard: Mock = Mock()
    dashboard.id = 42
    dashboard.dashboard_title = "Externally managed"
    dashboard.slug = "externally-managed"
    dashboard.uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    dashboard.is_managed_externally = True
    dashboard.deleted_at = datetime(2026, 1, 1)
    dashboard.json_metadata = json.dumps({"native_filter_configuration": []})
    dashboard.position_json = "{}"
    dashboard.slices = []
    dashboard.editors = []
    dashboard.viewers = []

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
            return_value=dashboard,
        ),
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id_or_uuid",
            return_value=dashboard,
        ),
        patch(
            "superset.mcp_service.dashboard.tool.delete_dashboard._find_dashboard_by_identifier",
            return_value=dashboard,
        ),
        patch(
            "superset.mcp_service.dashboard.tool.restore_dashboard._find_dashboard_for_restore",
            return_value=dashboard,
        ),
        patch(
            "superset.extensions.event_logger.log_context", return_value=nullcontext()
        ),
        patch("superset.extensions.db.session") as session,
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(tool_name, {"request": tool_request})

    response: dict[str, Any] = result.structured_content
    assert response["managed_externally"] is True
    assert response["permission_denied"] is False
    assert "managed externally" in response["error"]
    assert "cannot be changed here" in response["error"]
    session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("tool_name", "lookup", "tool_request"),
    [
        (
            "manage_native_filters",
            "superset.daos.dashboard.DashboardDAO.find_by_id",
            {"dashboard_id": 42, "reorder": []},
        ),
        (
            "delete_dashboard",
            "superset.mcp_service.dashboard.tool.delete_dashboard._find_dashboard_by_identifier",
            {"identifier": 42},
        ),
    ],
)
@pytest.mark.asyncio
async def test_non_editor_cannot_probe_managed_status(
    tool_name: str, lookup: str, tool_request: dict[str, Any]
) -> None:
    dashboard: Mock = Mock(id=42, dashboard_title="Hidden dashboard")
    dashboard.is_managed_externally = True

    with (
        patch(lookup, return_value=dashboard),
        patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SupersetSecurityException(Mock(message="forbidden")),
        ),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(tool_name, {"request": tool_request})

    response: dict[str, Any] = result.structured_content
    assert response["permission_denied"] is True
    assert response["managed_externally"] is False
    assert "Hidden dashboard" not in (response["error"] or "")


@pytest.mark.asyncio
async def test_native_filter_managed_editorship_database_error_is_structured() -> None:
    dashboard: Mock = Mock(id=42, dashboard_title="Externally managed")
    dashboard.is_managed_externally = True

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SQLAlchemyError("private database detail"),
        ),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "manage_native_filters",
                {"request": {"dashboard_id": 42, "reorder": []}},
            )

    response: dict[str, Any] = result.structured_content
    assert "database error" in (response["error"] or "")
    assert "private database detail" not in (response["error"] or "")
    assert response["managed_externally"] is False
