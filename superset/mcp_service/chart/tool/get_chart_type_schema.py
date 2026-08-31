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

"""
MCP tool: get_chart_type_schema
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from pydantic import TypeAdapter
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    BoxPlotChartConfig,
    BubbleChartConfig,
    HandlebarsChartConfig,
    HistogramChartConfig,
    InteractivePivotChartConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    TableChartConfig,
    WaterfallChartConfig,
    XYChartConfig,
)

logger = logging.getLogger(__name__)

# Module-level TypeAdapters — one per chart type, compiled once.
_CHART_TYPE_ADAPTERS: Dict[str, TypeAdapter[Any]] = {
    "xy": TypeAdapter(XYChartConfig),
    "table": TypeAdapter(TableChartConfig),
    "pie": TypeAdapter(PieChartConfig),
    "bubble": TypeAdapter(BubbleChartConfig),
    "pivot_table": TypeAdapter(PivotTableChartConfig),
    "interactive_pivot": TypeAdapter(InteractivePivotChartConfig),
    "mixed_timeseries": TypeAdapter(MixedTimeseriesChartConfig),
    "handlebars": TypeAdapter(HandlebarsChartConfig),
    "big_number": TypeAdapter(BigNumberChartConfig),
    "histogram": TypeAdapter(HistogramChartConfig),
    "box_plot": TypeAdapter(BoxPlotChartConfig),
    "waterfall": TypeAdapter(WaterfallChartConfig),
}

VALID_CHART_TYPES = sorted(_CHART_TYPE_ADAPTERS.keys())

# Per-type examples — lightweight inline examples for each chart type.
_CHART_EXAMPLES: Dict[str, list[Dict[str, Any]]] = {
    "xy": [
        {
            "chart_type": "xy",
            "kind": "line",
            "x": {"name": "order_date"},
            "y": [{"name": "revenue", "aggregate": "SUM"}],
            "time_grain": "P1D",
        },
        {
            "chart_type": "xy",
            "kind": "bar",
            "x": {"name": "category"},
            "y": [{"name": "sales", "aggregate": "SUM"}],
        },
    ],
    "table": [
        {
            "chart_type": "table",
            "columns": [
                {"name": "customer_name"},
                {"name": "revenue", "aggregate": "SUM"},
                {"sql_expression": "SUM(revenue) / COUNT(*)", "label": "Avg per Order"},
            ],
        },
    ],
    "pie": [
        {
            "chart_type": "pie",
            "dimension": {"name": "region"},
            "metric": {"name": "revenue", "aggregate": "SUM"},
        },
    ],
    "pivot_table": [
        {
            "chart_type": "pivot_table",
            "rows": [{"name": "region"}],
            "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            "columns": [{"name": "quarter"}],
        },
    ],
    "interactive_pivot": [
        {
            "chart_type": "interactive_pivot",
            "rows": [{"name": "region"}],
            "columns": [{"name": "quarter"}],
            "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            "show_row_totals": True,
            "show_column_totals": True,
        },
        {
            "chart_type": "interactive_pivot",
            "rows": [{"name": "region"}, {"name": "country"}],
            "columns": [{"name": "order_date"}],
            "metrics": [
                {"name": "revenue", "aggregate": "SUM"},
                {"name": "margin", "aggregate": "AVG"},
            ],
            "temporal_column": "order_date",
            "time_grain": "P1M",
            "comparison_period": "1 year ago",
            "comparison_type": "percentage",
            "show_row_totals": True,
            "show_column_totals": True,
            "show_column_subtotals": True,
        },
    ],
    "mixed_timeseries": [
        {
            "chart_type": "mixed_timeseries",
            "x": {"name": "order_date"},
            "y": [{"name": "revenue", "aggregate": "SUM"}],
            "y_secondary": [{"name": "orders", "aggregate": "COUNT"}],
            "time_grain": "P1M",
        },
    ],
    "handlebars": [
        {
            "chart_type": "handlebars",
            "query_mode": "raw",
            "columns": [{"name": "customer_name"}, {"name": "email"}],
            "handlebars_template": "{{#each data}}<p>{{customer_name}}</p>{{/each}}",
        },
    ],
    "big_number": [
        {
            "chart_type": "big_number",
            "metric": {"name": "revenue", "aggregate": "SUM"},
        },
        {
            "chart_type": "big_number",
            "metric": {"name": "revenue", "aggregate": "SUM"},
            "temporal_column": "order_date",
            "show_trendline": True,
            "aggregation": "sum",
            "time_grain": "P1D",
        },
    ],
    "histogram": [
        {
            "chart_type": "histogram",
            "column": {"name": "trip_duration"},
            "bins": 20,
        },
        {
            "chart_type": "histogram",
            "column": {"name": "fare_amount"},
            "groupby": [{"name": "payment_type"}],
            "normalize": True,
        },
    ],
    "box_plot": [
        {
            "chart_type": "box_plot",
            "metrics": [{"name": "fare_amount", "aggregate": "AVG"}],
            "distribute_across": [{"name": "month"}],
            "dimensions": [{"name": "day_of_week"}],
        },
        {
            "chart_type": "box_plot",
            "metrics": [{"name": "duration", "aggregate": "AVG"}],
            "distribute_across": [{"name": "month"}],
            "dimensions": [{"name": "vendor"}],
            "whisker_type": "percentile",
            "percentile_low": 10,
            "percentile_high": 90,
        },
    ],
    "waterfall": [
        {
            "chart_type": "waterfall",
            "x_axis": {"name": "month"},
            "metric": {"name": "revenue_delta", "aggregate": "SUM"},
        },
        {
            "chart_type": "waterfall",
            "x_axis": {"name": "quarter"},
            "metric": {"name": "profit", "aggregate": "SUM"},
            "breakdown": {"name": "region"},
            "show_total": True,
        },
    ],
    "bubble": [
        {
            "chart_type": "bubble",
            "entity": {"name": "country"},
            "x": {"name": "gdp", "aggregate": "AVG"},
            "y": {"name": "life_expectancy", "aggregate": "AVG"},
            "size": {"name": "population", "aggregate": "SUM"},
        },
    ],
}


def _get_chart_type_schema_impl(
    chart_type: str,
    include_examples: bool = True,
) -> Dict[str, Any]:
    """Pure logic for chart type schema lookup — no auth, no decorators."""
    from superset.mcp_service.chart.registry import get_registry

    enabled_types = sorted(get_registry().all_types())
    adapter = _CHART_TYPE_ADAPTERS.get(chart_type)
    if adapter is None:
        # Return a structured error matching ChartGenerationError's shape so
        # MCP clients consuming the response see a populated error_type,
        # message, details, and suggestions rather than a bare dict.
        valid_types_str = ", ".join(enabled_types)
        return {
            "error": {
                "error_type": "invalid_chart_type",
                "message": f"Unknown chart_type: {chart_type!r}",
                "details": (
                    f"Chart type {chart_type!r} is not supported. "
                    f"Must be one of: {valid_types_str}."
                ),
                "suggestions": [
                    f"Use one of: {valid_types_str}",
                    "Check spelling and ensure lowercase",
                    "Call this tool again with a valid chart_type to see "
                    "its schema and examples",
                ],
                "error_code": "INVALID_CHART_TYPE",
            },
            "valid_chart_types": enabled_types,
        }

    if get_registry().get(chart_type) is None:
        valid_types_str = ", ".join(enabled_types)
        return {
            "error": {
                "error_type": "disabled_chart_type",
                "message": f"Chart type {chart_type!r} is not available",
                "details": (
                    f"The host deployment does not provide {chart_type!r}. "
                    f"Enabled chart types: {valid_types_str}."
                ),
                "suggestions": [
                    f"Use one of: {valid_types_str}",
                    "Contact the instance administrator to enable this chart type",
                ],
                "error_code": "DISABLED_CHART_TYPE",
            },
            "valid_chart_types": enabled_types,
        }

    schema = adapter.json_schema()
    result: Dict[str, Any] = {
        "chart_type": chart_type,
        "schema": schema,
    }

    if include_examples:
        result["examples"] = _CHART_EXAMPLES.get(chart_type, [])

    return result


@tool(
    tags=["discovery"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get chart type schema",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def get_chart_type_schema(
    chart_type: str,
    include_examples: bool = True,
) -> Dict[str, Any]:
    """Get the full JSON Schema and examples for a specific chart type.

    Use this tool to discover the exact fields, types, and constraints
    for a chart configuration before calling generate_chart or update_chart.

    Valid chart_type values depend on the host deployment. Core types are xy,
    table, pie, bubble, pivot_table, mixed_timeseries, handlebars, big_number,
    histogram, box_plot, and waterfall. Deployments that enable an AG Grid
    pivot extension also expose interactive_pivot.

    Returns the JSON Schema for the requested chart type, optionally
    with working examples.
    """
    with event_logger.log_context(action="mcp.get_chart_type_schema.lookup"):
        return _get_chart_type_schema_impl(chart_type, include_examples)
