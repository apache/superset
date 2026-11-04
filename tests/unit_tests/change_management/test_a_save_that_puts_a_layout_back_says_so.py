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
"""A dashboard save that puts back layout the draft had changed says so.

Dashboard edit mode opens on the live dashboard, not on the author's draft, so
an edit-mode save posts the whole live layout over whatever layout the draft
held. A tester changed only the dashboard title and lost a removed chart, a
removed column, a removed row and a changed tab, and the answer said
``reverted_fields: []``: the tripwire that already caught a reverted title was
blind to the layout, because the layout is not a field. It travels as
``position_json`` or inside ``json_metadata.positions``.

These pin both halves of the contract. A save that undoes layout the draft had
changed names it, in words a person can act on. A save that merely *carries*
the layout, which every edit-mode save does, says nothing.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import gate
from asset_approval.bindings import _keep_the_layout_the_draft_holds
from asset_approval.changes import layout_put_back, reverted_fields
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.http import captured_message, put_back_sentence, signal_response
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

from superset.utils import json

AUTHOR = 5


def _chart(component_id: str, chart_id: int, name: str) -> dict[str, Any]:
    return {
        "type": "CHART",
        "id": component_id,
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID", "TAB-1", "ROW-1", "COLUMN-1"],
        "meta": {"chartId": chart_id, "sliceName": name, "width": 4, "height": 50},
    }


def _live_layout() -> dict[str, Any]:
    """A tab holding one row, which holds a column, which holds two charts."""
    return {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["TAB-1"],
            "parents": ["ROOT_ID"],
        },
        "TAB-1": {
            "type": "TAB",
            "id": "TAB-1",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"text": "Sales Overview"},
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["COLUMN-1"],
            "parents": ["ROOT_ID", "GRID_ID", "TAB-1"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        "COLUMN-1": {
            "type": "COLUMN",
            "id": "COLUMN-1",
            "children": ["CHART-rev", "CHART-units"],
            "parents": ["ROOT_ID", "GRID_ID", "TAB-1", "ROW-1"],
            "meta": {"width": 4},
        },
        "CHART-rev": _chart("CHART-rev", 1, "Quarterly Revenue"),
        "CHART-units": _chart("CHART-units", 2, "Units Sold"),
    }


def _layout_without_the_revenue_chart() -> dict[str, Any]:
    """What the author's draft left: the chart, its column and its row gone,
    and the tab renamed."""
    layout = _live_layout()
    for gone in ("CHART-rev", "CHART-units", "COLUMN-1", "ROW-1"):
        del layout[gone]
    layout["TAB-1"] = {**layout["TAB-1"], "children": [], "meta": {"text": "Overview"}}
    return layout


def _dashboard() -> SimpleNamespace:
    return SimpleNamespace(
        id=6,
        dashboard_title="Sales Dashboard",
        position_json=json.dumps(_live_layout()),
        json_metadata=json.dumps({"refresh_frequency": 0}),
    )


def _in_metadata(layout: dict[str, Any], **rest: Any) -> str:
    return json.dumps({"refresh_frequency": 0, "positions": layout, **rest})


# ------------------------------------------------------------- the measurement


def test_a_layout_carried_in_json_metadata_that_undoes_the_draft_is_named() -> None:
    """The shipped editor's shape: the layout rides inside ``json_metadata``."""
    drafted = {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}
    body = {"json_metadata": _in_metadata(_live_layout()), "dashboard_title": "T QA1"}

    put_back = reverted_fields(_dashboard(), drafted, body)

    assert put_back == [
        "layout: changed tab: Sales Overview",
        "layout: removed chart: Quarterly Revenue",
        "layout: removed chart: Units Sold",
        "layout: removed column",
        "layout: removed row",
    ]


def test_a_raw_position_json_that_undoes_the_draft_is_named() -> None:
    """The REST shape, and the column's name is never what the author is told."""
    drafted = {"position_json": json.dumps(_layout_without_the_revenue_chart())}
    body = {"position_json": json.dumps(_live_layout())}

    put_back = reverted_fields(_dashboard(), drafted, body)

    assert "layout: removed chart: Quarterly Revenue" in put_back
    assert "position_json" not in put_back


