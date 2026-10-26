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
"""The write gate: folding further edits into an open draft."""

from __future__ import annotations

from typing import Any

import pytest
from pytest_mock import MockerFixture

from asset_approval import gate
from asset_approval.exceptions import (
    AssetLockedError,
    ChangeRequestCreated,
)
from asset_approval.models import ChangeRequest
from asset_approval.types import AssetType, Operation

AUTHOR_ID = 5


def _open_request(
    body: dict[str, Any], command_args: dict[str, Any] | None = None
) -> ChangeRequest:
    return ChangeRequest(
        id=11,
        asset_type="dashboard",
        asset_id=1,
        operation=Operation.UPDATE.value,
        status="draft",
        author_fk=AUTHOR_ID,
        payload=ChangeRequest.serialize_payload(body, command_args),
    )


@pytest.fixture
def enabled(mocker: MockerFixture) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR_ID)


def test_combine_config_diffs_accumulates_edits() -> None:
    first = {
        "modified": [{"id": "a", "v": 1}, {"id": "b", "v": 1}],
        "deleted": ["x"],
        "reordered": ["a", "b"],
    }
    second = {"modified": [{"id": "a", "v": 2}], "deleted": ["b"], "reordered": []}

    combined = gate.combine_config_diffs(first, second)

    # The later edit of "a" wins, "b" was modified then deleted, the earlier
    # delete of "x" is kept, and the last non-empty ordering is kept.
    assert combined == {
        "modified": [{"id": "a", "v": 2}],
        "deleted": ["x", "b"],
        "reordered": ["a", "b"],
    }


def test_combine_config_diffs_revives_deleted_item() -> None:
    combined = gate.combine_config_diffs(
        {"modified": [], "deleted": ["a"]},
        {"modified": [{"id": "a", "v": 3}], "deleted": []},
    )
    assert combined == {"modified": [{"id": "a", "v": 3}], "deleted": []}


def test_combine_key_values_later_keys_win() -> None:
    assert gate.combine_key_values(
        {"color_scheme": "a", "label_colors": {"x": "#fff"}},
        {"color_scheme": "b"},
    ) == {"color_scheme": "b", "label_colors": {"x": "#fff"}}


def test_gate_is_a_noop_with_flag_off(mocker: MockerFixture) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=False)
    insert = mocker.patch.object(gate, "_insert_request")

    assert gate.gate_write(AssetType.DASHBOARD, 1, {"a": 1}) is None
    insert.assert_not_called()


def test_same_kind_edit_is_combined_into_open_draft(
    mocker: MockerFixture, enabled: None
) -> None:
    existing = _open_request(
        {"modified": [{"id": "a"}], "deleted": []}, {gate.COMMAND_KEY: "native_filters"}
    )
    mocker.patch.object(gate, "find_open_request", return_value=existing)
    update = mocker.patch.object(gate, "_update_own_request", return_value=11)

    with pytest.raises(ChangeRequestCreated):
        gate.gate_write(
            AssetType.DASHBOARD,
            1,
            {"modified": [{"id": "b"}], "deleted": []},
            command_args={gate.COMMAND_KEY: "native_filters"},
            combine=gate.combine_config_diffs,
        )

    stored = update.call_args.args[1]
    assert stored["modified"] == [{"id": "a"}, {"id": "b"}]


@pytest.mark.parametrize(
    "existing_kind,new_kind",
    [(None, "native_filters"), ("native_filters", None), ("colors", "native_filters")],
)
def test_different_kind_of_own_draft_is_refused(
    mocker: MockerFixture,
    enabled: None,
    existing_kind: str | None,
    new_kind: str | None,
) -> None:
    existing = _open_request(
        {"dashboard_title": "x"},
        {gate.COMMAND_KEY: existing_kind} if existing_kind else {},
    )
    mocker.patch.object(gate, "find_open_request", return_value=existing)
    update = mocker.patch.object(gate, "_update_own_request")

    with pytest.raises(AssetLockedError) as excinfo:
        gate.gate_write(
            AssetType.DASHBOARD,
            1,
            {"modified": []},
            command_args={gate.COMMAND_KEY: new_kind} if new_kind else None,
        )

    assert "You already have other changes open" in str(excinfo.value)
    update.assert_not_called()


def test_main_update_still_replaces_own_draft(
    mocker: MockerFixture, enabled: None
) -> None:
    """Unchanged behaviour: a full-state save replaces the previous one."""
    existing = _open_request({"dashboard_title": "old"})
    mocker.patch.object(gate, "find_open_request", return_value=existing)
    update = mocker.patch.object(gate, "_update_own_request", return_value=11)

    with pytest.raises(ChangeRequestCreated):
        gate.gate_write(AssetType.DASHBOARD, 1, {"dashboard_title": "new"})

    assert update.call_args.args[1] == {"dashboard_title": "new"}


def test_refuse_unreviewable_write(mocker: MockerFixture) -> None:
    from asset_approval.exceptions import (  # pylint: disable=import-outside-toplevel
        UnreviewableWriteRefusedError,
    )

    mocker.patch.object(gate, "is_enabled", return_value=False)
    gate.refuse_unreviewable_write("Doing it", "Do the other thing.")

    mocker.patch.object(gate, "is_enabled", return_value=True)
    with gate.replaying():
        gate.refuse_unreviewable_write("Doing it", "Do the other thing.")

    with pytest.raises(UnreviewableWriteRefusedError) as excinfo:
        gate.refuse_unreviewable_write("Doing it", "Do the other thing.")
    assert excinfo.value.status == 422
    assert str(excinfo.value) == (
        "Doing it needs review, which this action does not support yet. "
        "Do the other thing."
    )


def test_lock_names_the_holder_by_display_name(
    mocker: MockerFixture, enabled: None
) -> None:
    """The 409 names the other editor the way the review banner does."""
    existing = _open_request({"dashboard_title": "theirs"})
    existing.author_fk = AUTHOR_ID + 1
    existing.author = mocker.Mock(
        first_name="Alex", last_name="Rivera", username="alex"
    )
    mocker.patch.object(gate, "find_open_request", return_value=existing)

    with pytest.raises(AssetLockedError) as excinfo:
        gate.gate_write(AssetType.DASHBOARD, 1, {"dashboard_title": "mine"})

    assert str(excinfo.value).startswith("Alex Rivera already has changes open")
