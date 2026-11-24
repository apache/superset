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

from typing import Any, Callable, Iterator
from unittest.mock import MagicMock, patch

import pytest
from superset_core.canvas import StoredWidget
from superset_core.widgets import BindingRequest, Widget, WidgetBinding

from superset.canvas.data import PlacementData, RuntimeFilter
from superset.mcp_service.canvas.schemas import GetCanvasDataResponse
from superset.mcp_service.canvas.tool.canvas_ops_common import UNREAD_REASON
from superset.mcp_service.canvas.tool.get_canvas_data import (
    _get_canvas_data_impl,
    MAX_RESPONSE_BYTES,
    MAX_UNREAD,
)
from superset.utils import json

MODULE = "superset.mcp_service.canvas.tool.get_canvas_data"
BINDING = {"datasetId": 13, "metrics": ["revenue"]}
KPIS = "extensions.acme.kpis.board"


class Kpis(Widget):
    """An extension's widget type whose queries aren't in its props."""

    widget_type = KPIS
    asked: list[BindingRequest] = []

    @classmethod
    def build_bindings(cls, request: BindingRequest) -> list[WidgetBinding]:
        cls.asked.append(request)
        return [
            WidgetBinding(name, {"datasetId": 3, "metrics": [name]})
            for name in request.props.get("kpis", [])
        ]


@pytest.fixture
def kpis() -> Iterator[type[Kpis]]:
    Kpis.asked = []
    # Its bindings' dataset exists and the caller can read it.
    with (
        patch.dict("superset.widgets.registry.registry", {KPIS: Kpis}),
        patch(
            "superset.commands.canvas.placement_data.unreadable_datasets",
            return_value=set(),
        ),
    ):
        yield Kpis


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
    rows_of: Callable[..., PlacementData] | None = None,
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
            side_effect=rows_of or query_error,
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


def _with_kpis(*names: str) -> dict[str, Any]:
    definition = _canvas()
    definition["root"]["children"].insert(2, "board")
    definition["nodes"]["board"] = {"widgetType": KPIS, "props": {"kpis": list(names)}}
    return definition


def _rows_of(binding: dict[str, Any], filters: Any) -> PlacementData:
    return PlacementData([{binding["metrics"][0]: 1.0}], None, None)


def test_an_extension_widget_types_own_queries_answer_by_dataset(
    kpis: type[Kpis],
) -> None:
    filters = [RuntimeFilter(datasetId=3, column="region", values=["EMEA"])]
    result, run = _run(
        definition=_with_kpis("revenue", "deals"),
        rows_of=_rows_of,
        runtime_filters=filters,
    )

    board = result["widgets"][1]
    assert board["placement_id"] == "board"
    assert board["datasets"] == [
        {
            "name": "revenue",
            "row_count": 1,
            "columns": ["revenue"],
            "rows": [{"revenue": 1.0}],
        },
        {
            "name": "deals",
            "row_count": 1,
            "columns": ["deals"],
            "rows": [{"deals": 1.0}],
        },
    ]
    assert "rows" not in board
    assert "unread" not in result
    # Each runs as any other query, as the caller and narrowed by the filters.
    assert [
        call.args for call in run.call_args_list if call.args[0]["datasetId"] == 3
    ] == [
        ({"datasetId": 3, "metrics": ["revenue"]}, filters),
        ({"datasetId": 3, "metrics": ["deals"]}, filters),
    ]
    assert kpis.asked == [
        BindingRequest(
            canvas_id="7", placement_id="board", props={"kpis": ["revenue", "deals"]}
        )
    ]
    assert GetCanvasDataResponse.model_validate(result).widgets[1].datasets


def test_an_extension_widget_types_binding_on_a_dataset_the_caller_cant_read(
    kpis: type[Kpis],
) -> None:
    """Agents get the checks the data routes apply to a built binding."""
    with patch(
        "superset.commands.canvas.placement_data.unreadable_datasets",
        return_value={3},
    ):
        result, run = _run(definition=_with_kpis("revenue"), rows_of=_rows_of)

    board = result["widgets"][1]
    assert board["placement_id"] == "board"
    assert board["error_type"] == "DatasetNotAccessible"
    assert "datasets" not in board
    assert all(call.args[0]["datasetId"] != 3 for call in run.call_args_list)


