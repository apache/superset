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

"""Tests for the funnel chart type plugin.

Schema validation, form_data mapping (matching the frontend Funnel
buildQuery contract for viz_type ``funnel`` — a single ``groupby`` dimension
plus one ``metric``), native ``groupby`` aliasing, and registry integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_funnel_config
from superset.mcp_service.chart.schemas import ChartConfig, FunnelChartConfig


class TestFunnelChartConfigSchema:
    """FunnelChartConfig schema validation."""

    def test_basic_funnel_config(self) -> None:
        config = FunnelChartConfig(
            chart_type="funnel",
            dimension={"name": "stage"},
            metric={"name": "leads", "aggregate": "SUM"},
        )
        assert config.dimension.name == "stage"
        assert config.sort_by_metric is True  # frontend controlPanel default
        assert config.row_limit == 10  # frontend controlPanel default

    def test_funnel_missing_dimension(self) -> None:
        with pytest.raises(ValidationError):
            FunnelChartConfig(
                chart_type="funnel",
                metric={"name": "leads", "aggregate": "SUM"},
            )

    def test_funnel_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            FunnelChartConfig(chart_type="funnel", dimension={"name": "stage"})

    def test_funnel_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            FunnelChartConfig(
                chart_type="funnel",
                dimension={"name": "stage"},
                metric={"name": "leads", "aggregate": "SUM"},
                bogus=1,
            )

    def test_funnel_dimension_rejects_aggregate(self) -> None:
        """An aggregate makes the dimension metric-like; reject it."""
        with pytest.raises(ValidationError):
            FunnelChartConfig(
                chart_type="funnel",
                dimension={"name": "stage", "aggregate": "COUNT"},
                metric={"name": "leads", "aggregate": "SUM"},
            )

    def test_funnel_dimension_rejects_saved_metric(self) -> None:
        """The dimension is a category, not a metric."""
        with pytest.raises(ValidationError):
            FunnelChartConfig(
                chart_type="funnel",
                dimension={"name": "count", "saved_metric": True},
                metric={"name": "leads", "aggregate": "SUM"},
            )

    def test_groupby_alias_for_dimension(self) -> None:
        """Superset-native 'groupby' is accepted for the dimension field."""
        config = FunnelChartConfig.model_validate(
            {
                "chart_type": "funnel",
                "groupby": {"name": "stage"},
                "metric": {"name": "leads", "aggregate": "SUM"},
            }
        )
        assert config.dimension.name == "stage"

    def test_chart_config_union_dispatches_funnel(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "funnel",
                "dimension": {"name": "stage"},
                "metric": {"name": "leads", "aggregate": "SUM"},
            }
        )
        assert isinstance(config, FunnelChartConfig)


class TestMapFunnelConfig:
    """form_data mapping must match the frontend Funnel buildQuery."""

    def test_basic_funnel_form_data(self) -> None:
        config = FunnelChartConfig(
            chart_type="funnel",
            dimension={"name": "stage"},
            metric={"name": "leads", "aggregate": "SUM"},
        )
        form_data = map_funnel_config(config)
        assert form_data["viz_type"] == "funnel"
        # frontend funnel buildQuery reads a groupby list + a single metric
        assert form_data["groupby"] == ["stage"]
        assert form_data["metric"]["label"] == "SUM(leads)"
        assert form_data["sort_by_metric"] is True
        assert form_data["row_limit"] == 10

    def test_funnel_form_data_with_filters_and_no_sort(self) -> None:
        config = FunnelChartConfig(
            chart_type="funnel",
            dimension={"name": "stage"},
            metric={"name": "leads", "aggregate": "SUM"},
            sort_by_metric=False,
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_funnel_config(config)
        assert form_data["sort_by_metric"] is False
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_funnel_saved_metric_maps_to_name_string(self) -> None:
        config = FunnelChartConfig(
            chart_type="funnel",
            dimension={"name": "stage"},
            metric={"name": "conversion_rate", "saved_metric": True},
        )
        form_data = map_funnel_config(config)
        # saved metrics are passed as a bare name string for query resolution
        assert form_data["metric"] == "conversion_rate"


class TestFunnelPluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_funnel_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("funnel")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "funnel"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("funnel") == "Funnel Chart"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("funnel")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "funnel"})
        assert error is not None
        assert "dimension" in error.message
        assert "metric" in error.message

    def test_to_form_data_via_plugin(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("funnel")
        assert plugin is not None
        config = FunnelChartConfig(
            chart_type="funnel",
            dimension={"name": "stage"},
            metric={"name": "leads", "aggregate": "SUM"},
        )
        form_data = plugin.to_form_data(config)
        assert form_data["viz_type"] == "funnel"


class TestFunnelRecommendationCategory:
    """Funnel is categorized for chart recommendations."""

    def test_funnel_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("funnel") == "funnel"

    def test_get_chart_type_schema_includes_funnel(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "funnel" in _CHART_TYPE_ADAPTERS
