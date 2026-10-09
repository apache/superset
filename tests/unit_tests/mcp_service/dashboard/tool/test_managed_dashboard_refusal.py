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
from contextlib import ExitStack, nullcontext
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
        patch("superset.extensions.db.session") as session,
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
    session.rollback.assert_called_once()


@pytest.mark.parametrize(
    ("tool_name", "tool_request", "write_kind"),
    [
        ("manage_dashboard_owners", {"identifier": 42, "add_owner_ids": [7]}, "owners"),
        ("manage_dashboard_roles", {"identifier": 42, "add_role_ids": [5]}, "commit"),
        (
            "manage_dashboard_certification",
            {"identifier": 42, "certified_by": "QA"},
            "commit",
        ),
        (
            "manage_dashboard_markdown",
            {"dashboard_id": 42, "add": [{"component_type": "header", "text": "X"}]},
            "commit",
        ),
        (
            "update_dashboard",
            {"identifier": 42, "dashboard_title": "Changed"},
            "commit",
        ),
        (
            "add_chart_to_existing_dashboard",
            {"dashboard_id": 42, "chart_id": 9},
            "update",
        ),
        ("remove_chart_from_dashboard", {"dashboard_id": 42, "chart_id": 9}, "update"),
        ("manage_native_filters", {"dashboard_id": 42, "reorder": []}, "filters"),
        ("delete_dashboard", {"identifier": 42}, "delete"),
        ("restore_dashboard", {"identifier": 42}, "restore"),
    ],
)
@pytest.mark.asyncio
async def test_unmanaged_dashboard_reaches_write_path(
    tool_name: str, tool_request: dict[str, Any], write_kind: str
) -> None:
    dashboard: Mock = Mock()
    dashboard.id = 42
    dashboard.dashboard_title = "Unmanaged dashboard"
    dashboard.slug = "unmanaged"
    dashboard.uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    dashboard.is_managed_externally = False
    dashboard.deleted_at = datetime(2026, 1, 1)
    dashboard.json_metadata = json.dumps({"native_filter_configuration": []})
    dashboard.position_json = "{}"
    dashboard.slices = []
    dashboard.editors = []
    dashboard.viewers = []
    dashboard.tags = []
    dashboard.published = True
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.external_url = None
    dashboard.embedded = []
    dashboard.created_on = datetime(2026, 1, 1)
    dashboard.changed_on = datetime(2026, 1, 1)
    dashboard.created_by_name = "admin"
    dashboard.changed_by_name = "admin"
    dashboard.created_on_humanized = "Jan 2026"
    dashboard.changed_on_humanized = "Jan 2026"
    dashboard.created_by = Mock(username="admin")
    dashboard.changed_by = Mock(username="admin")
    chart: Mock = Mock(id=9, slice_name="Chart", tags=[], editors=[])
    if tool_name == "remove_chart_from_dashboard":
        dashboard.slices = [chart]

    with ExitStack() as stack:
        stack.enter_context(
            patch(
                "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
                return_value=dashboard,
            )
        )
        stack.enter_context(
            patch(
                "superset.daos.dashboard.DashboardDAO.find_by_id",
                return_value=dashboard,
            )
        )
        stack.enter_context(
            patch(
                "superset.daos.dashboard.DashboardDAO.find_by_id_or_uuid",
                return_value=dashboard,
            )
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.dashboard.tool.delete_dashboard._find_dashboard_by_identifier",
                return_value=dashboard,
            )
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.dashboard.tool.restore_dashboard._find_dashboard_for_restore",
                return_value=dashboard,
            )
        )
        stack.enter_context(
            patch(
                "superset.extensions.event_logger.log_context",
                return_value=nullcontext(),
            )
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.dashboard.tool.manage_dashboard_owners._owner_user_ids",
                return_value=[1],
            )
        )
        owner_write: Mock = stack.enter_context(
            patch(
                "superset.mcp_service.dashboard.tool.manage_dashboard_owners._apply_owner_change",
                return_value=({1, 7}, [], None),
            )
        )
        stack.enter_context(patch("superset.is_feature_enabled", return_value=True))
        role_subject: Mock = Mock(id=5, role_id=5)
        stack.enter_context(
            patch(
                "superset.subjects.utils.get_or_create_role_subject",
                return_value=role_subject,
            )
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.dashboard.tool.manage_dashboard_roles.serialize_subject_object",
                return_value=None,
            )
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.dashboard.tool.delete_dashboard._routes_to_soft_delete",
                return_value=False,
            )
        )
        stack.enter_context(
            patch(
                "superset.mcp_service.auth.check_chart_data_access",
                return_value=Mock(is_valid=True),
            )
        )
        session: Mock = stack.enter_context(patch("superset.extensions.db.session"))
        session.get.return_value = chart
        update_command: Mock = stack.enter_context(
            patch("superset.commands.dashboard.update.UpdateDashboardCommand")
        )
        update_command.return_value.run.return_value = dashboard
        filter_command: Mock = stack.enter_context(
            patch(
                "superset.commands.dashboard.update.UpdateDashboardNativeFiltersCommand"
            )
        )
        filter_command.return_value.run.return_value = []
        delete_command: Mock = stack.enter_context(
            patch("superset.commands.dashboard.delete.DeleteDashboardCommand")
        )
        restore_command: Mock = stack.enter_context(
            patch("superset.commands.dashboard.restore.RestoreDashboardCommand")
        )

        async with Client(mcp) as client:
            result = await client.call_tool(tool_name, {"request": tool_request})

    writes: dict[str, Mock] = {
        "owners": owner_write,
        "commit": session.commit,
        "update": update_command.return_value.run,
        "filters": filter_command.return_value.run,
        "delete": delete_command.return_value.run,
        "restore": restore_command.return_value.run,
    }
    writes[write_kind].assert_called()
    assert result.structured_content["managed_externally"] is False
