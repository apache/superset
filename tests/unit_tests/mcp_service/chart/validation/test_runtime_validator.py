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

        # Mock the plugin runtime dispatcher to return format warnings
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_plugin_runtime"
        ) as mock_plugin:
            mock_plugin.return_value = (
                ["Currency format '$,.2f' may not display dates correctly"],
                [],
            )

            is_valid, warnings_metadata = RuntimeValidator.validate_runtime_issues(
                config, 1
            )

            # Should still return valid despite warnings
            assert is_valid is True
            # Warnings are returned as metadata, not as blocking errors
            assert warnings_metadata is not None
            assert "warnings" in warnings_metadata
            assert len(warnings_metadata["warnings"]) > 0

    def test_validate_runtime_issues_non_blocking_with_cardinality_warnings(self):
        """Test that cardinality warnings do NOT block chart generation."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="user_id"),  # High cardinality column
            y=[ColumnRef(name="count", aggregate="COUNT")],
            kind="bar",
        )

        # Mock the plugin runtime dispatcher to return cardinality warnings
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_plugin_runtime"
        ) as mock_plugin:
            mock_plugin.return_value = (
                ["High cardinality detected: 10000+ unique values"],
                [],
            )

            is_valid, warnings_metadata = RuntimeValidator.validate_runtime_issues(
                config, 1
            )

            # Should still return valid despite high cardinality warning
            assert is_valid is True
            # Warnings are returned as metadata, not as blocking errors
            assert warnings_metadata is not None
            assert "warnings" in warnings_metadata
            assert len(warnings_metadata["warnings"]) > 0

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

            is_valid, warnings_metadata = RuntimeValidator.validate_runtime_issues(
                config, 1
            )

            # Should still return valid despite suggestion
            assert is_valid is True
            # Warnings are returned as metadata, not as blocking errors
            assert warnings_metadata is not None
            assert "warnings" in warnings_metadata
            assert len(warnings_metadata["warnings"]) > 0

    def test_validate_runtime_issues_non_blocking_with_multiple_warnings(self):
        """Test that multiple warnings combined do NOT block chart generation."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="user_id"),
            y=[ColumnRef(name="amount", aggregate="SUM")],
            kind="scatter",
            x_axis=AxisConfig(format="smart_date"),  # Wrong format for user_id
        )

        # Mock plugin runtime and chart type validators to return warnings
        with (
            patch(
                "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
                "_validate_plugin_runtime"
            ) as mock_plugin,
            patch(
                "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
                "_validate_chart_type"
            ) as mock_type,
        ):
            mock_plugin.return_value = (
                ["Format mismatch warning", "High cardinality warning"],
                [],
            )
            mock_type.return_value = (
                ["Chart type warning"],
                ["Chart type suggestion"],
            )

            is_valid, warnings_metadata = RuntimeValidator.validate_runtime_issues(
                config, 1
            )

            # Should still return valid despite multiple warnings
            assert is_valid is True
            # Warnings are returned as metadata, not as blocking errors
            assert warnings_metadata is not None
            assert "warnings" in warnings_metadata
            # Multiple warnings from different validators should all be collected
            assert len(warnings_metadata["warnings"]) >= 3

    def test_validate_runtime_issues_logs_warnings(self):
        """Test that warnings are logged for debugging purposes."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="value", aggregate="SUM")],
            kind="line",
        )

        with (
            patch(
                "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
                "_validate_plugin_runtime"
            ) as mock_plugin,
            patch(
                "superset.mcp_service.chart.validation.runtime.logger"
            ) as mock_logger,
        ):
            mock_plugin.return_value = (["Test warning message"], [])

            is_valid, warnings_metadata = RuntimeValidator.validate_runtime_issues(
                config, 1
            )

            # Verify warnings were logged
            assert mock_logger.info.called
            assert is_valid is True
            # Warnings are returned as metadata
            assert warnings_metadata is not None
            assert "warnings" in warnings_metadata

    def test_validate_table_chart_skips_xy_validations(self):
        """Test that table charts produce no XY-specific runtime warnings."""
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )

        # Plugin runtime dispatches to TableChartPlugin which returns no warnings.
        # Chart type suggester is also stubbed to return no warnings.
        with patch(
            "superset.mcp_service.chart.validation.runtime.RuntimeValidator."
            "_validate_chart_type"
        ) as mock_chart_type:
            mock_chart_type.return_value = ([], [])

            is_valid, error = RuntimeValidator.validate_runtime_issues(config, 1)

            assert is_valid is True
            assert error is None

    def test_validate_cardinality_returns_cleanly_when_x_name_is_none(self) -> None:
        """The dimension-rejection guard on XYChartConfig normally forbids
        x.name=None, but a model_construct bypass (or a future code path)
        could land us here. The defensive guard in XYChartPlugin.get_runtime_warnings
        must skip cardinality without crashing."""
        from superset.mcp_service.chart.plugins.xy import XYChartPlugin
        from superset.mcp_service.chart.validation.runtime.format_validator import (
            FormatTypeValidator,
        )

        col = ColumnRef.model_construct(name=None)
        config = XYChartConfig.model_construct(
            chart_type="xy",
            x=col,
            y=[ColumnRef(name="val", aggregate="SUM")],
            kind="line",
        )

        plugin = XYChartPlugin()
        with (
            patch.object(
                FormatTypeValidator,
                "validate_format_compatibility",
                return_value=(True, []),
            ),
            patch(
                "superset.mcp_service.chart.validation.runtime."
                "cardinality_validator.CardinalityValidator.check_cardinality"
            ) as mock_check,
        ):
            warnings, suggestions = plugin.get_runtime_warnings(config, dataset_id=1)

        assert warnings == []
        assert suggestions == []
        mock_check.assert_not_called()
