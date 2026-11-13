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
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


from typing import Any

import pytest

from superset.utils.dashboard_layout import selected_tab_chart_count


def _layout(tabs_children: list[str], extra: dict[str, Any]) -> dict[str, Any]:
    """Root-level TABS layout; ``extra`` adds the tab contents."""
    layout: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["TABS-root"]},
        "TABS-root": {
            "id": "TABS-root",
            "type": "TABS",
            "children": tabs_children,
            "parents": ["ROOT_ID"],
        },
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "children": [],
            "parents": ["ROOT_ID"],
        },
    }
    layout.update(extra)
    return layout


def _tab(tab_id: str, children: list[str], parents: list[str]) -> dict[str, Any]:
    return {"id": tab_id, "type": "TAB", "children": children, "parents": parents}


def _row(row_id: str, children: list[str], parents: list[str]) -> dict[str, Any]:
    return {"id": row_id, "type": "ROW", "children": children, "parents": parents}


def _chart(chart_id: str, parents: list[str]) -> dict[str, Any]:
    return {"id": chart_id, "type": "CHART", "children": [], "parents": parents}


def _markdown(md_id: str, parents: list[str]) -> dict[str, Any]:
    return {"id": md_id, "type": "MARKDOWN", "children": [], "parents": parents}


ROOT_PARENTS = ["ROOT_ID", "TABS-root"]


def _root_tabs_layout(first_has_chart: bool, second_has_chart: bool) -> dict[str, Any]:
    nodes: dict[str, Any] = {}
    for tab, has_chart, row, leaf in (
        ("TAB-1", first_has_chart, "ROW-1", "CHART-1"),
        ("TAB-2", second_has_chart, "ROW-2", "CHART-2"),
    ):
        nodes[tab] = _tab(tab, [row], ROOT_PARENTS)
        row_parents = [*ROOT_PARENTS, tab]
        if has_chart:
            nodes[row] = _row(row, [leaf], row_parents)
            nodes[leaf] = _chart(leaf, [*row_parents, row])
        else:
            nodes[row] = _row(row, [f"MD-{tab}"], row_parents)
            nodes[f"MD-{tab}"] = _markdown(f"MD-{tab}", [*row_parents, row])
    return _layout(["TAB-1", "TAB-2"], nodes)


def test_markdown_only_root_tab_is_empty() -> None:
    assert selected_tab_chart_count(_root_tabs_layout(True, False), "TAB-2") == (
        0,
        "1",
    )


def test_markdown_only_first_root_tab_uses_grid_id_suffix() -> None:
    assert selected_tab_chart_count(_root_tabs_layout(False, True), "TAB-1") == (
        0,
        "GRID_ID",
    )


def test_root_tab_with_chart_counts_charts() -> None:
    count = selected_tab_chart_count(_root_tabs_layout(False, True), "TAB-2")
    assert count == (1, "1")


def _nested_layout(
    tab1_has_chart: bool, tab2_has_chart: bool, outer_chart: bool = False
) -> dict[str, Any]:
    """Outer root tab A holds nested TABS with two tabs, plus optional outer chart."""
    outer = ["ROOT_ID", "TABS-root", "TAB-A"]
    nested_parents = [*outer, "TABS-nested"]
    nodes: dict[str, Any] = {
        "TAB-A": _tab("TAB-A", ["ROW-A", "TABS-nested"], ROOT_PARENTS),
        "ROW-A": _row("ROW-A", ["CHART-A"] if outer_chart else ["MD-A"], outer),
        "MD-A": _markdown("MD-A", [*outer, "ROW-A"]),
        "CHART-A": _chart("CHART-A", [*outer, "ROW-A"]),
        "TABS-nested": {
            "id": "TABS-nested",
            "type": "TABS",
            "children": ["TAB-N1", "TAB-N2"],
            "parents": outer,
        },
    }
    for tab, has_chart in (("TAB-N1", tab1_has_chart), ("TAB-N2", tab2_has_chart)):
        row = f"ROW-{tab}"
        nodes[tab] = _tab(tab, [row], nested_parents)
        inner_parents = [*nested_parents, tab]
        if has_chart:
            nodes[row] = _row(row, [f"CHART-{tab}"], inner_parents)
            nodes[f"CHART-{tab}"] = _chart(f"CHART-{tab}", [*inner_parents, row])
        else:
            nodes[row] = _row(row, [f"MD-{tab}"], inner_parents)
            nodes[f"MD-{tab}"] = _markdown(f"MD-{tab}", [*inner_parents, row])
    return _layout(["TAB-A"], nodes)


def test_nested_anchor_tab_two_text_only_while_tab_one_has_charts() -> None:
    assert selected_tab_chart_count(_nested_layout(True, False), "TAB-N2") == (
        0,
        "TAB-N2",
    )


def test_nested_anchor_tab_two_with_charts_while_tab_one_is_text_only() -> None:
    result = selected_tab_chart_count(_nested_layout(False, True), "TAB-N2")
    assert result is not None
    assert result[0] > 0


def test_charts_outside_nested_tabs_count_in_ancestor_pane() -> None:
    result = selected_tab_chart_count(
        _nested_layout(False, False, outer_chart=True), "TAB-N2"
    )
    assert result == (1, "TAB-N2")


