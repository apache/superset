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
"""Policy guards on dashboard writes that bypass REST update commands."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from superset.extensions import feature_flag_manager
from superset.models.dashboard import Dashboard
from superset.utils import json


@pytest.fixture(autouse=True)
def enable_policy(mocker: MockerFixture) -> None:
    """Enable the policy while preserving unrelated flag values."""
    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": True}
    )


@pytest.mark.parametrize("enabled", [True, False])
def test_mcp_update_validates_merged_frequency(
    mocker: MockerFixture, enabled: bool
) -> None:
    """MCP refuses a prohibited policy over a retained positive frequency."""
    from superset.mcp_service.dashboard.schemas import UpdateDashboardRequest
    from superset.mcp_service.dashboard.tool.update_dashboard import (
        _validate_update_request,
    )

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": enabled}
    )
    dashboard = Dashboard(json_metadata=json.dumps({"refresh_frequency": 60}))
    request = UpdateDashboardRequest(
        identifier=1,
        json_metadata_overrides={
            "auto_refresh_policy": {"auto_refresh_allowed": False}
        },
    )
    error = _validate_update_request(dashboard, request)
    if enabled:
        assert error is not None
        assert error.error_type == "InvalidRefreshPolicy"
        assert "refresh_frequency" in error.error
    else:
        assert error is None
    assert dashboard.params_dict == {"refresh_frequency": 60}


@pytest.mark.parametrize("enabled", [True, False])
def test_mcp_update_null_and_history(mocker: MockerFixture, enabled: bool) -> None:
    """MCP null removal follows the flag and logs once in the same session."""
    from superset.mcp_service.dashboard.schemas import UpdateDashboardRequest
    from superset.mcp_service.dashboard.tool.update_dashboard import (
        _apply_field_updates,
    )

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": enabled}
    )
    add = mocker.patch("superset.extensions.db.session.add")
    dashboard = Dashboard(id=1, json_metadata=json.dumps({"auto_refresh_policy": {}}))
    request = UpdateDashboardRequest(
        identifier=1, json_metadata_overrides={"auto_refresh_policy": None}
    )
    _apply_field_updates(dashboard, request)
    assert ("auto_refresh_policy" in dashboard.params_dict) is not enabled
    assert add.call_count == int(enabled)
    if enabled:
        assert json.loads(add.call_args.args[0].json) == {
            "old": {},
            "new": None,
            "source": "mcp_update",
        }


def test_restore_rejects_policy_before_reverting(mocker: MockerFixture) -> None:
    """A historical snapshot cannot introduce a policy/frequency contradiction."""
    from superset.commands.dashboard.exceptions import (
        DashboardRefreshPolicyInvalidError,
    )
    from superset.versioning.restore import restore_version

    dashboard = Dashboard(id=1, uuid=uuid4(), json_metadata="{}")
    target = MagicMock(
        json_metadata=json.dumps(
            {
                "auto_refresh_policy": {"auto_refresh_allowed": False},
                "refresh_frequency": 60,
            }
        )
    )
    mocker.patch(
        "superset.versioning.restore._find_target_version", return_value=target
    )
    with pytest.raises(DashboardRefreshPolicyInvalidError):
        restore_version(Dashboard, dashboard.uuid, 1, entity=dashboard)
    target.revert.assert_not_called()
    assert dashboard.params_dict == {}

    from superset.versioning.api_helpers import restore_version_endpoint

    api = MagicMock()
    api.response.return_value = "response-422"
    command = MagicMock()
    command.return_value.run.side_effect = lambda: restore_version(
        Dashboard, dashboard.uuid, 1, entity=dashboard
    )
    response = restore_version_endpoint(
        api, Dashboard, command, str(dashboard.uuid), str(uuid4())
    )
    assert response == "response-422"
    assert api.response.call_args.args == (422,)
    assert api.response.call_args.kwargs["errors"]
    target.revert.assert_not_called()


def test_mcp_title_update_preserves_removed_default(mocker: MockerFixture) -> None:
    """An unrelated MCP update preserves refresh settings outside the admin list."""
    from flask import current_app

    from superset.mcp_service.dashboard.schemas import UpdateDashboardRequest
    from superset.mcp_service.dashboard.tool.update_dashboard import (
        _apply_field_updates,
        _validate_update_request,
    )

    mocker.patch.dict(
        current_app.config,
        {"DASHBOARD_AUTO_REFRESH_INTERVALS": [[0, "Off"], [300, "5 minutes"]]},
    )
    metadata = {"refresh_frequency": 60, "auto_refresh_policy": {}}
    dashboard = Dashboard(id=1, json_metadata=json.dumps(metadata))
    request = UpdateDashboardRequest(identifier=1, dashboard_title="Renamed dashboard")
    assert _validate_update_request(dashboard, request) is None
    _apply_field_updates(dashboard, request)
    assert dashboard.dashboard_title == "Renamed dashboard"
    assert dashboard.params_dict == metadata


def test_restore_layout_preserves_removed_default(mocker: MockerFixture) -> None:
    """Restoring only layout preserves refresh settings outside the admin list."""
    from contextlib import nullcontext

    from flask import current_app

    from superset.versioning.restore import restore_version

    mocker.patch.dict(
        current_app.config,
        {"DASHBOARD_AUTO_REFRESH_INTERVALS": [[0, "Off"], [300, "5 minutes"]]},
    )
    metadata = {"refresh_frequency": 60, "auto_refresh_policy": {}}
    dashboard = Dashboard(id=1, uuid=uuid4(), json_metadata=json.dumps(metadata))
    target = MagicMock(json_metadata=json.dumps(metadata), position_json='{"ROOT": {}}')
    mocker.patch(
        "superset.versioning.restore._find_target_version", return_value=target
    )
    mocker.patch(
        "superset.versioning.restore.single_flush_scope", return_value=nullcontext()
    )
    mocker.patch(
        "superset.versioning.restore._restore_dashboard_membership",
        return_value=([], []),
    )
    mocker.patch("superset.versioning.restore._stamp_audit_fields_for_restore")
    target.revert.side_effect = lambda **kwargs: setattr(
        dashboard, "position_json", target.position_json
    )
    result = restore_version(Dashboard, dashboard.uuid, 1, entity=dashboard)
    assert result is not None
    assert result.entity is dashboard
    assert dashboard.position_json == target.position_json
    target.revert.assert_called_once()
    assert dashboard.params_dict == metadata
