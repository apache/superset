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

"""Tests for Sandpack chart type support in MCP service."""

import pytest

from superset.mcp_service.chart.chart_utils import (
    _resolve_viz_type,
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_config_to_form_data,
    map_sandpack_config,
)
from superset.mcp_service.chart.schemas import (
    ColumnRef,
    FilterConfig,
    SandpackChartConfig,
)
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator
from superset.utils import json

DEFAULT_APP = "import data from './data.json';\nexport default () => null;\n"


class TestSandpackChartConfig:
    def test_minimal_raw_config(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
        )
        assert config.chart_type == "sandpack"
        assert config.template == "react"
        assert config.layout == "preview"
        assert config.query_mode == "raw"
        assert config.row_limit == 1000

    def test_minimal_aggregate_config(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            query_mode="aggregate",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        assert config.query_mode == "aggregate"

    def test_app_code_alias(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            appCode=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
        )
        assert config.app_code == DEFAULT_APP

    def test_show_navigator_alias(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
            showNavigator=True,
        )
        assert config.show_navigator is True

    def test_app_code_min_length(self) -> None:
        with pytest.raises(ValueError, match="at least 1 character"):
            SandpackChartConfig(
                chart_type="sandpack",
                app_code="",
                columns=[ColumnRef(name="product")],
            )

    def test_raw_mode_requires_columns(self) -> None:
        with pytest.raises(ValueError, match="requires 'columns'"):
            SandpackChartConfig(chart_type="sandpack", app_code=DEFAULT_APP)

    def test_aggregate_mode_requires_metrics(self) -> None:
        with pytest.raises(ValueError, match="requires 'metrics'"):
            SandpackChartConfig(
                chart_type="sandpack",
                app_code=DEFAULT_APP,
                query_mode="aggregate",
            )

    def test_aggregate_mode_requires_aggregate_function(self) -> None:
        with pytest.raises(ValueError, match="Missing aggregate for"):
            SandpackChartConfig(
                chart_type="sandpack",
                app_code=DEFAULT_APP,
                query_mode="aggregate",
                metrics=[ColumnRef(name="sales")],
            )

    def test_raw_mode_rejects_metrics(self) -> None:
        with pytest.raises(ValueError, match="does not use 'metrics'"):
            SandpackChartConfig(
                chart_type="sandpack",
                app_code=DEFAULT_APP,
                query_mode="raw",
                columns=[ColumnRef(name="product")],
                metrics=[ColumnRef(name="sales", aggregate="SUM")],
            )

    def test_extra_fields_forbidden(self) -> None:
        with pytest.raises(ValueError, match="Unknown field"):
            SandpackChartConfig(
                chart_type="sandpack",
                app_code=DEFAULT_APP,
                columns=[ColumnRef(name="product")],
                bogus_field="x",
            )

    def test_invalid_template_rejected_by_pydantic(self) -> None:
        with pytest.raises(ValueError):
            SandpackChartConfig(
                chart_type="sandpack",
                app_code=DEFAULT_APP,
                template="vue",  # not a valid Literal value
                columns=[ColumnRef(name="product")],
            )


class TestMapSandpackConfig:
    def test_raw_mode_basic(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product"), ColumnRef(name="price")],
        )
        result = map_sandpack_config(config)

        assert result["viz_type"] == "sandpack"
        assert result["appCode"] == DEFAULT_APP
        assert result["template"] == "react"
        assert result["layout"] == "preview"
        assert result["showNavigator"] is False
        assert result["query_mode"] == "raw"
        assert result["all_columns"] == ["product", "price"]
        assert "metrics" not in result
        assert "groupby" not in result

    def test_aggregate_mode_with_groupby(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            query_mode="aggregate",
            groupby=[ColumnRef(name="region")],
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        result = map_sandpack_config(config)

        assert result["query_mode"] == "aggregate"
        assert result["groupby"] == ["region"]
        assert result["metrics"][0]["aggregate"] == "SUM"

    def test_dependencies_serialized_to_json_string(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
            dependencies={"recharts": "^2.12.0"},
        )
        result = map_sandpack_config(config)

        assert isinstance(result["dependencies"], str)
        assert json.loads(result["dependencies"]) == {"recharts": "^2.12.0"}

    def test_no_dependencies_omits_key(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
        )
        assert "dependencies" not in map_sandpack_config(config)

    def test_with_filters(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
            filters=[FilterConfig(column="status", op="=", value="active")],
        )
        result = map_sandpack_config(config)

        assert "adhoc_filters" in result
        assert result["adhoc_filters"][0]["subject"] == "status"
        assert result["adhoc_filters"][0]["comparator"] == "active"

    def test_layout_and_navigator_pass_through(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
            layout="split",
            show_navigator=True,
        )
        result = map_sandpack_config(config)
        assert result["layout"] == "split"
        assert result["showNavigator"] is True


class TestMapConfigToFormDataSandpack:
    def test_dispatches_sandpack_config(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
        )
        result = map_config_to_form_data(config)
        assert result["viz_type"] == "sandpack"


class TestGenerateChartNameSandpack:
    def test_raw_mode_uses_columns(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product"), ColumnRef(name="price")],
        )
        name = generate_chart_name(config)
        assert "Sandpack" in name
        assert "product" in name

    def test_aggregate_mode_uses_metrics(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            query_mode="aggregate",
            metrics=[ColumnRef(name="sales", aggregate="SUM")],
        )
        name = generate_chart_name(config)
        assert "Sandpack" in name
        assert "sales" in name


class TestResolveVizTypeSandpack:
    def test_sandpack(self) -> None:
        from unittest.mock import MagicMock

        config = MagicMock(chart_type="sandpack")
        assert _resolve_viz_type(config) == "sandpack"


class TestAnalyzeChartCapabilitiesSandpack:
    def test_sandpack_capabilities(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
        )
        caps = analyze_chart_capabilities(None, config)

        assert caps.supports_export is True
        assert "url" in caps.optimal_formats


class TestAnalyzeChartSemanticsSandpack:
    def test_sandpack_semantics(self) -> None:
        config = SandpackChartConfig(
            chart_type="sandpack",
            app_code=DEFAULT_APP,
            columns=[ColumnRef(name="product")],
        )
        semantics = analyze_chart_semantics(None, config)
        assert semantics.primary_insight is not None


class TestSchemaValidatorSandpack:
    def test_minimal_raw_accepted(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "app_code": DEFAULT_APP,
                "columns": [{"name": "product"}],
            },
        }
        is_valid, request, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert request is not None
        assert error is None

    def test_camelcase_app_code_alias(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "appCode": DEFAULT_APP,
                "columns": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is True
        assert error is None

    def test_missing_app_code(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "columns": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_APP_CODE"

    def test_empty_app_code(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "app_code": "   ",
                "columns": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_APP_CODE"

    def test_invalid_template(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "app_code": DEFAULT_APP,
                "template": "svelte",
                "columns": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_SANDPACK_TEMPLATE"

    def test_dependencies_must_be_object(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "app_code": DEFAULT_APP,
                "dependencies": ["recharts"],
                "columns": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_SANDPACK_DEPENDENCIES"

    def test_invalid_layout(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "app_code": DEFAULT_APP,
                "layout": "fullscreen",
                "columns": [{"name": "product"}],
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "INVALID_SANDPACK_LAYOUT"

    def test_raw_mode_missing_columns(self) -> None:
        data = {
            "dataset_id": 1,
            "config": {
                "chart_type": "sandpack",
                "app_code": DEFAULT_APP,
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
                "chart_type": "sandpack",
                "app_code": DEFAULT_APP,
                "query_mode": "aggregate",
            },
        }
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert error.error_code == "MISSING_AGGREGATE_METRICS"

    def test_invalid_chart_type_suggestions_mention_sandpack(self) -> None:
        data = {"dataset_id": 1, "config": {"chart_type": "invalid"}}
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        assert "sandpack" in (error.details or "")

    def test_missing_chart_type_suggestions_mention_sandpack(self) -> None:
        data = {"dataset_id": 1, "config": {}}
        is_valid, _, error = SchemaValidator.validate_request(data)
        assert is_valid is False
        assert error is not None
        suggestions_text = " ".join(error.suggestions or [])
        assert "sandpack" in suggestions_text
