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

"""Tests for Handlebars chart type support in MCP service."""

from unittest.mock import MagicMock

import pytest

from superset.mcp_service.chart.chart_utils import (
    _resolve_viz_type,
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_config_to_form_data,
    map_handlebars_config,
)
from superset.mcp_service.chart.schemas import (
    ColumnRef,
    FilterConfig,
    HandlebarsChartConfig,
)
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator


class TestHandlebarsChartConfig:
    """Test HandlebarsChartConfig Pydantic schema."""

    def test_minimal_aggregate_config(self) -> None:
        template = "<ul>{{#each data}}<li>{{this.name}}</li>{{/each}}</ul>"
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template=template,
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        assert config.chart_type == "handlebars"
        assert config.query_mode == "aggregate"
        assert config.row_limit == 1000

    def test_minimal_raw_config(self) -> None:
        template = (
            "<table>{{#each data}}<tr><td>{{this.name}}</td></tr>{{/each}}</table>"
        )
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template=template,
            query_mode="raw",
            columns=[ColumnRef(name="product"), ColumnRef(name="price")],
        )
        assert config.query_mode == "raw"
        assert config.columns is not None
        assert len(config.columns) == 2

    def test_aggregate_mode_requires_metrics(self) -> None:
        with pytest.raises(ValueError, match="requires 'metrics'"):
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="<p>test</p>",
                query_mode="aggregate",
            )

    def test_raw_mode_requires_columns(self) -> None:
        with pytest.raises(ValueError, match="requires 'columns'"):
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="<p>test</p>",
                query_mode="raw",
            )

    def test_template_min_length(self) -> None:
        with pytest.raises(ValueError, match="at least 1 character"):
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="",
                metrics=[ColumnRef(name="sales", aggregate="SUM")],
            )

    def test_extra_fields_forbidden(self) -> None:
        with pytest.raises(ValueError, match="Extra inputs"):
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="<p>test</p>",
                metrics=[ColumnRef(name="sales", aggregate="SUM")],
                unknown_field="bad",
            )

    def test_full_aggregate_config(self) -> None:
        template = (
            "<div>{{#each data}}<span>"
            "{{this.region}}: {{this.total}}"
            "</span>{{/each}}</div>"
        )
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template=template,
            query_mode="aggregate",
            groupby=[ColumnRef(name="region")],
            metrics=[ColumnRef(name="sales", aggregate="SUM", label="total")],
            filters=[FilterConfig(column="status", op="=", value="active")],
            row_limit=500,
            order_desc=False,
            style_template="div { color: blue; }",
        )
        assert config.row_limit == 500
        assert config.order_desc is False
        assert config.style_template == "div { color: blue; }"
        assert config.filters is not None
        assert len(config.filters) == 1
        assert config.groupby is not None
        assert len(config.groupby) == 1

    def test_row_limit_too_low(self) -> None:
        with pytest.raises(ValueError, match="greater than or equal to 1"):
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="<p>test</p>",
                metrics=[ColumnRef(name="x", aggregate="COUNT")],
                row_limit=0,
            )

    def test_row_limit_too_high(self) -> None:
        with pytest.raises(ValueError, match="less than or equal to 50000"):
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="<p>test</p>",
                metrics=[ColumnRef(name="x", aggregate="COUNT")],
                row_limit=50001,
            )


class TestMapHandlebarsConfig:
    """Test map_handlebars_config function."""

    def test_aggregate_mode_basic(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>{{data}}</p>",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        result = map_handlebars_config(config)

        assert result["viz_type"] == "handlebars"
        assert result["handlebars_template"] == "<p>{{data}}</p>"
        assert result["query_mode"] == "aggregate"
        assert result["row_limit"] == 1000
        assert result["order_desc"] is True
        assert len(result["metrics"]) == 1
        assert result["metrics"][0]["aggregate"] == "SUM"

    def test_aggregate_mode_with_groupby(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>{{data}}</p>",
            groupby=[ColumnRef(name="region")],
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        result = map_handlebars_config(config)

        assert result["groupby"] == ["region"]

    def test_raw_mode(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<table>rows</table>",
            query_mode="raw",
            columns=[ColumnRef(name="product"), ColumnRef(name="price")],
        )
        result = map_handlebars_config(config)

        assert result["query_mode"] == "raw"
        assert result["all_columns"] == ["product", "price"]
        assert "metrics" not in result
        assert "groupby" not in result

    def test_with_filters(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="count", aggregate="COUNT")],
            filters=[FilterConfig(column="status", op="=", value="active")],
        )
        result = map_handlebars_config(config)

        assert "adhoc_filters" in result
        assert len(result["adhoc_filters"]) == 1
        assert result["adhoc_filters"][0]["subject"] == "status"
        assert result["adhoc_filters"][0]["operator"] == "=="
        assert result["adhoc_filters"][0]["comparator"] == "active"

    def test_with_style_template(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="x", aggregate="COUNT")],
            style_template="p { font-size: 24px; }",
        )
        result = map_handlebars_config(config)

        assert result["styleTemplate"] == "p { font-size: 24px; }"

    def test_without_style_template(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="x", aggregate="COUNT")],
        )
        result = map_handlebars_config(config)

        assert "styleTemplate" not in result

    def test_custom_row_limit_and_order(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="x", aggregate="COUNT")],
            row_limit=50,
            order_desc=False,
        )
        result = map_handlebars_config(config)

        assert result["row_limit"] == 50
        assert result["order_desc"] is False


