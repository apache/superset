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
Cardinality validation to prevent unusable visualizations from high-cardinality data.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class CardinalityValidator:
    """
    Validates cardinality of dimensions to prevent charts with too many categories
    that become unreadable or cause performance issues.
    """

    # Thresholds for different chart types
    CARDINALITY_THRESHOLDS = {
        "bar": 50,  # Bar charts become unreadable with >50 bars
        "line": 100,  # Line charts can handle more points
        "scatter": 500,  # Scatter plots can show many points
        "area": 30,  # Area charts need fewer categories
        "table": 1000,  # Tables can handle many rows with pagination
        "default": 50,  # Conservative default
    }

    # Known high-cardinality column patterns
    HIGH_CARDINALITY_PATTERNS = [
        "id",
        "uuid",
        "guid",
        "email",
        "phone",
        "address",
        "session",
        "transaction",
        "order_number",
        "invoice",
        "timestamp",
        "datetime",
        "created_at",
        "updated_at",
    ]

    @staticmethod
    def check_cardinality(
        dataset_id: int | str,
        x_column: str,
        chart_type: str = "default",
        group_by_column: Optional[str] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check cardinality of X-axis and group_by columns.

        Returns:
            Tuple of (is_ok, warning_info)
        """
        try:
            # Quick pattern check first (no DB query needed)
            pattern_warnings = CardinalityValidator._check_column_patterns(
                x_column, group_by_column
            )

            if pattern_warnings:
                return False, {
                    "warnings": pattern_warnings,
                    "suggestions": CardinalityValidator._get_suggestions(
                        x_column, chart_type, pattern_based=True
                    ),
                }

            # For non-pattern columns, we could do actual cardinality check
            # but that requires DB access - for now just return OK
            # In production, you'd want to cache cardinality stats

            return True, None

        except Exception as e:
            logger.warning(f"Cardinality check failed: {e}")
            # Don't block on validation failures
            return True, None

    @staticmethod
    def _check_column_patterns(
        x_column: str, group_by_column: Optional[str] = None
    ) -> List[str]:
        """Check for known high-cardinality column patterns."""
        warnings = []

        x_lower = x_column.lower()

        # Check X-axis column
        for pattern in CardinalityValidator.HIGH_CARDINALITY_PATTERNS:
            if pattern in x_lower:
                warnings.append(
                    f"Column '{x_column}' appears to be a high-cardinality field "
                    f"(contains '{pattern}'). This may create an unreadable chart "
                    f"with too many categories on the X-axis."
                )
                break

        # Check group_by column if present
        if group_by_column:
            group_lower = group_by_column.lower()
            for pattern in CardinalityValidator.HIGH_CARDINALITY_PATTERNS:
                if pattern in group_lower:
                    warnings.append(
                        f"Group by column '{group_by_column}' appears to be a "
                        f"high-cardinality field (contains '{pattern}'). This may "
                        f"create too many series to visualize effectively."
                    )
                    break

        return warnings

    @staticmethod
    def _get_suggestions(
        column: str, chart_type: str, pattern_based: bool = False
    ) -> List[str]:
        """Get suggestions for handling high cardinality."""
        suggestions = []

        if pattern_based:
            # Suggestions when we detected high-cardinality patterns
            if any(p in column.lower() for p in ["id", "uuid", "guid"]):
                suggestions.extend(
                    [
                        "Consider using a different column for the X-axis",
                        f"If you need to analyze by {column}, use filters to limit "
                        f"the data",
                        "A table chart might be more appropriate for ID-based data",
                    ]
                )
            elif any(p in column.lower() for p in ["email", "phone", "address"]):
                suggestions.extend(
                    [
                        "Consider grouping by a higher-level category (e.g., "
                        "domain for emails)",
                        f"Use filters to focus on specific {column} values",
                        "Aggregate the data before visualization",
                    ]
                )
            elif any(
                p in column.lower() for p in ["timestamp", "datetime", "created_at"]
            ):
                suggestions.extend(
                    [
                        "Consider truncating timestamps to date or hour level",
                        "Use time-based grouping (daily, weekly, monthly)",
                        "Apply date range filters to limit the data",
                    ]
                )
        else:
            # General high-cardinality suggestions
            threshold = CardinalityValidator.CARDINALITY_THRESHOLDS.get(chart_type, 50)
            suggestions.extend(
                [
                    f"This chart type works best with fewer than {threshold} "
                    f"categories",
                    "Consider using filters to reduce the number of values",
                    "Try grouping or categorizing the data at a higher level",
                    "A table or pivot table might better display high-cardinality data",
                ]
            )

        return suggestions

    @staticmethod
    def suggest_chart_type(cardinality: int) -> List[str]:
        """Suggest appropriate chart types based on cardinality."""
        if cardinality <= 10:
            return ["bar", "pie", "donut", "area"]
        elif cardinality <= 30:
            return ["bar", "line", "area"]
        elif cardinality <= 100:
            return ["line", "scatter"]
        else:
            return ["table", "pivot_table", "heatmap"]
