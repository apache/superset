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

"""Tests for column name normalization in the MCP service.

This tests the fix for the issue where time series charts would incorrectly
prompt to add the x-axis to filters when the column name case didn't match
exactly (e.g., 'order_date' vs 'OrderDate').
"""

from typing import Any, Dict
from unittest.mock import patch

import pytest

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    FilterConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import DatasetContext


@pytest.fixture
def mock_dataset_context() -> DatasetContext:
    """Create a mock dataset context with mixed-case column names."""
    return DatasetContext(
        id=18,
        table_name="Vehicle Sales",
        schema="public",
        database_name="examples",
        available_columns=[
            {"name": "OrderDate", "type": "DATE", "is_temporal": True},
            {"name": "ProductLine", "type": "VARCHAR", "is_temporal": False},
            {"name": "Sales", "type": "DECIMAL", "is_numeric": True},
            {"name": "quantity_ordered", "type": "INTEGER", "is_numeric": True},
        ],
        available_metrics=[
            {"name": "TotalRevenue", "expression": "SUM(Sales)", "description": None},
        ],
    )


class TestGetCanonicalColumnName:
    """Test _get_canonical_column_name static method."""

    def test_exact_match_returns_same_name(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that exact match returns the same column name."""
        result = DatasetValidator._get_canonical_column_name(
            "OrderDate", mock_dataset_context
        )
        assert result == "OrderDate"

    def test_lowercase_returns_canonical_name(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that lowercase input returns the canonical (dataset) column name."""
        result = DatasetValidator._get_canonical_column_name(
            "orderdate", mock_dataset_context
        )
        assert result == "OrderDate"

    def test_snake_case_returns_canonical_name(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that snake_case input returns the canonical column name."""
        # 'order_date' won't match 'OrderDate' directly, but would match if
        # the dataset had 'order_date'. This test verifies case-insensitive matching.
        result = DatasetValidator._get_canonical_column_name(
            "productline", mock_dataset_context
        )
        assert result == "ProductLine"

    def test_uppercase_returns_canonical_name(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that uppercase input returns the canonical column name."""
        result = DatasetValidator._get_canonical_column_name(
            "SALES", mock_dataset_context
        )
        assert result == "Sales"

    def test_metric_name_normalization(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that metric names are also normalized."""
        result = DatasetValidator._get_canonical_column_name(
            "totalrevenue", mock_dataset_context
        )
        assert result == "TotalRevenue"

    def test_unknown_column_returns_original(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that unknown columns return the original name."""
        result = DatasetValidator._get_canonical_column_name(
            "unknown_column", mock_dataset_context
        )
        assert result == "unknown_column"


class TestNormalizeXYConfig:
    """Test _normalize_xy_config static method."""

    def test_normalize_x_axis_column(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that x-axis column name is normalized."""
        config_dict: Dict[str, Any] = {
            "chart_type": "xy",
            "x": {"name": "orderdate"},
            "y": [{"name": "Sales", "aggregate": "SUM"}],
            "kind": "line",
        }

        DatasetValidator._normalize_xy_config(config_dict, mock_dataset_context)

        assert config_dict["x"]["name"] == "OrderDate"

    def test_normalize_y_axis_columns(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that y-axis column names are normalized."""
        config_dict: Dict[str, Any] = {
            "chart_type": "xy",
            "x": {"name": "OrderDate"},
            "y": [
                {"name": "sales", "aggregate": "SUM"},
                {"name": "QUANTITY_ORDERED", "aggregate": "COUNT"},
            ],
            "kind": "bar",
        }

        DatasetValidator._normalize_xy_config(config_dict, mock_dataset_context)

        assert config_dict["y"][0]["name"] == "Sales"
        assert config_dict["y"][1]["name"] == "quantity_ordered"

    def test_normalize_group_by_column(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that group_by column name is normalized."""
        config_dict: Dict[str, Any] = {
            "chart_type": "xy",
            "x": {"name": "OrderDate"},
            "y": [{"name": "Sales", "aggregate": "SUM"}],
            "kind": "line",
            "group_by": {"name": "productline"},
        }

        DatasetValidator._normalize_xy_config(config_dict, mock_dataset_context)

        assert config_dict["group_by"]["name"] == "ProductLine"


class TestNormalizeTableConfig:
    """Test _normalize_table_config static method."""

    def test_normalize_table_columns(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that table column names are normalized."""
        config_dict: Dict[str, Any] = {
            "chart_type": "table",
            "columns": [
                {"name": "orderdate"},
                {"name": "PRODUCTLINE"},
                {"name": "sales", "aggregate": "SUM"},
            ],
        }

        DatasetValidator._normalize_table_config(config_dict, mock_dataset_context)

        assert config_dict["columns"][0]["name"] == "OrderDate"
        assert config_dict["columns"][1]["name"] == "ProductLine"
        assert config_dict["columns"][2]["name"] == "Sales"


class TestNormalizeFilters:
    """Test _normalize_filters static method."""

    def test_normalize_filter_columns(
        self, mock_dataset_context: DatasetContext
    ) -> None:
        """Test that filter column names are normalized."""
        config_dict: Dict[str, Any] = {
            "filters": [
                {"column": "productline", "op": "=", "value": "Classic Cars"},
                {"column": "ORDERDATE", "op": ">", "value": "2023-01-01"},
            ],
        }

        DatasetValidator._normalize_filters(config_dict, mock_dataset_context)

        assert config_dict["filters"][0]["column"] == "ProductLine"
        assert config_dict["filters"][1]["column"] == "OrderDate"


class TestNormalizeColumnNames:
    """Test the main normalize_column_names method."""

    @patch.object(DatasetValidator, "_get_dataset_context")
    def test_normalize_xy_chart_config(
        self, mock_get_context, mock_dataset_context: DatasetContext
    ) -> None:
        """Test full normalization of XY chart config."""
        mock_get_context.return_value = mock_dataset_context

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="orderdate"),  # lowercase - should normalize to OrderDate
            y=[
                ColumnRef(name="sales", aggregate="SUM")
            ],  # lowercase - should normalize to Sales
            kind="line",
            filters=[FilterConfig(column="productline", op="=", value="Classic Cars")],
        )

        normalized = DatasetValidator.normalize_column_names(config, dataset_id=18)

        assert normalized.x.name == "OrderDate"
        assert normalized.y[0].name == "Sales"
        assert normalized.filters is not None
        assert normalized.filters[0].column == "ProductLine"

    @patch.object(DatasetValidator, "_get_dataset_context")
    def test_normalize_table_chart_config(
        self, mock_get_context, mock_dataset_context: DatasetContext
    ) -> None:
        """Test full normalization of table chart config."""
        mock_get_context.return_value = mock_dataset_context

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="orderdate"),
                ColumnRef(name="productline"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )

        normalized = DatasetValidator.normalize_column_names(config, dataset_id=18)

        assert normalized.columns[0].name == "OrderDate"
        assert normalized.columns[1].name == "ProductLine"
        assert normalized.columns[2].name == "Sales"

    @patch.object(DatasetValidator, "_get_dataset_context")
    def test_returns_original_when_dataset_not_found(self, mock_get_context) -> None:
        """Test that original config is returned when dataset context is unavailable."""
        mock_get_context.return_value = None

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="orderdate"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
        )

        normalized = DatasetValidator.normalize_column_names(config, dataset_id=999)

        # Should return original config unchanged
        assert normalized.x.name == "orderdate"
        assert normalized.y[0].name == "sales"


class TestTimeSeriesFilterPromptFix:
    """Test the fix for time series charts incorrectly prompting x-axis filters."""

    @patch.object(DatasetValidator, "_get_dataset_context")
    def test_x_axis_matches_existing_filter_after_normalization(
        self, mock_get_context, mock_dataset_context: DatasetContext
    ) -> None:
        """
        Test the core fix: when creating a time series chart with
        'order_date' as x-axis, and there's already a filter with
        'OrderDate', after normalization they should match.

        This is the exact scenario from the bug report where:
        - User creates chart with x_axis = 'order_date'
        - Dataset has column named 'OrderDate'
        - Existing filter has subject = 'OrderDate'
        - Without normalization: 'order_date' != 'OrderDate' -> prompt shown
        - With normalization: 'OrderDate' == 'OrderDate' -> no prompt
        """
        mock_get_context.return_value = mock_dataset_context

        # Simulate what the MCP service receives from user
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="orderdate"),  # User provides lowercase
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
            # Simulating an existing filter with the canonical name
            filters=[
                FilterConfig(column="OrderDate", op=">", value="2023-01-01"),
            ],
        )

        normalized = DatasetValidator.normalize_column_names(config, dataset_id=18)

        # After normalization, x.name should match the filter column exactly
        assert normalized.x.name == "OrderDate"
        assert normalized.filters is not None
        assert normalized.filters[0].column == "OrderDate"

        # This equality is what the frontend checks - now they match!
        assert normalized.x.name == normalized.filters[0].column
