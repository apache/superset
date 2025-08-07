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
Chart resources for valid ChartConfig examples and templates
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp

logger = logging.getLogger(__name__)


@mcp.resource("superset://chart/configs")
@mcp_auth_hook
async def get_chart_configs_resource() -> str:
    """
    Provide valid ChartConfig examples that match the exact schema.

    This resource gives LLMs access to:
    - Valid ChartConfig examples for XYChartConfig and TableChartConfig
    - Working configurations that pass schema validation
    - Examples with proper ColumnRef, FilterConfig, AxisConfig, and LegendConfig
    - Best practices for each chart type configuration
    """

    # Valid XYChartConfig examples - these match the exact schema
    xy_chart_configs = {
        "line_chart": {
            "description": "Basic line chart for time series analysis",
            "config": {
                "chart_type": "xy",
                "kind": "line",
                "x": {"name": "created_on", "label": "Date Created"},
                "y": [
                    {
                        "name": "count_metric",
                        "aggregate": "COUNT",
                        "label": "Total Count",
                    }
                ],
            },
            "use_cases": [
                "Time series trends",
                "Historical analysis",
                "Growth tracking",
            ],
        },
        "bar_chart": {
            "description": "Bar chart for category comparison",
            "config": {
                "chart_type": "xy",
                "kind": "bar",
                "x": {"name": "category", "label": "Category"},
                "y": [{"name": "sales", "aggregate": "SUM", "label": "Total Sales"}],
                "x_axis": {"title": "Product Categories", "scale": "linear"},
                "y_axis": {
                    "title": "Revenue ($)",
                    "format": "$,.0f",
                    "scale": "linear",
                },
            },
            "use_cases": ["Category comparison", "Rankings", "Performance metrics"],
        },
        "multi_metric_line": {
            "description": "Multi-metric line chart with grouping",
            "config": {
                "chart_type": "xy",
                "kind": "line",
                "x": {"name": "date_column", "label": "Date"},
                "y": [
                    {"name": "revenue", "aggregate": "SUM", "label": "Revenue"},
                    {
                        "name": "users",
                        "aggregate": "COUNT_DISTINCT",
                        "label": "Unique Users",
                    },
                ],
                "group_by": {"name": "region", "label": "Region"},
                "legend": {"show": True, "position": "right"},
                "filters": [{"column": "status", "op": "=", "value": "active"}],
            },
            "use_cases": [
                "Multi-dimensional analysis",
                "Regional comparisons",
                "KPI tracking",
            ],
        },
        "scatter_plot": {
            "description": "Scatter plot for correlation analysis",
            "config": {
                "chart_type": "xy",
                "kind": "scatter",
                "x": {
                    "name": "advertising_spend",
                    "aggregate": "AVG",
                    "label": "Avg Ad Spend",
                },
                "y": [
                    {
                        "name": "conversion_rate",
                        "aggregate": "AVG",
                        "label": "Avg Conversion Rate",
                    }
                ],
                "group_by": {"name": "campaign_type", "label": "Campaign Type"},
                "x_axis": {"title": "Average Advertising Spend", "format": "$,.0f"},
                "y_axis": {"title": "Conversion Rate", "format": ".2%"},
            },
            "use_cases": [
                "Correlation analysis",
                "Outlier detection",
                "Performance relationships",
            ],
        },
        "area_chart": {
            "description": "Area chart for volume visualization",
            "config": {
                "chart_type": "xy",
                "kind": "area",
                "x": {"name": "month", "label": "Month"},
                "y": [
                    {"name": "signups", "aggregate": "SUM", "label": "Monthly Signups"}
                ],
                "filters": [
                    {"column": "year", "op": ">=", "value": 2023},
                    {"column": "active", "op": "=", "value": True},
                ],
            },
            "use_cases": ["Volume trends", "Cumulative metrics", "Stacked comparisons"],
        },
    }

    # Valid TableChartConfig examples - these match the exact schema
    table_chart_configs = {
        "basic_table": {
            "description": "Basic data table with multiple columns",
            "config": {
                "chart_type": "table",
                "columns": [
                    {"name": "name", "label": "Customer Name"},
                    {"name": "email", "label": "Email Address"},
                    {"name": "orders", "aggregate": "COUNT", "label": "Total Orders"},
                    {"name": "revenue", "aggregate": "SUM", "label": "Total Revenue"},
                ],
                "sort_by": ["Total Revenue"],
            },
            "use_cases": [
                "Detailed data views",
                "Customer lists",
                "Transaction records",
            ],
        },
        "aggregated_table": {
            "description": "Table with aggregated metrics and filters",
            "config": {
                "chart_type": "table",
                "columns": [
                    {"name": "region", "label": "Sales Region"},
                    {
                        "name": "sales_amount",
                        "aggregate": "SUM",
                        "label": "Total Sales",
                    },
                    {
                        "name": "sales_amount",
                        "aggregate": "AVG",
                        "label": "Average Sale",
                    },
                    {
                        "name": "customer_id",
                        "aggregate": "COUNT_DISTINCT",
                        "label": "Unique Customers",
                    },
                ],
                "filters": [
                    {"column": "sale_date", "op": ">=", "value": "2024-01-01"},
                    {"column": "status", "op": "!=", "value": "cancelled"},
                ],
                "sort_by": ["Total Sales", "Sales Region"],
            },
            "use_cases": ["Summary reports", "Regional analysis", "Performance tables"],
        },
    }

    # Schema reference for developers
    schema_reference = {
        "ChartConfig": {
            "description": "Union type - XYChartConfig or TableChartConfig by type",
            "discriminator": "chart_type",
            "types": ["xy", "table"],
        },
        "XYChartConfig": {
            "required_fields": ["chart_type", "x", "y"],
            "optional_fields": [
                "kind",
                "group_by",
                "x_axis",
                "y_axis",
                "legend",
                "filters",
            ],
            "chart_type": "xy",
            "kind_options": ["line", "bar", "area", "scatter"],
            "validation_rules": [
                "All column labels must be unique across x, y, and group_by",
                "Y-axis must have at least one column",
                "Column names must match pattern: ^[a-zA-Z0-9_][a-zA-Z0-9_\\s\\-\\.]*$",
            ],
        },
        "TableChartConfig": {
            "required_fields": ["chart_type", "columns"],
            "optional_fields": ["filters", "sort_by"],
            "chart_type": "table",
            "validation_rules": [
                "Must have at least one column",
                "All column labels must be unique",
                "Column names must match pattern: ^[a-zA-Z0-9_][a-zA-Z0-9_\\s\\-\\.]*$",
            ],
        },
        "ColumnRef": {
            "required_fields": ["name"],
            "optional_fields": ["label", "dtype", "aggregate"],
            "aggregate_options": [
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
            ],
            "validation_rules": [
                "Name cannot be empty and must follow pattern",
                "Labels are HTML-escaped to prevent XSS",
                "Aggregates are validated against allowed functions",
            ],
        },
        "FilterConfig": {
            "required_fields": ["column", "op", "value"],
            "operator_options": ["=", ">", "<", ">=", "<=", "!="],
            "value_types": ["string", "number", "boolean"],
            "validation_rules": [
                "Column names are sanitized to prevent injection",
                "Values are checked for malicious patterns",
                "String values are HTML-escaped",
            ],
        },
        "AxisConfig": {
            "optional_fields": ["title", "scale", "format"],
            "scale_options": ["linear", "log"],
            "format_examples": ["$,.2f", ".2%", ",.0f", ".1f"],
        },
        "LegendConfig": {
            "optional_fields": ["show", "position"],
            "show_default": True,
            "position_options": ["top", "bottom", "left", "right"],
            "position_default": "right",
        },
    }

    # Best practices for each configuration type
    best_practices = {
        "xy_charts": [
            "Use descriptive labels for axes and metrics",
            "Choose appropriate aggregation functions for your data",
            "Limit the number of Y-axis metrics (3-5 maximum)",
            "Use filters to focus on relevant data",
            "Configure axis formatting for better readability",
            "Consider grouping when comparing categories",
            "Use chart kinds: line for trends, bar for comparisons, scatter plots",
        ],
        "table_charts": [
            "Include essential columns only to avoid clutter",
            "Use meaningful column labels",
            "Apply sorting to highlight important data",
            "Use filters to limit result sets",
            "Mix dimensions and aggregated metrics appropriately",
            "Ensure unique labels to avoid conflicts",
            "Consider performance with large datasets",
        ],
        "general": [
            "Always specify chart_type as the first field",
            "Use consistent naming conventions for columns",
            "Validate column names exist in your dataset",
            "Test configurations with actual data",
            "Consider caching for frequently accessed charts",
            "Apply security best practices - avoid user input in column names",
        ],
    }

    # Common patterns and examples
    common_patterns = {
        "time_series": {
            "description": "Standard time-based analysis",
            "x_column_types": ["date", "datetime", "timestamp"],
            "recommended_aggregations": ["SUM", "COUNT", "AVG"],
            "best_chart_types": ["line", "area", "bar"],
        },
        "categorical_analysis": {
            "description": "Comparing discrete categories",
            "x_column_types": ["string", "category", "enum"],
            "recommended_aggregations": ["SUM", "COUNT", "COUNT_DISTINCT", "AVG"],
            "best_chart_types": ["bar", "table"],
        },
        "correlation_analysis": {
            "description": "Finding relationships between variables",
            "requirements": ["Two numerical metrics"],
            "recommended_aggregations": ["AVG", "SUM", "MEDIAN"],
            "best_chart_types": ["scatter"],
        },
    }

    resource_data = {
        "xy_chart_configs": xy_chart_configs,
        "table_chart_configs": table_chart_configs,
        "schema_reference": schema_reference,
        "best_practices": best_practices,
        "common_patterns": common_patterns,
        "metadata": {
            "version": "1.0",
            "schema_version": "ChartConfig v1.0",
            "last_updated": "2025-08-07",
            "usage_notes": [
                "All examples are valid ChartConfig objects that pass validation",
                "Copy these configurations directly into generate_chart requests",
                "Modify column names and labels to match your actual dataset",
                "Test configurations with get_dataset_info to verify columns",
                "All examples follow security best practices and input validation",
            ],
            "validation_info": [
                "Column names must match: ^[a-zA-Z0-9_][a-zA-Z0-9_\\s\\-\\.]*$",
                "Labels are automatically HTML-escaped for security",
                "Filter values are sanitized to prevent injection attacks",
                "All field lengths are validated against schema limits",
                "Duplicate labels are automatically detected and rejected",
            ],
        },
    }

    from superset.utils import json

    return json.dumps(resource_data, indent=2)
