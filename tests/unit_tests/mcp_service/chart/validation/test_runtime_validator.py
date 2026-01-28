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
Tests for RuntimeValidator.

These tests verify that semantic warnings are non-blocking and
chart generation succeeds even when warnings are present.
"""

from unittest.mock import patch

from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.runtime import RuntimeValidator


class TestRuntimeValidatorNonBlocking:
    """Test that RuntimeValidator treats semantic warnings as non-blocking."""

    def test_validate_runtime_issues_returns_valid_without_warnings(self):
        """Test that validation returns (True, None) when no issues found."""
        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="col1")],
        )

        is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

        assert is_valid is True
        assert error is None

    def test_validate_runtime_issues_non_blocking_with_format_warnings(self):
        """Test that format compatibility warnings do NOT block chart generation."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="value", aggregate="SUM")],
            kind="line",
            x_axis=AxisConfig(format="$,.2f"),  # Currency format for date - mismatch
        )

        # Mock the format validator to return warnings
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_format_compatibility"
        ) as mock_format:
            mock_format.return_value = [
                "Currency format '$,.2f' may not display dates correctly"
            ]

            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            # Should still return valid despite warnings
            assert is_valid is True
            assert error is None

    def test_validate_runtime_issues_non_blocking_with_cardinality_warnings(self):
        """Test that cardinality warnings do NOT block chart generation."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="user_id"),  # High cardinality column
            y=[ColumnRef(name="count", aggregate="COUNT")],
            kind="bar",
        )

        # Mock the cardinality validator to return warnings
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_cardinality"
        ) as mock_cardinality:
            mock_cardinality.return_value = (
                ["High cardinality detected: 10000+ unique values"],
                ["Consider using aggregation or filtering"],
            )

            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            # Should still return valid despite high cardinality warning
            assert is_valid is True
            assert error is None

    def test_validate_runtime_issues_non_blocking_with_chart_type_suggestions(self):
        """Test that chart type suggestions do NOT block chart generation."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),  # Categorical data
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",  # Line chart for categorical data
        )

        # Mock the chart type suggester to return suggestions
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_chart_type"
        ) as mock_suggester:
            mock_suggester.return_value = (
                ["Line chart may not be ideal for categorical X axis"],
                ["Consider using bar chart for better visualization"],
            )

            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            # Should still return valid despite suggestion
            assert is_valid is True
            assert error is None

    def test_validate_runtime_issues_non_blocking_with_multiple_warnings(self):
        """Test that multiple warnings combined do NOT block chart generation."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="user_id"),
            y=[ColumnRef(name="amount", aggregate="SUM")],
            kind="scatter",
            x_axis=AxisConfig(format="smart_date"),  # Wrong format for user_id
        )

        # Mock all validators to return warnings
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_format_compatibility"
        ) as mock_format, patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_cardinality"
        ) as mock_cardinality, patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_chart_type"
        ) as mock_type:
            mock_format.return_value = ["Format mismatch warning"]
            mock_cardinality.return_value = (
                ["High cardinality warning"],
                ["Cardinality suggestion"],
            )
            mock_type.return_value = (
                ["Chart type warning"],
                ["Chart type suggestion"],
            )

            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            # Should still return valid despite multiple warnings
            assert is_valid is True
            assert error is None

    def test_validate_runtime_issues_logs_warnings(self):
        """Test that warnings are logged for debugging purposes."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="value", aggregate="SUM")],
            kind="line",
        )

        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_format_compatibility"
        ) as mock_format, patch(
            "superset.mcp_service.chart.validation.runtime.logger"
        ) as mock_logger:
            mock_format.return_value = ["Test warning message"]

            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            # Verify warnings were logged
            assert mock_logger.info.called
            assert is_valid is True
            assert error is None

    def test_validate_table_chart_skips_xy_validations(self):
        """Test that table charts skip XY-specific validations."""
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )

        # These should not be called for table charts
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_format_compatibility"
        ) as mock_format, patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_cardinality"
        ) as mock_cardinality:
            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            # Format and cardinality validation should not be called for table charts
            mock_format.assert_not_called()
            mock_cardinality.assert_not_called()
            assert is_valid is True
            assert error is None
