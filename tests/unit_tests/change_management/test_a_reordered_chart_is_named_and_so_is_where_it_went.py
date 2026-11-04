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
"""A layout move names the component and says where it went.

The customer swapped two charts in a column. The review read "0 added, 0
removed, 2 moved" and listed one unrelated rename, because a swap is written
down in exactly one place -- the container's ``children`` list -- and both
charts keep byte-identical nodes. The summary compared nodes, found the
container (which it deliberately never names) and counted it.

A move is now an entry beside the add and the remove rows, in their shape:
``{"kind": "changed", "type", "name", "moved": True, "details": [...]}``. A
resize is *not* a move and is reported on its own, as a detail.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api
from superset.utils import json


def _chart(chart_id: int, name: str, **meta: Any) -> dict[str, Any]:
    return {
        "type": "CHART",
        "id": f"CHART-{chart_id}",
        "meta": {"chartId": chart_id, "sliceName": name, **meta},
        "children": [],
        # Deliberately constant: the editor's ``parents`` is not what tells a
        # reorder or a move apart, so a test that leaned on it would pass for
        # the wrong reason.
        "parents": ["ROOT_ID", "GRID_ID"],
    }


def _container(kind: str, key: str, *children: str, **meta: Any) -> dict[str, Any]:
    return {
        "type": kind,
        "id": key,
        "children": list(children),
        "parents": ["ROOT_ID", "GRID_ID"],
        **({"meta": meta} if meta else {}),
    }


def _layout(charts: list[dict[str, Any]], *containers: dict[str, Any]) -> str:
    body: dict[str, Any] = {
        "ROOT_ID": _container("ROOT", "ROOT_ID", "GRID_ID"),
        "GRID_ID": _container(
            "GRID", "GRID_ID", *[c["id"] for c in containers if c["type"] != "COLUMN"]
        ),
    }
    body.update({c["id"]: c for c in charts})
    body.update({c["id"]: c for c in containers})
    return json.dumps(body)


def _components(before: str, after: str) -> list[dict[str, Any]]:
    asset = SimpleNamespace(position_json=before)
    request = SimpleNamespace(
        operation="update", command_args={}, payload_dict={"position_json": after}
    )
    [entry] = api.describe_changes(request, asset)
    return entry["layout"]["components"]


def _named(components: list[dict[str, Any]], name: str) -> dict[str, Any]:
    [found] = [c for c in components if c.get("name") == name]
    return found


def test_two_charts_swapped_in_a_column_are_both_named() -> None:
    charts = [_chart(1, "Revenue"), _chart(2, "Churn")]
    row = _container("ROW", "ROW-1", "COLUMN-1")
    before = _layout(charts, row, _container("COLUMN", "COLUMN-1", "CHART-1", "CHART-2"))
    after = _layout(charts, row, _container("COLUMN", "COLUMN-1", "CHART-2", "CHART-1"))

    components = _components(before, after)

    assert _named(components, "Revenue") == {
        "kind": "changed",
        "type": "CHART",
        "name": "Revenue",
        "moved": True,
        "details": ["position 1 → 2 in column 1 of row 1"],
    }
    assert _named(components, "Churn")["details"] == ["position 2 → 1 in column 1 of row 1"]
    # The column is the thing both lines already say; it gets no line of its own.
    assert not any(c["type"] == "COLUMN" for c in components)


def test_a_chart_dragged_to_another_row_says_which_rows() -> None:
    charts = [_chart(1, "Revenue"), _chart(2, "Churn")]
    before = _layout(
        charts,
        _container("ROW", "ROW-1", "CHART-1"),
        _container("ROW", "ROW-2", "CHART-2"),
    )
    after = _layout(
        charts,
        _container("ROW", "ROW-1"),
        _container("ROW", "ROW-2", "CHART-2", "CHART-1"),
    )

    components = _components(before, after)

    assert components == [
        {
            "kind": "changed",
            "type": "CHART",
            "name": "Revenue",
            "moved": True,
            "details": ["from row 1 to row 2"],
        }
    ]


def test_a_chart_moved_into_a_tab_names_the_tab() -> None:
    charts = [_chart(1, "Revenue")]
    tab = _container("TAB", "TAB-9", "ROW-2", text="Regional breakdown")
    before = _layout(charts, _container("ROW", "ROW-1", "CHART-1"), tab)
    after_body = json.loads(
        _layout(
            charts,
            _container("ROW", "ROW-1"),
            _container("TAB", "TAB-9", "ROW-2", text="Regional breakdown"),
            _container("ROW", "ROW-2", "CHART-1"),
        )
    )
    after_body["GRID_ID"]["children"] = ["ROW-1", "TAB-9"]
    after_body["TAB-9"]["parents"] = ["ROOT_ID", "GRID_ID"]
    after_body["ROW-2"]["parents"] = ["ROOT_ID", "GRID_ID", "TAB-9"]

    components = _components(before, json.dumps(after_body))

    moved = _named(components, "Revenue")
    assert moved["name"] == "Revenue"
    assert moved["details"] == ["from row 1 to row 1 of tab: Regional breakdown"]


def test_a_chart_with_no_name_is_named_by_its_id() -> None:
    bare = {**_chart(1, ""), "meta": {}}
    other = _chart(2, "Churn")
    before = _layout([bare, other], _container("ROW", "ROW-1", "CHART-1", "CHART-2"))
    after = _layout([bare, other], _container("ROW", "ROW-1", "CHART-2", "CHART-1"))

    components = _components(before, after)

    assert _named(components, "CHART-1")["moved"] is True


def test_the_title_the_dashboard_shows_is_the_name() -> None:
    """A chart renamed on the dashboard carries both; the reviewer sees the
    override, so that is what a move is called."""
    charts = [_chart(1, "Items by Product Line", sliceNameOverride="Items sold")]
    charts.append(_chart(2, "Churn"))
    before = _layout(charts, _container("ROW", "ROW-1", "CHART-1", "CHART-2"))
    after = _layout(charts, _container("ROW", "ROW-1", "CHART-2", "CHART-1"))

    assert _named(_components(before, after), "Items sold")["moved"] is True


def test_a_neighbour_leaving_does_not_make_the_rest_move() -> None:
    charts = [_chart(1, "A"), _chart(2, "B"), _chart(3, "C")]
    before = _layout(charts, _container("ROW", "ROW-1", "CHART-1", "CHART-2", "CHART-3"))
    after = _layout(charts[1:], _container("ROW", "ROW-1", "CHART-2", "CHART-3"))

    components = _components(before, after)

    assert components == [{"kind": "removed", "type": "CHART", "name": "A"}]


def test_a_resize_is_reported_as_a_resize_and_not_a_move() -> None:
    before = _layout(
        [_chart(1, "Revenue", width=4, height=50)],
        _container("ROW", "ROW-1", "CHART-1"),
    )
    after = _layout(
        [_chart(1, "Revenue", width=12, height=50)],
        _container("ROW", "ROW-1", "CHART-1"),
    )

    components = _components(before, after)

    assert components == [
        {
            "kind": "changed",
            "type": "CHART",
            "name": "Revenue",
            "details": ["width 4 → 12"],
        }
    ]


def test_a_chart_that_moved_and_was_resized_is_one_line() -> None:
    charts_before = [_chart(1, "Revenue", width=4), _chart(2, "Churn")]
    charts_after = [_chart(1, "Revenue", width=6), _chart(2, "Churn")]
    before = _layout(charts_before, _container("ROW", "ROW-1", "CHART-1", "CHART-2"))
    after = _layout(charts_after, _container("ROW", "ROW-1", "CHART-2", "CHART-1"))

    revenue = _named(_components(before, after), "Revenue")

    assert revenue["moved"] is True
    assert revenue["details"] == ["position 1 → 2 in row 1", "width 4 → 6"]


def test_a_resized_column_is_no_longer_silent() -> None:
    """Resizing a container used to change the count and name nothing."""
    chart = [_chart(1, "Revenue")]
    before = _layout(chart, _container("COLUMN", "COLUMN-1", "CHART-1", width=4))
    after = _layout(chart, _container("COLUMN", "COLUMN-1", "CHART-1", width=6))

    [resized] = _components(before, after)

    assert resized["type"] == "COLUMN"
    assert resized["name"] == "holding Revenue"
    assert resized["details"] == ["width 4 → 6"]
    assert "moved" not in resized


def test_a_row_reordered_among_rows_is_named_by_what_it_holds() -> None:
    charts = [_chart(1, "Revenue"), _chart(2, "Churn")]
    before = _layout(
        charts,
        _container("ROW", "ROW-1", "CHART-1"),
        _container("ROW", "ROW-2", "CHART-2"),
    )
    after_body = json.loads(before)
    after_body["GRID_ID"]["children"] = ["ROW-2", "ROW-1"]

    components = _components(before, json.dumps(after_body))

    assert _named(components, "holding Revenue")["details"] == [
        "position 1 → 2 in the top level"
    ]
    assert _named(components, "holding Churn")["details"] == [
        "position 2 → 1 in the top level"
    ]


def test_a_large_restructure_drops_nothing() -> None:
    """sc-129075 removed a cap because counting was the complaint. A hundred
    charts reversed is a hundred lines, not a summary of them."""
    count = 100
    charts = [_chart(n, f"Chart {n}") for n in range(count)]
    ids = [c["id"] for c in charts]
    before = _layout(charts, _container("ROW", "ROW-1", *ids))
    after = _layout(charts, _container("ROW", "ROW-1", *reversed(ids)))

    components = _components(before, after)

    moved = {c["name"] for c in components if c.get("moved")}
    # The middle two of an even-length reversal sit in the same slot of the
    # reversed list only if the length is odd; here every chart changes place.
    assert moved == {f"Chart {n}" for n in range(count)}
    assert not any("more" in c for c in components)


def test_a_restructure_across_containers_names_every_chart() -> None:
    charts = [_chart(n, f"Chart {n}") for n in range(30)]
    first = [c["id"] for c in charts[:15]]
    second = [c["id"] for c in charts[15:]]
    before = _layout(
        charts,
        _container("ROW", "ROW-1", *first),
        _container("ROW", "ROW-2", *second),
    )
    after = _layout(
        charts,
        _container("ROW", "ROW-1", *second),
        _container("ROW", "ROW-2", *first),
    )

    components = _components(before, after)

    assert len([c for c in components if c["type"] == "CHART"]) == 30
    assert _named(components, "Chart 0")["details"] == ["from row 1 to row 2"]
    assert _named(components, "Chart 29")["details"] == ["from row 2 to row 1"]


def test_the_counts_are_still_there() -> None:
    charts = [_chart(1, "Revenue"), _chart(2, "Churn")]
    before = _layout(charts, _container("COLUMN", "COLUMN-1", "CHART-1", "CHART-2"))
    after = _layout(charts, _container("COLUMN", "COLUMN-1", "CHART-2", "CHART-1"))
    asset = SimpleNamespace(position_json=before)
    request = SimpleNamespace(
        operation="update", command_args={}, payload_dict={"position_json": after}
    )

    [entry] = api.describe_changes(request, asset)

    assert (
        entry["layout"]["added"],
        entry["layout"]["removed"],
        entry["layout"]["changed"],
    ) == (0, 0, 1)


def test_a_layout_riding_in_json_metadata_names_its_moves_too() -> None:
    charts = [_chart(1, "Revenue"), _chart(2, "Churn")]
    before = _layout(charts, _container("ROW", "ROW-1", "CHART-1", "CHART-2"))
    after = _layout(charts, _container("ROW", "ROW-1", "CHART-2", "CHART-1"))
    asset = SimpleNamespace(json_metadata="{}", position_json=before)
    request = SimpleNamespace(
        operation="update",
        command_args={},
        payload_dict={"json_metadata": json.dumps({"positions": json.loads(after)})},
    )

    [entry] = api.describe_changes(request, asset)

    components = entry["layout"]["components"]
    assert _named(components, "Revenue")["moved"] is True
    assert _named(components, "Churn")["moved"] is True


def test_tabs_reordered_are_named_by_their_titles() -> None:
    def tabs(*order: str) -> list[dict[str, Any]]:
        return [
            _container("TABS", "TABS-1", *order),
            _container("TAB", "TAB-a", text="Overview"),
            _container("TAB", "TAB-b", text="Regional"),
        ]

    def layout(*order: str) -> str:
        body = json.loads(_layout([], *tabs(*order)))
        body["GRID_ID"]["children"] = ["TABS-1"]
        return json.dumps(body)

    before, after = layout("TAB-a", "TAB-b"), layout("TAB-b", "TAB-a")

    components = _components(before, after)

    assert _named(components, "Overview")["details"] == ["position 1 → 2 in tabs 1"]
    assert _named(components, "Regional")["details"] == ["position 2 → 1 in tabs 1"]


def test_a_markdown_block_is_named_by_its_first_line() -> None:
    note = {
        "type": "MARKDOWN",
        "id": "MARKDOWN-1",
        "children": [],
        "meta": {"code": "# Overview\n\nA long paragraph."},
    }
    chart = _chart(1, "Revenue")
    before = _layout([note, chart], _container("ROW", "ROW-1", "MARKDOWN-1", "CHART-1"))
    after = _layout([note, chart], _container("ROW", "ROW-1", "CHART-1", "MARKDOWN-1"))

    assert _named(_components(before, after), "# Overview")["moved"] is True
