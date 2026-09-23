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

from typing import Any

from superset.dashboards.layout import remove_unreachable_components


def reachable_position() -> dict[str, Any]:
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-a"]},
        "ROW-a": {"id": "ROW-a", "type": "ROW", "children": ["CHART-a"]},
        "CHART-a": {"id": "CHART-a", "type": "CHART", "children": []},
        "HEADER_ID": {"id": "HEADER_ID", "type": "HEADER"},
    }


def test_intact_layout_is_returned_unchanged() -> None:
    position = reachable_position()

    assert remove_unreachable_components(position) == (position, [])


def trapped_components(chart_meta: dict[str, Any]) -> dict[str, Any]:
    # the shape of the reported corruption: a column moved into a row nested
    # inside itself, leaving the pair pointing at each other and detached
    return {
        "COLUMN-orphan": {
            "id": "COLUMN-orphan",
            "type": "COLUMN",
            "children": ["CHART-trapped", "ROW-orphan"],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a"],
        },
        "ROW-orphan": {
            "id": "ROW-orphan",
            "type": "ROW",
            "children": ["COLUMN-orphan"],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a", "COLUMN-orphan"],
        },
        "CHART-trapped": {
            "id": "CHART-trapped",
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a", "COLUMN-orphan"],
            "meta": chart_meta,
        },
    }


def test_detached_subtree_with_a_cycle_is_removed() -> None:
    position = reachable_position() | trapped_components({})

    cleaned, removed = remove_unreachable_components(position)

    assert cleaned == reachable_position()
    assert sorted(removed) == ["CHART-trapped", "COLUMN-orphan", "ROW-orphan"]


def test_detached_chart_is_reattached_to_the_grid() -> None:
    position = reachable_position() | trapped_components({"chartId": 2, "width": 4})

    cleaned, removed = remove_unreachable_components(position)

    assert sorted(removed) == ["CHART-trapped", "COLUMN-orphan", "ROW-orphan"]
    assert "COLUMN-orphan" not in cleaned
    assert "ROW-orphan" not in cleaned
    new_row_id = cleaned["GRID_ID"]["children"][-1]
    assert cleaned["GRID_ID"]["children"] == ["ROW-a", new_row_id]
    assert cleaned[new_row_id]["type"] == "ROW"
    assert cleaned[new_row_id]["children"] == ["CHART-trapped"]
    assert cleaned["CHART-trapped"]["parents"] == ["ROOT_ID", "GRID_ID", new_row_id]
    assert cleaned["CHART-trapped"]["meta"] == {"chartId": 2, "width": 4}
    # the caller's position is not mutated
    assert position["GRID_ID"]["children"] == ["ROW-a"]


def test_detached_markdown_and_header_are_reattached() -> None:
    position = reachable_position() | {
        "COLUMN-orphan": {
            "id": "COLUMN-orphan",
            "type": "COLUMN",
            "children": ["HEADER-trapped", "MARKDOWN-trapped", "ROW-orphan"],
        },
        "ROW-orphan": {
            "id": "ROW-orphan",
            "type": "ROW",
            "children": ["COLUMN-orphan"],
        },
        "HEADER-trapped": {
            "id": "HEADER-trapped",
            "type": "HEADER",
            "children": [],
            "meta": {"text": "Section title"},
        },
        "MARKDOWN-trapped": {
            "id": "MARKDOWN-trapped",
            "type": "MARKDOWN",
            "children": [],
            "meta": {"code": "# Notes", "width": 4},
        },
    }

    cleaned, removed = remove_unreachable_components(position)

    assert sorted(removed) == [
        "COLUMN-orphan",
        "HEADER-trapped",
        "MARKDOWN-trapped",
        "ROW-orphan",
    ]
    new_row_id = cleaned["GRID_ID"]["children"][-1]
    # a header is not a valid row child, so it sits directly in the grid
    assert cleaned["GRID_ID"]["children"] == ["ROW-a", "HEADER-trapped", new_row_id]
    assert cleaned["HEADER-trapped"]["parents"] == ["ROOT_ID", "GRID_ID"]
    assert cleaned["HEADER-trapped"]["meta"] == {"text": "Section title"}
    assert cleaned[new_row_id]["children"] == ["MARKDOWN-trapped"]
    assert cleaned["MARKDOWN-trapped"]["parents"] == ["ROOT_ID", "GRID_ID", new_row_id]
    assert cleaned["MARKDOWN-trapped"]["meta"] == {"code": "# Notes", "width": 4}


