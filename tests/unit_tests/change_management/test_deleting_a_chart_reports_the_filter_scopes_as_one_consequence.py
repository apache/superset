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
"""Deleting a chart reports the scopes it rewrote as one consequence.

A user deleted one chart and the review panel printed about ten more rows
under it: ``Removed · chart_configuration.59`` with a blob of ids, then
``chartsInScope`` and ``tabsInScope`` lists for the dashboard, for every other
chart's cross-filter record and for every native filter. "Priya has to scroll
through this to find the real changes."

Those lists are caches. Superset recomputes them whenever a chart or tab is
added or removed, so they are a consequence of the edit and not an edit. They
are also real stored changes, and a cross-filter scope is reviewable (Visa
Q3; see ``test_a_title_save_does_not_report_the_cross_filter_scopes``). So the
server does not drop them: it flags them ``consequence``, names every chart
and tab in them, and says in one sentence what caused them.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api

from superset.utils import json


@pytest.fixture(autouse=True)
def no_database(mocker: Any) -> None:
    mocker.patch.object(api, "_names_of", return_value={}, create=True)


TABS = {"TAB-d-E0Zc1cTH": "Overview", "TAB-regional": "Regional"}


def _layout(charts: dict[int, str], tabs: tuple[str, ...] = tuple(TABS)) -> dict:
    """A dashboard: tabs, and every chart in one row on the first tab."""
    layout: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["TABS-1"],
            "parents": ["ROOT_ID"],
        },
        "TABS-1": {
            "type": "TABS",
            "id": "TABS-1",
            "children": list(tabs),
            "parents": ["ROOT_ID", "GRID_ID"],
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": [f"CHART-{n}" for n in charts],
            "parents": ["ROOT_ID", "GRID_ID", "TABS-1", tabs[0]],
        },
    }
    for key in tabs:
        layout[key] = {
            "type": "TAB",
            "id": key,
            "children": ["ROW-1"] if key == tabs[0] else [],
            "meta": {"text": TABS[key]},
            "parents": ["ROOT_ID", "GRID_ID", "TABS-1"],
        }
    for n, name in charts.items():
        layout[f"CHART-{n}"] = {
            "type": "CHART",
            "id": f"CHART-{n}",
            "children": [],
            "meta": {"chartId": n, "sliceName": name},
            "parents": ["ROOT_ID", "GRID_ID", "TABS-1", tabs[0], "ROW-1"],
        }
    return layout


def _metadata(
    charts: dict[int, str],
    tabs: tuple[str, ...] = tuple(TABS),
    **extra: Any,
) -> dict[str, Any]:
    """What Superset keeps beside the layout, for these charts and tabs."""
    ids = list(charts)
    return {
        "color_scheme": "supersetColors",
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "chartsInScope": ids,
        },
        "chart_configuration": {
            str(n): {
                "id": n,
                "crossFilters": {
                    "scope": "global",
                    "chartsInScope": [other for other in ids if other != n],
                },
            }
            for n in ids
        },
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-country",
                "name": "Country",
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                "chartsInScope": ids,
                "tabsInScope": list(tabs),
            }
        ],
        **extra,
    }


BEFORE = {59: "Churn", 60: "Revenue", 61: "Signups", 62: "Refunds"}
AFTER = {60: "Revenue", 61: "Signups", 62: "Refunds"}


def _describe(
    stored: dict[str, Any], saved: dict[str, Any], *, layouts: tuple[dict, dict]
) -> dict[str, Any]:
    asset = SimpleNamespace(
        json_metadata=json.dumps(stored), position_json=json.dumps(layouts[0])
    )
    request = SimpleNamespace(
        operation="update",
        command_args={},
        payload_dict={
            "json_metadata": json.dumps({**saved, "positions": layouts[1]})
        },
    )
    [entry] = api.describe_changes(request, asset)
    return entry


def _delete_a_chart() -> dict[str, Any]:
    return _describe(
        _metadata(BEFORE),
        _metadata(AFTER),
        layouts=(_layout(BEFORE), _layout(AFTER)),
    )


def _keys(entry: dict[str, Any]) -> list[str]:
    return [row["key"] for row in entry["entries"]]


def test_one_deleted_chart_is_one_sentence() -> None:
    entry = _delete_a_chart()

    assert entry["consequence_summary"] == (
        "Cross-filter and native filter scopes updated for 1 removed chart (Churn)"
    )


def test_none_of_the_rows_is_a_raw_setting_path() -> None:
    entry = _delete_a_chart()

    assert not any(key.startswith("chart_configuration") for key in _keys(entry))
    assert not any(key.startswith("global_chart_configuration") for key in _keys(entry))
    assert not any("native_filter_configuration" in key for key in _keys(entry))
    # And not a blob of ids either: every value is chart names.
    for row in entry["entries"]:
        assert "[" not in (row.get("before") or "") + (row.get("after") or "")
        assert "59" not in (row.get("before") or "")


def test_the_whole_set_is_still_sent_and_flagged() -> None:
    """Nothing is hidden server-side: sc-129075 was about exactly that."""
    entry = _delete_a_chart()

    assert all(row["consequence"] is True for row in entry["entries"])
    # The dashboard's scope, three other charts' records, one filter, and the
    # deleted chart's own record: every list that moved has its row.
    assert sorted(_keys(entry)) == sorted(
        [
            "Churn · cross-filter settings",
            "Dashboard cross-filtering · charts in scope",
            "Cross-filtering from Revenue · charts in scope",
            "Cross-filtering from Signups · charts in scope",
            "Cross-filtering from Refunds · charts in scope",
            "Country filter · charts in scope",
        ]
    )
    for row in entry["entries"]:
        if row["key"].endswith("charts in scope"):
            assert row["kind"] == "removed"
            assert row["before"] == "Churn"


def test_the_deleted_charts_own_record_says_what_scope_it_had() -> None:
    entry = _delete_a_chart()

    [record] = [
        r for r in entry["entries"] if r["key"].endswith("cross-filter settings")
    ]
    assert record["kind"] == "removed"
    assert record["before"] == "scope: global"


def test_a_removed_tab_is_named_by_its_title_not_its_id() -> None:
    entry = _describe(
        _metadata(AFTER),
        _metadata(AFTER, tabs=("TAB-d-E0Zc1cTH",)),
        layouts=(_layout(AFTER), _layout(AFTER, tabs=("TAB-d-E0Zc1cTH",))),
    )

    [row] = entry["entries"]
    assert row["key"] == "Country filter · tabs in scope"
    assert row["before"] == "Regional"
    assert "TAB-" not in json.dumps(entry)
    assert entry["consequence_summary"] == (
        "Native filter scopes updated for 1 removed tab (Regional)"
    )


def test_a_tab_whose_name_the_layout_does_not_hold_is_shown_by_id() -> None:
    """A fallback, not a guess: an id is better than a name made up."""
    stored = _metadata(AFTER)
    saved = _metadata(AFTER, tabs=("TAB-d-E0Zc1cTH",))
    entry = _describe(stored, saved, layouts=({}, {}))

    [row] = entry["entries"]
    assert row["before"] == "TAB-regional"


def test_charts_added_are_named_in_the_sentence_and_the_rows() -> None:
    entry = _describe(
        _metadata(AFTER),
        _metadata(BEFORE),
        layouts=(_layout(AFTER), _layout(BEFORE)),
    )

    assert entry["consequence_summary"] == (
        "Cross-filter and native filter scopes updated for 1 added chart (Churn)"
    )
    assert {"kind": "added", "key": "Churn · cross-filter settings"}.items() <= next(
        r for r in entry["entries"] if r["key"].startswith("Churn")
    ).items()
    [country] = [r for r in entry["entries"] if r["key"].startswith("Country")]
    assert country["kind"] == "added"
    assert country["after"] == "Churn"


def test_several_removed_charts_are_all_named() -> None:
    gone = {n: BEFORE[n] for n in (59, 60)}
    entry = _describe(
        _metadata(BEFORE),
        _metadata({n: BEFORE[n] for n in (61, 62)}),
        layouts=(_layout(BEFORE), _layout({n: BEFORE[n] for n in (61, 62)})),
    )

    assert entry["consequence_summary"] == (
        "Cross-filter and native filter scopes updated for "
        "2 removed charts (Churn, Revenue)"
    )
    assert set(gone.values()) == {"Churn", "Revenue"}


def test_a_chart_leaving_a_scope_it_was_not_deleted_from_is_in_the_sentence() -> None:
    """Visa Q3. Nothing was added or removed, so this is the author's edit.

    It must not read as a recalculation: the sentence that is always visible
    names the chart, and its row says which scope it left.
    """
    narrowed = _metadata(BEFORE)
    narrowed["native_filter_configuration"][0]["chartsInScope"] = [59, 60, 62]

    entry = _describe(
        _metadata(BEFORE), narrowed, layouts=(_layout(BEFORE), _layout(BEFORE))
    )

    assert entry["consequence_summary"] == (
        "Native filter scopes updated for "
        "1 chart entering or leaving a scope (Signups)"
    )
    [row] = entry["entries"]
    assert (row["kind"], row["key"], row["before"]) == (
        "removed",
        "Country filter · charts in scope",
        "Signups",
    )


def test_the_authors_own_edit_stays_a_plain_row_ahead_of_the_consequences() -> None:
    saved = _metadata(AFTER, color_scheme="d3Category10")

    entry = _describe(
        _metadata(BEFORE), saved, layouts=(_layout(BEFORE), _layout(AFTER))
    )

    first = entry["entries"][0]
    assert first["key"] == "color_scheme"
    assert "consequence" not in first
    assert [row.get("consequence") for row in entry["entries"][1:]] == [True] * 6
    assert entry["keys"] == ["color_scheme"]


def test_a_scope_the_author_set_is_not_a_consequence() -> None:
    """``scope`` is the author's. Only the lists computed from it are not."""
    saved = _metadata(BEFORE)
    saved["native_filter_configuration"][0]["scope"]["excluded"] = [61]
    saved["native_filter_configuration"][0]["chartsInScope"] = [59, 60, 62]

    entry = _describe(
        _metadata(BEFORE), saved, layouts=(_layout(BEFORE), _layout(BEFORE))
    )

    [edit] = [row for row in entry["entries"] if "consequence" not in row]
    assert edit["key"] == "native_filter_configuration · Country.scope.excluded"
    assert edit["after"] == "[61]"


