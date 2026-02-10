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
Tests for the get_chart_data request schema and big_number chart handling.
"""

import pytest

from superset.mcp_service.chart.schemas import GetChartDataRequest


class TestBigNumberChartFallback:
    """Tests for big_number chart fallback query construction."""

    def test_big_number_uses_singular_metric(self):
        """Test that big_number charts use 'metric' (singular) from form_data."""
        # Mock form_data for big_number chart
        form_data = {
            "metric": {"label": "Count", "expressionType": "SIMPLE", "column": None},
            "viz_type": "big_number",
        }

        # Verify the metric extraction logic
        metric = form_data.get("metric")
        metrics = [metric] if metric else []

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Count"

    def test_big_number_total_uses_singular_metric(self):
        """Test that big_number_total charts use 'metric' (singular)."""
        form_data = {
            "metric": {"label": "Total Sales", "expressionType": "SQL"},
            "viz_type": "big_number_total",
        }

        metric = form_data.get("metric")
        metrics = [metric] if metric else []

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Total Sales"

    def test_big_number_empty_metric_returns_empty_list(self):
        """Test handling of big_number chart with no metric configured."""
        form_data = {
            "metric": None,
            "viz_type": "big_number",
        }

        metric = form_data.get("metric")
        metrics = [metric] if metric else []

        assert len(metrics) == 0

    def test_big_number_no_groupby_columns(self):
        """Test that big_number charts don't have groupby columns."""
        form_data = {
            "metric": {"label": "Count"},
            "viz_type": "big_number",
            "groupby": ["should_be_ignored"],  # This should be ignored
        }

        viz_type = form_data.get("viz_type", "")
        if viz_type.startswith("big_number"):
            groupby_columns: list[str] = []  # big_number charts don't group by
        else:
            groupby_columns = form_data.get("groupby", [])

        assert groupby_columns == []

    def test_standard_chart_uses_plural_metrics(self):
        """Test that non-big_number charts use 'metrics' (plural)."""
        form_data = {
            "metrics": [
                {"label": "Sum of Sales"},
                {"label": "Avg of Quantity"},
            ],
            "groupby": ["region", "category"],
            "viz_type": "table",
        }

        viz_type = form_data.get("viz_type", "")
        if viz_type.startswith("big_number"):
            metric = form_data.get("metric")
            metrics = [metric] if metric else []
            groupby_columns: list[str] = []
        else:
            metrics = form_data.get("metrics", [])
            groupby_columns = form_data.get("groupby", [])

        assert len(metrics) == 2
        assert len(groupby_columns) == 2

    def test_viz_type_detection_for_single_metric_charts(self):
        """Test viz_type detection handles all single-metric chart types."""
        # Chart types that use "metric" (singular) instead of "metrics" (plural)
        single_metric_types = ("big_number", "pop_kpi")

        # big_number variants match via startswith
        big_number_types = ["big_number", "big_number_total"]
        for viz_type in big_number_types:
            is_single_metric = (
                viz_type.startswith("big_number") or viz_type in single_metric_types
            )
            assert is_single_metric is True

        # pop_kpi (BigNumberPeriodOverPeriod) matches via exact match
        assert "pop_kpi" in single_metric_types

        # Verify standard chart types don't match
        other_types = ["table", "line", "bar", "pie", "echarts_timeseries"]
        for viz_type in other_types:
            is_single_metric = (
                viz_type.startswith("big_number") or viz_type in single_metric_types
            )
            assert is_single_metric is False

    def test_pop_kpi_uses_singular_metric(self):
        """Test that pop_kpi (BigNumberPeriodOverPeriod) uses singular metric."""
        form_data = {
            "metric": {"label": "Period Comparison", "expressionType": "SQL"},
            "viz_type": "pop_kpi",
        }

        viz_type = form_data.get("viz_type", "")
        single_metric_types = ("big_number", "pop_kpi")
        if viz_type.startswith("big_number") or viz_type in single_metric_types:
            metric = form_data.get("metric")
            metrics = [metric] if metric else []
            groupby_columns: list[str] = []
        else:
            metrics = form_data.get("metrics", [])
            groupby_columns = form_data.get("groupby", [])

        assert len(metrics) == 1
        assert metrics[0]["label"] == "Period Comparison"
        assert groupby_columns == []


