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
Unit tests for Superset-vocabulary coercion in MCP chart request schemas.

LLM clients reliably send Superset's public field names (datasource_id,
viz_type, show_legend, plugin viz names) before consulting the MCP tool
schema. These tests pin the translations that absorb those inputs instead
of rejecting them.
"""

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.schemas import (
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    TableChartConfig,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
    XYChartConfig,
)
from superset.mcp_service.dataset.tool.query_dataset import _validate_names

XY_BAR_CONFIG = {
    "chart_type": "xy",
    "kind": "bar",
    "x": {"name": "genre"},
    "y": [{"name": "global_sales", "aggregate": "SUM"}],
}


class TestDatasourceIdAlias:
    def test_generate_chart_accepts_datasource_id(self) -> None:
        request = GenerateChartRequest.model_validate(
            {"datasource_id": 23, "config": dict(XY_BAR_CONFIG)}
        )
        assert request.dataset_id == 23

    def test_dataset_id_wins_over_datasource_id(self) -> None:
        request = GenerateChartRequest.model_validate(
            {"dataset_id": 7, "datasource_id": 23, "config": dict(XY_BAR_CONFIG)}
        )
        assert request.dataset_id == 7


class TestVizTypeTranslation:
    @pytest.mark.parametrize(
        "viz_type,expected_kind",
        [
            ("bar", "bar"),
            ("dist_bar", "bar"),
            ("echarts_timeseries_bar", "bar"),
            ("echarts_timeseries_line", "line"),
            ("area", "area"),
            ("echarts_timeseries_scatter", "scatter"),
        ],
    )
    def test_xy_family_viz_types_map_to_xy(
        self, viz_type: str, expected_kind: str
    ) -> None:
        config = dict(XY_BAR_CONFIG)
        del config["kind"]
        config["chart_type"] = viz_type
        request = GenerateChartRequest.model_validate(
            {"dataset_id": 23, "config": config}
        )
        assert request.config.chart_type == "xy"
        assert request.config.kind == expected_kind

    def test_viz_type_key_is_accepted_as_chart_type(self) -> None:
        config = dict(XY_BAR_CONFIG)
        del config["chart_type"]
        del config["kind"]
        config["viz_type"] = "bar"
        request = GenerateChartRequest.model_validate(
            {"dataset_id": 23, "config": config}
        )
        assert request.config.chart_type == "xy"
        assert request.config.kind == "bar"

    def test_explicit_chart_type_wins_over_viz_type(self) -> None:
        config = dict(XY_BAR_CONFIG)
        config["viz_type"] = "pie"
        request = GenerateChartRequest.model_validate(
            {"dataset_id": 23, "config": config}
        )
        assert request.config.chart_type == "xy"

    def test_table_viz_type_is_preserved_with_explicit_chart_type(self) -> None:
        request = GenerateExploreLinkRequest.model_validate(
            {
                "dataset_id": 23,
                "config": {
                    "chart_type": "table",
                    "viz_type": "ag-grid-table",
                    "columns": [{"name": "genre"}],
                },
            }
        )
        assert isinstance(request.config, TableChartConfig)
        assert request.config.viz_type == "ag-grid-table"

    def test_explicit_kind_is_preserved(self) -> None:
        config = dict(XY_BAR_CONFIG)
        config["chart_type"] = "echarts_timeseries_bar"
        config["kind"] = "line"
        request = GenerateChartRequest.model_validate(
            {"dataset_id": 23, "config": config}
        )
        assert request.config.kind == "line"

    def test_big_number_total_maps_to_big_number(self) -> None:
        request = GenerateChartRequest.model_validate(
            {
                "dataset_id": 23,
                "config": {
                    "chart_type": "big_number_total",
                    "metric": {"name": "global_sales", "aggregate": "SUM"},
                },
            }
        )
        assert request.config.chart_type == "big_number"


class TestRequestModelsShareNormalization:
    def test_update_chart_request(self) -> None:
        request = UpdateChartRequest.model_validate(
            {"identifier": 409, "config": {**XY_BAR_CONFIG, "chart_type": "bar"}}
        )
        assert request.config is not None
        assert request.config.chart_type == "xy"

    def test_update_chart_preview_request(self) -> None:
        request = UpdateChartPreviewRequest.model_validate(
            {"datasource_id": 23, "config": {**XY_BAR_CONFIG, "chart_type": "bar"}}
        )
        assert request.dataset_id == 23
        assert request.config.chart_type == "xy"

    def test_generate_explore_link_request(self) -> None:
        request = GenerateExploreLinkRequest.model_validate(
            {"datasource_id": 23, "config": {**XY_BAR_CONFIG, "chart_type": "bar"}}
        )
        assert request.dataset_id == 23
        assert request.config is not None
        assert request.config.chart_type == "xy"


class TestXYFieldCoercion:
    def test_x_accepts_bare_column_name(self) -> None:
        config = XYChartConfig.model_validate({**XY_BAR_CONFIG, "x": "genre"})
        assert config.x is not None
        assert config.x.name == "genre"

    def test_y_accepts_bare_metric_names(self) -> None:
        config = XYChartConfig.model_validate({**XY_BAR_CONFIG, "y": ["count"]})
        assert config.y[0].name == "count"

    def test_show_legend_bool_becomes_legend_config(self) -> None:
        config = XYChartConfig.model_validate({**XY_BAR_CONFIG, "show_legend": True})
        assert config.legend is not None
        assert config.legend.show is True

    def test_show_legend_false(self) -> None:
        config = XYChartConfig.model_validate({**XY_BAR_CONFIG, "show_legend": False})
        assert config.legend is not None
        assert config.legend.show is False

    def test_chart_orientation_alias(self) -> None:
        config = XYChartConfig.model_validate(
            {**XY_BAR_CONFIG, "chart_orientation": "horizontal"}
        )
        assert config.orientation == "horizontal"

    def test_unknown_fields_still_rejected_with_suggestion(self) -> None:
        with pytest.raises(ValidationError, match="order_desc"):
            XYChartConfig.model_validate({**XY_BAR_CONFIG, "order_desc": True})


class TestQueryDatasetMetricGuidance:
    def test_no_saved_metrics_hint(self) -> None:
        errors = _validate_names(
            ["sum__global_sales"],
            set(),
            "metric",
            empty_hint="No saved metrics. Use execute_sql.",
        )
        assert len(errors) == 1
        assert "No saved metrics. Use execute_sql." in errors[0]
        assert "Did you mean" not in errors[0]

    def test_valid_metrics_listed_when_no_close_match(self) -> None:
        errors = _validate_names(
            ["zzz_nonexistent"],
            {"count", "revenue_total"},
            "metric",
            list_valid_on_miss=True,
        )
        assert len(errors) == 1
        assert "Valid metrics: count, revenue_total" in errors[0]

    def test_close_match_suggestion_unchanged(self) -> None:
        errors = _validate_names(
            ["revenue_totl"],
            {"count", "revenue_total"},
            "metric",
            list_valid_on_miss=True,
        )
        assert len(errors) == 1
        assert "Did you mean: revenue_total?" in errors[0]