def test_a_filter_that_arrives_shows_its_scope_lists_in_its_own_row() -> None:
    """The lists are part of what arrived, not something recalculated."""
    saved = _metadata(BEFORE)
    saved["native_filter_configuration"].append(
        {
            "id": "NATIVE_FILTER-region",
            "name": "Region",
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "chartsInScope": [59, 60],
            "tabsInScope": [],
        }
    )

    entry = _describe(
        _metadata(BEFORE), saved, layouts=(_layout(BEFORE), _layout(BEFORE))
    )

    [row] = entry["entries"]
    assert row["kind"] == "added"
    assert row["key"] == "native_filter_configuration · Region"
    assert "chartsInScope" in row["after"]
    assert "consequence" not in row
    assert "consequence_summary" not in entry


def test_a_record_vanishing_for_a_chart_still_on_the_dashboard_is_left_alone() -> None:
    """No chart left, so nothing explains it; it keeps its ordinary row."""
    saved = _metadata(BEFORE)
    del saved["chart_configuration"]["61"]

    entry = _describe(
        _metadata(BEFORE), saved, layouts=(_layout(BEFORE), _layout(BEFORE))
    )

    assert _keys(entry)[0] == "chart_configuration.61"
    assert "consequence" not in entry["entries"][0]


def test_a_scope_cache_in_a_place_nobody_listed_is_left_where_it_was() -> None:
    """Fail open: an unknown shape is shown in full, as it always was."""
    stored = {"something_new": {"chartsInScope": [1, 2, 3]}}
    saved = {"something_new": {"chartsInScope": [1, 2]}}

    entry = _describe(stored, saved, layouts=({}, {}))

    [row] = entry["entries"]
    assert row["key"] == "something_new.chartsInScope"
    assert row["before"] == "[1, 2, 3]"
    assert "consequence" not in row


