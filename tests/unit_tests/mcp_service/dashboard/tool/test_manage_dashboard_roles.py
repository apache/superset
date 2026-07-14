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

"""Tests for the manage_dashboard_roles MCP tool.

"Roles" are ROLE-type Subjects in the dashboard's ``viewers`` list (the
Subject-based model apache/superset#38831 introduced, replacing the legacy
``roles``/``DASHBOARD_RBAC`` relationship), gated by ``ENABLE_VIEWERS``.
"""

from collections.abc import Iterator
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.subjects.types import SubjectType
from superset.utils import json

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
SUBJECTS_FROM_ROLES = "superset.subjects.utils.subjects_from_roles"
IS_FEATURE_ENABLED = "superset.is_feature_enabled"


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Mock authentication for all tests in this module."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        with patch("superset.security_manager.raise_for_editorship"):
            mock_user = Mock()
            mock_user.id = 1
            mock_user.username = "admin"
            mock_get_user.return_value = mock_user
            yield mock_get_user


def _mock_subject(id: int, role_id: int, label: str = "role") -> Mock:
    subject = Mock()
    subject.id = id
    subject.type = SubjectType.ROLE
    subject.user_id = None
    subject.role_id = role_id
    subject.label = label
    subject.active = True
    return subject


def _mock_dashboard(
    id: int = 42,
    title: str = "Test Dashboard",
    slug: str | None = "test-slug",
    viewers: list[Mock] | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.viewers = viewers if viewers is not None else []
    return dashboard


class TestManageDashboardRoles:
    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(SUBJECTS_FROM_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio()
    async def test_add_role(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_subjects_from_roles: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_subjects_from_roles.return_value = [new_subject]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        mock_subjects_from_roles.assert_called_once_with([5])
        assert dash.viewers == [new_subject]
        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert [r["id"] for r in payload["roles"]] == [200]
        assert payload["added_role_ids"] == [5]
        assert payload["viewers_enabled"] is True
        assert payload["warnings"] == []

    @patch(IS_FEATURE_ENABLED, return_value=False)
    @patch(SUBJECTS_FROM_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio()
    async def test_add_role_warns_when_flag_disabled(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_subjects_from_roles: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_subjects_from_roles.return_value = [new_subject]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        payload = json.loads(result.content[0].text)
        assert payload["viewers_enabled"] is False
        assert any("ENABLE_VIEWERS" in w for w in payload["warnings"])

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(SUBJECTS_FROM_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio()
    async def test_remove_role(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_subjects_from_roles: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        keep = _mock_subject(200, 5, "Analyst")
        remove = _mock_subject(201, 6, "Sales")
        dash = _mock_dashboard(viewers=[keep, remove])
        mock_get.return_value = dash
        mock_subjects_from_roles.return_value = [keep]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "remove_role_ids": [6]}},
            )

        mock_subjects_from_roles.assert_called_once_with([5])
        payload = json.loads(result.content[0].text)
        assert payload["removed_role_ids"] == [6]

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio()
    async def test_remove_unknown_role_id_rejected(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        dash = _mock_dashboard(viewers=[_mock_subject(200, 5, "Analyst")])
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "remove_role_ids": [999]}},
            )

        payload = json.loads(result.content[0].text)
        assert "999" in (payload.get("error") or "")
        assert "not currently assigned" in (payload.get("error") or "").lower()

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio()
    async def test_dashboard_not_found(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        from superset.commands.dashboard.exceptions import DashboardNotFoundError

        mock_get.side_effect = DashboardNotFoundError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 999999, "add_role_ids": [1]}},
            )

        payload = json.loads(result.content[0].text)
        assert "not found" in (payload.get("error") or "").lower()

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio()
    async def test_non_owner_gets_permission_denied(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash

        with patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SupersetSecurityException(Mock(message="forbidden")),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 42, "add_role_ids": [5]}},
                )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(SUBJECTS_FROM_ROLES)
    @patch(DAO_GET)
    @pytest.mark.asyncio()
    async def test_unknown_role_id_in_add_rejected(
        self,
        mock_get: Mock,
        mock_subjects_from_roles: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        # subjects_from_roles silently skips roles without a matching Subject.
        mock_subjects_from_roles.return_value = []

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [99999]}},
            )

        payload = json.loads(result.content[0].text)
        assert "do not exist" in (payload.get("error") or "").lower()
        assert "list_roles" in (payload.get("error") or "")

    @pytest.mark.asyncio()
    async def test_add_remove_overlap_rejected(self, mcp_server: object) -> None:
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="cannot appear in both"):
                await client.call_tool(
                    "manage_dashboard_roles",
                    {
                        "request": {
                            "identifier": 42,
                            "add_role_ids": [1],
                            "remove_role_ids": [1],
                        }
                    },
                )

    @pytest.mark.asyncio()
    async def test_no_operation_rejected(self, mcp_server: object) -> None:
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="At least one of"):
                await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 42}},
                )

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(SUBJECTS_FROM_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio()
    async def test_add_already_assigned_role_not_reported_as_added(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_subjects_from_roles: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        """added_role_ids is a delta against the pre-call state, so a role
        that was already assigned must not be reported as added."""
        existing = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[existing])
        mock_get.return_value = dash
        mock_subjects_from_roles.return_value = [existing]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        payload = json.loads(result.content[0].text)
        assert payload["added_role_ids"] == []
        assert payload["removed_role_ids"] == []
        # URL matches the sibling dashboard tools' /dashboard/... pattern.
        assert payload["dashboard_url"].endswith("/dashboard/test-slug/")
        assert "/superset/dashboard/" not in payload["dashboard_url"]
