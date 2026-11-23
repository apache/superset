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


"""Tests for get_canvas_data."""

from __future__ import annotations

from typing import Any, Iterator
from unittest.mock import MagicMock, patch

import pytest
from superset_core.canvas import StoredWidget

from superset.canvas.data import PlacementData
from superset.mcp_service.canvas.tool.canvas_ops_common import UNREAD_REASON
from superset.mcp_service.canvas.tool.get_canvas_data import (
    _get_canvas_data_impl,
    MAX_RESPONSE_BYTES,
    MAX_UNREAD,
)
from superset.utils import json

MODULE = "superset.mcp_service.canvas.tool.get_canvas_data"
BINDING = {"datasetId": 13, "metrics": ["revenue"]}


@pytest.fixture(autouse=True)
def base_url() -> Iterator[None]:
    with patch(
        "superset.mcp_service.canvas.tool.canvas_ops_common.get_superset_base_url",
        return_value="https://superset.example",
    ):
        yield


def _canvas() -> dict[str, Any]:
    chart = {"widgetType": "echarts", "props": {"dataBinding": BINDING}}
    return {
        "version": 1,
        "root": {"layout": {"columns": 24}, "children": ["intro", "tabs", "kpi"]},
        "nodes": {
            "intro": {"widgetType": "markdown", "props": {"markdown": "# Hi"}},
            "tabs": {"widgetType": "tabs", "props": {}, "children": ["inner"]},
            "inner": chart,
            "kpi": {"widgetId": "w1"},
        },
    }


def _run(
    query_error: Exception | None = None,
    definition: dict[str, Any] | None = None,
    **kwargs: Any,
) -> tuple[dict[str, Any], MagicMock]:
    resolver = MagicMock()
    resolver.widgets.return_value = {
        "w1": StoredWidget("echarts", 1, "KPI", {"dataBinding": BINDING})
    }
    rows = [{"revenue": float(i)} for i in range(5)]
    canvas = MagicMock(id=7, title="Sales", url="/canvas/sales/")
    args: dict[str, Any] = {
        "canvas_id": 7,
        "draft_token": None,
        "placement_ids": None,
        "max_rows": 50,
        "max_widgets": 20,
        "runtime_filters": None,
        **kwargs,
    }
    with (
        patch(f"{MODULE}.CanvasDAO") as dao,
        patch(f"{MODULE}.get_widget_resolver", return_value=resolver),
        patch(f"{MODULE}.render_context", return_value={"titles": {"kpi": "KPI"}}),
        patch(
            f"{MODULE}.run_binding",
            return_value=PlacementData(rows, None, None),
            side_effect=query_error,
        ) as run,
    ):
        dao.find_by_id_or_uuid.return_value = canvas
        dao.load.return_value = definition or _canvas()
        return _get_canvas_data_impl(**args), run


def test_returns_data_for_every_bound_placement_in_layout_order() -> None:
    result, run = _run()

    assert result["url"] == "https://superset.example/canvas/sales/"
    assert [w["placement_id"] for w in result["widgets"]] == ["inner", "kpi"]
    kpi = result["widgets"][1]
    assert kpi["title"] == "KPI"
    assert kpi["row_count"] == 5
    assert kpi["columns"] == ["revenue"]
    assert run.call_count == 2


def test_lists_extension_widgets_it_cannot_read() -> None:
    definition = _canvas()
    definition["root"]["children"].append("ext")
    definition["nodes"]["ext"] = {
        "widgetType": "extensions.acme.kpis.board",
        "props": {"bindings": [{"datasetId": 3}]},
    }

    result, _ = _run(definition=definition)

    assert result["unread"] == [
        {
            "placement_id": "ext",
            "widget_type": "extensions.acme.kpis.board",
            "reason": UNREAD_REASON,
        }
    ]
    assert "unread" not in _run()[0]


def test_a_canvas_full_of_unread_widgets_stays_within_the_size_budget() -> None:
    definition = _canvas()
    for index in range(400):
        node_id = f"extension-widget-number-{index}"
        definition["root"]["children"].append(node_id)
        definition["nodes"][node_id] = {
            "widgetType": "extensions.acme.kpis.board",
            "props": {},
        }

    result, _ = _run(definition=definition)

    assert len(result["unread"]) == MAX_UNREAD
    assert len(json.dumps(result)) < MAX_RESPONSE_BYTES


def test_leaves_out_types_turned_off() -> None:
    with patch.dict(
        "superset.canvas.definition.registry.current_app.config",
        {"CANVAS_DISABLED_WIDGET_TYPES": frozenset({"echarts"})},
    ):
        result, run = _run()

    assert result["widgets"] == []
    assert "unread" not in result
    run.assert_not_called()


def test_runs_no_query_a_type_unknown_here_stored() -> None:
    definition = _canvas()
    definition["nodes"]["inner"] = {
        "widgetType": "extensions.acme.kpis.board",
        "props": {"dataBinding": BINDING},
    }

    result, run = _run(definition=definition)

    # The saved echarts widget still answers; the uninstalled type doesn't.
    assert [w["placement_id"] for w in result["widgets"]] == ["kpi"]
    assert run.call_count == 1


def test_caps_rows_and_widgets() -> None:
    result, run = _run(max_rows=2, max_widgets=1)

    only = result["widgets"][0]
    assert len(only["rows"]) == 2
    assert only["truncated"] is True
    assert result["skipped"] == ["kpi"]
    assert run.call_count == 1


def test_limits_to_the_placements_asked_for() -> None:
    result, _ = _run(placement_ids=["kpi"])

    assert [w["placement_id"] for w in result["widgets"]] == ["kpi"]


def test_reports_unknown_placements() -> None:
    result, run = _run(placement_ids=["nope"])

    assert "nope" in result["error"]
    run.assert_not_called()


@pytest.mark.parametrize("view_query", [True, False])
def test_a_failing_query_is_reported_per_widget(view_query: bool) -> None:
    # Unexpected driver errors stay generic even with permission to view SQL.
    with patch(
        "superset.mcp_service.canvas.tool.canvas_ops_common.can_view_query",
        return_value=view_query,
    ):
        result, _ = _run(query_error=ValueError("boom"))

    assert all(
        w["error"]
        == (
            "The widget's query failed: An error occurred while fetching the data."
            if view_query
            else "The widget's query failed."
        )
        for w in result["widgets"]
    )

    assert all(w["error_type"] == "QueryError" for w in result["widgets"])
    assert all("rows" not in w for w in result["widgets"])


def test_rows_are_trimmed_to_fit_the_response_budget() -> None:
    from superset.mcp_service.canvas.tool.get_canvas_data import _fit_rows

    entries = [
        {"placement_id": "big", "rows": [{"v": "x" * 100}] * 100},
        {"placement_id": "small", "rows": [{"v": 1}] * 3},
    ]

    _fit_rows(entries, 2_000)

    assert len(json.dumps(entries)) <= 2_000
    assert entries[0]["truncated"] is True
    assert entries[1]["rows"] == [{"v": 1}] * 3
    assert "truncated" not in entries[1]
