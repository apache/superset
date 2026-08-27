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

"""Tests for the bubble chart type plugin.

Schema validation, form_data mapping (matching the frontend Bubble buildQuery
contract for viz_type ``bubble_v2`` — an ``entity`` dimension plus three
separate metric keys ``x``/``y``/``size`` and an optional ``series``), and
registry integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_bubble_config
from superset.mcp_service.chart.schemas import BubbleChartConfig, ChartConfig


def _base(**overrides):
    cfg = {
        "chart_type": "bubble_v2",
        "entity": {"name": "country"},
        "x": {"name": "gdp", "aggregate": "AVG"},
        "y": {"name": "life_expectancy", "aggregate": "AVG"},
        "size": {"name": "population", "aggregate": "SUM"},
    }
    cfg.update(overrides)
    return cfg


class TestBubbleChartConfigSchema:
    """BubbleChartConfig schema validation."""

    def test_basic_bubble_config(self) -> None:
        config = BubbleChartConfig(**_base())
        assert config.entity.name == "country"
        assert config.x.name == "gdp"
        assert config.series is None  # series grouping is optional
        assert config.row_limit == 10000  # shared control default

    @pytest.mark.parametrize("missing", ["entity", "x", "y", "size"])
    def test_bubble_missing_required(self, missing: str) -> None:
        cfg = _base()
        del cfg[missing]
        with pytest.raises(ValidationError):
            BubbleChartConfig(**cfg)

    def test_bubble_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            BubbleChartConfig(**_base(bogus=1))

    def test_bubble_entity_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            BubbleChartConfig(**_base(entity={"name": "c", "saved_metric": True}))

    def test_bubble_series_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            BubbleChartConfig(**_base(series={"name": "c", "saved_metric": True}))

    def test_bubble_x_accepts_saved_metric(self) -> None:
        """A saved metric is a valid x/y/size value."""
        config = BubbleChartConfig(
            **_base(x={"name": "gdp_index", "saved_metric": True})
        )
        assert config.x.saved_metric is True

    def test_chart_config_union_dispatches_bubble(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(_base())
        assert isinstance(config, BubbleChartConfig)


class TestMapBubbleConfig:
    """form_data mapping must match the frontend Bubble buildQuery."""

    def test_basic_bubble_form_data(self) -> None:
        config = BubbleChartConfig(**_base())
        form_data = map_bubble_config(config)
        assert form_data["viz_type"] == "bubble_v2"
        assert form_data["entity"] == "country"
        # x/y/size are three separate metric keys (not a metrics array)
        assert form_data["x"]["label"] == "AVG(gdp)"
        assert form_data["y"]["label"] == "AVG(life_expectancy)"
        assert form_data["size"]["label"] == "SUM(population)"
        assert form_data["row_limit"] == 10000
        assert "series" not in form_data  # omitted when not set

    def test_bubble_form_data_with_series_and_filters(self) -> None:
        config = BubbleChartConfig(
            **_base(
                series={"name": "continent"},
                filters=[{"column": "year", "op": "=", "value": 2026}],
            )
        )
        form_data = map_bubble_config(config)
        assert form_data["series"] == "continent"
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_bubble_saved_metric_maps_to_name_string(self) -> None:
        config = BubbleChartConfig(
            **_base(size={"name": "headcount", "saved_metric": True})
        )
        assert map_bubble_config(config)["size"] == "headcount"


class TestBubblePluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_bubble_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("bubble_v2")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "bubble_v2"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("bubble_v2") == "Bubble Chart"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("bubble_v2")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "bubble_v2"})
        assert error is not None
        assert "entity" in error.message
        assert "x" in error.message


class TestBubbleRecommendationCategory:
    """Bubble is categorized for chart recommendations and schema discovery."""

    def test_bubble_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("bubble_v2") == "bubble"

    def test_get_chart_type_schema_includes_bubble(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "bubble_v2" in _CHART_TYPE_ADAPTERS
