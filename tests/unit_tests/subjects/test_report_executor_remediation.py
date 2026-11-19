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
"""sc-120031: the UPGRADING remediation for reports must actually work.

The published-dashboard tightening makes an already-scheduled report
against an unpublished dashboard fail on its next run, so UPDATING.md
tells operators how to fix it. Richard Fogaça's review found the advice
wrong: adding the execution principal as a *viewer* does not restore
access (the viewer branch is itself published-gated), and re-owning the
schedule does not necessarily change who the report runs as. These pins
hold the corrected guidance to its claims — each test names the bullet
it protects, so a future edit that reintroduces bad advice fails here.
"""

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

from superset.exceptions import SupersetSecurityException
from superset.tasks.types import ExecutorType, FixedExecutor
from superset.tasks.utils import get_executor

if TYPE_CHECKING:
    from superset.security.manager import SupersetSecurityManager


def _make_sm() -> "SupersetSecurityManager":
    """Build only the manager shell needed by the patched access gate."""
    # Avoid app-init regression: the manager imports the model registry;
    # resolve it after the app_context fixture initializes the application.
    # pylint: disable=import-outside-toplevel
    from superset.security.manager import SupersetSecurityManager

    return SupersetSecurityManager.__new__(SupersetSecurityManager)


def _make_dashboard(*, published: bool, has_viewers: bool) -> MagicMock:
    dashboard: MagicMock = MagicMock()
    dashboard.published = published
    dashboard.viewers = [MagicMock()] if has_viewers else []
    dashboard.slices = []
    return dashboard


def _gate(
    sm: "SupersetSecurityManager",
    dashboard: MagicMock,
    *,
    is_viewer: bool,
    is_editor: bool,
) -> None:
    """Run the object-read gate as a non-admin, non-guest principal."""
    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=is_editor),
        patch.object(sm, "is_viewer", return_value=is_viewer),
        patch.object(sm, "is_guest_user", return_value=False),
        patch.object(sm, "get_dashboard_access_error_object", return_value=MagicMock()),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_viewer_membership_alone_does_not_unblock_an_unpublished_dashboard(
    app_context: None,
) -> None:
    """The REJECTED remedy: adding the executor as a viewer.

    UPDATING.md must not offer this for an unpublished dashboard — the
    viewer branch requires publication too, so the report keeps failing.
    """
    sm: "SupersetSecurityManager" = _make_sm()
    dashboard: MagicMock = _make_dashboard(published=False, has_viewers=True)

    with pytest.raises(SupersetSecurityException):
        _gate(sm, dashboard, is_viewer=True, is_editor=False)


def test_publishing_unblocks_the_viewer_execution_principal(
    app_context: None,
) -> None:
    """Documented remedy 1: publish, with the principal's read access intact."""
    sm: "SupersetSecurityManager" = _make_sm()
    dashboard: MagicMock = _make_dashboard(published=True, has_viewers=True)

    _gate(sm, dashboard, is_viewer=True, is_editor=False)


def test_editorship_unblocks_regardless_of_published_state(
    app_context: None,
) -> None:
    """Documented remedy 2: grant the principal dashboard editorship.

    Editors are admitted ahead of both the viewer branch and the
    datasource fallback, so this works while the dashboard stays
    unpublished.
    """
    sm: "SupersetSecurityManager" = _make_sm()
    dashboard: MagicMock = _make_dashboard(published=False, has_viewers=True)

    _gate(sm, dashboard, is_viewer=False, is_editor=True)


def test_fixed_executor_ignores_schedule_ownership() -> None:
    """The REJECTED remedy: re-owning the schedule.

    With a FixedExecutor configured the resolved principal is the
    configured account, whatever the schedule's owners or editors say —
    so "re-own the schedule to a dashboard editor" cannot be offered as
    a general fix.
    """
    report: MagicMock = MagicMock()
    report.created_by = MagicMock(username="original_owner")
    report.changed_by = MagicMock(username="original_owner")

    executor_type: ExecutorType
    username: str
    executor_type, username = get_executor(
        executors=[FixedExecutor("reports_service_account")],
        model=report,
    )
    assert executor_type == ExecutorType.FIXED_USER
    assert username == "reports_service_account"

    # Hand the schedule to a different owner/modifier entirely: the
    # resolved execution principal does not move.
    report.created_by = MagicMock(username="dashboard_editor")
    report.changed_by = MagicMock(username="dashboard_editor")
    username_after: str
    _, username_after = get_executor(
        executors=[FixedExecutor("reports_service_account")],
        model=report,
    )
    assert username_after == "reports_service_account"
