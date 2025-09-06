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
Format-type compatibility validation to prevent misleading data presentation.
"""

import logging
import re
from typing import List, Optional, Tuple

from superset.mcp_service.chart.schemas import ColumnRef, XYChartConfig

logger = logging.getLogger(__name__)


class FormatTypeValidator:
    """
    Validates that format strings are appropriate for the data type and aggregation.
    Prevents issues like currency formatting on COUNT data or percentage on absolute
    values.
    """

    # Format patterns and their appropriate uses
    CURRENCY_PATTERNS = [
        r"\$",  # Dollar sign
        r"€",  # Euro
        r"£",  # Pound
        r"¥",  # Yen
        r"[,.]2f",  # Two decimal places (common for currency)
        r"\$[,.]",  # Dollar with thousands separator
    ]

    PERCENTAGE_PATTERNS = [
        r"%",  # Percentage sign
        r"\.0%",  # Percentage with no decimals
        r"\.1%",  # Percentage with 1 decimal
        r"\.2%",  # Percentage with 2 decimals
    ]

    INTEGER_PATTERNS = [
        r"\.0f",  # No decimals
        r",d",  # Integer with thousands separator
        r"[,.]0f",  # Integer format variations
    ]

    @staticmethod
    def validate_format_compatibility(
        config: XYChartConfig,
    ) -> Tuple[bool, Optional[List[str]]]:
        """
        Validate that axis formats are appropriate for the data types.

        Returns:
            Tuple of (is_valid, warnings_list)
        """
        warnings = []

        # Validate Y-axis format against metrics
        if config.y_axis and config.y_axis.format:
            y_warnings = FormatTypeValidator._validate_y_axis_format(
                config.y_axis.format, config.y
            )
            warnings.extend(y_warnings)

        # Validate X-axis format (usually temporal or categorical)
        if config.x_axis and config.x_axis.format:
            x_warnings = FormatTypeValidator._validate_x_axis_format(
                config.x_axis.format, config.x
            )
            warnings.extend(x_warnings)

        return len(warnings) == 0, warnings if warnings else None

    @staticmethod
    def _validate_y_axis_format(
        format_string: str, y_columns: List[ColumnRef]
    ) -> List[str]:
        """Validate Y-axis format against the metrics."""
        warnings = []

        warnings.extend(
            FormatTypeValidator._check_currency_format_issues(format_string, y_columns)
        )
        warnings.extend(
            FormatTypeValidator._check_percentage_format_issues(
                format_string, y_columns
            )
        )
        warnings.extend(
            FormatTypeValidator._check_decimal_format_issues(format_string, y_columns)
        )

        return warnings

    @staticmethod
    def _check_currency_format_issues(
        format_string: str, y_columns: List[ColumnRef]
    ) -> List[str]:
        """Check for currency format issues."""
        warnings = []
        if FormatTypeValidator._is_currency_format(format_string):
            for col in y_columns:
                if col.aggregate in ["COUNT", "COUNT_DISTINCT"]:
                    warnings.append(
                        f"Currency format '{format_string}' applied to {col.aggregate} "
                        f"of '{col.name}'. COUNT operations return whole numbers, not "
                        f"currency values. Consider using integer format like ',"
                        f"d' instead."
                    )
        return warnings

    @staticmethod
    def _check_percentage_format_issues(
        format_string: str, y_columns: List[ColumnRef]
    ) -> List[str]:
        """Check for percentage format issues."""
        warnings = []
        if FormatTypeValidator._is_percentage_format(format_string):
            for col in y_columns:
                if col.aggregate in ["SUM", "COUNT", "COUNT_DISTINCT"]:
                    label = col.label or f"{col.aggregate}({col.name})"
                    warnings.append(
                        f"Percentage format '{format_string}' applied to "
                        f"{col.aggregate} of '{col.name}'. This will multiply values "
                        f"by 100 and add %. "
                        f"If '{label}' contains absolute values (not ratios 0-1), "
                        f"consider using a numeric format instead."
                    )
        return warnings

    @staticmethod
    def _check_decimal_format_issues(
        format_string: str, y_columns: List[ColumnRef]
    ) -> List[str]:
        """Check for decimal format issues."""
        warnings = []
        if "." in format_string and any(char.isdigit() for char in format_string):
            decimal_places = FormatTypeValidator._get_decimal_places(format_string)
            if decimal_places and decimal_places > 0:
                for col in y_columns:
                    if col.aggregate in ["COUNT", "COUNT_DISTINCT"]:
                        warnings.append(
                            f"Decimal format '{format_string}' applied to "
                            f"{col.aggregate} of '{col.name}'. COUNT operations "
                            f"always return "
                            f"integers. Consider using integer format like ',"
                            f"d' or '.0f' instead."
                        )
        return warnings

    @staticmethod
    def _validate_x_axis_format(format_string: str, x_column: ColumnRef) -> List[str]:
        """Validate X-axis format appropriateness."""
        warnings = []

        # Currency format on X-axis is almost always wrong
        if FormatTypeValidator._is_currency_format(format_string):
            warnings.append(
                f"Currency format '{format_string}' applied to X-axis '"
                f"{x_column.name}'. "
                f"X-axis typically shows categories, time, or dimensions, "
                f"not currency. "
                f"Consider removing the format or using a date/category format."
            )

        # Percentage format on X-axis is unusual
        elif FormatTypeValidator._is_percentage_format(format_string):
            warnings.append(
                f"Percentage format '{format_string}' applied to X-axis '"
                f"{x_column.name}'. "
                f"This is unusual for axis labels. Consider if this is intentional."
            )

        return warnings

    @staticmethod
    def _is_currency_format(format_string: str) -> bool:
        """Check if format string represents currency."""
        return any(
            re.search(pattern, format_string, re.IGNORECASE)
            for pattern in FormatTypeValidator.CURRENCY_PATTERNS
        )

    @staticmethod
    def _is_percentage_format(format_string: str) -> bool:
        """Check if format string represents percentage."""
        return any(
            re.search(pattern, format_string)
            for pattern in FormatTypeValidator.PERCENTAGE_PATTERNS
        )

    @staticmethod
    def _get_decimal_places(format_string: str) -> Optional[int]:
        """Extract number of decimal places from format string."""
        if match := re.search(r"\.(\d+)f", format_string):
            return int(match.group(1))
        return None

    @staticmethod
    def suggest_format(column: ColumnRef) -> str:
        """Suggest appropriate format based on column and aggregation."""
        if column.aggregate in ["COUNT", "COUNT_DISTINCT"]:
            return ",d"  # Integer with thousands separator
        elif column.aggregate in ["AVG", "STDDEV", "VAR"]:
            return ",.2f"  # Two decimals for statistical measures
        elif column.aggregate in ["SUM", "MIN", "MAX"]:
            # Could be currency or regular number, default to flexible
            return ",.2f"  # Two decimals with thousands separator
        else:
            return ""  # Let Superset decide
