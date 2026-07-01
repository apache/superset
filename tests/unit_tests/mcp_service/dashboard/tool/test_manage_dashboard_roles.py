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

"""Tests for the manage_dashboard_roles MCP tool."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
POPULATE_ROLES = "superset.commands.utils.populate_roles"
IS_FEATURE_ENABLED = "superset.is_feature_enabled"


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests in this module."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        with patch("superset.security_manager.raise_for_ownership"):
            mock_user = Mock()
            mock_user.id = 1
            mock_user.username = "admin"
            mock_get_user.return_value = mock_user
            yield mock_get_user


def _mock_role(id: int, name: str = "role") -> Mock:
    role = Mock()
    role.id = id
    role.name = name
    role.permissions = []
    return role


def _mock_dashboard(
    id: int = 42,
    title: str = "Test Dashboard",
    slug: str | None = "test-slug",
    roles: list[Mock] | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.roles = roles if roles is not None else []
    return dashboard


class TestManageDashboardRoles:
    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(POPULATE_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_role(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_populate: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        new_role = _mock_role(5, "Analyst")
        dash = _mock_dashboard(roles=[])
        mock_get.return_value = dash
        mock_populate.return_value = [new_role]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        mock_populate.assert_called_once_with([5])
        assert dash.roles == [new_role]
        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert [r["id"] for r in payload["roles"]] == [5]
        assert payload["added_role_ids"] == [5]
        assert payload["dashboard_rbac_enabled"] is True
        assert payload["warnings"] == []

    @patch(IS_FEATURE_ENABLED, return_value=False)
    @patch(POPULATE_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_role_warns_when_flag_disabled(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_populate: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        new_role = _mock_role(5, "Analyst")
        dash = _mock_dashboard(roles=[])
        mock_get.return_value = dash
        mock_populate.return_value = [new_role]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        payload = json.loads(result.content[0].text)
        assert payload["dashboard_rbac_enabled"] is False
        assert any("DASHBOARD_RBAC" in w for w in payload["warnings"])

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(POPULATE_ROLES)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_remove_role(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_populate: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        keep = _mock_role(5, "Analyst")
        remove = _mock_role(6, "Sales")
        dash = _mock_dashboard(roles=[keep, remove])
        mock_get.return_value = dash
        mock_populate.return_value = [keep]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "remove_role_ids": [6]}},
            )

        mock_populate.assert_called_once_with([5])
        payload = json.loads(result.content[0].text)
        assert payload["removed_role_ids"] == [6]

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_remove_unknown_role_id_rejected(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        dash = _mock_dashboard(roles=[_mock_role(5, "Analyst")])
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
    @pytest.mark.asyncio
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
    @pytest.mark.asyncio
    async def test_non_owner_gets_permission_denied(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard(roles=[])
        mock_get.return_value = dash

        with patch(
            "superset.security_manager.raise_for_ownership",
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
    @patch(POPULATE_ROLES)
    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_unknown_role_id_in_add_rejected(
        self, mock_get: Mock, mock_populate: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        from superset.commands.exceptions import RolesNotFoundValidationError

        dash = _mock_dashboard(roles=[])
        mock_get.return_value = dash
        mock_populate.side_effect = RolesNotFoundValidationError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [99999]}},
            )

        payload = json.loads(result.content[0].text)
        assert "do not exist" in (payload.get("error") or "").lower()
        assert "list_roles" in (payload.get("error") or "")

    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
    async def test_no_operation_rejected(self, mcp_server: object) -> None:
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="At least one of"):
                await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 42}},
                )
