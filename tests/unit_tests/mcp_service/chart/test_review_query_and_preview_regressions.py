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

from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.common.form_data_query_context import build_query_objects_from_form_data
from superset.common.query_object import QueryObject
from superset.mcp_service.chart.chart_helpers import build_query_dicts_from_form_data
from superset.mcp_service.chart.preview_utils import (
    _generate_vega_lite_preview_from_data,
)
from superset.mcp_service.chart.schemas import GetChartPreviewRequest, VegaLitePreview
from superset.mcp_service.chart.tool.get_chart_preview import VegaLitePreviewStrategy
from superset.semantic_layers.mapper import _normalize_column
from superset.utils import json


@pytest.mark.parametrize(
    "viz_type", ["echarts_timeseries_line", "mixed_timeseries", "big_number"]
)
@pytest.mark.parametrize("fill", [True, False])
def test_resample_fills_requested_range_edges(viz_type: str, fill: bool) -> None:
    """Execute the rebuilt pipeline, including QueryObject's range resolution."""
    query = build_query_objects_from_form_data(
        {
            "viz_type": viz_type,
            "x_axis": "ds",
            "metric": "revenue",
            "resample_rule": "1D",
            "resample_method": "zerofill",
            "resample_fill_time_range": fill,
        }
    )[0]
    result = QueryObject(
        **query, from_dttm=datetime(2026, 1, 1), to_dttm=datetime(2026, 1, 8)
    ).exec_post_processing(
        pd.DataFrame(
            {"ds": pd.date_range("2026-01-03", periods=3), "revenue": [3, 4, 5]}
        )
    )
    assert list(result["ds"]) == list(
        pd.date_range("2026-01-01" if fill else "2026-01-03", periods=7 if fill else 3)
    )
    assert list(result["revenue"]) == ([0, 0, 3, 4, 5, 0, 0] if fill else [3, 4, 5])


@pytest.mark.parametrize("viz_type", ["table", "ag-grid-table"])
@pytest.mark.parametrize("request_offset", [None, "2 weeks ago"])
@pytest.mark.parametrize("saved_viz", [True, False])
def test_table_inherited_offset_survives_filter_preparation(
    viz_type: str, request_offset: str | None, saved_viz: bool
) -> None:
    """Exercise the production entry point rather than the common builder alone."""
    form_data: dict[str, Any] = {
        "viz_type": viz_type,
        "groupby": ["region"],
        "metrics": ["revenue"],
        "time_compare": ["inherit"],
        "comparison_type": "difference",
        "extra_form_data": {"time_compare": "1 year ago"},
    }
    if not saved_viz:
        form_data.pop("viz_type")
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(
            form_data,
            1,
            "table",
            chart=SimpleNamespace(viz_type=viz_type),
            extra_form_data={"time_compare": request_offset}
            if request_offset
            else None,
        )[0]
    offset = request_offset or "1 year ago"
    assert "extra_form_data" not in form_data
    assert query["time_offsets"] == [offset]
    assert query["post_processing"][0]["options"]["compare_columns"] == [
        f"revenue__{offset}"
    ]


@pytest.mark.parametrize(
    ("axis_grain", "extras_grain", "panel_grain", "expected"),
    [
        ("P1M", None, None, "P1M"),
        (None, None, None, "P1D"),
        ("P1M", "P1W", "P1D", "P1M"),
        (None, "P1W", None, "P1W"),
        (None, None, "P1Y", "P1Y"),
    ],
)
def test_forecast_resolves_frontend_grain_precedence(
    axis_grain: str | None,
    extras_grain: str | None,
    panel_grain: str | None,
    expected: str,
) -> None:
    """Forecasting uses the axis, resolved extras, panel, then daily default."""
    query = build_query_objects_from_form_data(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": {
                "expressionType": "SQL",
                "sqlExpression": "ds",
                "label": "ds",
                "timeGrain": axis_grain,
            },
            "metrics": ["revenue"],
            "forecastEnabled": True,
            "forecastPeriods": 2,
            "extras": {"time_grain_sqla": extras_grain},
            "time_grain_sqla": panel_grain,
        },
        filters_prepared=True,
    )[0]
    assert query["post_processing"][-1]["options"]["time_grain"] == expected


