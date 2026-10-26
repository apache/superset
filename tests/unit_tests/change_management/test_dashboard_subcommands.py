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
"""The dashboard's narrower write endpoints go through review too.

Native filters, chart customizations and colors each have their own command
that overrides ``run``, so the main update's gate never saw them. With
review on they are captured (and replay through the same command), or --
for the background color sync, which nobody authored -- refused.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval import gate
from asset_approval.exceptions import (
    ChangeRequestCreated,
    UnreviewableWriteRefusedError,
)
from asset_approval.models import ChangeRequest
from asset_approval.replay import build_command
from asset_approval.types import AssetType
from superset.commands.dashboard.update import (
    UpdateDashboardChartCustomizationsCommand,
    UpdateDashboardColorsConfigCommand,
    UpdateDashboardCommand,
    UpdateDashboardNativeFiltersCommand,
)

DIFF = {"modified": [{"id": "NATIVE_FILTER-1"}], "deleted": [], "reordered": []}
COLORS = {"color_scheme": "supersetColors", "label_colors": {"a": "#000000"}}


@pytest.fixture
def dashboard(mocker: MockerFixture) -> MagicMock:
    model = MagicMock(id=1, json_metadata="{}")

    def validate(self: UpdateDashboardCommand) -> None:
        self._model = model

    mocker.patch.object(UpdateDashboardCommand, "validate", validate)
    return model


@pytest.fixture
def dao(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.commands.dashboard.update.DashboardDAO")


@pytest.fixture
def capture(mocker: MockerFixture) -> MagicMock:
    """Review on, no open request, and the insert recorded."""
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=5)
    mocker.patch.object(gate, "find_open_request", return_value=None)
    return mocker.patch.object(gate, "_insert_request", return_value=7)


def _captured_args(insert: MagicMock) -> tuple[dict[str, Any], dict[str, Any]]:
    args = insert.call_args.args
    # (asset_type, asset_id, payload, author_id, note, command_args, operation)
    assert args[0] is AssetType.DASHBOARD
    assert args[1] == 1
    return args[2], args[5]


@pytest.mark.parametrize(
    "command_cls,dao_method,kind",
    [
        (
            UpdateDashboardNativeFiltersCommand,
            "update_native_filters_config",
            "native_filters",
        ),
        (
            UpdateDashboardChartCustomizationsCommand,
            "update_chart_customizations_config",
            "chart_customizations",
        ),
    ],
)
def test_config_diff_is_captured_not_applied(
    session: Session,
    dashboard: MagicMock,
    dao: MagicMock,
    capture: MagicMock,
    command_cls: type[UpdateDashboardCommand],
    dao_method: str,
    kind: str,
) -> None:
    with pytest.raises(ChangeRequestCreated) as excinfo:
        command_cls(1, DIFF).run()

    assert excinfo.value.change_request_id == 7
    getattr(dao, dao_method).assert_not_called()
    payload, command_args = _captured_args(capture)
    assert payload == DIFF
    assert command_args == {gate.COMMAND_KEY: kind}


@pytest.mark.parametrize(
    "command_cls,dao_method",
    [
        (UpdateDashboardNativeFiltersCommand, "update_native_filters_config"),
        (
            UpdateDashboardChartCustomizationsCommand,
            "update_chart_customizations_config",
        ),
    ],
)
def test_config_diff_applies_directly_with_flag_off(
    mocker: MockerFixture,
    session: Session,
    dashboard: MagicMock,
    dao: MagicMock,
    command_cls: type[UpdateDashboardCommand],
    dao_method: str,
) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=False)
    insert = mocker.patch.object(gate, "_insert_request")
    getattr(dao, dao_method).return_value = ["config"]

    assert command_cls(1, DIFF).run() == ["config"]

    getattr(dao, dao_method).assert_called_once_with(dashboard, DIFF)
    insert.assert_not_called()


def test_explicit_color_edit_is_captured(
    session: Session, dashboard: MagicMock, dao: MagicMock, capture: MagicMock
) -> None:
    with pytest.raises(ChangeRequestCreated):
        UpdateDashboardColorsConfigCommand(1, COLORS, mark_updated=True).run()

    dao.update_colors_config.assert_not_called()
    payload, command_args = _captured_args(capture)
    assert payload == COLORS
    assert command_args == {gate.COMMAND_KEY: "colors", "mark_updated": True}


def test_background_color_sync_is_refused(
    session: Session, dashboard: MagicMock, dao: MagicMock, capture: MagicMock
) -> None:
    with pytest.raises(UnreviewableWriteRefusedError):
        UpdateDashboardColorsConfigCommand(1, COLORS, mark_updated=False).run()

    dao.update_colors_config.assert_not_called()
    capture.assert_not_called()


@pytest.mark.parametrize("mark_updated", [True, False])
def test_colors_apply_directly_with_flag_off(
    mocker: MockerFixture,
    session: Session,
    dashboard: MagicMock,
    dao: MagicMock,
    mark_updated: bool,
) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=False)
    mocker.patch.object(session, "commit")

    UpdateDashboardColorsConfigCommand(1, COLORS, mark_updated=mark_updated).run()

    dao.update_colors_config.assert_called_once_with(dashboard, COLORS)


@pytest.mark.parametrize(
    "command_args,body,expected_cls",
    [
        ({}, {"dashboard_title": "x"}, UpdateDashboardCommand),
        (
            {gate.COMMAND_KEY: "native_filters"},
            DIFF,
            UpdateDashboardNativeFiltersCommand,
        ),
        (
            {gate.COMMAND_KEY: "chart_customizations"},
            DIFF,
            UpdateDashboardChartCustomizationsCommand,
        ),
        (
            {gate.COMMAND_KEY: "colors", "mark_updated": True},
            COLORS,
            UpdateDashboardColorsConfigCommand,
        ),
    ],
)
def test_replay_rebuilds_the_capturing_command(
    command_args: dict[str, Any],
    body: dict[str, Any],
    expected_cls: type[UpdateDashboardCommand],
) -> None:
    change_request = ChangeRequest(
        asset_type="dashboard",
        asset_id=1,
        operation="update",
        payload=ChangeRequest.serialize_payload(body, command_args),
    )

    command = build_command(change_request)

    assert type(command) is expected_cls
    assert command._model_id == 1
    assert command._properties == body
    if expected_cls is UpdateDashboardColorsConfigCommand:
        assert command._mark_updated is True


def test_replay_refuses_unknown_command() -> None:
    from asset_approval.exceptions import (  # pylint: disable=import-outside-toplevel
        ChangeManagementException,
    )

    change_request = ChangeRequest(
        asset_type="dashboard",
        asset_id=1,
        operation="update",
        payload=ChangeRequest.serialize_payload({}, {gate.COMMAND_KEY: "nope"}),
    )
    with pytest.raises(ChangeManagementException):
        build_command(change_request)


def test_replayed_filter_diff_is_applied(
    session: Session, dashboard: MagicMock, dao: MagicMock, capture: MagicMock
) -> None:
    """Approval runs the captured command with the gate suspended."""
    from asset_approval.replay import (  # pylint: disable=import-outside-toplevel
        apply_change,
    )

    change_request = ChangeRequest(
        asset_type="dashboard",
        asset_id=1,
        operation="update",
        payload=ChangeRequest.serialize_payload(
            DIFF, {gate.COMMAND_KEY: "native_filters"}
        ),
    )
    dao.update_native_filters_config.return_value = ["config"]

    assert apply_change(change_request) == ["config"]

    dao.update_native_filters_config.assert_called_once_with(dashboard, DIFF)
    capture.assert_not_called()
