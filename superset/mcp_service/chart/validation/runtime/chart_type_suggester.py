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
Chart type suggestions based on data characteristics and user intent.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)

logger = logging.getLogger(__name__)


class ChartTypeSuggester:
    """
    Suggests appropriate chart types based on data characteristics
    and identifies potential mismatches between chart type and data.
    """

    @staticmethod
    def analyze_and_suggest(
        config: ChartConfig,
        dataset_id: int | str,  # noqa: ARG002
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Analyze chart configuration and suggest better chart types if needed.

        Returns:
            Tuple of (is_appropriate, suggestion_info)
        """
        try:
            if isinstance(config, XYChartConfig):
                return ChartTypeSuggester._analyze_xy_chart(config)
            elif isinstance(config, TableChartConfig):
                return ChartTypeSuggester._analyze_table_chart(config)
            else:
                return True, None
        except Exception as e:
            logger.warning("Chart type analysis failed: %s", e)
            return True, None  # Don't block on suggestion failures

    @staticmethod
    def _analyze_xy_chart(
        config: XYChartConfig,
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Analyze XY chart appropriateness."""
        issues = []
        suggestions = []

        x_analysis = ChartTypeSuggester._analyze_x_axis(config.x.name)
        y_analysis = ChartTypeSuggester._analyze_y_axis(config.y)

        # Check chart type specific issues
        chart_issues, chart_suggestions = ChartTypeSuggester._check_chart_type_issues(
            config, x_analysis, y_analysis
        )
        issues.extend(chart_issues)
        suggestions.extend(chart_suggestions)

        # Add general suggestions
        general_suggestions = ChartTypeSuggester._get_general_suggestions(
            x_analysis, y_analysis
        )
        suggestions.extend(general_suggestions)

        if issues:
            return False, {
                "issues": issues,
                "suggestions": suggestions,
                "recommended_types": ChartTypeSuggester._get_recommended_types(
                    x_analysis["is_temporal"],
                    x_analysis["is_categorical"],
                    y_analysis["has_count"],
                    y_analysis["num_metrics"],
                ),
            }

        return True, None

    @staticmethod
    def _analyze_x_axis(x_name: str) -> Dict[str, Any]:
        """Analyze X-axis characteristics."""
        x_name_lower = x_name.lower()
        return {
            "is_temporal": any(
                t in x_name_lower
                for t in [
                    "date",
                    "time",
                    "year",
                    "month",
                    "day",
                    "hour",
                    "created",
                    "updated",
                ]
            ),
            "is_categorical": any(
                c in x_name_lower
                for c in [
                    "category",
                    "type",
                    "status",
                    "department",
                    "region",
                    "country",
                    "state",
                ]
            ),
            "is_id": any(i in x_name_lower for i in ["id", "uuid", "guid", "key"]),
            "name": x_name,
        }

    @staticmethod
    def _analyze_y_axis(y_columns: List[ColumnRef]) -> Dict[str, Any]:
        """Analyze Y-axis characteristics."""
        return {
            "has_count": any(
                col.aggregate in ["COUNT", "COUNT_DISTINCT"] for col in y_columns
            ),
            "num_metrics": len(y_columns),
        }

    @staticmethod
    def _check_chart_type_issues(
        config: XYChartConfig, x_analysis: Dict[str, Any], y_analysis: Dict[str, Any]
    ) -> Tuple[List[str], List[str]]:
        """Check for chart type specific issues."""
        issues = []
        suggestions = []

        # Extract analysis values
        x_is_temporal = x_analysis["is_temporal"]
        x_is_categorical = x_analysis["is_categorical"]
        x_is_id = x_analysis["is_id"]
        num_metrics = y_analysis["num_metrics"]

        # Check chart type specific issues by delegating to helper methods
        if config.kind == "line":
            line_issues, line_suggestions = ChartTypeSuggester._check_line_chart_issues(
                config, x_is_temporal, x_is_categorical, x_is_id
            )
            issues.extend(line_issues)
            suggestions.extend(line_suggestions)
        elif config.kind == "scatter":
            (
                scatter_issues,
                scatter_suggestions,
            ) = ChartTypeSuggester._check_scatter_chart_issues(
                config, x_is_categorical, num_metrics
            )
            issues.extend(scatter_issues)
            suggestions.extend(scatter_suggestions)
        elif config.kind == "area":
            area_issues, area_suggestions = ChartTypeSuggester._check_area_chart_issues(
                config, x_is_temporal
            )
            issues.extend(area_issues)
            suggestions.extend(area_suggestions)
        elif config.kind == "bar":
            bar_issues, bar_suggestions = ChartTypeSuggester._check_bar_chart_issues(
                config, x_is_id
            )
            issues.extend(bar_issues)
            suggestions.extend(bar_suggestions)

        return issues, suggestions

    @staticmethod
    def _check_line_chart_issues(
        config: XYChartConfig,
        x_is_temporal: bool,
        x_is_categorical: bool,
        x_is_id: bool,
    ) -> Tuple[List[str], List[str]]:
        """Check line chart specific issues."""
        issues = []
        suggestions = []

        if not x_is_temporal and x_is_categorical:
            issues.append(
                f"Line chart with categorical X-axis '{config.x.name}' may not "
                f"show meaningful trends"
            )
            suggestions.extend(
                [
                    "Consider using a bar chart for categorical comparisons",
                    "Line charts work best with temporal or continuous data",
                ]
            )
        elif x_is_id:
            issues.append(
                f"Line chart with ID field '{config.x.name}' on X-axis will not "
                f"show meaningful patterns"
            )
            suggestions.extend(
                [
                    "Use a table to display individual records",
                    "Or aggregate the data by a meaningful dimension",
                ]
            )

        return issues, suggestions

    @staticmethod
    def _check_scatter_chart_issues(
        config: XYChartConfig, x_is_categorical: bool, num_metrics: int
    ) -> Tuple[List[str], List[str]]:
        """Check scatter chart specific issues."""
        issues = []
        suggestions = []

        if x_is_categorical:
            issues.append(
                f"Scatter plot with categorical X-axis '{config.x.name}' may not "
                f"effectively show correlations"
            )
            suggestions.extend(
                [
                    "Scatter plots work best with two continuous variables",
                    "Consider a bar chart for categorical vs numeric data",
                ]
            )
        if num_metrics > 1:
            issues.append("Scatter plots with multiple Y metrics can be confusing")
            suggestions.extend(
                [
                    "Consider using only one Y metric for clarity",
                    "Or use a line/bar chart to compare multiple metrics",
                ]
            )

        return issues, suggestions

    @staticmethod
    def _check_area_chart_issues(
        config: XYChartConfig, x_is_temporal: bool
    ) -> Tuple[List[str], List[str]]:
        """Check area chart specific issues."""
        issues = []
        suggestions = []

        if not x_is_temporal:
            issues.append(
                f"Area chart with non-temporal X-axis '{config.x.name}' may be "
                f"misleading"
            )
            suggestions.extend(
                [
                    "Area charts imply cumulative or part-to-whole relationships over "
                    "time",
                    "Consider a stacked bar chart for categorical data",
                ]
            )

        # Check for potential negative values
        for col in config.y:
            if any(term in col.name.lower() for term in ["loss", "debt", "negative"]):
                issues.append(
                    f"Area chart with potentially negative values in '{col.name}' "
                    f"can create visual confusion"
                )
                suggestions.extend(
                    [
                        "Use a line chart for data that can go negative",
                        "Or ensure all values are positive before using area chart",
                    ]
                )

        return issues, suggestions

    @staticmethod
    def _check_bar_chart_issues(
        config: XYChartConfig, x_is_id: bool
    ) -> Tuple[List[str], List[str]]:
        """Check bar chart specific issues."""
        issues = []
        suggestions = []

        if x_is_id:
            issues.append(
                f"Bar chart with ID field '{config.x.name}' may create too many bars"
            )
            suggestions.extend(
                [
                    "Consider aggregating by a higher-level category",
                    "Or use filters to limit the number of bars displayed",
                ]
            )

        return issues, suggestions

    @staticmethod
    def _get_general_suggestions(
        x_analysis: Dict[str, Any], y_analysis: Dict[str, Any]
    ) -> List[str]:
        """Get general suggestions based on data patterns."""
        suggestions = []
        x_is_temporal = x_analysis["is_temporal"]
        x_is_categorical = x_analysis["is_categorical"]
        has_count = y_analysis["has_count"]
        num_metrics = y_analysis["num_metrics"]

        if has_count and x_is_categorical:
            suggestions.append(
                "This looks like frequency analysis - bar charts work well for counts "
                "by category"
            )
        elif x_is_temporal and num_metrics == 1:
            suggestions.append(
                "Single metric over time - line charts are ideal for showing trends"
            )
        elif x_is_temporal and num_metrics > 3:
            suggestions.append(
                "Many metrics over time - consider focusing on 2-3 key metrics for "
                "clarity"
            )

        return suggestions

    @staticmethod
    def _analyze_table_chart(
        config: TableChartConfig,
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Analyze table chart appropriateness."""
        issues = []
        suggestions = []

        # Count different column types
        raw_columns = sum(1 for col in config.columns if not col.aggregate)
        metric_columns = sum(1 for col in config.columns if col.aggregate)
        total_columns = len(config.columns)

        # Check if data might be better visualized
        if metric_columns > 0 and raw_columns <= 2:
            # Mostly metrics with few dimensions - could be visualized
            issues.append(
                "Table with mostly aggregated metrics could be visualized as a chart"
            )
            suggestions.append("Consider a bar chart to compare metric values visually")
            suggestions.append("Or use a line chart if there's a time dimension")

        # Check for ID-heavy tables
        id_columns = sum(
            1
            for col in config.columns
            if any(i in col.name.lower() for i in ["id", "uuid", "guid", "key"])
        )
        if id_columns > total_columns / 2:
            suggestions.append(
                "Table appears to be ID-heavy - ensure this is for detailed record "
                "inspection"
            )
            suggestions.append(
                "For analysis, consider aggregating by meaningful dimensions instead"
            )

        # Very wide tables
        if total_columns > 10:
            issues.append(
                f"Table with {total_columns} columns may be difficult to read"
            )
            suggestions.append("Consider showing only the most important columns")
            suggestions.append("Or break into multiple focused views")

        if issues:
            return False, {
                "issues": issues,
                "suggestions": suggestions,
                "recommended_types": ["table", "pivot_table"]
                if metric_columns > 0
                else ["table"],
            }

        return True, None

    @staticmethod
    def _get_recommended_types(
        x_is_temporal: bool, x_is_categorical: bool, has_count: bool, num_metrics: int
    ) -> List[str]:
        """Get recommended chart types based on data characteristics."""
        recommendations = []

        if x_is_temporal:
            recommendations.extend(["line", "area", "bar"])
            if num_metrics == 1:
                recommendations.append("scatter")  # For trend analysis
        elif x_is_categorical:
            recommendations.extend(["bar", "table"])
            if has_count and num_metrics == 1:
                recommendations.append("pie")  # For proportion analysis
        else:
            # Continuous or unclear X-axis
            recommendations.extend(["scatter", "line", "table"])

        # Always include table as fallback
        if "table" not in recommendations:
            recommendations.append("table")

        return recommendations

    @staticmethod
    def get_chart_type_description(chart_type: str) -> str:
        """Get a description of when to use each chart type."""
        descriptions = {
            "line": "Best for showing trends over time or continuous data",
            "bar": "Ideal for comparing values across categories",
            "area": "Shows cumulative totals and part-to-whole relationships over time",
            "scatter": "Reveals correlations between two continuous variables",
            "table": "Displays detailed data or many dimensions at once",
            "pie": "Shows proportions of a whole (use sparingly, max 5-7 slices)",
            "pivot_table": "Summarizes data across multiple dimensions",
        }
        return descriptions.get(
            chart_type, f"Visualizes data using {chart_type} format"
        )
