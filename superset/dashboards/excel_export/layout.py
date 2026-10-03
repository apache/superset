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
"""Determine the order in which a dashboard's charts appear in its layout."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

CHART_TYPE = "CHART"
ROOT_ID = "ROOT_ID"


def _walk_chart_ids(position: dict[str, Any]) -> list[int]:
    """
    Depth-first walk of a dashboard ``position_json`` returning chart ids in
    visual (layout) order, including tab-nested charts. Each chart id appears
    once (first occurrence wins); cycles are guarded against.
    """
    if ROOT_ID not in position:
        return []

    ordered: list[int] = []
    seen_charts: set[int] = set()
    visited_nodes: set[str] = set()
    stack: list[str] = [ROOT_ID]

    while stack:
        node_id = stack.pop()
        if node_id in visited_nodes:
            continue
        visited_nodes.add(node_id)

        node = position.get(node_id)
        if not isinstance(node, dict):
            continue

        if node.get("type") == CHART_TYPE:
            chart_id = node.get("meta", {}).get("chartId")
            if isinstance(chart_id, int) and chart_id not in seen_charts:
                seen_charts.add(chart_id)
                ordered.append(chart_id)

        # Push children in reverse so they are popped in their declared order.
        children = node.get("children", [])
        for child_id in reversed(children):
            stack.append(child_id)

    return ordered


def get_charts_in_layout_order(dashboard: Dashboard) -> list[Slice]:
    """
    Return the dashboard's charts ordered by their position in the layout.

    Charts are visited depth-first over ``position_json`` (so tab-nested charts
    are included in tab order), de-duplicated when the same chart is placed more
    than once, and any chart that belongs to the dashboard but is absent from
    the layout is appended at the end ordered by id. Layout entries that no
    longer correspond to a dashboard chart are skipped.

    :param dashboard: The dashboard whose charts to order
    :returns: The dashboard's :class:`Slice` objects in layout order
    """
    slices_by_id: dict[int, Slice] = {slc.id: slc for slc in dashboard.slices}

    result: list[Slice] = []
    used: set[int] = set()
    for chart_id in _walk_chart_ids(dashboard.position):
        slc = slices_by_id.get(chart_id)
        if slc is not None and chart_id not in used:
            used.add(chart_id)
            result.append(slc)

    orphans = sorted(
        (slc for chart_id, slc in slices_by_id.items() if chart_id not in used),
        key=lambda slc: slc.id,
    )
    result.extend(orphans)
    return result