def test_an_extension_widget_type_that_builds_no_query_is_unread(
    kpis: type[Kpis],
) -> None:
    result, _ = _run(definition=_with_kpis())

    assert result["unread"] == [
        {"placement_id": "board", "widget_type": KPIS, "reason": UNREAD_REASON}
    ]
    assert [w["placement_id"] for w in result["widgets"]] == ["inner", "kpi"]


def test_max_widgets_counts_every_query_a_widget_runs(kpis: type[Kpis]) -> None:
    result, run = _run(
        definition=_with_kpis("revenue", "deals"), rows_of=_rows_of, max_widgets=2
    )

    # The board's two queries don't fit after the first widget's one.
    assert [w["placement_id"] for w in result["widgets"]] == ["inner"]
    assert result["skipped"] == ["board", "kpi"]
    assert run.call_count == 1


def test_a_widget_type_that_fails_to_build_its_queries_is_reported(
    kpis: type[Kpis],
) -> None:
    with (
        patch.object(
            Kpis, "build_bindings", side_effect=RuntimeError("private-diagnostic")
        ),
        patch(
            "superset.mcp_service.canvas.tool.canvas_ops_common.can_view_query",
            return_value=False,
        ),
    ):
        result, run = _run(definition=_with_kpis("revenue"), max_widgets=2)

    board = result["widgets"][1]
    assert board["placement_id"] == "board"
    assert board["error"] == "The widget's query failed."
    assert board["error_type"] == "QueryError"
    assert "private-diagnostic" not in json.dumps(result)
    # It counts as one widget against max_widgets.
    assert result["skipped"] == ["kpi"]
    assert run.call_count == 1


def test_a_widget_types_refusal_reaches_agents_with_its_code(
    kpis: type[Kpis],
) -> None:
    from superset_core.widgets import WidgetDataRefusedError

    refused = WidgetDataRefusedError("CONTENT_CHANGED", "Reload this board")
    with patch.object(Kpis, "build_bindings", side_effect=refused):
        result, run = _run(definition=_with_kpis("revenue"), max_widgets=2)

    board = result["widgets"][1]
    assert board == {
        "placement_id": "board",
        "title": None,
        "widget_type": KPIS,
        "error": "Reload this board",
        "error_type": "WidgetDataRefused",
        "error_code": "CONTENT_CHANGED",
    }
    # It counts as one widget against max_widgets.
    assert result["skipped"] == ["kpi"]
    assert run.call_count == 1
    entry = GetCanvasDataResponse.model_validate(result).widgets[1]
    assert entry.error_code == "CONTENT_CHANGED"


def test_a_widget_type_learns_the_placement_comes_from_the_callers_draft(
    kpis: type[Kpis],
) -> None:
    draft = MagicMock(canvas_id=7, definition=_with_kpis("revenue"))
    draft.resolver.return_value.widgets.return_value = {}
    with (
        patch(f"{MODULE}.load_draft", return_value=draft),
        patch(f"{MODULE}.CanvasDAO") as dao,
        patch(f"{MODULE}.render_context", return_value={}),
        patch(f"{MODULE}.draft_url", return_value="/canvas/7/#draft=tok"),
        patch(f"{MODULE}.run_binding", side_effect=_rows_of),
    ):
        dao.find_by_id.return_value = MagicMock(id=7, title="Sales")
        _get_canvas_data_impl(7, "tok", ["board"], 50, 20, None)

    # The tool reads no saved version of a canvas, so it names none.
    assert [
        (r.canvas_id, r.canvas_draft_token, r.canvas_version) for r in kpis.asked
    ] == [("7", "tok", None)]


def test_dataset_rows_are_trimmed_to_fit_the_response_budget() -> None:
    from superset.mcp_service.canvas.tool.get_canvas_data import _fit_rows

    entries: list[dict[str, Any]] = [
        {
            "placement_id": "board",
            "datasets": [
                {"name": "big", "rows": [{"v": "x" * 100}] * 100},
                {"name": "small", "rows": [{"v": 1}] * 3},
            ],
        }
    ]

    _fit_rows(entries, 2_000)

    assert len(json.dumps(entries)) <= 2_000
    big, small = entries[0]["datasets"]
    assert big["truncated"] is True
    assert small["rows"] == [{"v": 1}] * 3


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
