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
"""A dashboard save posts more than the author edited.

Found running the flow by hand: an editor changed a dashboard title, put it
back, and saved. Nothing was different, and a change request was created
anyway. Three entries inside ``json_metadata`` account for it, and the
author set none of them -- the two derived label-colour maps, which Superset
recomputes from whichever charts rendered, and the layout, which the stored
metadata does not carry at all because the asset keeps it in its own column.
"""

from types import SimpleNamespace
from typing import Any

from asset_approval.changes import baseline_of, changed_fields, moved_since
from superset.utils import json

LAYOUT = {
    "CHART-a": {"id": "CHART-a", "meta": {"chartId": 1, "height": 50, "width": 4}},
    "GRID_ID": {"id": "GRID_ID", "children": ["CHART-a"]},
}


def _dashboard(**fields: Any) -> SimpleNamespace:
    base = {
        "dashboard_title": "USA Births Names",
        "css": "",
        "slug": None,
        "position_json": json.dumps(LAYOUT),
        "json_metadata": json.dumps(
            {
                "chart_configuration": {"1": {"id": 1}},
                "color_scheme": "",
                "label_colors": {"Boys": "#ADD8E6"},
                "cross_filters_enabled": False,
                "shared_label_colors": ["Alex"],
                "map_label_colors": {"Alex": "#111111"},
                "color_scheme_domain": [],
            }
        ),
    }
    base.update(fields)
    return SimpleNamespace(**base)


def _editor_echo(**metadata: Any) -> dict[str, Any]:
    """What the dashboard editor posts back when nothing was edited."""
    body = {
        "chart_configuration": {"1": {"id": 1}},
        "color_scheme": "",
        "label_colors": {"Boys": "#ADD8E6"},
        "cross_filters_enabled": False,
        # recomputed from whatever rendered, and wider than what is stored
        "shared_label_colors": ["Alex", "Blair", "Cameron"],
        "map_label_colors": {"Alex": "#111111", "Blair": "#222222"},
        "color_scheme_domain": [],
        # the layout, which the stored metadata does not carry
        "positions": LAYOUT,
        # a key the stored metadata has never had
        "filter_scopes": {},
    }
    body.update(metadata)
    return {"dashboard_title": "USA Births Names", "json_metadata": json.dumps(body)}


def test_the_editors_own_echo_is_not_a_change() -> None:
    assert changed_fields(_dashboard(), _editor_echo()) == []


def test_a_recomputed_colour_map_is_not_an_edit() -> None:
    payload = _editor_echo(map_label_colors={"Someone": "#999999"})

    assert changed_fields(_dashboard(), payload) == []


def test_a_colour_the_author_chose_is_still_an_edit() -> None:
    """label_colors is set by a person; the derived maps are not."""
    payload = _editor_echo(label_colors={"Boys": "#000000"})

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_moved_chart_is_still_an_edit() -> None:
    moved = {**LAYOUT, "CHART-a": {"id": "CHART-a", "meta": {"chartId": 1, "height": 80, "width": 4}}}
    payload = _editor_echo(positions=moved)

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_new_entry_in_the_metadata_is_still_an_edit() -> None:
    payload = _editor_echo(refresh_frequency=60)

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_cross_filters_being_switched_on_is_still_an_edit() -> None:
    payload = _editor_echo(cross_filters_enabled=True)

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_cross_filter_scope_change_is_still_an_edit() -> None:
    payload = _editor_echo(chart_configuration={"1": {"id": 1, "crossFilters": {"scope": "global"}}})

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_dashboard_that_cannot_be_read_still_reports_everything() -> None:
    assert changed_fields(None, _editor_echo()) == ["dashboard_title", "json_metadata"]


def test_unparseable_metadata_is_still_compared() -> None:
    live = _dashboard(json_metadata="{{{ not json")

    assert changed_fields(live, _editor_echo()) == ["json_metadata"]


def test_a_background_colour_sync_does_not_make_a_request_stale() -> None:
    """The gate lets that sync through, so it must not strand what is waiting."""
    before = _dashboard()
    baseline = baseline_of(before, _editor_echo())

    after = _dashboard(
        json_metadata=json.dumps(
            {
                "chart_configuration": {"1": {"id": 1}},
                "color_scheme": "",
                "label_colors": {"Boys": "#ADD8E6"},
                "cross_filters_enabled": False,
                "shared_label_colors": ["Alex", "Blair", "Cameron", "Dana"],
                "map_label_colors": {"Alex": "#111111", "Dana": "#333333"},
                "color_scheme_domain": [],
            }
        )
    )

    assert moved_since(after, baseline) == []


def test_a_real_metadata_edit_still_makes_a_request_stale() -> None:
    before = _dashboard()
    baseline = baseline_of(before, _editor_echo())

    after = _dashboard(
        json_metadata=json.dumps(
            {
                "chart_configuration": {"1": {"id": 1}},
                "color_scheme": "supersetColors",
                "label_colors": {"Boys": "#ADD8E6"},
                "cross_filters_enabled": False,
            }
        )
    )

    assert moved_since(after, baseline) == ["json_metadata"]
