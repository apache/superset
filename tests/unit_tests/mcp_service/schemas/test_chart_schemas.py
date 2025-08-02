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
Unit tests for MCP chart schema validation.
"""

import pytest
from pydantic import ValidationError

from superset.mcp_service.schemas.chart_schemas import (
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)


class TestTableChartConfig:
    """Test TableChartConfig validation."""

    def test_duplicate_labels_rejected(self) -> None:
        """Test that TableChartConfig rejects duplicate labels."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            TableChartConfig(
                columns=[
                    ColumnRef(name="product_line", label="product_line"),
                    ColumnRef(name="sales", aggregate="SUM", label="product_line"),
                ]
            )

    def test_unique_labels_accepted(self) -> None:
        """Test that TableChartConfig accepts unique labels."""
        config = TableChartConfig(
            columns=[
                ColumnRef(name="product_line", label="Product Line"),
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ]
        )
        assert len(config.columns) == 2


class TestXYChartConfig:
    """Test XYChartConfig validation."""

    def test_different_labels_accepted(self) -> None:
        """Test that different labels for x and y are accepted."""
        config = XYChartConfig(
            x=ColumnRef(name="product_line"),  # Label: "product_line"
            y=[
                ColumnRef(
                    name="product_line", aggregate="COUNT"
                ),  # Label: "COUNT(product_line)"
            ],
        )
        assert config.x.name == "product_line"
        assert config.y[0].aggregate == "COUNT"

    def test_explicit_duplicate_label_rejected(self) -> None:
        """Test that explicit duplicate labels are rejected."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                x=ColumnRef(name="product_line"),
                y=[ColumnRef(name="sales", label="product_line")],
            )

    def test_duplicate_y_axis_labels_rejected(self) -> None:
        """Test that duplicate y-axis labels are rejected."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                x=ColumnRef(name="date"),
                y=[
                    ColumnRef(name="sales", aggregate="SUM"),
                    ColumnRef(name="revenue", aggregate="SUM", label="SUM(sales)"),
                ],
            )

    def test_unique_labels_accepted(self) -> None:
        """Test that unique labels are accepted."""
        config = XYChartConfig(
            x=ColumnRef(name="date", label="Order Date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="profit", aggregate="AVG", label="Average Profit"),
            ],
        )
        assert len(config.y) == 2

    def test_group_by_duplicate_with_x_rejected(self) -> None:
        """Test that group_by conflicts with x are rejected."""
        with pytest.raises(ValidationError, match="Duplicate column/metric labels"):
            XYChartConfig(
                x=ColumnRef(name="region"),
                y=[ColumnRef(name="sales", aggregate="SUM")],
                group_by=ColumnRef(name="category", label="region"),
            )

    def test_realistic_chart_configurations(self) -> None:
        """Test realistic chart configurations."""
        # This should work - COUNT(product_line) != product_line
        config = XYChartConfig(
            x=ColumnRef(name="product_line"),
            y=[
                ColumnRef(name="product_line", aggregate="COUNT"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )
        assert config.x.name == "product_line"
        assert len(config.y) == 2

    def test_time_series_chart_configuration(self) -> None:
        """Test time series chart configuration works."""
        # This should PASS now - the chart creation logic fixes duplicates
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="price_each", aggregate="AVG", label="Avg Price"),
            ],
            kind="line",
        )
        assert config.x.name == "order_date"
        assert config.kind == "line"

    def test_time_series_with_custom_x_axis_label(self) -> None:
        """Test time series chart with custom x-axis label."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date", label="Order Date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="price_each", aggregate="AVG", label="Avg Price"),
            ],
            kind="line",
        )
        assert config.x.label == "Order Date"

    def test_area_chart_configuration(self) -> None:
        """Test area chart configuration."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
            kind="area",
        )
        assert config.kind == "area"