@pytest.mark.parametrize("truncate", [False, True])
@pytest.mark.parametrize("groupby", [["region"], ["region", "product"]])
def test_grouped_timeseries_preview_keeps_all_pivoted_series(
    truncate: bool, groupby: list[str]
) -> None:
    """Render real flattened pipeline output, including truncated metric labels."""
    form_data: dict[str, Any] = {
        "viz_type": "echarts_timeseries_line",
        "x_axis": "ds",
        "metrics": ["revenue"],
        "groupby": groupby,
        "truncate_metric": truncate,
    }
    query = build_query_objects_from_form_data(form_data)[0]
    rows = pd.DataFrame(
        {
            "ds": ["2026-01-01", "2026-01-01"],
            "region": ["East", "West"],
            "product": ["A", "B"],
            "revenue": [10, 20],
        }
    )
    processed = (
        QueryObject(**query).exec_post_processing(rows).to_dict(orient="records")
    )
    result = _generate_vega_lite_preview_from_data(processed, form_data)
    assert isinstance(result, VegaLitePreview)
    spec = result.specification
    series = [column for column in processed[0] if column != "ds"]
    assert spec["transform"] == [{"fold": series, "as": ["series", "value"]}]
    assert spec["encoding"]["color"]["field"] == "series"
    assert spec["encoding"]["y"]["field"] == "value"
    assert sorted(processed[0][column] for column in series) == [10, 20]


@pytest.mark.parametrize("viz_type", ["table", "ag-grid-table"])
def test_table_temporal_column_is_a_semantic_column_reference(viz_type: str) -> None:
    """Physical temporal dimensions must not become semantic adhoc SQL."""
    query = build_query_objects_from_form_data(
        {
            "viz_type": viz_type,
            "datasource": "1__semantic_view",
            "query_mode": "aggregate",
            "groupby": ["region", "ds"],
            "metrics": ["revenue"],
            "time_grain_sqla": "P1M",
            "temporal_columns_lookup": {"ds": True},
        }
    )[0]
    assert query["columns"][0]["isColumnReference"] is True
    assert _normalize_column(query["columns"][0], {"ds", "region"}) == "ds"


def test_grouped_timeseries_long_preview_preserves_original_encoding() -> None:
    """Existing long-form results remain usable without the wide-data transform."""
    rows = [
        {"ds": "2026-01-01", "region": "East", "revenue": 10},
        {"ds": "2026-01-01", "region": "West", "revenue": 20},
    ]
    result = _generate_vega_lite_preview_from_data(
        rows,
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "ds",
            "metrics": ["revenue"],
            "groupby": ["region"],
        },
    )
    assert isinstance(result, VegaLitePreview)
    spec = result.specification
    assert "transform" not in spec
    assert spec["data"]["values"] == rows
    assert spec["encoding"]["y"]["field"] == "revenue"
    assert spec["encoding"]["color"]["field"] == "region"


@pytest.mark.parametrize("x_axis", ["series", "value"])
def test_wide_preview_fold_does_not_overwrite_the_axis(x_axis: str) -> None:
    """Fold-generated fields cannot shadow the chart's existing result fields."""
    result = _generate_vega_lite_preview_from_data(
        [{x_axis: "2026-01-01", "revenue, East": 10, "revenue, West": None}],
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": x_axis,
            "metrics": ["revenue"],
            "groupby": ["region"],
        },
    )
    assert isinstance(result, VegaLitePreview)
    spec = result.specification
    assert x_axis not in spec["transform"][0]["as"]
    assert spec["transform"][0]["fold"] == ["revenue, East", "revenue, West"]
    assert spec["encoding"]["x"]["field"] == x_axis


