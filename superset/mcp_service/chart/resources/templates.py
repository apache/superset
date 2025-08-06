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
Chart resources for visualization templates and best practices
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp

logger = logging.getLogger(__name__)


@mcp.resource("superset://chart/templates")
@mcp_auth_hook
async def get_chart_templates_resource() -> str:
    """
    Provide chart configuration templates and best practices.

    This resource gives LLMs access to:
    - Pre-configured chart settings for common use cases
    - Best practice configurations for each chart type
    - Color schemes and formatting guidelines
    - Performance optimization settings
    """

    templates = {
        "line_chart": {
            "description": "Time series line chart for trend analysis",
            "viz_type": "line",
            "recommended_for": ["time_series", "trends", "continuous_data"],
            "configuration": {
                "metrics": ["SUM(metric)"],
                "groupby": ["time_column"],
                "time_grain_sqla": "P1D",
                "time_range": "No filter",
                "order_desc": True,
                "limit": 1000,
                "show_legend": True,
                "line_interpolation": "linear",
            },
            "best_practices": [
                "Use for showing trends over time",
                "Limit to 5-7 lines maximum for readability",
                "Include clear axis labels",
                "Use appropriate time granularity",
            ],
        },
        "bar_chart": {
            "description": "Vertical bar chart for category comparison",
            "viz_type": "bar",
            "recommended_for": ["category_comparison", "rankings", "discrete_data"],
            "configuration": {
                "metrics": ["SUM(metric)"],
                "groupby": ["category_column"],
                "order_desc": True,
                "limit": 20,
                "show_legend": False,
                "show_bar_value": True,
            },
            "best_practices": [
                "Sort bars by value for easier comparison",
                "Limit to 10-15 categories for clarity",
                "Use consistent color scheme",
                "Start y-axis at zero for accurate comparison",
            ],
        },
        "pie_chart": {
            "description": "Pie chart for showing parts of a whole",
            "viz_type": "pie",
            "recommended_for": ["composition", "market_share", "percentages"],
            "configuration": {
                "metrics": ["SUM(metric)"],
                "groupby": ["category_column"],
                "order_desc": True,
                "limit": 7,
                "show_legend": True,
                "show_labels": True,
                "label_type": "value_percent",
            },
            "best_practices": [
                "Limit to 5-7 segments maximum",
                "Order segments by size",
                "Use distinct colors",
                "Consider donut chart for better readability",
            ],
        },
        "table": {
            "description": "Data table for detailed information display",
            "viz_type": "table",
            "recommended_for": ["detailed_data", "exact_values", "multiple_metrics"],
            "configuration": {
                "metrics": ["SUM(metric1)", "AVG(metric2)", "COUNT(*)"],
                "groupby": ["dimension1", "dimension2"],
                "order_desc": True,
                "limit": 100,
                "show_totals": True,
                "conditional_formatting": [],
            },
            "best_practices": [
                "Use for exact values and detailed analysis",
                "Apply conditional formatting for key values",
                "Limit columns for better readability",
                "Include totals when appropriate",
            ],
        },
        "scatter_plot": {
            "description": "Scatter plot for correlation analysis",
            "viz_type": "scatter",
            "recommended_for": [
                "correlation",
                "outlier_detection",
                "two_variable_analysis",
            ],
            "configuration": {
                "metrics": ["AVG(x_metric)", "AVG(y_metric)"],
                "groupby": ["category"],
                "limit": 500,
                "show_legend": True,
                "point_radius": 3,
            },
            "best_practices": [
                "Use for showing relationships between variables",
                "Include trend lines when appropriate",
                "Size points by additional metric if helpful",
                "Limit points to avoid overcrowding",
            ],
        },
    }

    color_schemes = {
        "categorical": {
            "default": [
                "#1f77b4",
                "#ff7f0e",
                "#2ca02c",
                "#d62728",
                "#9467bd",
                "#8c564b",
                "#e377c2",
            ],
            "professional": [
                "#084594",
                "#2171b5",
                "#4292c6",
                "#6baed6",
                "#9ecae1",
                "#c6dbef",
            ],
            "vibrant": [
                "#e41a1c",
                "#377eb8",
                "#4daf4a",
                "#984ea3",
                "#ff7f00",
                "#ffff33",
            ],
        },
        "sequential": {
            "blue": [
                "#f7fbff",
                "#deebf7",
                "#c6dbef",
                "#9ecae1",
                "#6baed6",
                "#4292c6",
                "#2171b5",
                "#084594",
            ],
            "green": [
                "#f7fcf5",
                "#e5f5e0",
                "#c7e9c0",
                "#a1d99b",
                "#74c476",
                "#41ab5d",
                "#238b45",
                "#005a32",
            ],
            "red": [
                "#fff5f0",
                "#fee0d2",
                "#fcbba1",
                "#fc9272",
                "#fb6a4a",
                "#ef3b2c",
                "#cb181d",
                "#99000d",
            ],
        },
    }

    performance_tips = {
        "row_limits": {
            "line_charts": 1000,
            "bar_charts": 50,
            "tables": 200,
            "scatter_plots": 1000,
            "pie_charts": 10,
        },
        "caching": {"enabled": True, "timeout": 3600, "key_prefix": "chart_cache"},
        "aggregation_tips": [
            "Pre-aggregate data at the database level when possible",
            "Use appropriate time grains for time series",
            "Consider using calculated columns for complex metrics",
            "Apply filters to reduce data volume",
        ],
    }

    chart_selection_guide = {
        "time_series_data": ["line", "area", "bar"],
        "categorical_data": ["bar", "pie", "table"],
        "numerical_relationships": ["scatter", "line", "table"],
        "composition_analysis": ["pie", "stacked_bar", "area"],
        "detailed_analysis": ["table", "heatmap"],
        "geographic_data": ["map", "choropleth"],
    }

    resource_data = {
        "templates": templates,
        "color_schemes": color_schemes,
        "performance_tips": performance_tips,
        "chart_selection_guide": chart_selection_guide,
        "metadata": {
            "version": "1.0",
            "last_updated": "2025-08-03",
            "usage_notes": [
                "These templates provide starting points for chart creation",
                "Adjust configurations based on your specific data",
                "Follow best practices for better user experience",
                "Consider performance implications for large datasets",
            ],
        },
    }

    from superset.utils import json

    return json.dumps(resource_data, indent=2)