def test_detached_chart_is_reattached_to_the_first_tab() -> None:
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS-t"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []},
        "TABS-t": {
            "id": "TABS-t",
            "type": "TABS",
            "children": ["TAB-1", "TAB-2"],
            "parents": ["ROOT_ID"],
        },
        "TAB-1": {
            "id": "TAB-1",
            "type": "TAB",
            "children": [],
            "parents": ["ROOT_ID", "TABS-t"],
        },
        "TAB-2": {"id": "TAB-2", "type": "TAB", "children": []},
        "CHART-trapped": {
            "id": "CHART-trapped",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": 2},
        },
    }

    cleaned, _ = remove_unreachable_components(position)

    [new_row_id] = cleaned["TAB-1"]["children"]
    assert cleaned["CHART-trapped"]["parents"] == [
        "ROOT_ID",
        "TABS-t",
        "TAB-1",
        new_row_id,
    ]


def test_detached_chart_already_placed_is_not_duplicated() -> None:
    position = reachable_position()
    position["CHART-a"]["meta"] = {"chartId": 2}
    position |= trapped_components({"chartId": 2})

    cleaned, _ = remove_unreachable_components(position)

    assert "CHART-trapped" not in cleaned
    assert cleaned["GRID_ID"]["children"] == ["ROW-a"]


def test_detached_charts_wrap_into_rows_by_width() -> None:
    position = reachable_position()
    for index, width in enumerate([6, 6, 4]):
        chart_key = f"CHART-orphan-{index}"
        position[chart_key] = {
            "id": chart_key,
            "type": "CHART",
            "children": [],
            "meta": {"chartId": 10 + index, "width": width},
        }

    cleaned, _ = remove_unreachable_components(position)

    new_rows = cleaned["GRID_ID"]["children"][1:]
    assert [cleaned[row_id]["children"] for row_id in new_rows] == [
        ["CHART-orphan-0", "CHART-orphan-1"],
        ["CHART-orphan-2"],
    ]


def test_malformed_children_do_not_raise() -> None:
    position = reachable_position()
    position["ROW-a"]["children"] = ["CHART-a", ["nested"], {"id": "x"}, 3]
    position["CHART-a"]["children"] = {"not": "a list"}

    assert remove_unreachable_components(position) == (position, [])


def test_detached_grid_of_a_tabbed_dashboard_is_kept() -> None:
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS-t"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []},
        "TABS-t": {"id": "TABS-t", "type": "TABS", "children": ["TAB-1"]},
        "TAB-1": {"id": "TAB-1", "type": "TAB", "children": []},
        "HEADER_ID": {"id": "HEADER_ID", "type": "HEADER"},
    }

    assert remove_unreachable_components(position) == (position, [])


def test_detached_grid_children_are_cleared() -> None:
    position: dict[str, Any] = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS-t"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-stale"]},
        "ROW-stale": {"id": "ROW-stale", "type": "ROW", "children": []},
        "TABS-t": {"id": "TABS-t", "type": "TABS", "children": ["TAB-1"]},
        "TAB-1": {"id": "TAB-1", "type": "TAB", "children": []},
    }

    cleaned, removed = remove_unreachable_components(position)

    assert removed == ["ROW-stale"]
    assert cleaned["GRID_ID"]["children"] == []
    assert position["GRID_ID"]["children"] == ["ROW-stale"]


def test_layout_without_a_root_is_left_alone() -> None:
    position = {"ROW-a": {"id": "ROW-a", "type": "ROW", "children": []}}

    assert remove_unreachable_components(position) == (position, [])


def test_missing_child_reference_does_not_raise() -> None:
    position = reachable_position()
    position["ROW-a"]["children"] = ["CHART-a", "CHART-does-not-exist"]

    assert remove_unreachable_components(position) == (position, [])


def test_malformed_root_children_leave_the_layout_alone() -> None:
    position = reachable_position()
    position["ROOT_ID"]["children"] = {"0": "GRID_ID"}

    assert remove_unreachable_components(position) == (position, [])
