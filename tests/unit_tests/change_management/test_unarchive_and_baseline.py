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
"""Two ways content reached viewers without a second pair of eyes.

Un-archiving put a reviewed delete back on one editor's say-so (QA-17),
and an approval replayed its captured body over an asset that had moved
since, republishing the older content with nothing said (QA-24).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from asset_approval import gate
from asset_approval.changes import baseline_of, changed_fields, moved_since
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.models import ChangeRequest
from asset_approval.replay import build_command
from asset_approval.types import AssetType
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


@pytest.fixture
def capture(mocker: MockerFixture) -> MagicMock:
    """Review on, no open request, and the insert recorded."""
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=5)
    mocker.patch.object(gate, "find_open_request", return_value=None)
    return mocker.patch.object(gate, "_insert_request", return_value=7)


# ----------------------------------------------------------------- un-archive


@pytest.fixture
def unarchive(mocker: MockerFixture) -> tuple[Any, MagicMock]:
    from superset.commands.chart.restore import RestoreChartCommand
    from superset.models.slice import Slice

    chart = Slice(id=11, uuid=uuid4())
    mocker.patch.object(RestoreChartCommand, "validate", return_value=chart)
    restored = mocker.patch.object(Slice, "restore")
    return RestoreChartCommand(str(chart.uuid)), restored


def test_unarchive_is_captured(
    session: Session, unarchive: tuple[Any, MagicMock], capture: MagicMock
) -> None:
    command, restored = unarchive

    with pytest.raises(ChangeRequestCreated):
        command.run()

    restored.assert_not_called()
    args = capture.call_args.args
    assert args[0] is AssetType.CHART
    assert args[1] == 11
    assert args[5] == {gate.COMMAND_KEY: gate.RESTORE_COMMAND}


def test_unarchive_replays_as_the_same_command(session: Session) -> None:
    from superset.commands.chart.restore import RestoreChartCommand

    asset_uuid = str(uuid4())
    command = build_command(
        ChangeRequest(
            id=1,
            asset_type="chart",
            asset_id=11,
            operation="update",
            payload=ChangeRequest.serialize_payload(
                {"uuid": asset_uuid}, {gate.COMMAND_KEY: gate.RESTORE_COMMAND}
            ),
        )
    )

    assert isinstance(command, RestoreChartCommand)
    assert command._model_uuid == asset_uuid


# ------------------------------------------------------------------- baseline


def test_baseline_records_only_the_reviewed_fields() -> None:
    """An exempt change during a review is allowed to coexist with it."""
    asset = MagicMock(slice_name="Funnel", description="old", params='{"a": 1}')

    base = baseline_of(
        asset, {"slice_name": "Renamed", "description": "new", "params": "{}"}
    )

    assert base == {"slice_name": "Funnel", "params": {"a": 1}}


def test_nothing_moved_when_the_asset_is_untouched() -> None:
    asset = MagicMock(slice_name="Funnel")
    assert moved_since(asset, {"slice_name": "Funnel"}) == []


def test_a_field_edited_since_capture_is_reported() -> None:
    asset = MagicMock(slice_name="Renamed outside review")
    assert moved_since(asset, {"slice_name": "Funnel"}) == ["slice_name"]


def test_json_is_compared_by_meaning_not_spelling() -> None:
    """Superset reserialises these columns on every save."""
    asset = MagicMock(params='{"b": 2,  "a": 1}')
    assert moved_since(asset, {"params": {"a": 1, "b": 2}}) == []


def test_a_request_captured_without_a_baseline_is_not_refused() -> None:
    """The check is an addition, not a retroactive refusal of the queue."""
    assert moved_since(MagicMock(slice_name="anything"), {}) == []


# ----------------------------------------------------- never-written booleans


def test_a_null_boolean_told_it_is_false_is_not_a_change() -> None:
    """The dataset schema sends this on every PUT, touched or not (QA-25)."""


    asset = MagicMock(always_filter_main_dttm=None, description="d")
    assert changed_fields(
        asset, {"always_filter_main_dttm": False, "description": "d"}
    ) == []


def test_a_null_boolean_told_it_is_true_is_still_a_change() -> None:
    asset = MagicMock(always_filter_main_dttm=None)
    assert changed_fields(asset, {"always_filter_main_dttm": True}) == [
        "always_filter_main_dttm"
    ]