def test_the_two_shapes_are_read_against_each_other() -> None:
    """A draft held in one shape and a save posted in the other is the same
    layout; the shape the layout travelled in is not what was undone."""
    drafted = {"position_json": json.dumps(_layout_without_the_revenue_chart())}
    body = {"json_metadata": _in_metadata(_live_layout())}

    assert "layout: removed chart: Quarterly Revenue" in reverted_fields(
        _dashboard(), drafted, body
    )


def test_components_that_read_the_same_are_counted_not_repeated() -> None:
    live = _live_layout()
    live["COLUMN-2"] = {**live["COLUMN-1"], "id": "COLUMN-2", "children": []}
    live["ROW-1"]["children"] = ["COLUMN-1", "COLUMN-2"]
    live["COLUMN-3"] = {**live["COLUMN-1"], "id": "COLUMN-3", "children": []}
    live["ROW-1"]["children"].append("COLUMN-3")
    dashboard = SimpleNamespace(id=6, position_json=json.dumps(live))
    drafted = {k: v for k, v in live.items() if k not in ("COLUMN-2", "COLUMN-3")}
    drafted["ROW-1"] = {**live["ROW-1"], "children": ["COLUMN-1"]}

    assert layout_put_back(
        dashboard,
        {"position_json": json.dumps(drafted)},
        {"position_json": json.dumps(live)},
    ) == ["layout: removed column x2"]


# ------------------------------------------------- what is not a revert


def test_a_save_that_carries_the_layout_without_undoing_anything_says_nothing() -> None:
    """Every edit-mode save legitimately carries the whole layout. The draft
    here moved nothing in it, so there is nothing to have undone."""
    drafted = {"dashboard_title": "Renamed"}
    body = {
        "dashboard_title": "Renamed again",
        "json_metadata": _in_metadata(_live_layout()),
    }

    assert reverted_fields(_dashboard(), drafted, body) == []


def test_a_draft_whose_layout_equals_live_has_nothing_to_undo() -> None:
    drafted = {"json_metadata": _in_metadata(_live_layout())}
    body = {"json_metadata": _in_metadata(_live_layout())}

    assert reverted_fields(_dashboard(), drafted, body) == []


def test_a_save_that_keeps_the_drafts_layout_says_nothing() -> None:
    drafted = {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}
    body = {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}

    assert reverted_fields(_dashboard(), drafted, body) == []


def test_a_save_that_states_no_layout_leaves_the_drafts_alone() -> None:
    """The Properties dialog posts a ``json_metadata`` with no layout in it;
    the fold keeps the draft's, so nothing was put back."""
    drafted = {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}
    body = {"json_metadata": json.dumps({"refresh_frequency": 0})}

    assert reverted_fields(_dashboard(), drafted, body) == []


def test_editing_a_component_the_draft_had_changed_is_not_undoing_it() -> None:
    """Neither the draft's version nor live's: a further edit, not a revert."""
    drafted_layout = _live_layout()
    drafted_layout["TAB-1"]["meta"] = {"text": "Overview"}
    body_layout = _live_layout()
    body_layout["TAB-1"]["meta"] = {"text": "Something else"}

    assert (
        reverted_fields(
            _dashboard(),
            {"json_metadata": _in_metadata(drafted_layout)},
            {"json_metadata": _in_metadata(body_layout)},
        )
        == []
    )


def test_the_layout_is_not_reported_as_the_metadata_it_rode_in() -> None:
    """``json_metadata`` is the column the layout travels in, not a setting
    the draft changed."""
    drafted = {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}
    body = {"json_metadata": _in_metadata(_live_layout())}

    assert "json_metadata" not in reverted_fields(_dashboard(), drafted, body)


def test_the_metadata_beside_the_layout_is_still_watched() -> None:
    """Taking the layout out of the comparison also lets a reverted setting
    next to it be seen, which it could not be with the layout left in."""
    drafted = {
        "json_metadata": _in_metadata(_live_layout(), refresh_frequency=300),
    }
    body = {"json_metadata": _in_metadata(_live_layout())}

    assert reverted_fields(_dashboard(), drafted, body) == ["json_metadata"]


def test_an_asset_without_a_layout_column_says_nothing() -> None:
    chart = SimpleNamespace(id=1, slice_name="x")

    assert layout_put_back(chart, {"position_json": "{}"}, {"position_json": "{}"}) == []


