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

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest


def test_restore_dashboard_clears_deleted_at(app_context: None) -> None:
    """RestoreDashboardCommand.run() restores a soft-deleted dashboard."""
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1)
    dashboard.id = 1

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = dashboard

    with (
        patch("superset.commands.dashboard.restore.db") as mock_db,
        patch("superset.commands.dashboard.restore.security_manager") as mock_sec,
    ):
        mock_db.session.query.return_value = query_mock
        mock_sec.raise_for_ownership.return_value = None

        cmd = RestoreDashboardCommand(1)
        cmd.run()

    dashboard.restore.assert_called_once()


def test_restore_dashboard_not_found_raises(app_context: None) -> None:
    """RestoreDashboardCommand raises DashboardNotFoundError when missing."""
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = None

    with patch("superset.commands.dashboard.restore.db") as mock_db:
        mock_db.session.query.return_value = query_mock

        cmd = RestoreDashboardCommand(999)
        with pytest.raises(DashboardNotFoundError):
            cmd.run()


def test_restore_active_dashboard_raises_not_found(
    app_context: None,
) -> None:
    """RestoreDashboardCommand raises error for non-deleted dashboard."""
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.restore import RestoreDashboardCommand

    dashboard = MagicMock()
    dashboard.deleted_at = None

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = dashboard

    with patch("superset.commands.dashboard.restore.db") as mock_db:
        mock_db.session.query.return_value = query_mock

        cmd = RestoreDashboardCommand(1)
        with pytest.raises(DashboardNotFoundError):
            cmd.run()


def test_restore_dashboard_forbidden_raises(app_context: None) -> None:
    """RestoreDashboardCommand raises DashboardForbiddenError."""
    from superset.commands.dashboard.exceptions import DashboardForbiddenError
    from superset.commands.dashboard.restore import RestoreDashboardCommand
    from superset.exceptions import SupersetSecurityException

    dashboard = MagicMock()
    dashboard.deleted_at = datetime(2026, 1, 1)

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = dashboard

    def raise_security(*args: object, **kwargs: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with (
        patch("superset.commands.dashboard.restore.db") as mock_db,
        patch("superset.commands.dashboard.restore.security_manager") as mock_sec,
    ):
        mock_db.session.query.return_value = query_mock
        mock_sec.raise_for_ownership = raise_security

        cmd = RestoreDashboardCommand(1)
        with pytest.raises(DashboardForbiddenError):
            cmd.run()
