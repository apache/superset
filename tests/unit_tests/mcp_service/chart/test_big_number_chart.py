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

"""Tests for Big Number chart type support in MCP service."""

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.chart_utils import (
    _resolve_viz_type,
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_big_number_config,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    ColumnRef,
    FilterConfig,
)
from superset.mcp_service.chart.validation.schema_validator import (
    SchemaValidator,
)


class TestBigNumberChartConfig:
    """Test BigNumberChartConfig Pydantic schema."""

    def test_minimal_config(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        assert config.chart_type == "big_number"
        assert config.metric.name == "revenue"
        assert config.metric.aggregate == "SUM"
        assert config.show_trendline is False

    def test_with_trendline(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
        )
        assert config.show_trendline is True
        assert config.temporal_column == "ds"

    def test_trendline_without_temporal_column_fails(self) -> None:
        with pytest.raises(ValidationError, match="requires 'temporal_column'"):
            BigNumberChartConfig(
                chart_type="big_number",
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                show_trendline=True,
            )

    def test_metric_without_aggregate_fails(self) -> None:
        with pytest.raises(ValidationError, match="saved dataset metric"):
            BigNumberChartConfig(
                chart_type="big_number",
                metric=ColumnRef(name="revenue"),
            )

    def test_saved_metric_accepted(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="total_sales", saved_metric=True),
        )
        assert config.metric.saved_metric is True
        assert config.metric.is_metric is True

    def test_with_subheader(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            subheader="Total revenue this quarter",
        )
        assert config.subheader == "Total revenue this quarter"

    def test_with_y_axis_format(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            y_axis_format="$,.2f",
        )
        assert config.y_axis_format == "$,.2f"

    def test_with_compare_lag(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
            compare_lag=1,
        )
        assert config.compare_lag == 1

    def test_compare_lag_zero_fails(self) -> None:
        with pytest.raises(ValidationError, match="greater than or equal"):
            BigNumberChartConfig(
                chart_type="big_number",
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                compare_lag=0,
            )

    def test_compare_lag_requires_trendline(self) -> None:
        with pytest.raises(
            ValidationError, match="compare_lag requires show_trendline"
        ):
            BigNumberChartConfig(
                chart_type="big_number",
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                compare_lag=1,
            )

    def test_with_filters(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            filters=[
                FilterConfig(column="region", op="=", value="US"),
            ],
        )
        assert config.filters is not None
        assert len(config.filters) == 1

    def test_extra_fields_forbidden(self) -> None:
        with pytest.raises(ValueError, match="Unknown field 'unknown_field'"):
            BigNumberChartConfig(
                chart_type="big_number",
                metric=ColumnRef(name="revenue", aggregate="SUM"),
                unknown_field="bad",
            )

    def test_with_time_grain(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
            time_grain="P1M",
        )
        assert config.time_grain == "P1M"

    def test_with_custom_label(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM", label="Total Sales"),
        )
        assert config.metric.label == "Total Sales"


