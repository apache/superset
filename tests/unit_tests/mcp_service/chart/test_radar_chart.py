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

"""Tests for the radar chart type plugin.

Schema validation, form_data mapping (matching the frontend Radar buildQuery
contract for viz_type ``radar`` — multiple ``metrics`` forming the axes plus
an optional ``groupby`` for the series polygons), and registry integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_radar_config
from superset.mcp_service.chart.schemas import ChartConfig, RadarChartConfig


class TestRadarChartConfigSchema:
    """RadarChartConfig schema validation."""

    def test_basic_radar_config(self) -> None:
        config = RadarChartConfig(
            chart_type="radar",
            metrics=[
                {"name": "speed", "aggregate": "AVG"},
                {"name": "power", "aggregate": "AVG"},
                {"name": "range", "aggregate": "AVG"},
            ],
        )
        assert len(config.metrics) == 3
        assert config.groupby is None  # series grouping is optional
        assert config.row_limit == 10  # frontend controlPanel default

    def test_radar_missing_metrics(self) -> None:
        with pytest.raises(ValidationError):
            RadarChartConfig(chart_type="radar", groupby=[{"name": "model"}])

    def test_radar_empty_metrics_rejected(self) -> None:
        with pytest.raises(ValidationError):
            RadarChartConfig(chart_type="radar", metrics=[])

    def test_radar_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            RadarChartConfig(
                chart_type="radar",
                metrics=[{"name": "speed", "aggregate": "AVG"}],
                bogus=1,
            )

    def test_radar_groupby_rejects_aggregate(self) -> None:
        """An aggregate makes a series column metric-like; reject it."""
        with pytest.raises(ValidationError):
            RadarChartConfig(
                chart_type="radar",
                metrics=[{"name": "speed", "aggregate": "AVG"}],
                groupby=[{"name": "model", "aggregate": "SUM"}],
            )

    def test_radar_groupby_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            RadarChartConfig(
                chart_type="radar",
                metrics=[{"name": "speed", "aggregate": "AVG"}],
                groupby=[{"name": "count", "saved_metric": True}],
            )

    def test_radar_metric_accepts_saved_metric(self) -> None:
        """A saved metric is a valid radar axis."""
        config = RadarChartConfig(
            chart_type="radar",
            metrics=[{"name": "efficiency_score", "saved_metric": True}],
        )
        assert config.metrics[0].saved_metric is True

    def test_chart_config_union_dispatches_radar(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "radar",
                "metrics": [{"name": "speed", "aggregate": "AVG"}],
            }
        )
        assert isinstance(config, RadarChartConfig)


class TestMapRadarConfig:
    """form_data mapping must match the frontend Radar buildQuery."""

    def test_basic_radar_form_data(self) -> None:
        config = RadarChartConfig(
            chart_type="radar",
            metrics=[
                {"name": "speed", "aggregate": "AVG"},
                {"name": "power", "aggregate": "AVG"},
            ],
        )
        form_data = map_radar_config(config)
        assert form_data["viz_type"] == "radar"
        assert [m["label"] for m in form_data["metrics"]] == [
            "AVG(speed)",
            "AVG(power)",
        ]
        assert form_data["groupby"] == []
        assert form_data["row_limit"] == 10

    def test_radar_form_data_with_series_and_filters(self) -> None:
        config = RadarChartConfig(
            chart_type="radar",
            metrics=[{"name": "speed", "aggregate": "AVG"}],
            groupby=[{"name": "model"}],
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_radar_config(config)
        assert form_data["groupby"] == ["model"]
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_radar_saved_metric_maps_to_name_string(self) -> None:
        config = RadarChartConfig(
            chart_type="radar",
            metrics=[{"name": "efficiency_score", "saved_metric": True}],
        )
        assert map_radar_config(config)["metrics"] == ["efficiency_score"]


class TestRadarPluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_radar_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("radar")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "radar"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("radar") == "Radar Chart"

    def test_pre_validate_missing_metrics(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("radar")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "radar"})
        assert error is not None
        assert "metrics" in error.message


class TestRadarRecommendationCategory:
    """Radar is categorized for chart recommendations and schema discovery."""

    def test_radar_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("radar") == "radar"

    def test_get_chart_type_schema_includes_radar(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "radar" in _CHART_TYPE_ADAPTERS