def test_a_cache_that_is_not_a_list_is_left_where_it_was() -> None:
    stored = _metadata(BEFORE)
    saved = _metadata(BEFORE)
    saved["global_chart_configuration"]["chartsInScope"] = "all"

    entry = _describe(stored, saved, layouts=(_layout(BEFORE), _layout(BEFORE)))

    [row] = entry["entries"]
    assert row["key"] == "global_chart_configuration.chartsInScope"
    assert "consequence" not in row


def test_a_save_that_moved_no_scope_has_no_consequence_group() -> None:
    entry = _describe(
        _metadata(BEFORE),
        _metadata(BEFORE, color_scheme="d3Category10"),
        layouts=(_layout(BEFORE), _layout(BEFORE)),
    )

    assert [row["key"] for row in entry["entries"]] == ["color_scheme"]
    assert "consequence_summary" not in entry


def test_the_layout_still_names_the_deleted_chart() -> None:
    """The real change is where it always was, and leads the field."""
    entry = _delete_a_chart()

    assert {"kind": "removed", "type": "CHART", "name": "Churn"} in entry["layout"][
        "components"
    ]


def test_the_comparison_the_gate_makes_is_untouched() -> None:
    """Separating the rows for the panel must not change what is captured."""
    from asset_approval.changes import changed_fields

    asset = SimpleNamespace(
        json_metadata=json.dumps(_metadata(BEFORE)),
        position_json=json.dumps(_layout(BEFORE)),
    )
    payload = {
        "json_metadata": json.dumps(
            {**_metadata(AFTER), "positions": _layout(AFTER)}
        )
    }

    assert changed_fields(asset, payload) == ["json_metadata"]