class TestMapBigNumberConfig:
    """Test map_big_number_config function."""

    def test_basic_total(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        form_data = map_big_number_config(config)
        assert form_data["viz_type"] == "big_number_total"
        assert form_data["metric"]["aggregate"] == "SUM"
        assert form_data["metric"]["column"]["column_name"] == "revenue"

    def test_with_trendline(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="order_date",
            show_trendline=True,
        )
        form_data = map_big_number_config(config)
        assert form_data["viz_type"] == "big_number"
        assert form_data["show_trend_line"] is True
        assert "x_axis" not in form_data
        assert form_data["granularity_sqla"] == "order_date"
        assert form_data["start_y_axis_at_zero"] is True

    def test_with_time_grain(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="order_date",
            show_trendline=True,
            time_grain="P1M",
        )
        form_data = map_big_number_config(config)
        assert form_data["time_grain_sqla"] == "P1M"

    def test_with_subheader(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            subheader="Year to date",
        )
        form_data = map_big_number_config(config)
        assert form_data["subheader"] == "Year to date"

    def test_with_y_axis_format(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            y_axis_format="$,.2f",
        )
        form_data = map_big_number_config(config)
        assert form_data["y_axis_format"] == "$,.2f"

    def test_with_compare_lag(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
            compare_lag=7,
        )
        form_data = map_big_number_config(config)
        assert form_data["compare_lag"] == 7

    def test_with_filters(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            filters=[
                FilterConfig(column="region", op="=", value="US"),
            ],
        )
        form_data = map_big_number_config(config)
        assert "adhoc_filters" in form_data
        assert len(form_data["adhoc_filters"]) == 1
        assert form_data["adhoc_filters"][0]["subject"] == "region"
        assert form_data["adhoc_filters"][0]["operator"] == "=="
        assert form_data["adhoc_filters"][0]["comparator"] == "US"

    def test_no_trendline_fields_for_total(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        form_data = map_big_number_config(config)
        assert "x_axis" not in form_data
        assert "granularity_sqla" not in form_data
        assert "time_grain_sqla" not in form_data
        assert "start_y_axis_at_zero" not in form_data


class TestMapConfigToFormDataBigNumber:
    """Test map_config_to_form_data dispatch for big number."""

    def test_dispatches_big_number(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        form_data = map_config_to_form_data(config)
        assert form_data["viz_type"] == "big_number_total"

    def test_dispatches_big_number_trendline(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
        )
        form_data = map_config_to_form_data(config)
        assert form_data["viz_type"] == "big_number"


class TestGenerateChartNameBigNumber:
    """Test generate_chart_name for big number configs."""

    def test_basic_total_name(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        name = generate_chart_name(config)
        assert "Big Number" in name
        assert "SUM(revenue)" in name

    def test_with_trendline_name(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
        )
        name = generate_chart_name(config)
        assert "Big Number" in name
        assert "trendline" in name

    def test_with_custom_label(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(
                name="revenue",
                aggregate="SUM",
                label="Total Sales",
            ),
        )
        name = generate_chart_name(config)
        assert "Total Sales" in name


class TestResolveVizTypeBigNumber:
    """Test _resolve_viz_type for big number configs."""

    def test_big_number_total(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        assert _resolve_viz_type(config) == "big_number_total"

    def test_big_number_with_trendline(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
        )
        assert _resolve_viz_type(config) == "big_number"


class TestAnalyzeChartCapabilitiesBigNumber:
    """Test analyze_chart_capabilities for big number configs."""

    def test_big_number_total_capabilities(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        result = analyze_chart_capabilities(None, config)
        assert result.supports_export is True
        assert result.supports_interaction is False
        assert result.supports_drill_down is False

    def test_big_number_trendline_capabilities(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
        )
        result = analyze_chart_capabilities(None, config)
        assert result.supports_export is True
        assert result.supports_interaction is False
        assert result.supports_drill_down is False


class TestAnalyzeChartSemanticsBigNumber:
    """Test analyze_chart_semantics for big number configs."""

    def test_big_number_total_semantics(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
        )
        result = analyze_chart_semantics(None, config)
        assert result is not None
        assert "metric" in result.primary_insight.lower()
        assert result.data_story != ""
        assert len(result.recommended_actions) > 0

    def test_big_number_trendline_semantics(self) -> None:
        config = BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(name="revenue", aggregate="SUM"),
            temporal_column="ds",
            show_trendline=True,
        )
        result = analyze_chart_semantics(None, config)
        assert result is not None
        assert "trend" in result.primary_insight.lower()
        assert result.data_story != ""
        assert len(result.recommended_actions) > 0


class TestSchemaValidatorBigNumber:
    """Test SchemaValidator for big number chart type."""

    def test_valid_big_number_request(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert request is not None
        assert error is None

    def test_valid_big_number_with_trendline(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "temporal_column": "ds",
                "show_trendline": True,
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert request is not None

    def test_missing_metric(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_BIG_NUMBER_METRIC"

    def test_invalid_metric_type(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": "not_a_dict",
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_BIG_NUMBER_METRIC_TYPE"

    def test_missing_metric_aggregate(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue"},
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_BIG_NUMBER_AGGREGATE"

    def test_trendline_without_temporal(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "show_trendline": True,
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_TEMPORAL_COLUMN"

    def test_big_number_accepted_in_chart_type_check(self) -> None:
        """Verify big_number passes the chart_type validation."""
        is_valid, error = SchemaValidator._pre_validate(
            {
                "dataset_id": 1,
                "config": {
                    "chart_type": "big_number",
                    "metric": {"name": "revenue", "aggregate": "SUM"},
                },
            }
        )
        assert is_valid is True
        assert error is None

    def test_invalid_chart_type_still_rejected(self) -> None:
        """Ensure unknown chart types are still rejected."""
        is_valid, error = SchemaValidator._pre_validate(
            {
                "dataset_id": 1,
                "config": {"chart_type": "nonexistent_chart"},
            }
        )
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_CHART_TYPE"

    def test_big_number_with_subheader_and_format(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "subheader": "Year to date",
                "y_axis_format": "$,.2f",
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert request is not None
