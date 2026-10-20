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

"""Tests for the heatmap chart type plugin.

Schema validation, form_data mapping (matching the frontend Heatmap
buildQuery contract for viz_type ``heatmap_v2`` — an ``x_axis`` column, a
single ``groupby`` Y column, and one ``metric``), native ``groupby``
aliasing for the Y axis, and registry integration.
"""

from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_heatmap_config
from superset.mcp_service.chart.schemas import ChartConfig, HeatmapChartConfig


class TestHeatmapChartConfigSchema:
    """HeatmapChartConfig schema validation."""

    def test_basic_heatmap_config(self) -> None:
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "trips", "aggregate": "COUNT"},
        )
        assert config.x_axis.name == "day_of_week"
        assert config.y_axis.name == "hour"
        assert config.normalize_across == "heatmap"  # frontend default

    def test_heatmap_missing_x_axis(self) -> None:
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                y_axis={"name": "hour"},
                metric={"name": "trips", "aggregate": "COUNT"},
            )

    def test_heatmap_missing_y_axis(self) -> None:
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week"},
                metric={"name": "trips", "aggregate": "COUNT"},
            )

    def test_heatmap_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week"},
                y_axis={"name": "hour"},
            )

    def test_heatmap_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week"},
                y_axis={"name": "hour"},
                metric={"name": "trips", "aggregate": "COUNT"},
                bogus=1,
            )

    def test_heatmap_axis_rejects_aggregate(self) -> None:
        """An aggregate makes an axis metric-like; x_axis/y_axis are dims."""
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week", "aggregate": "COUNT"},
                y_axis={"name": "hour"},
                metric={"name": "trips", "aggregate": "COUNT"},
            )
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week"},
                y_axis={"name": "hour", "aggregate": "COUNT"},
                metric={"name": "trips", "aggregate": "COUNT"},
            )

    def test_heatmap_y_axis_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week"},
                y_axis={"name": "count", "saved_metric": True},
                metric={"name": "trips", "aggregate": "COUNT"},
            )

    def test_heatmap_invalid_normalize_across_rejected(self) -> None:
        with pytest.raises(ValidationError):
            HeatmapChartConfig(
                chart_type="heatmap_v2",
                x_axis={"name": "day_of_week"},
                y_axis={"name": "hour"},
                metric={"name": "trips", "aggregate": "COUNT"},
                normalize_across="diagonal",
            )

    def test_groupby_alias_for_y_axis(self) -> None:
        """Superset-native 'groupby' is accepted for the Y-axis field."""
        config = HeatmapChartConfig.model_validate(
            {
                "chart_type": "heatmap_v2",
                "x_axis": {"name": "day_of_week"},
                "groupby": {"name": "hour"},
                "metric": {"name": "trips", "aggregate": "COUNT"},
            }
        )
        assert config.y_axis.name == "hour"

    def test_chart_config_union_dispatches_heatmap(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "heatmap_v2",
                "x_axis": {"name": "day_of_week"},
                "y_axis": {"name": "hour"},
                "metric": {"name": "trips", "aggregate": "COUNT"},
            }
        )
        assert isinstance(config, HeatmapChartConfig)


class TestMapHeatmapConfig:
    """form_data mapping must match the frontend Heatmap buildQuery."""

    def test_basic_heatmap_form_data(self) -> None:
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "trips", "aggregate": "COUNT"},
        )
        form_data = map_heatmap_config(config)
        assert form_data["viz_type"] == "heatmap_v2"
        assert form_data["x_axis"] == "day_of_week"
        # Y axis uses the groupby key as a single column (control is multi:false)
        assert form_data["groupby"] == "hour"
        assert form_data["metric"]["label"] == "COUNT(trips)"
        assert form_data["normalize_across"] == "heatmap"

    def test_heatmap_form_data_with_normalize_and_filters(self) -> None:
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "trips", "aggregate": "COUNT"},
            normalize_across="x",
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_heatmap_config(config)
        assert form_data["normalize_across"] == "x"
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_normalized_defaults_false(self) -> None:
        # normalize_across has no visual effect on the frontend unless the
        # 'normalized' flag is also set, so it must be threaded through.
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "trips", "aggregate": "COUNT"},
        )
        assert map_heatmap_config(config)["normalized"] is False

    def test_normalized_true_maps_through(self) -> None:
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "trips", "aggregate": "COUNT"},
            normalize_across="x",
            normalized=True,
        )
        assert map_heatmap_config(config)["normalized"] is True

    def test_heatmap_saved_metric_maps_to_name_string(self) -> None:
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "avg_fare", "saved_metric": True},
        )
        assert map_heatmap_config(config)["metric"] == "avg_fare"


