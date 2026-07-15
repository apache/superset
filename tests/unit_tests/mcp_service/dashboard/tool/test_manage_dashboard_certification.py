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

"""Tests for the manage_dashboard_certification MCP tool."""

from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.utils import json

DAO_GET: str = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"


def _mock_dashboard(
    id: int = 42,
    title: str = "Test Dashboard",
    slug: str | None = "test-slug",
    certified_by: str | None = None,
    certification_details: str | None = None,
) -> Mock:
    dashboard: Mock = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.certified_by = certified_by
    dashboard.certification_details = certification_details
    return dashboard


class TestManageDashboardCertification:
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_set_certification(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        dash: Mock = _mock_dashboard()
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_certification",
                {
                    "request": {
                        "identifier": 42,
                        "certified_by": "Data Platform Team",
                        "certification_details": "Verified against source-of-truth.",
                    }
                },
            )

        assert dash.certified_by == "Data Platform Team"
        assert dash.certification_details == "Verified against source-of-truth."
        assert mock_session.commit.call_count >= 1
        payload: dict[str, Any] = json.loads(result.content[0].text)
        # Response text is wrapped for LLM context (mirrors the read-path
        # sanitization on DashboardInfo.certified_by), so check substring.
        assert "Data Platform Team" in payload["certified_by"]
        assert set(payload["changed_fields"]) == {
            "certified_by",
            "certification_details",
        }

    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_set_certified_by_only(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        dash = _mock_dashboard(certification_details="Existing details")
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_certification",
                {"request": {"identifier": 42, "certified_by": "Analytics Guild"}},
            )

        assert dash.certified_by == "Analytics Guild"
        assert dash.certification_details == "Existing details"
        payload = json.loads(result.content[0].text)
        assert payload["changed_fields"] == ["certified_by"]

    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_clear_with_empty_string(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        dash = _mock_dashboard(
            certified_by="Old Team", certification_details="Old details"
        )
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_certification",
                {
                    "request": {
                        "identifier": 42,
                        "certified_by": "",
                        "certification_details": "",
                    }
                },
            )

        assert dash.certified_by is None
        assert dash.certification_details is None
        payload = json.loads(result.content[0].text)
        assert payload["certified_by"] is None
        assert payload["certification_details"] is None

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_no_fields_is_noop(self, mock_get: Mock, mcp_server: object) -> None:
        dash = _mock_dashboard(certified_by="Existing")
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_certification",
                {"request": {"identifier": 42}},
            )

        assert dash.certified_by == "Existing"
        payload = json.loads(result.content[0].text)
        assert payload["changed_fields"] == []
        assert any("No fields provided" in w for w in payload["warnings"])

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_dashboard_not_found(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        from superset.commands.dashboard.exceptions import DashboardNotFoundError

        mock_get.side_effect = DashboardNotFoundError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_certification",
                {"request": {"identifier": 999999, "certified_by": "Team"}},
            )

        payload = json.loads(result.content[0].text)
        assert "not found" in (payload.get("error") or "").lower()

    @pytest.mark.asyncio
    async def test_rejects_boolean_identifier(self, mcp_server: object) -> None:
        """bool subclasses int; identifier=true must not coerce to dashboard ID 1."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_certification",
                    {"request": {"identifier": True, "certified_by": "Team"}},
                )

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_lookup_database_error_is_not_masked_as_not_found(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        """A real DB/infra failure during lookup must surface as a distinct
        database error, not be collapsed into "not found"."""
        from sqlalchemy.exc import SQLAlchemyError

        mock_get.side_effect = SQLAlchemyError("connection to server lost")

        with patch(
            "superset.mcp_service.dashboard.tool.manage_dashboard_certification.logger"
        ) as mock_logger:
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_certification",
                    {"request": {"identifier": 999999, "certified_by": "Team"}},
                )

        payload = json.loads(result.content[0].text)
        assert "not found" not in (payload.get("error") or "").lower()
        assert "database error" in (payload.get("error") or "").lower()
        assert "connection to server lost" not in (payload.get("error") or "")
        mock_logger.exception.assert_called_once()

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_view_only_caller_gets_permission_denied(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        """get_by_id_or_slug itself re-checks view access and raises
        DashboardAccessDeniedError for dashboards the caller cannot see;
        that must surface as permission_denied, not an unhandled error."""
        from superset.commands.dashboard.exceptions import (
            DashboardAccessDeniedError,
        )

        mock_get.side_effect = DashboardAccessDeniedError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_certification",
                {"request": {"identifier": 42, "certified_by": "Team"}},
            )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_non_owner_gets_permission_denied(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard()
        mock_get.return_value = dash

        with patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SupersetSecurityException(Mock(message="forbidden")),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_certification",
                    {"request": {"identifier": 42, "certified_by": "Team"}},
                )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True
        assert dash.certified_by is None

    @pytest.mark.asyncio
    async def test_xss_certified_by_is_sanitized(self, mcp_server: object) -> None:
        from superset.mcp_service.dashboard.schemas import (
            ManageDashboardCertificationRequest,
        )

        request: ManageDashboardCertificationRequest = (
            ManageDashboardCertificationRequest(
                identifier=1, certified_by="<script>alert(1)</script>Team"
            )
        )
        assert "<script>" not in (request.certified_by or "")

    @pytest.mark.asyncio
    async def test_xss_certification_details_is_sanitized(
        self, mcp_server: object
    ) -> None:
        from superset.mcp_service.dashboard.schemas import (
            ManageDashboardCertificationRequest,
        )

        request = ManageDashboardCertificationRequest(
            identifier=1,
            certification_details="<script>alert(1)</script>Verified details",
        )
        assert "<script>" not in (request.certification_details or "")

    @pytest.mark.asyncio
    async def test_certified_by_sanitized_to_empty_rejected(
        self, mcp_server: object
    ) -> None:
        """HTML-only input must not be silently treated as a clear request."""
        from pydantic import ValidationError

        from superset.mcp_service.dashboard.schemas import (
            ManageDashboardCertificationRequest,
        )

        with pytest.raises(ValidationError, match="explicit empty string"):
            ManageDashboardCertificationRequest(identifier=1, certified_by="<b></b>")

    @pytest.mark.asyncio
    async def test_certification_details_sanitized_to_empty_rejected(
        self, mcp_server: object
    ) -> None:
        """HTML-only input must not be silently treated as a clear request."""
        from pydantic import ValidationError

        from superset.mcp_service.dashboard.schemas import (
            ManageDashboardCertificationRequest,
        )

        with pytest.raises(ValidationError, match="explicit empty string"):
            ManageDashboardCertificationRequest(
                identifier=1, certification_details="<script>alert(1)</script>"
            )
