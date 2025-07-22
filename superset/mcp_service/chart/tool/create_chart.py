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
MCP tool: create_chart (simplified schema)
"""

from typing import Any, Dict, Union

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ColumnRef,
    CreateChartRequest,
    TableChartConfig,
    XYChartConfig,
)
from superset.utils import json


@mcp.tool
@mcp_auth_hook
async def create_chart(request: CreateChartRequest) -> Dict[str, Any]:
    """
    Create a new chart in Superset.

    Args:
        request: Chart creation request with dataset_id, config, and save_chart flag

    Returns:
        Dictionary containing chart info or explore link, and error message if any
    """
    try:
        # Map the simplified config to Superset's form_data format
        form_data = _map_config_to_form_data(request.config)

        if not request.save_chart:
            # Generate explore link without saving the chart
            explore_url = _generate_explore_link(
                dataset_id=request.dataset_id, form_data=form_data
            )
            return {
                "chart": None,
                "explore_url": explore_url,
                "error": None,
            }

        # Save the chart
        from superset.commands.chart.create import CreateChartCommand

        # Generate a chart name
        chart_name = _generate_chart_name(request.config)

        # Create the chart using Superset's command
        command = CreateChartCommand(
            {
                "slice_name": chart_name,
                "viz_type": form_data["viz_type"],
                "datasource_id": int(request.dataset_id),
                "datasource_type": "table",
                "params": json.dumps(form_data),
            }
        )

        chart = command.run()

        return {
            "chart": {
                "id": chart.id,
                "slice_name": chart.slice_name,
                "viz_type": chart.viz_type,
                "url": f"/chart/{chart.id}",
            },
            "explore_url": None,
            "error": None,
        }

    except Exception as e:
        return {
            "chart": None,
            "explore_url": None,
            "error": f"Chart creation failed: {str(e)}",
        }


def _generate_explore_link(dataset_id: str, form_data: Dict[str, Any]) -> str:
    """Generate an explore link for the given dataset and form data."""
    from superset.commands.explore.form_data.create import CreateFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters
    from superset.utils.core import DatasourceType

    # Create form data key for caching
    parameters = CommandParameters(
        datasource_id=int(dataset_id),
        datasource_type=DatasourceType.TABLE,
        form_data=json.dumps(form_data),
    )

    try:
        command = CreateFormDataCommand(parameters)
        form_data_key = command.run()

        # Generate explore URL with form_data_key
        explore_url = (
            f"/explore/?form_data_key={form_data_key}&datasource_id="
            f"{dataset_id}&datasource_type=table"
        )
        return explore_url
    except Exception:
        # Fallback to simple URL if form data caching fails
        form_data_str = json.dumps(form_data)
        return (
            f"/explore/?datasource_id={dataset_id}&datasource_type=table"
            f"&form_data={form_data_str}"
        )


def _map_config_to_form_data(
    config: Union[TableChartConfig, XYChartConfig],
) -> Dict[str, Any]:
    """Map chart config to Superset form_data."""
    if isinstance(config, TableChartConfig):
        return _map_table_config(config)
    elif isinstance(config, XYChartConfig):
        return _map_xy_config(config)
    else:
        raise ValueError(f"Unsupported config type: {type(config)}")


def _map_table_config(config: TableChartConfig) -> Dict[str, Any]:
    """Map table chart config to form_data."""
    # Convert columns to metrics - always use complex object format
    metrics = [_create_metric_object(col) for col in config.columns]

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
                "operator": _map_filter_operator(filter_config.op),
                "comparator": filter_config.value,
            }
            for filter_config in config.filters
        ]

    if config.sort_by:
        form_data["order_by_cols"] = config.sort_by

    return form_data


def _create_metric_object(col: ColumnRef) -> Dict[str, Any]:
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


def _add_axis_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
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


def _add_legend_config(form_data: Dict[str, Any], config: XYChartConfig) -> None:
    """Add legend configuration to form_data."""
    if config.legend:
        if not config.legend.show:
            form_data["show_legend"] = False
        if config.legend.position:
            form_data["legend_orientation"] = config.legend.position


def _map_xy_config(config: XYChartConfig) -> Dict[str, Any]:
    """Map XY chart config to form_data."""
    # Map chart kind to viz_type
    viz_type_map = {
        "line": "echarts_timeseries_line",
        "bar": "echarts_timeseries_bar",
        "area": "echarts_area",
        "scatter": "echarts_timeseries_scatter",
    }

    # Convert Y columns to metrics
    metrics = [_create_metric_object(col) for col in config.y]

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
                "operator": _map_filter_operator(filter_config.op),
                "comparator": filter_config.value,
            }
            for filter_config in config.filters
        ]

    # Add configurations
    _add_axis_config(form_data, config)
    _add_legend_config(form_data, config)

    return form_data


def _map_filter_operator(op: str) -> str:
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


def _generate_chart_name(config: Union[TableChartConfig, XYChartConfig]) -> str:
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
