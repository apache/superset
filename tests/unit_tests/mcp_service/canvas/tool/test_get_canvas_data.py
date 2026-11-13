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
from superset.mcp_service.canvas.tool.get_canvas_data import _get_canvas_data_impl

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
    query_error: Exception | None = None, **kwargs: Any
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
        dao.load.return_value = _canvas()
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


def test_a_failing_query_is_reported_per_widget() -> None:
    result, _ = _run(query_error=ValueError("boom"))

    assert all("boom" in w["error"] for w in result["widgets"])
