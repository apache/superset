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
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastmcp import Client, Context

from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests in this module."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        with patch("superset.security_manager.raise_for_editorship"):
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
) -> Mock:
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
    dashboard.editors = []
    dashboard.tags = []
    dashboard.embedded = []
    return dashboard


class TestUpdateDashboard:
    """update_dashboard patches existing dashboard layout/theme/CSS."""

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_layout_theme_and_css(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
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
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
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
        self, mock_get: Mock, mcp_server: object
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
    @pytest.mark.asyncio
    async def test_update_lookup_database_error_is_not_masked_as_not_found(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        """A real DB/infra failure during lookup must surface as a distinct
        ``DatabaseError``, not be collapsed into ``DashboardNotFound`` — and
        must be logged server-side, since ``ctx.*`` calls never reach ops."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_get.side_effect = SQLAlchemyError("connection to server lost")

        with patch(
            "superset.mcp_service.dashboard.tool.update_dashboard.logger"
        ) as mock_logger:
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "update_dashboard", {"request": {"identifier": 999999}}
                )

        payload = json.loads(result.content[0].text)
        assert payload.get("error_type") == "DatabaseError"
        assert "not found" not in (payload.get("error") or "").lower()
        # The raw exception text must never reach the LLM-facing response.
        assert "connection to server lost" not in (payload.get("error") or "")
        mock_logger.exception.assert_called_once()

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_title_and_slug_and_published(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
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
    async def test_update_description(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
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
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
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
    async def test_non_editor_gets_permission_denied(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        """A user without editorship on the dashboard receives a
        permission_denied response — the class-level Dashboard.write
        permission is not enough on its own.
        """
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash

        # mock_auth fixture patches raise_for_editorship to a no-op for the
        # whole module; override here so this one test sees the real
        # editorship rejection path.
        with patch(
            "superset.security_manager.raise_for_editorship",
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
    async def test_xss_only_title_is_rejected(self, mcp_server: object) -> None:
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

    @patch("superset.commands.utils.update_tags")
    @patch("superset.commands.utils.validate_tags")
    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_tags_replaces(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_validate_tags: Mock,
        mock_update_tags: Mock,
        mcp_server: object,
    ) -> None:
        """``tags`` routes through the same validate/update helpers the REST
        UpdateDashboardCommand uses, and reports ``tags`` as changed."""
        from superset.tags.models import ObjectType

        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard",
                {"request": {"identifier": 42, "tags": [3, 7]}},
            )

        mock_validate_tags.assert_called_once()
        mock_update_tags.assert_called_once()
        update_args = mock_update_tags.call_args.args
        assert update_args[0] == ObjectType.dashboard
        assert update_args[1] == 42
        assert update_args[3] == [3, 7]
        payload = json.loads(result.content[0].text)
        assert "tags" in payload.get("changed_fields", [])

    @patch("superset.commands.utils.update_tags")
    @patch("superset.commands.utils.validate_tags")
    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_update_tags_empty_list_clears(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_validate_tags: Mock,
        mock_update_tags: Mock,
        mcp_server: object,
    ) -> None:
        """An empty ``tags`` list is a full replacement that clears all
        custom tags — it must still reach ``update_tags`` (not be treated
        as 'unchanged')."""
        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            await client.call_tool(
                "update_dashboard",
                {"request": {"identifier": 42, "tags": []}},
            )

        mock_update_tags.assert_called_once()
        assert mock_update_tags.call_args.args[3] == []

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_typed_metadata_toggles_fold_into_json_metadata(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        """Typed convenience fields are merged into json_metadata without
        clobbering unrelated keys."""
        dash = _mock_dashboard(
            id=42, json_metadata=json.dumps({"label_colors": {"A": "#111"}})
        )
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard",
                {
                    "request": {
                        "identifier": 42,
                        "cross_filters_enabled": False,
                        "refresh_frequency": 300,
                        "filter_bar_orientation": "HORIZONTAL",
                    }
                },
            )

        merged = json.loads(dash.json_metadata)
        assert merged["cross_filters_enabled"] is False
        assert merged["refresh_frequency"] == 300
        assert merged["filter_bar_orientation"] == "HORIZONTAL"
        assert merged["label_colors"] == {"A": "#111"}  # preserved
        payload = json.loads(result.content[0].text)
        assert "json_metadata" in payload.get("changed_fields", [])

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_typed_metadata_conflict_is_rejected(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        """Setting the same key via a typed field AND json_metadata_overrides
        is ambiguous and rejected before any write."""
        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard",
                {
                    "request": {
                        "identifier": 42,
                        "cross_filters_enabled": False,
                        "json_metadata_overrides": {"cross_filters_enabled": True},
                    }
                },
            )

        payload = json.loads(result.content[0].text)
        assert "cross_filters_enabled" in (payload.get("error") or "")
        mock_session.commit.assert_not_called()

    @patch("superset.dashboards.schemas.validate_css")
    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_invalid_css_is_rejected(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_validate_css: Mock,
        mcp_server: object,
    ) -> None:
        """CSS is run through the same ``validate_css`` the REST schema uses;
        a rejection short-circuits before any write."""
        from marshmallow import ValidationError

        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash
        mock_validate_css.side_effect = ValidationError("CSS is invalid")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dashboard",
                {"request": {"identifier": 42, "css": "@import url(evil);"}},
            )

        payload = json.loads(result.content[0].text)
        assert "css is invalid" in (payload.get("error") or "").lower()
        mock_session.commit.assert_not_called()

    @patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_ctx_info_is_awaited(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        """``ctx.info`` calls must be awaited — ``Context.info`` is an
        async method, so an unawaited call silently drops the log line
        instead of raising. Assert it was actually invoked (and thus
        awaited, since ``AsyncMock`` records only real awaits) rather
        than just checking the response succeeded."""
        dash = _mock_dashboard(id=42)
        mock_get.return_value = dash

        with patch.object(Context, "info", new_callable=AsyncMock) as mock_ctx_info:
            async with Client(mcp_server) as client:
                await client.call_tool(
                    "update_dashboard",
                    {
                        "request": {
                            "identifier": 42,
                            "dashboard_title": "Renamed",
                        }
                    },
                )

        assert mock_ctx_info.await_count >= 2
        awaited_messages = [c.args[0] for c in mock_ctx_info.await_args_list]
        assert any("Updating dashboard" in msg for msg in awaited_messages)
        assert any("updated" in msg for msg in awaited_messages)

    def test_request_slug_is_normalized(self) -> None:
        """Slug is cleaned to match the REST DashboardPutSchema contract."""
        from pydantic import ValidationError as PydanticValidationError

        from superset.mcp_service.dashboard.schemas import UpdateDashboardRequest

        assert (
            UpdateDashboardRequest(identifier=1, slug="  My Slug!? ").slug == "My-Slug"
        )
        assert UpdateDashboardRequest(identifier=1, slug="").slug == ""
        assert UpdateDashboardRequest(identifier=1).slug is None
        # Whitespace-only normalizes to empty string (clears slug), matching REST.
        assert UpdateDashboardRequest(identifier=1, slug="   ").slug == ""
        # A slug containing only non-word characters is rejected (can't be
        # silently cleared when the intent is to set a slug).
        with pytest.raises(
            PydanticValidationError,
            match="characters that are removed during normalization",
        ):
            UpdateDashboardRequest(identifier=1, slug="!!!")