@pytest.mark.parametrize("viz_type", ["table", "ag-grid-table"])
@pytest.mark.parametrize("saved_viz", [True, False])
@pytest.mark.parametrize("request_offset", [None, "2 weeks ago", "3 weeks ago"])
def test_table_inherited_custom_offset_preserves_other_comparisons(
    viz_type: str, saved_viz: bool, request_offset: str | None
) -> None:
    """Resolve custom before checking whether inheritance replaces the selection."""
    form_data: dict[str, Any] = {
        "viz_type": viz_type,
        "query_mode": "aggregate",
        "groupby": ["region"],
        "metrics": ["revenue"],
        "time_compare": ["1 year ago", "custom"],
        "start_date_offset": "2 weeks ago",
        "comparison_type": "difference",
        "extra_form_data": {"time_compare": "2 weeks ago"},
    }
    if not saved_viz:
        form_data.pop("viz_type")
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(
            form_data,
            1,
            "table",
            chart=SimpleNamespace(viz_type=viz_type),
            extra_form_data={"time_compare": request_offset}
            if request_offset
            else None,
        )[0]
    offsets = (
        ["3 weeks ago"]
        if request_offset == "3 weeks ago"
        else ["1 year ago", "2 weeks ago"]
    )
    assert "extra_form_data" not in form_data
    assert query["time_offsets"] == offsets
    assert query["post_processing"][0]["options"]["compare_columns"] == [
        f"revenue__{offset}" for offset in offsets
    ]


@pytest.mark.parametrize(
    "viz_type",
    [
        "echarts_timeseries_line",
        "echarts_timeseries_bar",
        "echarts_area",
        "echarts_timeseries_scatter",
    ],
)
@pytest.mark.parametrize("dimensions", [{}, {"width": 800, "height": 200}])
def test_saved_xy_preview_honors_dimensions_and_description(
    viz_type: str, dimensions: dict[str, int]
) -> None:
    """Saved plugin previews keep the framing contract of the saved fallback."""
    form_data = {
        "viz_type": viz_type,
        "x_axis": "ds",
        "metrics": ["revenue"],
        "groupby": ["region"],
    }
    data = [{"ds": "2026-01-01", "revenue, East": 10, "revenue, West": 20}]
    chart = SimpleNamespace(
        id=1,
        slice_name="Regional revenue",
        viz_type=viz_type,
        datasource_id=1,
        datasource_type="table",
        params=json.dumps(form_data),
    )
    strategy = VegaLitePreviewStrategy(
        chart,
        GetChartPreviewRequest(identifier=1, format="vega_lite", **dimensions),
    )
    with (
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "build_query_context_from_form_data",
            return_value=MagicMock(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
        patch.object(strategy, "_authorize_guest_query"),
    ):
        command.return_value.run.return_value = {"queries": [{"data": data}]}
        result = strategy.generate()
    assert isinstance(result, VegaLitePreview)
    spec = result.specification
    assert spec["width"] == dimensions.get("width", 800)
    assert spec["height"] == dimensions.get("height", 600)
    assert spec["description"] == "Chart preview for Regional revenue"
    assert spec["encoding"]["x"]["field"] == "ds"
    assert spec["transform"][0]["fold"] == ["revenue, East", "revenue, West"]
    unsaved = _generate_vega_lite_preview_from_data(data, form_data)
    assert isinstance(unsaved, VegaLitePreview)
    assert unsaved.specification["width"] == "container"
    assert unsaved.specification["height"] == 400


@pytest.mark.parametrize(
    ("axis", "field"),
    [
        (None, "__timestamp"),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "DATE_TRUNC('month', ds)",
                "label": "Month",
            },
            "Month",
        ),
    ],
)
def test_grouped_timeseries_preview_resolves_legacy_and_sql_axes(
    axis: dict[str, str] | None, field: str
) -> None:
    """Render wide rows using the legacy timestamp or the SQL axis result label."""
    form_data: dict[str, Any] = {
        "viz_type": "echarts_timeseries_line",
        "metrics": ["revenue"],
        "groupby": ["region"],
    }
    if axis is not None:
        form_data["x_axis"] = axis
    rows = [{field: "2026-01-01", "revenue, East": 10, "revenue, West": 20}]
    result = _generate_vega_lite_preview_from_data(rows, form_data)
    assert isinstance(result, VegaLitePreview)
    spec = result.specification
    assert spec["encoding"]["x"]["field"] == field
    assert spec["transform"] == [
        {"fold": ["revenue, East", "revenue, West"], "as": ["series", "value"]}
    ]
    assert spec["encoding"]["y"]["field"] == "value"
    assert spec["encoding"]["color"]["field"] == "series"
