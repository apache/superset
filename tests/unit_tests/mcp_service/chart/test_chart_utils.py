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
Unit tests for MCP chart utilities.
"""

from superset.mcp_service.chart.chart_utils import map_xy_config
from superset.mcp_service.schemas.chart_schemas import ColumnRef, XYChartConfig


class TestChartUtils:
    """Test chart utility functions."""

    def test_xy_chart_no_duplicate_groupby_simple(self) -> None:
        """Test that x_axis column is not duplicated in groupby for simple charts."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="price_each", aggregate="AVG", label="Avg Price"),
            ],
            kind="line",
        )

        form_data = map_xy_config(config)

        # Should have x_axis but NO groupby (to avoid duplicate labels)
        assert form_data["x_axis"] == "order_date"
        assert "groupby" not in form_data or not form_data["groupby"]

    def test_xy_chart_different_group_by(self) -> None:
        """Test chart with different group_by column."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
            group_by=ColumnRef(name="category"),  # Different from x_axis
            kind="line",
        )

        form_data = map_xy_config(config)

        # Should have x_axis and groupby with only the group_by column
        assert form_data["x_axis"] == "order_date"
        assert form_data.get("groupby") == ["category"]

    def test_xy_chart_same_group_by_as_x_axis(self) -> None:
        """Test chart where group_by is same as x_axis."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="price_each", label="Price Each"),  # Custom label
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
            group_by=ColumnRef(name="price_each"),  # Same as x_axis!
            kind="line",
        )

        form_data = map_xy_config(config)

        # Should have x_axis but NO groupby (since group_by == x_axis)
        assert form_data["x_axis"] == "price_each"
        assert "groupby" not in form_data or not form_data["groupby"]

    def test_groupby_exclusion_prevents_duplicates(self) -> None:
        """Test that x_axis column is always excluded from groupby."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="price_each"),  # This will be x_axis
            y=[
                ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
                ColumnRef(name="quantity", aggregate="COUNT", label="Order Count"),
            ],
            group_by=ColumnRef(name="category"),  # Different column for grouping
            kind="line",
        )

        form_data = map_xy_config(config)

        # Should have x_axis="price_each" and groupby=["category"]
        assert form_data["x_axis"] == "price_each"
        assert form_data.get("groupby") == ["category"]
        assert "price_each" not in form_data.get("groupby", [])

    def test_problematic_case_same_column_x_axis_and_group_by(self) -> None:
        """Test the problematic case: same column for x_axis and group_by."""
        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="price_each", label="Price Each"),  # Custom label
            y=[ColumnRef(name="sales", aggregate="SUM", label="Total Sales")],
            group_by=ColumnRef(name="price_each"),  # Same as x_axis!
            kind="line",
        )

        form_data = map_xy_config(config)

        # Should have x_axis="price_each" but NO groupby (avoided duplicate)
        assert form_data["x_axis"] == "price_each"
        assert "groupby" not in form_data or not form_data["groupby"]