def test_off_path_tabs_count_their_default_tab() -> None:
    # Anchor is the second root tab; the first root tab (off path) is irrelevant,
    # but a TABS off the path inside the anchor's tab counts only its first child.
    layout = _root_tabs_layout(True, False)
    layout["ROW-2"]["children"] = ["TABS-inner"]
    layout["TABS-inner"] = {
        "id": "TABS-inner",
        "type": "TABS",
        "children": ["TAB-I1", "TAB-I2"],
        "parents": [*ROOT_PARENTS, "TAB-2", "ROW-2"],
    }
    inner = [*ROOT_PARENTS, "TAB-2", "ROW-2", "TABS-inner"]
    layout["TAB-I1"] = _tab("TAB-I1", ["MD-I1"], inner)
    layout["MD-I1"] = _markdown("MD-I1", [*inner, "TAB-I1"])
    layout["TAB-I2"] = _tab("TAB-I2", ["CHART-I2"], inner)
    layout["CHART-I2"] = _chart("CHART-I2", [*inner, "TAB-I2"])
    assert selected_tab_chart_count(layout, "TAB-2") == (0, "1")


def test_tabs_under_grid_use_tab_id_suffix() -> None:
    layout = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "children": ["TABS-g"],
            "parents": ["ROOT_ID"],
        },
        "TABS-g": {
            "id": "TABS-g",
            "type": "TABS",
            "children": ["TAB-G1"],
            "parents": ["ROOT_ID", "GRID_ID"],
        },
        "TAB-G1": _tab("TAB-G1", ["MD-G"], ["ROOT_ID", "GRID_ID", "TABS-g"]),
        "MD-G": _markdown("MD-G", ["ROOT_ID", "GRID_ID", "TABS-g", "TAB-G1"]),
    }
    assert selected_tab_chart_count(layout, "TAB-G1") == (0, "TAB-G1")


@pytest.mark.parametrize("position", [None, {}, [], "x", {"ROOT_ID": "x"}])
def test_unusable_position_returns_none(position: Any) -> None:
    assert selected_tab_chart_count(position, "TAB-1") is None


@pytest.mark.parametrize("anchor", [None, "", 3, "MISSING", "ROW-1", "TABS-root"])
def test_unusable_anchor_returns_none(anchor: Any) -> None:
    assert selected_tab_chart_count(_root_tabs_layout(True, False), anchor) is None


def test_stale_parents_return_none() -> None:
    layout = _root_tabs_layout(True, False)
    layout["TAB-2"]["parents"] = ["ROOT_ID"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_missing_parents_return_none() -> None:
    layout = _root_tabs_layout(True, False)
    del layout["TAB-2"]["parents"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_missing_child_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    del layout["MD-TAB-2"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_non_dict_child_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    layout["MD-TAB-2"] = "oops"
    assert selected_tab_chart_count(layout, "TAB-2") is None


@pytest.mark.parametrize("child_id", [["MD-TAB-2"], {"id": "MD-TAB-2"}, 3, None])
def test_non_string_child_id_returns_none(child_id: Any) -> None:
    layout = _root_tabs_layout(True, False)
    layout["ROW-2"]["children"] = [child_id]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_non_list_children_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    layout["ROW-2"]["children"] = "MD-TAB-2"
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_cycle_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    layout["ROW-2"]["children"] = ["TAB-2"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_anchor_reached_twice_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    layout["TABS-root"]["children"] = ["TAB-1", "TAB-2", "TAB-2"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_unreachable_anchor_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    layout["TABS-root"]["children"] = ["TAB-1"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


@pytest.mark.parametrize("node_type", ["DYNAMIC", "SOMETHING_NEW", None])
def test_unknown_node_type_returns_none(node_type: Any) -> None:
    layout = _root_tabs_layout(True, False)
    layout["ROW-2"]["children"] = ["DYN"]
    layout["DYN"] = {"id": "DYN", "type": node_type, "children": []}
    assert selected_tab_chart_count(layout, "TAB-2") is None


def test_unknown_cases_never_report_zero() -> None:
    """None, not 0, is the answer whenever the layout cannot be trusted."""
    layout = _root_tabs_layout(True, False)
    layout["TAB-2"]["parents"] = ["wrong"]
    assert selected_tab_chart_count(layout, "TAB-2") is None


def _with_chart_ids(layout: dict[str, Any]) -> dict[str, Any]:
    """Give each CHART node a ``meta.chartId`` as a saved dashboard layout has."""
    for index, node in enumerate(
        (n for n in layout.values() if n.get("type") == "CHART"), start=1
    ):
        node["meta"] = {"chartId": index}
    return layout


def test_attached_charts_all_in_layout_keeps_count() -> None:
    layout = _with_chart_ids(_root_tabs_layout(True, False))
    assert selected_tab_chart_count(layout, "TAB-2", attached_chart_ids=[1]) == (
        0,
        "1",
    )


def test_orphan_attached_chart_returns_none() -> None:
    """The frontend appends layout-less charts to the first root tab, so the
    layout alone cannot say a tab is chart-free."""
    layout = _with_chart_ids(_root_tabs_layout(False, False))
    assert selected_tab_chart_count(layout, "TAB-1", attached_chart_ids=[7]) is None
    assert selected_tab_chart_count(layout, "TAB-2", attached_chart_ids=[7]) is None


def test_orphan_among_laid_out_charts_returns_none() -> None:
    layout = _with_chart_ids(_root_tabs_layout(True, False))
    assert selected_tab_chart_count(layout, "TAB-2", attached_chart_ids=[1, 7]) is None


def test_layout_chart_without_chart_id_meta_returns_none() -> None:
    layout = _root_tabs_layout(True, False)
    assert selected_tab_chart_count(layout, "TAB-2", attached_chart_ids=[1]) is None
