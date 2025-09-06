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
generation that can be used by both generate_chart and generate_explore_link tools.
"""

from typing import Any, Dict

from superset.mcp_service.chart.schemas import (
    ChartCapabilities,
    ChartSemantics,
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json


def generate_explore_link(dataset_id: int | str, form_data: Dict[str, Any]) -> str:
    """Generate an explore link for the given dataset and form data."""
    base_url = get_superset_base_url()
    numeric_dataset_id = None

    try:
        from superset.commands.explore.form_data.parameters import CommandParameters

        # Find the dataset to get its numeric ID
        from superset.daos.dataset import DatasetDAO
        from superset.mcp_service.commands.create_form_data import (
            MCPCreateFormDataCommand,
        )
        from superset.utils.core import DatasourceType

        dataset = None

        if isinstance(dataset_id, int) or (
            isinstance(dataset_id, str) and dataset_id.isdigit()
        ):
            numeric_dataset_id = (
                int(dataset_id) if isinstance(dataset_id, str) else dataset_id
            )
            dataset = DatasetDAO.find_by_id(numeric_dataset_id)
        else:
            # Try UUID lookup using DAO flexible method
            dataset = DatasetDAO.find_by_id(dataset_id, id_column="uuid")
            if dataset:
                numeric_dataset_id = dataset.id

        if not dataset or numeric_dataset_id is None:
            # Fallback to basic explore URL
            return (
                f"{base_url}/explore/?datasource_type=table&datasource_id={dataset_id}"
            )

        # Add datasource to form_data
        form_data_with_datasource = {
            **form_data,
            "datasource": f"{numeric_dataset_id}__table",
        }

        # Try to create form_data in cache using MCP-specific CreateFormDataCommand
        cmd_params = CommandParameters(
            datasource_type=DatasourceType.TABLE,
            datasource_id=numeric_dataset_id,
            chart_id=0,  # 0 for new charts
            tab_id=None,
            form_data=json.dumps(form_data_with_datasource),
        )

        # Create the form_data cache entry and get the key
        form_data_key = MCPCreateFormDataCommand(cmd_params).run()

        # Return URL with just the form_data_key
        return f"{base_url}/explore/?form_data_key={form_data_key}"

    except Exception:
        # Fallback to basic explore URL with numeric ID if available
        if numeric_dataset_id is not None:
            return (
                f"{base_url}/explore/?datasource_type=table"
                f"&datasource_id={numeric_dataset_id}"
            )
        else:
            return (
                f"{base_url}/explore/?datasource_type=table&datasource_id={dataset_id}"
            )


def map_config_to_form_data(
    config: TableChartConfig | XYChartConfig,
) -> Dict[str, Any]:
    """Map chart config to Superset form_data."""
    if isinstance(config, TableChartConfig):
        return map_table_config(config)
    elif isinstance(config, XYChartConfig):
        return map_xy_config(config)
    else:
        raise ValueError(f"Unsupported config type: {type(config)}")


def map_table_config(config: TableChartConfig) -> Dict[str, Any]:
    """Map table chart config to form_data with defensive validation."""
    # Early validation to prevent empty charts
    if not config.columns:
        raise ValueError("Table chart must have at least one column")

    # Separate columns with aggregates from raw columns
    raw_columns = []
    aggregated_metrics = []

    for col in config.columns:
        if col.aggregate:
            # Column has aggregation - treat as metric
            aggregated_metrics.append(create_metric_object(col))
        else:
            # No aggregation - treat as raw column
            raw_columns.append(col.name)

    # Final validation - ensure we have some data to display
    if not raw_columns and not aggregated_metrics:
        raise ValueError("Table chart configuration resulted in no displayable columns")

    form_data: Dict[str, Any] = {
        "viz_type": "table",
    }

    # Handle raw columns (no aggregation)
    if raw_columns and not aggregated_metrics:
        # Pure raw columns - show individual rows
        form_data.update(
            {
                "all_columns": raw_columns,
                "query_mode": "raw",
                "include_time": False,
                "order_desc": True,
                "row_limit": 1000,  # Reasonable limit for raw data
            }
        )

    # Handle aggregated columns only
    elif aggregated_metrics and not raw_columns:
        # Pure aggregation - show totals
        form_data.update(
            {
                "metrics": aggregated_metrics,
                "query_mode": "aggregate",
            }
        )

    # Handle mixed columns (raw + aggregated)
    elif raw_columns and aggregated_metrics:
        # Mixed mode - group by raw columns, aggregate metrics
        form_data.update(
            {
                "all_columns": raw_columns,
                "metrics": aggregated_metrics,
                "groupby": raw_columns,
                "query_mode": "aggregate",
            }
        )

    if config.filters:
        form_data["adhoc_filters"] = [
            {
                "clause": "WHERE",
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
    """Create a metric object for a column with enhanced validation."""
    # Ensure aggregate is valid - default to SUM if not specified or invalid
    valid_aggregates = {
        "SUM",
        "COUNT",
        "AVG",
        "MIN",
        "MAX",
        "COUNT_DISTINCT",
        "STDDEV",
        "VAR",
        "MEDIAN",
        "PERCENTILE",
    }
    aggregate = col.aggregate or "SUM"

    # Validate aggregate function (final safety check)
    if aggregate.upper() not in valid_aggregates:
        aggregate = "SUM"  # Safe fallback

    return {
        "aggregate": aggregate.upper(),
        "column": {
            "column_name": col.name,
        },
        "expressionType": "SIMPLE",
        "label": col.label or f"{aggregate.upper()}({col.name})",
        "optionName": f"metric_{col.name}",
        "sqlExpression": None,
        "hasCustomLabel": bool(col.label),
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
    """Map XY chart config to form_data with defensive validation."""
    # Early validation to prevent empty charts
    if not config.y:
        raise ValueError("XY chart must have at least one Y-axis metric")

    # Map chart kind to viz_type
    viz_type_map = {
        "line": "echarts_timeseries_line",
        "bar": "echarts_timeseries_bar",
        "area": "echarts_area",
        "scatter": "echarts_timeseries_scatter",
    }

    # Convert Y columns to metrics with validation
    metrics = []
    for col in config.y:
        if not col.name.strip():  # Validate column name is not empty
            raise ValueError("Y-axis column name cannot be empty")
        metrics.append(create_metric_object(col))

    # Final validation - ensure we have metrics to display
    if not metrics:
        raise ValueError("XY chart configuration resulted in no displayable metrics")

    form_data: Dict[str, Any] = {
        "viz_type": viz_type_map.get(config.kind, "echarts_timeseries_line"),
        "x_axis": config.x.name,
        "metrics": metrics,
    }

    # CRITICAL FIX: For time series charts, handle groupby carefully to avoid duplicates
    # The x_axis field already tells Superset which column to use for time grouping
    groupby_columns = []

    # Only add groupby columns if there's an explicit group_by specified
    # The x_axis column should NOT be duplicated in groupby as it causes
    # "Duplicate column/metric labels" errors in Superset
    # Only add group_by column if it's specified AND different from x_axis
    # NEVER add the x_axis column to groupby as it creates duplicate labels
    if config.group_by and config.group_by.name != config.x.name:
        groupby_columns.append(config.group_by.name)

    # Set the groupby in form_data only if we have valid columns
    # Don't set empty groupby - let Superset handle x_axis grouping automatically
    if groupby_columns:
        form_data["groupby"] = groupby_columns

    # Add filters if specified
    if config.filters:
        form_data["adhoc_filters"] = [
            {
                "clause": "WHERE",
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


def generate_chart_name(config: TableChartConfig | XYChartConfig) -> str:
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


def analyze_chart_capabilities(chart: Any | None, config: Any) -> ChartCapabilities:
    """Analyze chart capabilities based on type and configuration."""
    if chart:
        viz_type = getattr(chart, "viz_type", "unknown")
    else:
        # Map config chart_type to viz_type
        chart_type = getattr(config, "chart_type", "unknown")
        if chart_type == "xy":
            kind = getattr(config, "kind", "line")
            viz_type_map = {
                "line": "echarts_timeseries_line",
                "bar": "echarts_timeseries_bar",
                "area": "echarts_area",
                "scatter": "echarts_timeseries_scatter",
            }
            viz_type = viz_type_map.get(kind, "echarts_timeseries_line")
        elif chart_type == "table":
            viz_type = "table"
        else:
            viz_type = "unknown"

    # Determine interaction capabilities based on chart type
    interactive_types = [
        "echarts_timeseries_line",
        "echarts_timeseries_bar",
        "echarts_area",
        "echarts_timeseries_scatter",
        "deck_scatter",
        "deck_hex",
    ]

    supports_interaction = viz_type in interactive_types
    supports_drill_down = viz_type in ["table", "pivot_table_v2"]
    supports_real_time = viz_type in [
        "echarts_timeseries_line",
        "echarts_timeseries_bar",
    ]

    # Determine optimal formats
    optimal_formats = ["url"]  # Always include static image
    if supports_interaction:
        optimal_formats.extend(["interactive", "vega_lite"])
    optimal_formats.extend(["ascii", "table"])

    # Classify data types
    data_types = []
    if hasattr(config, "x") and config.x:
        data_types.append("categorical" if not config.x.aggregate else "metric")
    if hasattr(config, "y") and config.y:
        data_types.extend(["metric"] * len(config.y))
    if "time" in viz_type or "timeseries" in viz_type:
        data_types.append("time_series")

    return ChartCapabilities(
        supports_interaction=supports_interaction,
        supports_real_time=supports_real_time,
        supports_drill_down=supports_drill_down,
        supports_export=True,  # All charts can be exported
        optimal_formats=optimal_formats,
        data_types=list(set(data_types)),
    )


def analyze_chart_semantics(chart: Any | None, config: Any) -> ChartSemantics:
    """Generate semantic understanding of the chart."""
    if chart:
        viz_type = getattr(chart, "viz_type", "unknown")
    else:
        # Map config chart_type to viz_type
        chart_type = getattr(config, "chart_type", "unknown")
        if chart_type == "xy":
            kind = getattr(config, "kind", "line")
            viz_type_map = {
                "line": "echarts_timeseries_line",
                "bar": "echarts_timeseries_bar",
                "area": "echarts_area",
                "scatter": "echarts_timeseries_scatter",
            }
            viz_type = viz_type_map.get(kind, "echarts_timeseries_line")
        elif chart_type == "table":
            viz_type = "table"
        else:
            viz_type = "unknown"

    # Generate primary insight based on chart type
    insights_map = {
        "echarts_timeseries_line": "Shows trends and changes over time",
        "echarts_timeseries_bar": "Compares values across categories or time periods",
        "table": "Displays detailed data in tabular format",
        "pie": "Shows proportional relationships within a dataset",
        "echarts_area": "Emphasizes cumulative totals and part-to-whole relationships",
    }

    primary_insight = insights_map.get(
        viz_type, f"Visualizes data using {viz_type} format"
    )

    # Generate data story
    columns = []
    if hasattr(config, "x") and config.x:
        columns.append(config.x.name)
    if hasattr(config, "y") and config.y:
        columns.extend([col.name for col in config.y])

    if columns:
        ellipsis = "..." if len(columns) > 3 else ""
        data_story = (
            f"This {viz_type} chart analyzes {', '.join(columns[:3])}{ellipsis}"
        )
    else:
        data_story = "This chart provides insights into the selected dataset"

    # Generate recommended actions
    recommended_actions = [
        "Review data patterns and trends",
        "Consider filtering or drilling down for more detail",
        "Export chart for reporting or sharing",
    ]

    if viz_type in ["echarts_timeseries_line", "echarts_timeseries_bar"]:
        recommended_actions.append("Analyze seasonal patterns or cyclical trends")

    return ChartSemantics(
        primary_insight=primary_insight,
        data_story=data_story,
        recommended_actions=recommended_actions,
        anomalies=[],  # Would need actual data analysis to populate
        statistical_summary={},  # Would need actual data analysis to populate
    )
