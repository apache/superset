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

from typing import Any
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


def test_mcp_update_flag_off_checks_only_a_changed_policy_shape(
    mocker: MockerFixture,
) -> None:
    """With the flag off MCP refuses a malformed new policy and keeps a stored one."""
    from superset.mcp_service.dashboard.schemas import UpdateDashboardRequest
    from superset.mcp_service.dashboard.tool.update_dashboard import (
        _validate_update_request,
    )

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    stored = {"auto_refresh_policy": "invalid", "refresh_frequency": 45}
    dashboard = Dashboard(json_metadata=json.dumps(stored))

    error = _validate_update_request(
        dashboard,
        UpdateDashboardRequest(
            identifier=1,
            json_metadata_overrides={
                "auto_refresh_policy": {"auto_refresh_allowed": 1}
            },
        ),
    )
    assert error is not None
    assert error.error_type == "InvalidRefreshPolicy"
    assert error.error == (
        "auto_refresh_policy.auto_refresh_allowed: Must be true or false."
    )

    for request in (
        UpdateDashboardRequest(identifier=1, dashboard_title="Renamed"),
        UpdateDashboardRequest(
            identifier=1, json_metadata_overrides={"refresh_frequency": 60}
        ),
        UpdateDashboardRequest(
            identifier=1,
            json_metadata_overrides={
                "auto_refresh_policy": {
                    "minimum_refresh_interval": {"value": 45, "unit": "seconds"}
                }
            },
        ),
    ):
        assert _validate_update_request(dashboard, request) is None
    assert dashboard.params_dict == stored


SWAPS = [
    ({"auto_refresh_allowed": True}, {"auto_refresh_allowed": 1}),
    ({"auto_refresh_allowed": False}, {"auto_refresh_allowed": 0}),
    (
        {"minimum_refresh_interval": {"value": 1, "unit": "minutes"}},
        {"minimum_refresh_interval": {"value": True, "unit": "minutes"}},
    ),
]


@pytest.mark.parametrize("stored_policy, submitted", SWAPS)
def test_mcp_update_flag_off_refuses_a_boolean_number_swap(
    mocker: MockerFixture, stored_policy: dict[str, Any], submitted: dict[str, Any]
) -> None:
    """With the flag off MCP treats a boolean turned into a number as a change."""
    from superset.mcp_service.dashboard.schemas import UpdateDashboardRequest
    from superset.mcp_service.dashboard.tool.update_dashboard import (
        _validate_update_request,
    )

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    dashboard = Dashboard(
        json_metadata=json.dumps({"auto_refresh_policy": stored_policy})
    )
    error = _validate_update_request(
        dashboard,
        UpdateDashboardRequest(
            identifier=1, json_metadata_overrides={"auto_refresh_policy": submitted}
        ),
    )
    assert error is not None
    assert error.error_type == "InvalidRefreshPolicy"


@pytest.mark.parametrize("stored_policy, submitted", SWAPS)
def test_restore_flag_off_refuses_a_boolean_number_swap(
    mocker: MockerFixture, stored_policy: dict[str, Any], submitted: dict[str, Any]
) -> None:
    """With the flag off a restore treats a boolean turned into a number as a change."""
    from superset.commands.dashboard.exceptions import (
        DashboardRefreshPolicyInvalidError,
    )
    from superset.versioning.restore import restore_version

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    current = {"auto_refresh_policy": stored_policy}
    dashboard = Dashboard(id=1, uuid=uuid4(), json_metadata=json.dumps(current))
    target = MagicMock(json_metadata=json.dumps({"auto_refresh_policy": submitted}))
    _restore_mocks(mocker, dashboard, target)
    with pytest.raises(DashboardRefreshPolicyInvalidError):
        restore_version(Dashboard, dashboard.uuid, 1, entity=dashboard)
    target.revert.assert_not_called()
    assert dashboard.params_dict == current


def _restore_mocks(mocker: MockerFixture, dashboard: Dashboard, target: Any) -> None:
    """Patch the parts of a restore that need a database."""
    from contextlib import nullcontext

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
        dashboard, "json_metadata", target.json_metadata
    )


def test_restore_flag_off_refuses_a_malformed_policy(mocker: MockerFixture) -> None:
    """With the flag off a restore can't bring back a different malformed policy."""
    from superset.commands.dashboard.exceptions import (
        DashboardRefreshPolicyInvalidError,
    )
    from superset.versioning.restore import restore_version

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    dashboard = Dashboard(id=1, uuid=uuid4(), json_metadata="{}")
    target = MagicMock(json_metadata=json.dumps({"auto_refresh_policy": "invalid"}))
    _restore_mocks(mocker, dashboard, target)
    with pytest.raises(DashboardRefreshPolicyInvalidError) as excinfo:
        restore_version(Dashboard, dashboard.uuid, 1, entity=dashboard)
    assert [error["code"] for error in excinfo.value.errors] == ["invalid_policy"]
    target.revert.assert_not_called()
    assert dashboard.params_dict == {}


@pytest.mark.parametrize(
    "current, restored",
    [
        (
            {"refresh_frequency": 0},
            {
                "auto_refresh_policy": {"auto_refresh_allowed": False},
                "refresh_frequency": 60,
            },
        ),
        (
            {"auto_refresh_policy": "invalid", "refresh_frequency": 0},
            {"auto_refresh_policy": "invalid", "refresh_frequency": 45},
        ),
    ],
)
def test_restore_flag_off_skips_rules_and_unchanged_policies(
    mocker: MockerFixture, current: dict[str, Any], restored: dict[str, Any]
) -> None:
    """With the flag off a well-formed or unchanged policy is restored, no history."""
    from superset.versioning.restore import restore_version

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    add = mocker.patch("superset.extensions.db.session.add")
    dashboard = Dashboard(id=1, uuid=uuid4(), json_metadata=json.dumps(current))
    target = MagicMock(json_metadata=json.dumps(restored))
    _restore_mocks(mocker, dashboard, target)
    assert restore_version(Dashboard, dashboard.uuid, 1, entity=dashboard)
    target.revert.assert_called_once()
    assert dashboard.params_dict == restored
    add.assert_not_called()


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
