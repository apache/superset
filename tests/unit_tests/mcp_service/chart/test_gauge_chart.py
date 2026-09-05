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

"""Tests for the gauge chart type plugin.

Schema validation, form_data mapping (matching the frontend Gauge buildQuery
contract for viz_type ``gauge_chart`` — a single ``metric`` with an optional
multi ``groupby`` producing one dial per row), and registry integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_gauge_config
from superset.mcp_service.chart.schemas import ChartConfig, GaugeChartConfig


class TestGaugeChartConfigSchema:
    """GaugeChartConfig schema validation."""

    def test_basic_gauge_config(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge_chart",
            metric={"name": "progress", "aggregate": "AVG"},
        )
        assert config.metric.name == "progress"
        assert config.groupby is None  # groupby is optional (single dial)
        assert config.row_limit == 10  # frontend controlPanel default
        assert config.min_val is None
        assert config.max_val is None

    def test_gauge_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            GaugeChartConfig(chart_type="gauge_chart", groupby=[{"name": "team"}])

    def test_gauge_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge_chart",
                metric={"name": "progress", "aggregate": "AVG"},
                bogus=1,
            )

    def test_gauge_groupby_rejects_saved_metric(self) -> None:
        """A groupby dial dimension is a category, not a metric."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge_chart",
                metric={"name": "progress", "aggregate": "AVG"},
                groupby=[{"name": "count", "saved_metric": True}],
            )

    def test_gauge_groupby_rejects_aggregate(self) -> None:
        """An aggregate makes a dial dimension metric-like; reject it."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge_chart",
                metric={"name": "progress", "aggregate": "AVG"},
                groupby=[{"name": "team", "aggregate": "SUM"}],
            )

    def test_gauge_rejects_inverted_bounds(self) -> None:
        """min_val >= max_val yields an inverted dial; reject it."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge_chart",
                metric={"name": "progress", "aggregate": "AVG"},
                min_val=100,
                max_val=0,
            )

    def test_gauge_row_limit_capped_at_ten(self) -> None:
        """The frontend limits gauge dials to 10."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge_chart",
                metric={"name": "progress", "aggregate": "AVG"},
                row_limit=25,
            )

    def test_chart_config_union_dispatches_gauge(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "gauge_chart",
                "metric": {"name": "progress", "aggregate": "AVG"},
            }
        )
        assert isinstance(config, GaugeChartConfig)


class TestMapGaugeConfig:
    """form_data mapping must match the frontend Gauge buildQuery."""

    def test_basic_gauge_form_data(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge_chart",
            metric={"name": "progress", "aggregate": "AVG"},
        )
        form_data = map_gauge_config(config)
        assert form_data["viz_type"] == "gauge_chart"
        assert form_data["groupby"] == []  # no dials -> single gauge
        assert form_data["metric"]["label"] == "AVG(progress)"
        assert form_data["row_limit"] == 10

    def test_gauge_form_data_with_dials_and_range(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge_chart",
            metric={"name": "progress", "aggregate": "AVG"},
            groupby=[{"name": "team"}],
            min_val=0,
            max_val=100,
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_gauge_config(config)
        assert form_data["groupby"] == ["team"]
        assert form_data["min_val"] == 0
        assert form_data["max_val"] == 100
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_gauge_color_scheme_defaults_and_bounds_emitted(self) -> None:
        """color_scheme defaults to supersetColors; min/max keys are emitted."""
        config = GaugeChartConfig(
            chart_type="gauge_chart",
            metric={"name": "progress", "aggregate": "AVG"},
            min_val=0,
            max_val=100,
        )
        form_data = map_gauge_config(config)
        assert form_data["color_scheme"] == "supersetColors"
        assert form_data["min_val"] == 0
        assert form_data["max_val"] == 100
        # explicit scheme passes through unchanged
        explicit = map_gauge_config(
            GaugeChartConfig(
                chart_type="gauge_chart",
                metric={"name": "progress", "aggregate": "AVG"},
                color_scheme="lyftColors",
            )
        )
        assert explicit["color_scheme"] == "lyftColors"

    def test_gauge_sort_by_metric_becomes_orderby(self, monkeypatch) -> None:
        """sort_by_metric (default True) must reach the query as a metric orderby."""
        from superset.mcp_service.chart import chart_helpers

        monkeypatch.setattr(
            chart_helpers,
            "resolve_datasource_engine",
            lambda datasource_id, datasource_type: "base",
        )
        config = GaugeChartConfig(
            chart_type="gauge_chart",
            metric={"name": "progress", "aggregate": "AVG"},
            groupby=[{"name": "team"}],
        )
        assert config.sort_by_metric is True
        form_data = map_gauge_config(config)
        queries = chart_helpers.build_query_dicts_from_form_data(form_data, 1, "table")
        orderby = queries[0].get("orderby")
        assert orderby, "sort_by_metric must produce an orderby"
        assert orderby[0][1] is False, "dials must order by metric descending"

    def test_gauge_saved_metric_maps_to_name_string(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge_chart",
            metric={"name": "sla_attainment", "saved_metric": True},
        )
        assert map_gauge_config(config)["metric"] == "sla_attainment"


class TestGaugePluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_gauge_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("gauge_chart")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "gauge_chart"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("gauge_chart") == "Gauge Chart"

    def test_pre_validate_missing_metric(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("gauge_chart")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "gauge_chart"})
        assert error is not None
        assert "metric" in error.message

    def test_pre_validate_passes_without_groupby(self) -> None:
        """groupby is optional; metric alone is a valid gauge."""
        from superset.mcp_service.chart import registry

        plugin = registry.get("gauge_chart")
        assert plugin is not None
        assert plugin.pre_validate({"chart_type": "gauge_chart", "metric": {}}) is None


class TestGaugeRecommendationCategory:
    """Gauge is categorized for chart recommendations and schema discovery."""

    def test_gauge_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("gauge_chart") == "gauge"

    def test_get_chart_type_schema_includes_gauge(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "gauge_chart" in _CHART_TYPE_ADAPTERS
