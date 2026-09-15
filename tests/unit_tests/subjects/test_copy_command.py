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

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.dashboard.copy import CopyDashboardCommand
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardInvalidError,
)


def _make_dashboard() -> MagicMock:
    dash = MagicMock()
    dash.id = 1
    dash.dashboard_title = "Original Dashboard"
    return dash


def _make_security_manager(is_editor: bool) -> MagicMock:
    sm = MagicMock()
    sm.is_editor = MagicMock(return_value=is_editor)
    return sm


VALID_DATA = {
    "dashboard_title": "Copied Dashboard",
    "json_metadata": "{}",
}


def test_copy_dashboard_validate_non_editor_forbidden():
    """Non-editors cannot copy a dashboard (is_editor returns False)."""
    dash = _make_dashboard()
    cmd = CopyDashboardCommand(dash, VALID_DATA)
    mock_sm = _make_security_manager(is_editor=False)

    with patch(
        "superset.commands.dashboard.copy.security_manager",
        mock_sm,
    ):
        with pytest.raises(DashboardForbiddenError):
            cmd.validate()
        mock_sm.is_editor.assert_called_once_with(dash)


def test_copy_dashboard_validate_editor_allowed():
    """Editors can copy a dashboard (is_editor returns True)."""
    dash = _make_dashboard()
    cmd = CopyDashboardCommand(dash, VALID_DATA)
    mock_sm = _make_security_manager(is_editor=True)

    with patch(
        "superset.commands.dashboard.copy.security_manager",
        mock_sm,
    ):
        cmd.validate()  # should not raise
        mock_sm.is_editor.assert_called_once_with(dash)


def test_copy_dashboard_validate_missing_title():
    """Missing dashboard_title raises DashboardInvalidError."""
    dash = _make_dashboard()
    data = {"json_metadata": "{}"}
    cmd = CopyDashboardCommand(dash, data)

    with pytest.raises(DashboardInvalidError):
        cmd.validate()


def test_copy_dashboard_validate_missing_json_metadata():
    """Missing json_metadata raises DashboardInvalidError."""
    dash = _make_dashboard()
    data = {"dashboard_title": "Copied Dashboard"}
    cmd = CopyDashboardCommand(dash, data)

    with pytest.raises(DashboardInvalidError):
        cmd.validate()
