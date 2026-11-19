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

"""Tests for the treemap chart type plugin.

Schema validation, form_data mapping (matching the frontend Treemap
buildQuery contract for viz_type ``treemap_v2`` — one ``metric`` plus an
ordered multi ``groupby`` hierarchy), and registry integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_treemap_config
from superset.mcp_service.chart.schemas import ChartConfig, TreemapChartConfig


class TestTreemapChartConfigSchema:
    """TreemapChartConfig schema validation."""

    def test_basic_treemap_config(self) -> None:
        config = TreemapChartConfig(
            chart_type="treemap_v2",
            groupby=[{"name": "region"}, {"name": "product"}],
            metric={"name": "revenue", "aggregate": "SUM"},
        )
        assert [g.name for g in config.groupby] == ["region", "product"]
        assert config.sort_by_metric is True  # shared control default

    def test_treemap_missing_groupby(self) -> None:
        with pytest.raises(ValidationError):
            TreemapChartConfig(
                chart_type="treemap_v2",
                metric={"name": "revenue", "aggregate": "SUM"},
            )

    def test_treemap_empty_groupby_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TreemapChartConfig(
                chart_type="treemap_v2",
                groupby=[],
                metric={"name": "revenue", "aggregate": "SUM"},
            )

    def test_treemap_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            TreemapChartConfig(chart_type="treemap_v2", groupby=[{"name": "region"}])

    def test_treemap_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            TreemapChartConfig(
                chart_type="treemap_v2",
                groupby=[{"name": "region"}],
                metric={"name": "revenue", "aggregate": "SUM"},
                bogus=1,
            )

    def test_treemap_groupby_rejects_aggregate(self) -> None:
        """An aggregate makes a hierarchy column metric-like; reject it."""
        with pytest.raises(ValidationError):
            TreemapChartConfig(
                chart_type="treemap_v2",
                groupby=[{"name": "region", "aggregate": "SUM"}],
                metric={"name": "revenue", "aggregate": "SUM"},
            )

    def test_treemap_groupby_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            TreemapChartConfig(
                chart_type="treemap_v2",
                groupby=[{"name": "count", "saved_metric": True}],
                metric={"name": "revenue", "aggregate": "SUM"},
            )

    def test_chart_config_union_dispatches_treemap(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "treemap_v2",
                "groupby": [{"name": "region"}],
                "metric": {"name": "revenue", "aggregate": "SUM"},
            }
        )
        assert isinstance(config, TreemapChartConfig)


class TestMapTreemapConfig:
    """form_data mapping must match the frontend Treemap buildQuery."""

    def test_basic_treemap_form_data(self) -> None:
        config = TreemapChartConfig(
            chart_type="treemap_v2",
            groupby=[{"name": "region"}, {"name": "product"}],
            metric={"name": "revenue", "aggregate": "SUM"},
        )
        form_data = map_treemap_config(config)
        assert form_data["viz_type"] == "treemap_v2"
        # hierarchy order is preserved (nesting levels)
        assert form_data["groupby"] == ["region", "product"]
        assert form_data["metric"]["label"] == "SUM(revenue)"
        assert form_data["sort_by_metric"] is True

    def test_treemap_form_data_with_filters_and_no_sort(self) -> None:
        config = TreemapChartConfig(
            chart_type="treemap_v2",
            groupby=[{"name": "region"}],
            metric={"name": "revenue", "aggregate": "SUM"},
            sort_by_metric=False,
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_treemap_config(config)
        assert form_data["sort_by_metric"] is False
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_treemap_saved_metric_maps_to_name_string(self) -> None:
        config = TreemapChartConfig(
            chart_type="treemap_v2",
            groupby=[{"name": "region"}],
            metric={"name": "gross_margin", "saved_metric": True},
        )
        assert map_treemap_config(config)["metric"] == "gross_margin"


class TestTreemapPluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_treemap_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("treemap_v2")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "treemap_v2"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("treemap_v2") == "Treemap"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("treemap_v2")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "treemap_v2"})
        assert error is not None
        assert "groupby" in error.message
        assert "metric" in error.message


class TestTreemapRecommendationCategory:
    """Treemap is categorized for chart recommendations and schema discovery."""

    def test_treemap_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("treemap_v2") == "treemap"

    def test_get_chart_type_schema_includes_treemap(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "treemap_v2" in _CHART_TYPE_ADAPTERS