class TestMapConfigToFormDataHandlebars:
    """Test map_config_to_form_data dispatches to handlebars correctly."""

    def test_dispatches_handlebars_config(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "handlebars"


class TestGenerateChartNameHandlebars:
    """Test generate_chart_name for handlebars configs."""

    def test_raw_mode_with_columns(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            query_mode="raw",
            columns=[ColumnRef(name="product"), ColumnRef(name="price")],
        )
        name = generate_chart_name(config)
        assert "Handlebars" in name
        assert "product" in name
        assert "price" in name

    def test_aggregate_mode_with_metrics(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        name = generate_chart_name(config)
        assert "Handlebars" in name
        assert "sales" in name

    def test_aggregate_mode_no_groupby(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="count", aggregate="COUNT")],
        )
        name = generate_chart_name(config)
        assert "Handlebars" in name
        assert "count" in name

    def test_truncates_to_three_columns(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            query_mode="raw",
            columns=[
                ColumnRef(name="alpha"),
                ColumnRef(name="bravo"),
                ColumnRef(name="charlie"),
                ColumnRef(name="delta"),
            ],
        )
        name = generate_chart_name(config)
        assert "alpha" in name
        assert "bravo" in name
        assert "charlie" in name
        assert "delta" not in name


class TestResolveVizType:
    """Test _resolve_viz_type helper."""

    def test_xy_line(self) -> None:
        config = MagicMock(chart_type="xy", kind="line")
        assert _resolve_viz_type(config) == "echarts_timeseries_line"

    def test_xy_bar(self) -> None:
        config = MagicMock(chart_type="xy", kind="bar")
        assert _resolve_viz_type(config) == "echarts_timeseries_bar"

    def test_xy_area(self) -> None:
        config = MagicMock(chart_type="xy", kind="area")
        assert _resolve_viz_type(config) == "echarts_area"

    def test_xy_scatter(self) -> None:
        config = MagicMock(chart_type="xy", kind="scatter")
        assert _resolve_viz_type(config) == "echarts_timeseries_scatter"

    def test_table(self) -> None:
        config = MagicMock(chart_type="table", viz_type="table")
        assert _resolve_viz_type(config) == "table"

    def test_ag_grid_table(self) -> None:
        config = MagicMock(chart_type="table", viz_type="ag-grid-table")
        assert _resolve_viz_type(config) == "ag-grid-table"

    def test_handlebars(self) -> None:
        config = MagicMock(chart_type="handlebars")
        assert _resolve_viz_type(config) == "handlebars"

    def test_unknown(self) -> None:
        config = MagicMock(chart_type="unknown_type")
        assert _resolve_viz_type(config) == "unknown"


class TestAnalyzeChartCapabilitiesHandlebars:
    """Test analyze_chart_capabilities for handlebars config."""

    def test_handlebars_capabilities(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        caps = analyze_chart_capabilities(None, config)

        assert caps.supports_interaction is False
        assert caps.supports_drill_down is False
        assert caps.supports_export is True
        assert "url" in caps.optimal_formats


class TestAnalyzeChartSemanticsHandlebars:
    """Test analyze_chart_semantics for handlebars config."""

    def test_handlebars_semantics(self) -> None:
        config = HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="<p>test</p>",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        semantics = analyze_chart_semantics(None, config)

        assert (
            "Handlebars" in semantics.primary_insight
            or "template" in semantics.primary_insight
        )
        assert semantics.data_story is not None


class TestSchemaValidatorHandlebars:
    """Test SchemaValidator pre-validation for handlebars chart type."""

    def test_handlebars_accepted_as_valid_chart_type(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": "<p>{{data}}</p>",
                "metrics": [{"name": "sales", "aggregate": "SUM"}],
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert request is not None
        assert error is None

    def test_missing_handlebars_template(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "metrics": [{"name": "sales", "aggregate": "SUM"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_HANDLEBARS_TEMPLATE"

    def test_empty_handlebars_template(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": "   ",
                "metrics": [{"name": "sales", "aggregate": "SUM"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_HANDLEBARS_TEMPLATE"

    def test_non_string_handlebars_template(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": 123,
                "metrics": [{"name": "sales", "aggregate": "SUM"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_HANDLEBARS_TEMPLATE"

    def test_raw_mode_missing_columns(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": "<p>test</p>",
                "query_mode": "raw",
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_RAW_COLUMNS"

    def test_aggregate_mode_missing_metrics(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": "<p>test</p>",
                "query_mode": "aggregate",
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_AGGREGATE_METRICS"

    def test_default_aggregate_mode_missing_metrics(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": "<p>test</p>",
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_AGGREGATE_METRICS"

    def test_handlebars_raw_mode_valid(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "handlebars",
                "handlebars_template": "<p>{{#each data}}{{this.name}}{{/each}}</p>",
                "query_mode": "raw",
                "columns": [{"name": "product"}, {"name": "price"}],
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert request is not None
        assert error is None

    def test_non_string_chart_type_rejected(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {"chart_type": ["handlebars"]},
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_CHART_TYPE"

    def test_handlebars_in_error_messages(self) -> None:
        """Verify 'handlebars' appears in missing chart_type suggestions."""
        data = {
            "dataset_id": 1,
            "config": {},
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        suggestions_text = " ".join(error.suggestions or [])
        assert "handlebars" in suggestions_text

    def test_invalid_chart_type_mentions_handlebars(self) -> None:
        """Invalid chart_type error should mention handlebars as option."""
        data = {
            "dataset_id": 1,
            "config": {"chart_type": "invalid"},
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert "handlebars" in (error.details or "")