# ------------------------------------------------------------------ the sentence


def test_the_sentence_counts_the_layout_changes_and_names_them() -> None:
    sentence = put_back_sentence(
        [
            "layout: changed tab: Overview",
            "layout: removed chart: Quarterly Revenue",
            "layout: removed column",
            "layout: removed row",
        ]
    )

    assert sentence == (
        "This save undid 4 layout changes your draft had made: "
        "changed tab: Overview, removed chart: Quarterly Revenue, "
        "removed column, removed row."
    )


def test_one_layout_change_is_said_in_the_singular() -> None:
    assert put_back_sentence(["layout: removed chart: Units Sold"]) == (
        "This save undid 1 layout change your draft had made: "
        "removed chart: Units Sold."
    )


def test_a_collapsed_entry_counts_for_every_component_it_stands_for() -> None:
    sentence = put_back_sentence(["layout: removed column x2", "layout: removed row"])

    assert sentence.startswith("This save undid 3 layout changes")


def test_a_setting_and_a_layout_are_each_said_in_their_own_words() -> None:
    sentence = put_back_sentence(["dashboard_title", "layout: removed row"])

    assert sentence == (
        "This save put back 1 setting your draft had changed: dashboard_title. "
        "It also undid 1 layout change your draft had made: removed row."
    )


def test_a_long_layout_list_is_counted_rather_than_recited() -> None:
    sentence = put_back_sentence([f"layout: removed chart: C{n}" for n in range(9)])

    assert "undid 9 layout changes" in sentence
    assert "and 4 more" in sentence
    assert "C7" not in sentence


def test_the_layout_never_reads_as_a_column_name() -> None:
    sentence = put_back_sentence(["layout: removed row"])

    assert "position_json" not in sentence
    assert "setting" not in sentence


# ------------------------------------------------------------------ end to end


@pytest.fixture
def live(mocker: MockerFixture) -> SimpleNamespace:
    asset = _dashboard()
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    return asset


@pytest.fixture
def update(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(gate, "_update_own_request", return_value=7)


def _draft(body: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        author_fk=AUTHOR,
        status=ChangeStatus.DRAFT.value,
        operation=Operation.UPDATE.value,
        command_args={},
        payload_dict=body,
    )


def test_the_title_only_save_that_destroyed_a_layout_now_says_so(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The tester's run: a draft holding a removed chart, column, row and a
    changed tab, then an edit-mode save that changed only the title."""
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}
        ),
    )

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_write(
            AssetType.DASHBOARD,
            6,
            {
                "dashboard_title": "Sales Dashboard QA1",
                "json_metadata": _in_metadata(_live_layout()),
            },
            fold_fields=_keep_the_layout_the_draft_holds,
        )

    assert raised.value.reverted_fields
    assert "layout: removed chart: Quarterly Revenue" in raised.value.reverted_fields
    message = captured_message(raised.value)
    assert "undid 5 layout changes" in message
    assert "removed chart: Quarterly Revenue" in message
    body, _ = signal_response(raised.value)
    assert body["reverted_fields"] == raised.value.reverted_fields


def test_an_edit_mode_save_that_changes_only_the_title_stays_quiet(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The mirror: the draft never touched the layout, so the whole live
    layout riding along with a new title undoes nothing."""
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft({"dashboard_title": "Draft"})
    )

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_write(
            AssetType.DASHBOARD,
            6,
            {
                "dashboard_title": "Sales Dashboard QA1",
                "json_metadata": _in_metadata(_live_layout()),
            },
            fold_fields=_keep_the_layout_the_draft_holds,
        )

    assert raised.value.reverted_fields == []
    assert "undid" not in captured_message(raised.value)


def test_a_properties_save_after_a_layout_draft_stays_quiet(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The fold keeps the draft's layout when the later save states none, so
    saying it was undone would be a false accusation."""
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {"json_metadata": _in_metadata(_layout_without_the_revenue_chart())}
        ),
    )

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_write(
            AssetType.DASHBOARD,
            6,
            {
                "dashboard_title": "Sales Dashboard QA1",
                "json_metadata": json.dumps({"refresh_frequency": 0}),
            },
            fold_fields=_keep_the_layout_the_draft_holds,
        )

    assert raised.value.reverted_fields == []
