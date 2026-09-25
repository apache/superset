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
"""Unit tests for RestoreDashboardCommand."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


def test_restore_dashboard_not_found_raises(app_context: None) -> None:
    """RestoreDashboardCommand raises DashboardNotFoundError for missing dashboard."""
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    with patch("superset.daos.dashboard.DashboardDAO.find_by_id", return_value=None):
        cmd = RestoreDashboardCommand("999")
        with pytest.raises(DashboardNotFoundError):
            cmd.run()


def test_restore_active_dashboard_raises_not_found(app_context: None) -> None:
    """RestoreDashboardCommand raises DashboardNotFoundError for non-deleted dashboard."""  # noqa: E501
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = None  # not soft-deleted

    with patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
    ):
        cmd = RestoreDashboardCommand("1")
        with pytest.raises(DashboardNotFoundError):
            cmd.run()


def test_restore_dashboard_forbidden_raises(app_context: None) -> None:
    """RestoreDashboardCommand raises DashboardForbiddenError on permission check."""
    from superset.commands.dashboard.exceptions import DashboardForbiddenError
    from superset.commands.dashboard.restore import RestoreDashboardCommand
    from superset.exceptions import SupersetSecurityException

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def raise_security(*args: object, **kwargs: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch("superset.commands.restore.security_manager") as mock_sec,
    ):
        mock_sec.raise_for_editorship = raise_security

        cmd = RestoreDashboardCommand("1")
        with pytest.raises(DashboardForbiddenError):
            cmd.run()


def test_restore_dashboard_slug_conflict_raises(app_context: None) -> None:
    """Restore raises DashboardSlugConflictError when slug is now claimed by an active dashboard.

    The partial unique index ``WHERE deleted_at IS NULL`` allows another
    dashboard to claim the slug while this one was soft-deleted. The
    command catches that case before flushing so the operator sees a
    domain-specific error instead of an opaque unique-index violation.
    """  # noqa: E501
    from superset.commands.dashboard.exceptions import DashboardSlugConflictError
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dashboard.slug = "q1-report"
    dashboard.id = 42

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch.object(
            RestoreDashboardCommand, "_has_active_slug_twin", return_value=True
        ) as mock_twin_check,
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDashboardCommand("1")
        with pytest.raises(DashboardSlugConflictError):
            cmd.run()

    mock_twin_check.assert_called_once_with(dashboard)


def test_restore_dashboard_no_slug_conflict_when_no_active_collision(
    app_context: None,
) -> None:
    """No collision check fires when no other active dashboard has the same slug."""
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dashboard.slug = "q1-report"
    dashboard.id = 42

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch.object(
            RestoreDashboardCommand, "_has_active_slug_twin", return_value=False
        ),
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDashboardCommand("1")
        cmd.run()

    dashboard.restore.assert_called_once()


def test_restore_dashboard_skips_conflict_check_when_no_slug(
    app_context: None,
) -> None:
    """Dashboards without a slug skip the conflict check entirely."""
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dashboard.slug = None
    dashboard.id = 42

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch.object(
            RestoreDashboardCommand, "_has_active_slug_twin", return_value=True
        ) as mock_twin_check,
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDashboardCommand("1")
        cmd.run()

    # Conflict check should not be consulted when the dashboard has no slug.
    mock_twin_check.assert_not_called()
    dashboard.restore.assert_called_once()


def test_restore_dashboard_runs_conflict_check_for_empty_string_slug(
    app_context: None,
) -> None:
    """An empty-string slug is still subject to the partial unique index, so
    the conflict check must run — the guard is ``is not None``, not truthiness.
    """
    from superset.commands.dashboard.exceptions import DashboardSlugConflictError
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dashboard.slug = ""
    dashboard.id = 42

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
        ),
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch.object(
            RestoreDashboardCommand, "_has_active_slug_twin", return_value=True
        ) as mock_twin_check,
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDashboardCommand("1")
        with pytest.raises(DashboardSlugConflictError):
            cmd.run()

    # Empty string is a real value the unique index enforces — guard must run.
    mock_twin_check.assert_called_once()
