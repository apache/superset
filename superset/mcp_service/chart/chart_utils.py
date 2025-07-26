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
Shared chart utilities for MCP tools

This module contains shared logic for chart configuration mapping and explore link
generation that can be used by both create_chart and generate_explore_link tools.
"""

from typing import Any, Dict, Union

from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)
from superset.utils import json


def generate_explore_link(dataset_id: str, form_data: Dict[str, Any]) -> str:
    """Generate an explore link for the given dataset and form data."""
    try:
        from superset.commands.explore.form_data.parameters import CommandParameters
        from superset.mcp_service.commands.create_form_data import (
            MCPCreateFormDataCommand,
        )
        from superset.utils.core import DatasourceType

        # Add datasource to form_data
        form_data_with_datasource = {**form_data, "datasource": f"{dataset_id}__table"}

        # Try to create form_data in cache using MCP-specific CreateFormDataCommand
        cmd_params = CommandParameters(
            datasource_type=DatasourceType.TABLE,
            datasource_id=int(dataset_id),
            chart_id=0,  # 0 for new charts
            tab_id=None,
            form_data=json.dumps(form_data_with_datasource),
        )

        # Create the form_data cache entry and get the key
        form_data_key = MCPCreateFormDataCommand(cmd_params).run()

        # Return URL with just the form_data_key
        return f"/explore/?form_data_key={form_data_key}"

    except Exception:
        # Fallback to basic explore URL with just dataset id if cache fails
        return f"/explore/?datasource_type=table&datasource_id={dataset_id}"


def map_config_to_form_data(
    config: Union[TableChartConfig, XYChartConfig],
) -> Dict[str, Any]:
    """Map chart config to Superset form_data."""
    if isinstance(config, TableChartConfig):
        return map_table_config(config)
    elif isinstance(config, XYChartConfig):
        return map_xy_config(config)
    else:
        raise ValueError(f"Unsupported config type: {type(config)}")


def map_table_config(config: TableChartConfig) -> Dict[str, Any]:
    """Map table chart config to form_data."""
    # Convert columns to metrics - always use complex object format
    metrics = [create_metric_object(col) for col in config.columns]

    form_data = {
        "viz_type": "table",
        "all_columns": [col.name for col in config.columns],
        "metrics": metrics,
    }

    if config.filters:
        form_data["adhoc_filters"] = [
            {
                "expressionType": "SIMPLE",
                "subject": filter_config.column,
                "operator": map_filter_operator(filter_config.op),
                "comparator": filter_config.value,
            }
            for filter_config in config.filters
        ]

    if config.sort_by:
        form_data["order_by_cols"] = config.sort_by

    return form_data


def create_metric_object(col: ColumnRef) -> Dict[str, Any]:
    """Create a metric object for a column."""
    aggregate = col.aggregate or "SUM"
    return {
        "aggregate": aggregate,
        "column": {
            "column_name": col.name,
        },
        "expressionType": "SIMPLE",
        "label": col.label or f"{aggregate}({col.name})",
        "optionName": f"metric_{col.name}",
        "sqlExpression": None,
        "hasCustomLabel": False,
        "datasourceWarning": False,
    }


def add_axis_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    """Add axis configurations to form_data."""
    if config.x_axis:
        if config.x_axis.title:
            form_data["x_axis_title"] = config.x_axis.title
        if config.x_axis.format:
            form_data["x_axis_format"] = config.x_axis.format

    if config.y_axis:
        if config.y_axis.title:
            form_data["y_axis_title"] = config.y_axis.title
        if config.y_axis.format:
            form_data["y_axis_format"] = config.y_axis.format
        if config.y_axis.scale == "log":
            form_data["y_axis_scale"] = "log"


def add_legend_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    """Add legend configuration to form_data."""
    if config.legend:
        if not config.legend.show:
            form_data["show_legend"] = False
        if config.legend.position:
            form_data["legend_orientation"] = config.legend.position


def map_xy_config(config: XYChartConfig) -> Dict[str, Any]:
    """Map XY chart config to form_data."""
    # Map chart kind to viz_type
    viz_type_map = {
        "line": "echarts_timeseries_line",
        "bar": "echarts_timeseries_bar",
        "area": "echarts_area",
        "scatter": "echarts_timeseries_scatter",
    }

    # Convert Y columns to metrics
    metrics = [create_metric_object(col) for col in config.y]

    form_data: Dict[str, Any] = {
        "viz_type": viz_type_map.get(config.kind, "echarts_timeseries_line"),
        "x_axis": config.x.name,
        "metrics": metrics,
    }

    # Add groupby if specified
    if config.group_by:
        form_data["groupby"] = [config.group_by.name]

    # Add filters if specified
    if config.filters:
        form_data["adhoc_filters"] = [
            {
                "expressionType": "SIMPLE",
                "subject": filter_config.column,
                "operator": map_filter_operator(filter_config.op),
                "comparator": filter_config.value,
            }
            for filter_config in config.filters
        ]

    # Add configurations
    add_axis_config(form_data, config)
    add_legend_config(form_data, config)

    return form_data


def map_filter_operator(op: str) -> str:
    """Map filter operator to Superset format."""
    operator_map = {
        "=": "==",
        ">": ">",
        "<": "<",
        ">=": ">=",
        "<=": "<=",
        "!=": "!=",
    }
    return operator_map.get(op, op)


def generate_chart_name(config: Union[TableChartConfig, XYChartConfig]) -> str:
    """Generate a chart name based on the configuration."""
    if isinstance(config, TableChartConfig):
        return f"Table Chart - {', '.join(col.name for col in config.columns)}"
    elif isinstance(config, XYChartConfig):
        chart_type = config.kind.capitalize()
        x_col = config.x.name
        y_cols = ", ".join(col.name for col in config.y)
        return f"{chart_type} Chart - {x_col} vs {y_cols}"
    else:
        return "Chart"
