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
from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from superset.dashboards.excel_export.layout import get_charts_in_layout_order


def _chart_node(node_id: str, chart_id: int) -> dict[str, Any]:
    return {"id": node_id, "type": "CHART", "meta": {"chartId": chart_id}}


def _dashboard(position: dict[str, Any], chart_ids: list[int]) -> MagicMock:
    dashboard = MagicMock()
    dashboard.position = position
    dashboard.slices = [MagicMock(id=cid) for cid in chart_ids]
    return dashboard


def _ids(slices: list[Any]) -> list[int]:
    return [slc.id for slc in slices]


def test_grid_order() -> None:
    position = {
        "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "children": ["ROW-1"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a", "CHART-b"]},
        "CHART-a": _chart_node("CHART-a", 1),
        "CHART-b": _chart_node("CHART-b", 2),
    }
    dashboard = _dashboard(position, [2, 1])
    assert _ids(get_charts_in_layout_order(dashboard)) == [1, 2]


def test_tab_nested_order() -> None:
    position = {
        "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "children": ["TABS-1"]},
        "TABS-1": {"type": "TABS", "children": ["TAB-1", "TAB-2"]},
        "TAB-1": {"type": "TAB", "children": ["CHART-a"]},
        "TAB-2": {"type": "TAB", "children": ["CHART-b"]},
        "CHART-a": _chart_node("CHART-a", 10),
        "CHART-b": _chart_node("CHART-b", 20),
    }
    dashboard = _dashboard(position, [20, 10])
    assert _ids(get_charts_in_layout_order(dashboard)) == [10, 20]


def test_duplicate_chart_placement_exported_once() -> None:
    position = {
        "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "children": ["ROW-1", "ROW-2"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a"]},
        "ROW-2": {"type": "ROW", "children": ["CHART-a-dup"]},
        "CHART-a": _chart_node("CHART-a", 5),
        "CHART-a-dup": _chart_node("CHART-a-dup", 5),
    }
    dashboard = _dashboard(position, [5])
    assert _ids(get_charts_in_layout_order(dashboard)) == [5]


def test_orphan_charts_appended_by_id() -> None:
    position = {
        "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "children": ["ROW-1"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a"]},
        "CHART-a": _chart_node("CHART-a", 7),
    }
    # Charts 3 and 9 are on the dashboard but not in the layout.
    dashboard = _dashboard(position, [7, 9, 3])
    assert _ids(get_charts_in_layout_order(dashboard)) == [7, 3, 9]


def test_stale_layout_chart_skipped() -> None:
    position = {
        "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "children": ["ROW-1"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a", "CHART-gone"]},
        "CHART-a": _chart_node("CHART-a", 1),
        "CHART-gone": _chart_node("CHART-gone", 999),  # not in dashboard.slices
    }
    dashboard = _dashboard(position, [1])
    assert _ids(get_charts_in_layout_order(dashboard)) == [1]


def test_empty_position_returns_all_slices_sorted() -> None:
    dashboard = _dashboard({}, [3, 1, 2])
    assert _ids(get_charts_in_layout_order(dashboard)) == [1, 2, 3]
