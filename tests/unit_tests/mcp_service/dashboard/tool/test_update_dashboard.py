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

"""Tests for the update_dashboard MCP tool."""

from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.fixture
def mcp_server():
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


def _mock_dashboard(
    id: int = 42,
    title: str = "Test Dashboard",
    slug: str | None = "test-slug",
    published: bool = True,
    css: str | None = None,
    json_metadata: str | None = None,
    position_json: str | None = None,
):
    """Build a Mock with EVERY field the DashboardInfo serializer touches
    explicitly set. Without this, Mock returns auto-Mock objects for
    unset attributes, which Pydantic rejects as wrong-type."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.description = "desc"
    dashboard.published = published
    dashboard.css = css
    dashboard.json_metadata = json_metadata or json.dumps({"label_colors": {}})
    dashboard.position_json = position_json
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.created_on = datetime(2024, 1, 1)
    dashboard.changed_on = datetime(2024, 1, 1)
    dashboard.created_by = Mock(username="admin")
    dashboard.changed_by = Mock(username="admin")
    dashboard.created_by_name = "admin"
    dashboard.changed_by_name = "admin"
    dashboard.created_on_humanized = "a day ago"
    dashboard.changed_on_humanized = "a day ago"
    dashboard.uuid = f"dashboard-uuid-{id}"
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    return dashboard


class TestUpdateDashboard:
    """update_dashboard patches existing dashboard layout/theme/CSS."""

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_layout_theme_and_css(
        self, mock_session, mock_get, mcp_server
    ) -> None:
        dash = _mock_dashboard(
            id=42,
            json_metadata=json.dumps(
                {"label_colors": {"Old": "#000"}, "cross_filters_enabled": True}
            ),
        )
        mock_get.return_value = dash

        position = {"ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]}}
        overrides = {
            "label_colors": {"Electronics": "#4C78A8"},
            "cross_filters_enabled": False,
        }

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard",
                {
                    "request": {
                        "identifier": 42,
                        "position_json": position,
                        "json_metadata_overrides": overrides,
                        "css": ".x{color:red}",
                    }
                },
            )

        # All three top-level writes applied to the model
        assert dash.position_json == json.dumps(position)
        assert dash.css == ".x{color:red}"
        # json_metadata is shallow-merged: label_colors REPLACED (top-level
        # key), but other keys not in overrides preserved
        merged = json.loads(dash.json_metadata)
        assert merged["label_colors"] == {"Electronics": "#4C78A8"}
        assert merged["cross_filters_enabled"] is False
        assert mock_session.commit.call_count >= 1
        # changed_fields enumerates what actually changed.
        # StructuredContentStripperMiddleware strips structured_content;
        # the JSON-encoded response lives in content[0].text.
        payload = json.loads(result.content[0].text)
        changed = set(payload.get("changed_fields") or [])
        assert {"position_json", "json_metadata", "css"} <= changed

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_with_no_fields_is_noop(
        self, mock_session, mock_get, mcp_server
    ) -> None:
        dash = _mock_dashboard(id=42)
        original_css = dash.css
        original_title = dash.dashboard_title
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard", {"request": {"identifier": 42}}
            )

        # Nothing modified — dashboard fields unchanged, warning emitted
        assert dash.css == original_css
        assert dash.dashboard_title == original_title
        # StructuredContentStripperMiddleware strips structured_content;
        # the JSON-encoded response lives in content[0].text.
        payload = json.loads(result.content[0].text)
        warnings = payload.get("warnings") or []
        assert any("No fields provided" in w for w in warnings)

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @pytest.mark.asyncio
    async def test_update_missing_dashboard_returns_error(
        self, mock_get, mcp_server
    ) -> None:
        # get_by_id_or_slug raises when not found; the tool catches and
        # returns a structured DashboardError
        from superset.commands.dashboard.exceptions import (
            DashboardNotFoundError,
        )

        mock_get.side_effect = DashboardNotFoundError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard", {"request": {"identifier": 999999}}
            )

        payload = json.loads(result.content[0].text)
        assert "not found" in (payload.get("error") or "").lower()

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_title_and_slug_and_published(
        self, mock_session, mock_get, mcp_server
    ) -> None:
        dash = _mock_dashboard(id=42, published=False)
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            await client.call_tool(
                "update_dashboard",
                {
                    "request": {
                        "identifier": 42,
                        "dashboard_title": "Renamed",
                        "slug": "renamed-slug",
                        "published": True,
                    }
                },
            )

        assert dash.dashboard_title == "Renamed"
        assert dash.slug == "renamed-slug"
        assert dash.published is True

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_description(self, mock_session, mock_get, mcp_server) -> None:
        """A description-only update writes ``description`` and reports
        it in ``changed_fields`` without touching other fields."""
        dash = _mock_dashboard(id=42)
        original_title = dash.dashboard_title
        original_slug = dash.slug
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard",
                {
                    "request": {
                        "identifier": 42,
                        "description": "Q4 executive review — refreshed weekly.",
                    }
                },
            )

        assert dash.description == "Q4 executive review — refreshed weekly."
        # Other fields untouched
        assert dash.dashboard_title == original_title
        assert dash.slug == original_slug
        payload = json.loads(result.content[0].text)
        assert "description" in payload.get("changed_fields", [])

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_empty_slug_clears_slug(
        self, mock_session, mock_get, mcp_server
    ) -> None:
        """An explicit empty string clears the slug."""
        dash = _mock_dashboard(id=42, slug="had-a-slug")
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            await client.call_tool(
                "update_dashboard",
                {"request": {"identifier": 42, "slug": ""}},
            )

        assert dash.slug is None

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @pytest.mark.asyncio
    async def test_non_owner_gets_permission_denied(self, mock_get, mcp_server) -> None:
        """A user without ownership on the dashboard receives a
        permission_denied response — the class-level Dashboard.write
        permission is not enough on its own.
        """
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash

        # mock_auth fixture patches raise_for_ownership to a no-op for the
        # whole module; override here so this one test sees the real
        # ownership rejection path.
        with patch(
            "superset.security_manager.raise_for_ownership",
            side_effect=SupersetSecurityException(Mock(message="forbidden")),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "update_dashboard",
                    {
                        "request": {
                            "identifier": 42,
                            "dashboard_title": "Hostile rename",
                        }
                    },
                )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True
        assert "permission" in (payload.get("error") or "").lower()
        # Title was NOT applied
        assert dash.dashboard_title == "Test Dashboard"

    @pytest.mark.asyncio
    async def test_xss_only_title_is_rejected(self, mcp_server) -> None:
        """A dashboard_title that sanitizes to an empty string raises at
        the Pydantic layer — same guard as ``generate_dashboard``. The
        update path must not be a backdoor for XSS payloads."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="dashboard_title"):
                await client.call_tool(
                    "update_dashboard",
                    {
                        "request": {
                            "identifier": 42,
                            "dashboard_title": "<script>alert(1)</script>",
                        }
                    },
                )
