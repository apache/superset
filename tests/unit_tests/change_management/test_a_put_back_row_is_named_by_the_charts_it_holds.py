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
"""A row has no name, so the sentence names what is inside it.

When everything a save put back is a container -- a row, a column, a tabs
strip -- the component namer has nothing to show: a container's own record is
its list of children and its ancestry, and when the children themselves are
still in the same places there is no chart, heading or tab to point at. The
answer used to be "this save undid 1 layout change your draft had made:
changed arrangement", which tells an author that something of theirs went and
not what, and on a dashboard of forty tiles leaves them nowhere to look.

The components *inside* the container do have names, and the review panel
already names an unnamed container by them (``api._holding``). So does this
now, in the panel's own words, so an author can match the sentence to the
line they will read beside it.

Two shapes reach it, both real. The dashboard editor rewrites a node's
``parents`` for every descendant when a row moves, so a draft can hold a row
whose ancestry differs and whose children do not. And a row's ``children``
can name a component that is in neither layout -- a chart hard-deleted after
the draft was written, or a hand-built body.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval.changes import layout_put_back, UNNAMEABLE_LAYOUT_LABEL
from asset_approval.http import put_back_sentence

from superset.utils import json


def _chart(component_id: str, chart_id: int, name: str) -> dict[str, Any]:
    return {
        "type": "CHART",
        "id": component_id,
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
        "meta": {"chartId": chart_id, "sliceName": name, "width": 4, "height": 50},
    }


def _live_layout() -> dict[str, Any]:
    return {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID"],
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["CHART-rev", "CHART-units"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        "CHART-rev": _chart("CHART-rev", 1, "Quarterly Revenue"),
        "CHART-units": _chart("CHART-units", 2, "Units Sold"),
    }


def _dashboard() -> SimpleNamespace:
    return SimpleNamespace(id=6, position_json=json.dumps(_live_layout()))


def _put_back(draft_layout: dict[str, Any]) -> list[str]:
    return layout_put_back(
        _dashboard(),
        {"position_json": json.dumps(draft_layout)},
        {"position_json": json.dumps(_live_layout())},
    )


def test_a_row_whose_ancestry_the_draft_rewrote_is_named_by_its_charts() -> None:
    draft = _live_layout()
    draft["ROW-1"] = {**draft["ROW-1"], "parents": ["ROOT_ID", "GRID_ID", "TAB-9"]}

    assert _put_back(draft) == [
        "layout: changed row: holding Quarterly Revenue, Units Sold"
    ]


def test_a_row_listing_a_component_nobody_has_is_named_by_its_charts() -> None:
    draft = _live_layout()
    draft["ROW-1"] = {
        **draft["ROW-1"],
        "children": ["CHART-rev", "CHART-units", "CHART-deleted"],
    }

    assert _put_back(draft) == [
        "layout: changed row: holding Quarterly Revenue, Units Sold"
    ]


def test_the_sentence_says_which_row_rather_than_that_something_moved() -> None:
    draft = _live_layout()
    draft["ROW-1"] = {**draft["ROW-1"], "parents": ["ROOT_ID", "GRID_ID", "TAB-9"]}

    sentence = put_back_sentence(_put_back(draft))

    assert sentence == (
        "This save undid 1 layout change your draft had made: "
        "changed row: holding Quarterly Revenue, Units Sold."
    )
    assert UNNAMEABLE_LAYOUT_LABEL not in sentence


def test_a_container_holding_nothing_named_still_says_what_it_is() -> None:
    """An empty row has no charts to name, so the type is all there is -- and
    "changed row" is still a thing an author can find."""
    live = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID"],
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
    }
    draft = {**live, "ROW-1": {**live["ROW-1"], "children": ["CHART-deleted"]}}

    assert layout_put_back(
        SimpleNamespace(id=6, position_json=json.dumps(live)),
        {"position_json": json.dumps(draft)},
        {"position_json": json.dumps(live)},
    ) == ["layout: changed row"]


def test_a_component_with_a_name_of_its_own_is_still_named_by_it() -> None:
    """The container wording is the fallback, not a replacement: a chart that
    came back is named as the chart it is."""
    draft = _live_layout()
    del draft["CHART-rev"]
    draft["ROW-1"] = {**draft["ROW-1"], "children": ["CHART-units"]}

    assert "layout: removed chart: Quarterly Revenue" in _put_back(draft)
