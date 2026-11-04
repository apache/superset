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
"""A save that puts the live value back over a draft says so.

The fold stops a *partial* body losing work. It cannot stop a **full**
body doing it: an editing surface that opens on the live asset posts the
live value back for every field it carries, so the second save legitimately
asserts live and the author's first save is gone with the gate behaving
exactly as designed.

So the gate says what happened. Not a refusal -- it cannot tell a revert
the author meant from an edit made on a stale view, and refusing the first
would take away the only way anyone has to undo part of a draft. A sentence
in the answer instead, and the same list as data beside it, on every client
including the REST API and MCP, where no dialog could ever have warned.

It is also the oracle for the surfaces nobody has found yet: if an editing
screen still starts from live, its second save says so in its own response
and a reviewer can read it rather than infer it from a final state.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import gate
from asset_approval.changes import reverted_fields
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.http import (
    captured_message,
    put_back_sentence,
    SAVED_MESSAGE,
    signal_response,
    UPDATED_MESSAGE,
)
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

from superset.utils import json

AUTHOR = 5
LIVE_PARAMS = {"metric": "live_metric", "colour": "live_colour"}


# --------------------------------------------------------------- the measurement


def _chart(**over: Any) -> SimpleNamespace:
    base = {
        "id": 13,
        "slice_name": "Live",
        "description": None,
        "params": json.dumps(LIVE_PARAMS, sort_keys=True),
    }
    base.update(over)
    return SimpleNamespace(**base)


def test_a_top_level_field_put_back_is_named() -> None:
    chart = _chart()

    assert reverted_fields(
        chart, {"slice_name": "Renamed"}, {"slice_name": "Live"}
    ) == ["slice_name"]


def test_a_field_the_body_leaves_out_is_not_a_revert() -> None:
    """The fold keeps the draft's value, so nothing was put back."""
    chart = _chart()

    assert reverted_fields(chart, {"slice_name": "Renamed"}, {"description": "x"}) == []


def test_a_field_the_draft_never_moved_is_not_a_revert() -> None:
    chart = _chart()

    assert reverted_fields(chart, {"slice_name": "Live"}, {"slice_name": "Live"}) == []


def test_a_second_edit_of_the_same_field_is_not_a_revert() -> None:
    """Changing a draft's rename to a different name is editing, not undoing."""
    chart = _chart()

    assert (
        reverted_fields(chart, {"slice_name": "First"}, {"slice_name": "Second"}) == []
    )


def test_params_is_reported_by_the_settings_inside_it() -> None:
    """A chart's whole control set is one field, so naming the field says
    nothing an author can check."""
    chart = _chart()
    drafted = dict(LIVE_PARAMS, metric="drafted_metric", colour="drafted_colour")
    # The second save restores the colour and keeps the drafted metric.
    second = dict(LIVE_PARAMS, metric="drafted_metric")

    assert reverted_fields(
        chart, {"params": json.dumps(drafted)}, {"params": json.dumps(second)}
    ) == ["colour"]
    assert "params" not in reverted_fields(
        chart, {"params": json.dumps(drafted)}, {"params": json.dumps(second)}
    )


def test_a_whole_params_blob_written_back_from_live_names_every_setting() -> None:
    """The Explore case: the page reloaded live, so the save asserts live."""
    chart = _chart()
    drafted = {"metric": "drafted_metric", "colour": "drafted_colour"}

    assert reverted_fields(
        chart,
        {"params": json.dumps(drafted)},
        {"params": json.dumps(LIVE_PARAMS)},
    ) == ["colour", "metric"]


def test_an_unreadable_asset_says_nothing() -> None:
    """Wrong in the quiet direction only: naming a setting a save did not
    touch would be worse than saying nothing at all."""
    assert (
        reverted_fields(None, {"slice_name": "Renamed"}, {"slice_name": "Live"}) == []
    )


def test_a_field_the_asset_does_not_have_says_nothing() -> None:
    chart = _chart()

    assert reverted_fields(chart, {"invented": 1}, {"invented": 2}) == []


# ------------------------------------------------------------------ the sentence


def test_the_ordinary_capture_gains_no_sentence() -> None:
    assert put_back_sentence([]) == ""
    assert captured_message(ChangeRequestCreated(1, "chart", 7)) == SAVED_MESSAGE


def test_one_setting_is_named_in_the_singular() -> None:
    assert put_back_sentence(["colour"]) == (
        "This save put back 1 setting your draft had changed: colour."
    )


def test_several_settings_are_counted_and_named() -> None:
    sentence = put_back_sentence(["colour", "metric"])

    assert sentence.startswith("This save put back 2 settings")
    assert "colour, metric" in sentence


