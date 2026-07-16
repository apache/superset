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

"""Tests for the manage_dashboard_owners MCP tool.

"Owners" are USER-type Subjects in the dashboard's ``editors`` list (the
Subject-based model apache/superset#38831 introduced, replacing the legacy
``owners`` relationship).
"""

from typing import Callable
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.subjects.types import SubjectType
from superset.utils import json

DAO_GET: str = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
GET_OR_CREATE_USER_SUBJECT: str = "superset.subjects.utils.get_or_create_user_subject"
POPULATE_SUBJECT_LIST: str = "superset.commands.utils.populate_subject_list"


def _get_or_create_side_effect(
    mapping: dict[int, Mock],
) -> Callable[[int], Mock | None]:
    """Typed stand-in for ``get_or_create_user_subject``'s ``side_effect``:
    resolves a user ID to its mocked Subject, or ``None`` if unknown."""

    def _lookup(user_id: int) -> Mock | None:
        return mapping.get(user_id)

    return _lookup


def _mock_subject(id: int, user_id: int, label: str = "user") -> Mock:
    subject = Mock()
    subject.id = id
    subject.type = SubjectType.USER
    subject.user_id = user_id
    subject.role_id = None
    subject.label = label
    subject.active = True
    return subject


def _mock_dashboard(
    id: int = 42,
    title: str = "Test Dashboard",
    slug: str | None = "test-slug",
    editors: list[Mock] | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.editors = (
        editors if editors is not None else [_mock_subject(100, 1, "admin")]
    )
    return dashboard


class TestManageDashboardOwners:
    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_owner(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        existing = _mock_subject(100, 1, "admin")
        new_owner = _mock_subject(101, 7, "bob")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect(
            {1: existing, 7: new_owner}
        )
        mock_populate.return_value = [existing, new_owner]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [7]}},
            )

        mock_populate.assert_called_once_with(
            [100, 101],
            default_to_user=False,
            ensure_no_lockout=True,
            field_name="editors",
        )
        assert dash.editors == [existing, new_owner]
        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert sorted(o["id"] for o in payload["owners"]) == [100, 101]
        assert payload["added_owner_ids"] == [7]
        assert payload["removed_owner_ids"] == []

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_remove_owner(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        keep = _mock_subject(100, 1, "admin")
        remove = _mock_subject(101, 2, "carol")
        dash = _mock_dashboard(editors=[keep, remove])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({1: keep})
        mock_populate.return_value = [keep]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [2]}},
            )

        mock_populate.assert_called_once_with(
            [100], default_to_user=False, ensure_no_lockout=True, field_name="editors"
        )
        payload = json.loads(result.content[0].text)
        assert payload["removed_owner_ids"] == [2]
        assert [o["id"] for o in payload["owners"]] == [100]

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_remove_all_owners_rejected(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        """Removing every owner must be rejected before any DB write."""
        original_editors = [_mock_subject(100, 1, "admin")]
        dash = _mock_dashboard(editors=original_editors)
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [1]}},
            )

        payload = json.loads(result.content[0].text)
        assert "at least one owner" in (payload.get("error") or "").lower()
        # dashboard.editors must remain untouched
        assert dash.editors is original_editors

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_remove_unknown_owner_id_rejected(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        dash = _mock_dashboard(editors=[_mock_subject(100, 1, "admin")])
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
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [1]}},
            )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True

    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_non_owner_gets_permission_denied(
        self, mock_get: Mock, mcp_server: object
    ) -> None:
        from superset.exceptions import SupersetSecurityException

        dash = _mock_dashboard(editors=[_mock_subject(100, 1, "admin")])
        mock_get.return_value = dash

        with patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SupersetSecurityException(Mock(message="forbidden")),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "manage_dashboard_owners",
                    {"request": {"identifier": 42, "add_owner_ids": [7]}},
                )

        payload = json.loads(result.content[0].text)
        assert payload.get("permission_denied") is True

    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @pytest.mark.asyncio
    async def test_unknown_user_id_in_add_rejected(
        self, mock_get: Mock, mock_get_or_create: Mock, mcp_server: object
    ) -> None:
        existing = _mock_subject(100, 1, "admin")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({1: existing})

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [99999]}},
            )

        payload = json.loads(result.content[0].text)
        assert "not exist" in (payload.get("error") or "").lower()
        assert "find_users" in (payload.get("error") or "")

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_self_removal_auto_readded_warns(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """When populate_subject_list re-adds a caller who tried to remove
        themselves (ensure_no_lockout self-protection), the response
        surfaces a warning instead of silently diverging from what was
        requested."""
        admin = _mock_subject(100, 1, "admin")
        carol = _mock_subject(101, 2, "carol")
        dave = _mock_subject(102, 3, "dave")
        dash = _mock_dashboard(editors=[admin, carol, dave])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect({3: dave})
        # Requested new subject ids == [102] (dave), but populate_subject_list
        # simulates re-adding admin's subject per ensure_no_lockout.
        mock_populate.return_value = [admin, dave]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "remove_owner_ids": [1, 2]}},
            )

        mock_populate.assert_called_once_with(
            [102], default_to_user=False, ensure_no_lockout=True, field_name="editors"
        )
        payload = json.loads(result.content[0].text)
        assert any("automatically re-added" in w for w in payload.get("warnings", []))

    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_add_already_owner_is_noop_without_disclosure(
        self, mock_session: Mock, mock_get: Mock, mcp_server: object
    ) -> None:
        """Adding an ID that is already an owner is a no-op: skip the DB
        write and do not return the full owner list. Otherwise a caller
        could enumerate owners via a disguised "change" request that
        never actually changes anything."""
        existing = _mock_subject(100, 1, "admin")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [1]}},
            )

        mock_session.commit.assert_not_called()
        payload = json.loads(result.content[0].text)
        assert payload["owners"] == []
        assert payload["added_owner_ids"] == []
        assert any("no effective change" in w.lower() for w in payload["warnings"])

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_partial_change_still_discloses_full_owners(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """A request that DOES change something (even if one of several
        requested ops is redundant) still returns the full owner list —
        only a fully no-op request is suppressed."""
        existing = _mock_subject(100, 1, "admin")
        new_owner = _mock_subject(101, 7, "bob")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect(
            {1: existing, 7: new_owner}
        )
        mock_populate.return_value = [existing, new_owner]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                # add_owner_ids includes the already-current owner (1) AND
                # a genuinely new one (7) — net effect is a real change.
                {"request": {"identifier": 42, "add_owner_ids": [1, 7]}},
            )

        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert sorted(o["id"] for o in payload["owners"]) == [100, 101]
        assert payload["added_owner_ids"] == [7]

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

    @pytest.mark.asyncio
    async def test_rejects_boolean_identifier(self, mcp_server: object) -> None:
        """bool subclasses int; identifier=true must not coerce to dashboard ID 1."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_owners",
                    {"request": {"identifier": True, "add_owner_ids": [1]}},
                )

    @pytest.mark.asyncio
    async def test_rejects_boolean_add_owner_ids(self, mcp_server: object) -> None:
        """bool subclasses int; add_owner_ids=[true] must not coerce to user ID 1."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_owners",
                    {"request": {"identifier": 42, "add_owner_ids": [True]}},
                )

    @pytest.mark.asyncio
    async def test_rejects_boolean_remove_owner_ids(self, mcp_server: object) -> None:
        """bool subclasses int; remove_owner_ids=[false] must not coerce to ID 0."""
        from fastmcp.exceptions import ToolError

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "manage_dashboard_owners",
                    {"request": {"identifier": 42, "remove_owner_ids": [False]}},
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
                    "manage_dashboard_owners",
                    {"request": {"identifier": 999999, "add_owner_ids": [1]}},
                )

        payload = json.loads(result.content[0].text)
        assert "not found" not in (payload.get("error") or "").lower()
        assert "database error" in (payload.get("error") or "").lower()
        # The raw exception text must never reach the LLM-facing response.
        assert "connection to server lost" not in (payload.get("error") or "")
        mock_logger.exception.assert_called_once()

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_subjects_not_found_during_populate_returns_error(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """populate_subject_list raising SubjectsNotFoundValidationError
        (subject rows vanished between resolution and validation) must
        surface as the structured could-not-resolve error."""
        from superset.subjects.exceptions import SubjectsNotFoundValidationError

        existing = _mock_subject(100, 1, "admin")
        new_owner = _mock_subject(101, 7, "bob")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect(
            {1: existing, 7: new_owner}
        )
        mock_populate.side_effect = SubjectsNotFoundValidationError()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [7]}},
            )

        payload = json.loads(result.content[0].text)
        assert "could not be resolved" in (payload.get("error") or "").lower()
        assert "find_users" in (payload.get("error") or "")

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_rollback_failure_still_returns_structured_error(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """Even when the rollback itself fails on the already-broken
        session, the caller must still get the structured database-error
        response, not an unhandled exception."""
        from sqlalchemy.exc import SQLAlchemyError

        existing = _mock_subject(100, 1, "admin")
        new_owner = _mock_subject(101, 7, "bob")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect(
            {1: existing, 7: new_owner}
        )
        mock_populate.return_value = [existing, new_owner]
        mock_session.commit.side_effect = SQLAlchemyError("connection lost")
        mock_session.rollback.side_effect = SQLAlchemyError("still broken")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [7]}},
            )

        payload = json.loads(result.content[0].text)
        assert "database error" in (payload.get("error") or "").lower()

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_refresh_failure_after_commit_still_returns_owners(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """A failed post-commit refresh() must not fail the call: the
        response is built from the subjects captured before the commit."""
        from sqlalchemy.exc import SQLAlchemyError

        existing = _mock_subject(100, 1, "admin")
        new_owner = _mock_subject(101, 7, "bob")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect(
            {1: existing, 7: new_owner}
        )
        mock_populate.return_value = [existing, new_owner]
        mock_session.refresh.side_effect = SQLAlchemyError("stale connection")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [7]}},
            )

        assert mock_session.commit.call_count >= 1
        payload = json.loads(result.content[0].text)
        assert payload.get("error") is None
        assert sorted(o["id"] for o in payload["owners"]) == [100, 101]
        assert payload["added_owner_ids"] == [7]

    @patch(POPULATE_SUBJECT_LIST)
    @patch(GET_OR_CREATE_USER_SUBJECT)
    @patch(DAO_GET)
    @patch("superset.extensions.db.session")
    @pytest.mark.asyncio
    async def test_owner_label_sanitized_for_llm_context(
        self,
        mock_session: Mock,
        mock_get: Mock,
        mock_get_or_create: Mock,
        mock_populate: Mock,
        mcp_server: object,
    ) -> None:
        """Owner labels are user-controlled display names; they must be
        wrapped in untrusted-content delimiters before reaching LLM context
        so they cannot be mistaken for trusted instructions."""
        from superset.mcp_service.utils.sanitization import (
            LLM_CONTEXT_CLOSE_DELIMITER,
            LLM_CONTEXT_OPEN_DELIMITER,
        )

        existing = _mock_subject(100, 1, "admin")
        new_owner = _mock_subject(101, 7, "<script>alert(1)</script>")
        dash = _mock_dashboard(editors=[existing])
        mock_get.return_value = dash
        mock_get_or_create.side_effect = _get_or_create_side_effect(
            {1: existing, 7: new_owner}
        )
        mock_populate.return_value = [existing, new_owner]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "manage_dashboard_owners",
                {"request": {"identifier": 42, "add_owner_ids": [7]}},
            )

        payload = json.loads(result.content[0].text)
        new_label = next(o["label"] for o in payload["owners"] if o["id"] == 101)
        assert new_label is not None
        assert new_label.startswith(LLM_CONTEXT_OPEN_DELIMITER)
        assert new_label.endswith(LLM_CONTEXT_CLOSE_DELIMITER)
        assert "<script>alert(1)</script>" in new_label