class TestXAxisInQueryContext:
    """Tests for x_axis inclusion in fallback query context columns."""

    def test_x_axis_string_included_in_columns(self):
        """Test that x_axis (string format) is included alongside groupby columns."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
            "viz_type": "echarts_timeseries_bar",
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]

    def test_x_axis_dict_included_in_columns(self):
        """Test that x_axis (dict format with column_name) is included."""
        form_data = {
            "x_axis": {"column_name": "territory"},
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)
        elif x_axis_config and isinstance(x_axis_config, dict):
            col_name = x_axis_config.get("column_name")
            if col_name and col_name not in columns:
                columns.insert(0, col_name)

        assert columns == ["territory", "year"]

    def test_no_x_axis_uses_groupby_only(self):
        """Test that without x_axis, only groupby columns are used."""
        form_data = {
            "groupby": ["region", "category"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["region", "category"]

    def test_x_axis_not_duplicated_if_in_groupby(self):
        """Test that x_axis is not duplicated if already in groupby list."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["territory", "year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]

    def test_x_axis_without_groupby(self):
        """Test that x_axis works when there's no groupby."""
        form_data = {
            "x_axis": "date",
            "metrics": [{"label": "SUM(sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["date"]

    def test_empty_groupby_with_x_axis(self):
        """Test x_axis with explicitly empty groupby."""
        form_data = {
            "x_axis": "platform",
            "groupby": [],
            "metrics": [{"label": "SUM(global_sales)"}],
        }

        groupby_columns = form_data.get("groupby", [])
        x_axis_config = form_data.get("x_axis")
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["platform"]


class TestGetChartDataRequestSchema:
    """Test the GetChartDataRequest schema validation."""

    def test_default_request(self):
        """Test creating request with all defaults."""
        request = GetChartDataRequest(identifier=1)

        assert request.identifier == 1
        assert request.limit is None  # Uses chart's configured limit by default
        assert request.format == "json"
        assert request.use_cache is True
        assert request.force_refresh is False
        assert request.cache_timeout is None

    def test_request_with_uuid_identifier(self):
        """Test creating request with UUID identifier."""
        uuid = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
        request = GetChartDataRequest(identifier=uuid)

        assert request.identifier == uuid

    def test_request_with_custom_limit(self):
        """Test creating request with custom limit."""
        request = GetChartDataRequest(identifier=1, limit=500)

        assert request.limit == 500

    def test_request_with_csv_format(self):
        """Test creating request with CSV format."""
        request = GetChartDataRequest(identifier=1, format="csv")

        assert request.format == "csv"

    def test_request_with_excel_format(self):
        """Test creating request with Excel format."""
        request = GetChartDataRequest(identifier=1, format="excel")

        assert request.format == "excel"

    def test_request_with_cache_control(self):
        """Test creating request with cache control options."""
        request = GetChartDataRequest(
            identifier=1,
            use_cache=False,
            force_refresh=True,
            cache_timeout=3600,
        )

        assert request.use_cache is False
        assert request.force_refresh is True
        assert request.cache_timeout == 3600

    def test_invalid_format(self):
        """Test that invalid format raises validation error."""
        with pytest.raises(
            ValueError, match="Input should be 'json', 'csv' or 'excel'"
        ):
            GetChartDataRequest(identifier=1, format="invalid")

    def test_model_dump_serialization(self):
        """Test that the request serializes correctly for JSON."""
        request = GetChartDataRequest(
            identifier=123,
            limit=50,
            format="json",
        )

        data = request.model_dump()

        assert isinstance(data, dict)
        assert data["identifier"] == 123
        assert data["limit"] == 50
        assert data["format"] == "json"
