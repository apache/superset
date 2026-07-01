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

"""Tests for the manage_dashboard_owners MCP tool."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
POPULATE_OWNER_LIST = "superset.commands.utils.populate_owner_list"


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


def _mock_user(id: int, username: str = "user") -> Mock:
    user = Mock()
    user.id = id
    user.username = username
    user.first_name = "First"
    user.last_name = "Last"
    user.active = True
    user.changed_on = None
    return user


def _mock_dashboard(
    id: int = 42,
    title: str = "Test Dashboard",
    slug: str | None = "test-slug",
    owners: list[Mock] | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.owners = owners if owners is not None else [_mock_user(1, "admin")]
    return dashboard


class TestManageDashboardOwners:
    @patch(POPULATE_OWNER_LIST)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_owner(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        existing = _mock_user(1, "admin")
        new_owner = _mock_user(7, "bob")
        dash = _mock_dashboard(owners=[existing])
        mock_get.return_value = dash
        # populate_owner_list resolves the final list; simulate it (and the
        # side effect of assigning dashboard.owners like the real setter).
        mock_populate.return_value = [existing, new_owner]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [7]}},
            )

        mock_populate.assert_called_once_with([1, 7], default_to_user=False)
        assert dash.owners == [existing, new_owner]
        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert sorted(o["id"] for o in payload["owners"]) == [1, 7]
        assert payload["added_owner_ids"] == [7]
        assert payload["removed_owner_ids"] == []

    @patch(POPULATE_OWNER_LIST)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_remove_owner(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        keep = _mock_user(1, "admin")
        remove = _mock_user(2, "carol")
        dash = _mock_dashboard(owners=[keep, remove])
        mock_get.return_value = dash
        mock_populate.return_value = [keep]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [2]}},
            )

        mock_populate.assert_called_once_with([1], default_to_user=False)
        payload = json.loads(result.content[0].text)
        assert payload["removed_owner_ids"] == [2]
        assert [o["id"] for o in payload["owners"]] == [1]

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_remove_all_owners_rejected(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        """Removing every owner must be rejected before any DB write."""
        original_owners = [_mock_user(1, "admin")]
        dash = _mock_dashboard(owners=original_owners)
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [1]}},
            )

        payload = json.loads(result.content[0].text)
        assert "at least one owner" in (payload.get("error") or "").lower()
        # dashboard.owners must remain untouched
        assert dash.owners is original_owners

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_remove_unknown_owner_id_rejected(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        dash = _mock_dashboard(owners=[_mock_user(1, "admin")])
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [999]}},
            )

        payload = json.loads(result.content[0].text)
        assert "999" in (payload.get("error") or "")
        assert "not currently owners" in (payload.get("error") or "").lower()

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_dashboard_not_found(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        from superset.commands.dashboard.exceptions import DashboardNotFoundError

        mock_get.side_effect = DashboardNotFoundError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 999999, "add_owner_ids": [1]}},
            )

        payload = json.loads(result.content[0].text)
        assert "not found" in (payload.get("error") or "").lower()

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_non_owner_gets_permission_denied(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard(owners=[_mock_user(1, "admin")])
        mock_get.return_value = dash

        with patch(
            "superset.security_manager.raise_for_ownership",
            side_effect=SupersetSecurityException(Mock(message="forbidden")),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_owners",
                    {"request": {"identifier": 42, "add_owner_ids": [7]}},
                )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True

    @patch(POPULATE_OWNER_LIST)
    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_unknown_user_id_in_add_rejected(
        self, mock_get: Mock, mock_populate: Mock, mcp_server: object
    ) -> None:
        from superset.commands.exceptions import OwnersNotFoundValidationError

        dash = _mock_dashboard(owners=[_mock_user(1, "admin")])
        mock_get.return_value = dash
        mock_populate.side_effect = OwnersNotFoundValidationError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [99999]}},
            )

        payload = json.loads(result.content[0].text)
        assert "do not exist" in (payload.get("error") or "").lower()
        assert "find_users" in (payload.get("error") or "")

    @patch(POPULATE_OWNER_LIST)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_self_removal_auto_readded_warns(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """When populate_owner_list re-adds a caller who tried to remove
        themselves (self-protection), the response surfaces a warning
        instead of silently diverging from what was requested."""
        admin = _mock_user(1, "admin")
        carol = _mock_user(2, "carol")
        dave = _mock_user(3, "dave")
        dash = _mock_dashboard(owners=[admin, carol, dave])
        mock_get.return_value = dash
        # Requested new_owner_ids == [3] (dave), but populate_owner_list
        # simulates re-adding admin (id=1) per its non-admin self-protection.
        mock_populate.return_value = [admin, dave]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [1, 2]}},
            )

        mock_populate.assert_called_once_with([3], default_to_user=False)
        payload = json.loads(result.content[0].text)
        assert any("automatically re-added" in w for w in payload.get("warnings", []))

    @pytest.mark.asyncio
    async def test_add_remove_overlap_rejected(self, mcp_server: object) -> None:
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="cannot appear in both"):
                await client.call_tool(
                    "manage_dashboard_owners",
                    {
                        "request": {
                            "identifier": 42,
                            "add_owner_ids": [1],
                            "remove_owner_ids": [1],
                        }
                    },
                )

    @pytest.mark.asyncio
    async def test_no_operation_rejected(self, mcp_server: object) -> None:
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="At least one of"):
                await client.call_tool(
                    "manage_dashboard_owners",
                    {"request": {"identifier": 42}},
                )