def test_a_long_list_is_counted_rather_than_recited() -> None:
    """An Explore save posts every control, so this list is legitimately
    long and a sentence that recited it would read as a fault."""
    sentence = put_back_sentence([f"setting_{n}" for n in range(9)])

    assert "This save put back 9 settings" in sentence
    assert "and 4 more" in sentence
    assert "setting_5" not in sentence


def test_the_sentence_rides_on_the_fold_message() -> None:
    """Appended, never instead of: where the draft went still has to be said."""
    message = captured_message(
        ChangeRequestCreated(
            1, "chart", 7, updated_existing=True, reverted_fields=["colour"]
        )
    )

    assert message.startswith(UPDATED_MESSAGE)
    assert "put back 1 setting" in message


def test_the_response_carries_the_list_as_data_too() -> None:
    """So a check can assert a field rather than parse English (J5)."""
    body, status = signal_response(
        ChangeRequestCreated(
            1, "chart", 7, updated_existing=True, reverted_fields=["colour", "metric"]
        )
    )

    assert status == 202
    assert body["reverted_fields"] == ["colour", "metric"]
    assert body["review_required"] is True


def test_an_ordinary_capture_carries_an_empty_list() -> None:
    body, _ = signal_response(ChangeRequestCreated(1, "chart", 7))

    assert body["reverted_fields"] == []


def test_the_signal_never_carries_none() -> None:
    """Read by the message builder and by the response, so a None would be
    two different kinds of crash."""
    assert ChangeRequestCreated(1, "chart", 7).reverted_fields == []


# ------------------------------------------------------------------ end to end


@pytest.fixture
def live(mocker: MockerFixture) -> SimpleNamespace:
    asset = _chart()
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    return asset


def _draft(body: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        author_fk=AUTHOR,
        status=ChangeStatus.DRAFT.value,
        operation=Operation.UPDATE.value,
        command_args={},
        payload_dict=body,
    )


@pytest.fixture
def update(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(gate, "_update_own_request", return_value=7)


def test_a_capture_that_undid_part_of_a_draft_reports_it(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    drafted = {"metric": "drafted_metric", "colour": "drafted_colour"}
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft({"params": json.dumps(drafted)})
    )

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_write(
            AssetType.CHART,
            13,
            # A full-state body written from the live chart, which is what
            # an Explore page that reloaded live posts.
            {"params": json.dumps(LIVE_PARAMS), "slice_name": "Renamed"},
            fold_fields=True,
        )

    assert raised.value.reverted_fields == ["colour", "metric"]
    assert "put back 2 settings" in captured_message(raised.value)


def test_a_dashboard_is_told_too(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The dashboard still replaces on a fold -- its layout lives inside
    ``json_metadata`` and a field-level merge there would be silently
    wrong. Until that is lifted, the sentence is what makes the loss
    visible in the save's own answer."""
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft({"slice_name": "Renamed"})
    )

    with pytest.raises(ChangeRequestCreated) as raised:
        # No ``fold_fields``: the dashboard main update, in shape.
        gate.gate_write(
            AssetType.CHART, 13, {"slice_name": "Live", "description": "why"}
        )

    assert raised.value.reverted_fields == ["slice_name"]


def test_the_double_click_race_reports_it_too(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The other fold site has to answer the same way.

    The lookup found the slot free and the insert lost it, which is the
    genuine window one author's double-clicked Save falls into. A tripwire
    that fires on one branch and not the other is no oracle at all.
    """
    from sqlalchemy.exc import IntegrityError

    drafted = {"metric": "drafted_metric", "colour": "drafted_colour"}
    holder = _draft({"params": json.dumps(drafted)})
    mocker.patch.object(gate, "find_open_request", side_effect=[None, holder])

    class _SlotTaken:
        def begin(self) -> Any:
            raise IntegrityError("open slot taken", {}, Exception())

    mocker.patch.object(gate, "db", SimpleNamespace(engine=_SlotTaken()))

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_write(
            AssetType.CHART,
            13,
            # Live's controls written back, plus a rename -- so the save is
            # not itself a no-op and really does reach the insert.
            {"params": json.dumps(LIVE_PARAMS), "slice_name": "Renamed"},
            fold_fields=True,
        )

    assert raised.value.reverted_fields == ["colour", "metric"]
    assert "put back 2 settings" in captured_message(raised.value)


def test_a_first_save_has_nothing_to_report(
    live: SimpleNamespace, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "find_open_request", return_value=None)
    mocker.patch.object(gate, "_insert_request", return_value=7)

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_write(AssetType.CHART, 13, {"slice_name": "Renamed"})

    assert raised.value.reverted_fields == []