class TestHeatmapQueryContext:
    """The built query must GROUP BY both axes, not just the Y (groupby) column.

    map_heatmap_config emits X under 'x_axis' and Y under 'groupby'. The shared
    query builder only knows list-shaped groupby roles, so the plugin's query
    hooks supply both axes, mirroring the Heatmap frontend buildQuery.
    """

    @staticmethod
    def _form_data(**overrides: Any) -> dict[str, Any]:
        config = HeatmapChartConfig(
            chart_type="heatmap_v2",
            x_axis={"name": "day_of_week"},
            y_axis={"name": "hour"},
            metric={"name": "trips", "aggregate": "COUNT"},
        )
        return {**map_heatmap_config(config), **overrides}

    def test_x_axis_reaches_group_by(self, monkeypatch) -> None:
        from superset.mcp_service.chart import chart_helpers

        monkeypatch.setattr(
            chart_helpers,
            "resolve_datasource_engine",
            lambda datasource_id, datasource_type: "base",
        )
        form_data = self._form_data()
        queries = chart_helpers.build_query_dicts_from_form_data(form_data, 1, "table")
        assert len(queries) == 1
        query = queries[0]
        # The X axis is normalized to the frontend BASE_AXIS column shape and
        # the single-select Y groupby string follows it.
        assert query["columns"] == [
            {
                "columnType": "BASE_AXIS",
                "sqlExpression": "day_of_week",
                "label": "day_of_week",
                "expressionType": "SQL",
                "isColumnReference": True,
            },
            "hour",
        ]
        assert query["metrics"] == [form_data["metric"]]
        assert query["row_limit"] == 10000
        assert "orderby" not in query

    @pytest.mark.parametrize(
        "sorts,expected",
        [
            ({"sort_x_axis": "value_desc"}, [["<metric>", False]]),
            ({"sort_y_axis": "alpha_asc"}, [["hour", True]]),
            (
                {"sort_x_axis": "alpha_desc", "sort_y_axis": "value_asc"},
                [["day_of_week", False], ["<metric>", True]],
            ),
        ],
    )
    def test_sort_axes_follow_frontend_contract(
        self, monkeypatch, sorts: dict[str, str], expected: list[list[Any]]
    ) -> None:
        # Saved heatmaps built in Explore carry sort_x_axis / sort_y_axis;
        # "value" sorts by the cell metric, "alpha" by the axis column.
        from superset.mcp_service.chart import chart_helpers

        monkeypatch.setattr(
            chart_helpers,
            "resolve_datasource_engine",
            lambda datasource_id, datasource_type: "base",
        )
        form_data = self._form_data(**sorts)
        query = chart_helpers.build_query_dicts_from_form_data(form_data, 1, "table")[0]
        expected = [
            [form_data["metric"] if target == "<metric>" else target, ascending]
            for target, ascending in expected
        ]
        assert query["orderby"] == expected

    def test_resolve_query_fields_tolerates_scalar_groupby(self) -> None:
        from superset.mcp_service.chart.plugins.heatmap import HeatmapChartPlugin

        plugin = HeatmapChartPlugin()
        fields = plugin.resolve_query_fields(
            {"x_axis": "day", "groupby": "hour", "metric": "count"}, "heatmap_v2"
        )
        assert fields == (["count"], ["day", "hour"])
        # A migrated chart may lack x_axis entirely; only the Y column remains.
        fields = plugin.resolve_query_fields({"groupby": ["hour"]}, "heatmap_v2")
        assert fields is not None
        assert fields[1] == ["hour"]

    def test_x_axis_reaches_columns_from_form_data(self) -> None:
        # The generate_chart compile check derives columns through a different
        # builder (columns_from_form_data, used by the dashboard export path
        # too), which must tolerate the scalar 'groupby' this mapper emits and
        # carry both axes rather than crashing on str.copy().
        from superset.common.form_data_query_context import columns_from_form_data

        columns = columns_from_form_data(self._form_data())
        assert columns == ["day_of_week", "hour"]


class TestHeatmapPluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_heatmap_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("heatmap_v2")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "heatmap_v2"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("heatmap_v2") == "Heatmap"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("heatmap_v2")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "heatmap_v2"})
        assert error is not None
        assert "x_axis" in error.message
        assert "metric" in error.message


class TestHeatmapRecommendationCategory:
    """Heatmap is categorized for chart recommendations and schema discovery."""

    def test_heatmap_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("heatmap_v2") == "heatmap"

    def test_get_chart_type_schema_includes_heatmap(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "heatmap_v2" in _CHART_TYPE_ADAPTERS
