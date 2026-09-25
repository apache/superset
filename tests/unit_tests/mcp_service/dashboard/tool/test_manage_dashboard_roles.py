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

from typing import Callable
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.subjects.types import SubjectType
from superset.utils import json

DAO_GET: str = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
GET_OR_CREATE_ROLE_SUBJECT: str = "superset.subjects.utils.get_or_create_role_subject"
IS_FEATURE_ENABLED: str = "superset.is_feature_enabled"


def _get_or_create_side_effect(
    mapping: dict[int, Mock],
) -> Callable[[int], Mock | None]:
    """Typed stand-in for ``get_or_create_role_subject``'s ``side_effect``:
    resolves a role ID to its mocked Subject, or ``None`` if unknown."""

    def _lookup(role_id: int) -> Mock | None:
        return mapping.get(role_id)

    return _lookup


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
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_role(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({5: new_subject})

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        mock_get_or_create.assert_called_once_with(5)
        assert dash.viewers == [new_subject]
        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert [r["id"] for r in payload["roles"]] == [200]
        assert payload["added_role_ids"] == [5]
        assert payload["viewers_enabled"] is True
        assert payload["warnings"] == []

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_commit_failure_rolls_back_and_returns_error(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        """A DB fault during commit must be caught, trigger a rollback, and
        surface as a structured error response rather than an unhandled
        exception."""
        from sqlalchemy.exc import SQLAlchemyError

        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({5: new_subject})
        mock_session.commit.side_effect = SQLAlchemyError("connection lost")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        mock_session.rollback.assert_called_once()
        payload = json.loads(result.content[0].text)
        assert "database error" in (payload.get("error") or "").lower()

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_rollback_failure_still_returns_structured_error(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        """Even when the rollback itself fails on the already-broken
        session, the caller must still get the structured database-error
        response, not an unhandled exception."""
        from sqlalchemy.exc import SQLAlchemyError

        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({5: new_subject})
        mock_session.commit.side_effect = SQLAlchemyError("connection lost")
        mock_session.rollback.side_effect = SQLAlchemyError("still broken")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        payload = json.loads(result.content[0].text)
        assert "database error" in (payload.get("error") or "").lower()

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_refresh_failure_after_commit_returns_captured_values(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        """A failed post-commit refresh() must not fail the call: the
        response is built from values captured before the commit."""
        from sqlalchemy.exc import SQLAlchemyError

        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({5: new_subject})
        mock_session.refresh.side_effect = SQLAlchemyError("stale connection")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert payload.get("error") is None
        assert [r["id"] for r in payload["roles"]] == [200]
        assert payload["added_role_ids"] == [5]

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_viewers_lazy_load_failure_returns_error(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        """A DB fault while lazy-loading dashboard.viewers must surface as
        the structured load error, not an unhandled exception."""
        from sqlalchemy.exc import SQLAlchemyError

        class _ViewersRaise:
            id: int = 42
            dashboard_title: str = "Test Dashboard"
            slug: str = "test-slug"

            @property
            def viewers(self) -> list[Mock]:
                raise SQLAlchemyError("lazy load failed")

        mock_get.return_value = _ViewersRaise()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        payload = json.loads(result.content[0].text)
        assert "failed to load dashboard roles" in (payload.get("error") or "").lower()
        assert "lazy load failed" not in (payload.get("error") or "")

    @patch(IS_FEATURE_ENABLED, return_value=False)
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_role_warns_when_flag_disabled(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        new_subject = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({5: new_subject})

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        payload = json.loads(result.content[0].text)
        assert payload["viewers_enabled"] is False
        assert any("ENABLE_VIEWERS" in w for w in payload["warnings"])

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_remove_role(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        keep = _mock_subject(200, 5, "Analyst")
        remove = _mock_subject(201, 6, "Sales")
        dash = _mock_dashboard(viewers=[keep, remove])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({5: keep})

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "remove_role_ids": [6]}},
            )

        mock_get_or_create.assert_called_once_with(5)
        payload = json.loads(result.content[0].text)
        assert payload["removed_role_ids"] == [6]

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio
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
    async def test_view_only_caller_gets_permission_denied(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
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
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [1]}},
            )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @pytest.mark.asyncio
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
    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_editorship_check_db_fault_returns_database_error(
        self, mock_get: Mock, mock_flag: Mock, mcp_server: object
    ) -> None:
        """``raise_for_editorship`` re-queries the editor relationship, so a
        broken session there must surface as the structured database-error
        response rather than an unhandled exception."""
        from sqlalchemy.exc import SQLAlchemyError

        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash

        with patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SQLAlchemyError("connection lost"),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 42, "add_role_ids": [5]}},
                )

        payload = json.loads(result.content[0].text)
        assert "database error" in (payload.get("error") or "").lower()
        # The raw exception text must never reach the LLM-facing response.
        assert "connection lost" not in (payload.get("error") or "")

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(GET_OR_CREATE_ROLE_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_unknown_role_id_in_add_rejected(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        dash = _mock_dashboard(viewers=[])
        mock_get.return_value = dash
        # get_or_create_role_subject returns None only when no such role
        # exists (an unsynced-but-existing role is synced on demand).
        mock_get_or_create.return_value = None
        mock_get_or_create.side_effect = None

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [99999]}},
            )

        # A rejected request must never leave uncommitted Subject rows
        # (flushed by get_or_create_role_subject for earlier, valid role
        # IDs in the same call) sitting in the session.
        mock_session.rollback.assert_called_once()
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

    @patch(IS_FEATURE_ENABLED, return_value=True)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_already_assigned_role_is_noop_without_disclosure(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_flag: Mock,
        mcp_server: object,
    ) -> None:
        """ "Adding" an already-assigned role is a no-op: no DB write, no
        added/removed deltas, and — mirroring manage_dashboard_owners — an
        EMPTY roles list, so the tool cannot be used as a disguised
        access-role directory lookup."""
        existing = _mock_subject(200, 5, "Analyst")
        dash = _mock_dashboard(viewers=[existing])
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_roles",
                {"request": {"identifier": 42, "add_role_ids": [5]}},
            )

        mock_session.commit.assert_not_called()
        payload = json.loads(result.content[0].text)
        assert payload["roles"] == []
        assert payload["added_role_ids"] == []
        assert payload["removed_role_ids"] == []
        assert any("no effective change" in w.lower() for w in payload["warnings"])
        # URL matches the sibling dashboard tools' /dashboard/... pattern.
        assert payload["dashboard_url"].endswith("/dashboard/test-slug/")
        assert "/superset/dashboard/" not in payload["dashboard_url"]

    @pytest.mark.asyncio
    async def test_rejects_boolean_identifier(self, mcp_server: object) -> None:
        """bool subclasses int; identifier=true must not coerce to dashboard ID 1."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": True, "add_role_ids": [5]}},
                )

    @pytest.mark.asyncio
    async def test_rejects_boolean_add_role_ids(self, mcp_server: object) -> None:
        """bool subclasses int; add_role_ids=[true] must not coerce to role ID 1."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 42, "add_role_ids": [True]}},
                )

    @pytest.mark.asyncio
    async def test_rejects_boolean_remove_role_ids(self, mcp_server: object) -> None:
        """bool subclasses int; remove_role_ids=[false] must not coerce to role ID 0."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 42, "remove_role_ids": [False]}},
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
            "superset.mcp_service.dashboard.tool.governance_utils.logger"
        ) as mock_logger:
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_roles",
                    {"request": {"identifier": 999999, "add_role_ids": [5]}},
                )

        payload = json.loads(result.content[0].text)
        assert "not found" not in (payload.get("error") or "").lower()
        assert "database error" in (payload.get("error") or "").lower()
        assert "connection to server lost" not in (payload.get("error") or "")
        mock_logger.exception.assert_called_once()
