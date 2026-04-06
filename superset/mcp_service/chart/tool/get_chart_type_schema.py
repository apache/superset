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

from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    HandlebarsChartConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    TableChartConfig,
    XYChartConfig,
)

logger = logging.getLogger(__name__)

# Module-level TypeAdapters — one per chart type, compiled once.
_CHART_TYPE_ADAPTERS: Dict[str, TypeAdapter[Any]] = {
    "xy": TypeAdapter(XYChartConfig),
    "table": TypeAdapter(TableChartConfig),
    "pie": TypeAdapter(PieChartConfig),
    "pivot_table": TypeAdapter(PivotTableChartConfig),
    "mixed_timeseries": TypeAdapter(MixedTimeseriesChartConfig),
    "handlebars": TypeAdapter(HandlebarsChartConfig),
    "big_number": TypeAdapter(BigNumberChartConfig),
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
            "columns": [{"name": "customer_name"}, {"name": "email"}],
            "handlebars_template": "{{#each data}}<p>{{customer_name}}</p>{{/each}}",
        },
    ],
    "big_number": [
        {
            "chart_type": "big_number",
            "metric": {"name": "revenue", "aggregate": "SUM"},
        },
    ],
}


def _get_chart_type_schema_impl(
    chart_type: str,
    include_examples: bool = True,
) -> Dict[str, Any]:
    """Pure logic for chart type schema lookup — no auth, no decorators."""
    adapter = _CHART_TYPE_ADAPTERS.get(chart_type)
    if adapter is None:
        return {
            "error": f"Unknown chart_type: {chart_type!r}",
            "valid_chart_types": VALID_CHART_TYPES,
            "hint": (
                "Use one of the valid chart_type values listed above. "
                "Call this tool again with a valid chart_type to see "
                "its schema and examples."
            ),
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
    annotations=ToolAnnotations(
        title="Get chart type schema",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_chart_type_schema(
    chart_type: str,
    include_examples: bool = True,
) -> Dict[str, Any]:
    """Get the full JSON Schema and examples for a specific chart type.

    Use this tool to discover the exact fields, types, and constraints
    for a chart configuration before calling generate_chart or update_chart.

    Valid chart_type values: xy, table, pie, pivot_table,
    mixed_timeseries, handlebars, big_number.

    Returns the JSON Schema for the requested chart type, optionally
    with working examples.
    """
    return _get_chart_type_schema_impl(chart_type, include_examples)
