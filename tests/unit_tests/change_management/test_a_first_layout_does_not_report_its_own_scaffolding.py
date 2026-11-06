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
"""R5-01: a title-only save reported four things added to the layout.

The ``json_metadata`` half of R5-01 was fixed by asking the same defaults
table the gate asks. This is the other half, and the fix does not transfer:
``layout_summary`` counts generated element ids, so there is no defaults
table to consult. What it had instead was ``_blob_pair``, which stands an
empty stored blob in as ``{}`` -- right everywhere else, and on a layout it
makes the four structural nodes every v2 layout carries read as four things
the author put there.

The guard is narrow on purpose. Suppressing those nodes whenever they
appear would hide a root-level restructure of a dashboard that already has
a layout, which is the one thing in this area a reviewer most needs. So the
last two tests here matter more than the first.
"""

from __future__ import annotations

from typing import Any

from asset_approval.api import _layout_of
from asset_approval.changes import (
    LAYOUT_SCAFFOLDING,
    layout_summary,
    scaffolding_being_laid_down,
)

# Asked through ``_layout_of``, which is what the panel calls. It runs
# ``_blob_pair`` first, and that is the step that stands a stored NULL in as
# ``{}`` and so creates this defect -- calling ``layout_summary`` directly
# with ``None`` skips it and passes whatever the code does, which is how the
# first draft of this file reported a pass over a fix that silenced a first
# chart.

#: What the editor posts for a dashboard with nothing on it.
BARE: dict[str, Any] = {
    "DASHBOARD_VERSION_KEY": "v2",
    "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
    "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
    "HEADER_ID": {
        "type": "HEADER",
        "id": "HEADER_ID",
        "meta": {"text": "Regional sales"},
    },
}


def _with_a_chart() -> dict[str, Any]:
    layout = {key: dict(value) if isinstance(value, dict) else value
              for key, value in BARE.items()}
    layout["GRID_ID"] = {"type": "GRID", "id": "GRID_ID", "children": ["CHART-ab"]}
    layout["CHART-ab"] = {
        "type": "CHART",
        "id": "CHART-ab",
        "meta": {"sliceName": "Revenue by region"},
    }
    return layout


def test_a_dashboard_stored_without_a_layout_reports_no_layout_change() -> None:
    # The title-only save. Four nodes arrive because the layout is coming
    # into existence, and none of them is a decision anybody made.
    assert _layout_of(None, BARE) is None


def test_an_empty_stored_layout_is_the_same_case() -> None:
    # Stored as "{}" rather than NULL; both exist in the wild.
    assert _layout_of("{}", BARE) is None
    assert layout_summary("{}", BARE) is None


def test_a_chart_on_that_first_save_is_still_reported() -> None:
    # The scaffolding is quiet; the thing the author actually added is not.
    # Getting this wrong in the other direction would silence a first chart,
    # and the first draft of this fix did exactly that.
    layout = _layout_of(None, _with_a_chart())
    assert layout is not None
    assert (layout["added"], layout["removed"], layout["changed"]) == (1, 0, 0)
    # And named, not just counted: one row, the chart, by its own name.
    assert [
        (row["kind"], row.get("name")) for row in layout["components"]
    ] == [("added", "Revenue by region")]


def test_a_dashboard_that_already_has_a_layout_is_untouched() -> None:
    # Nothing is suppressed once there is content, so a root-level
    # restructure reads exactly as it did before this change.
    before = _with_a_chart()
    after = _with_a_chart()
    after["ROOT_ID"] = {
        "type": "ROOT",
        "id": "ROOT_ID",
        "children": ["TABS-xy"],
    }
    assert scaffolding_being_laid_down(before, after) == frozenset()
    summary = layout_summary(before, after)
    assert summary is not None
    assert summary["changed"] == 1


def test_a_scaffolding_node_arriving_under_a_real_layout_is_reported() -> None:
    # A layout being repaired beneath a dashboard that has one. The author
    # did not do this, and that is precisely why it must be visible.
    before = _with_a_chart()
    del before["HEADER_ID"]
    after = _with_a_chart()
    assert scaffolding_being_laid_down(before, after) == frozenset()
    summary = layout_summary(before, after)
    assert summary == {"added": 1, "removed": 0, "changed": 0}


def test_the_header_text_is_still_an_edit_on_a_bare_dashboard() -> None:
    # HEADER_ID is scaffolding, but its text is the dashboard's own title
    # shown on the grid. Present on both sides, so it is a move, not an
    # arrival, and the narrow guard leaves it alone.
    before = {key: dict(value) if isinstance(value, dict) else value
              for key, value in BARE.items()}
    after = {key: dict(value) if isinstance(value, dict) else value
             for key, value in BARE.items()}
    after["HEADER_ID"] = {
        "type": "HEADER",
        "id": "HEADER_ID",
        "meta": {"text": "Regional sales, EMEA"},
    }
    summary = layout_summary(before, after)
    assert summary == {"added": 0, "removed": 0, "changed": 1}


def test_the_scaffolding_set_matches_what_the_editor_builds() -> None:
    # Pinned against the frontend constants, so a fifth structural node
    # added upstream shows up here rather than silently counting as an
    # author's edit.
    assert LAYOUT_SCAFFOLDING == frozenset(BARE)
