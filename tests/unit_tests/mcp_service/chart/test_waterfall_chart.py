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

"""Tests for the waterfall chart type plugin.

Schema validation, form_data mapping (matching the frontend Waterfall
buildQuery/transformProps contract for viz_type ``waterfall``), native
vocabulary aliases, and registry integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import map_waterfall_config
from superset.mcp_service.chart.schemas import ChartConfig, WaterfallChartConfig


class TestWaterfallChartConfigSchema:
    """WaterfallChartConfig schema validation."""

    def test_basic_waterfall_config(self) -> None:
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "month"},
            metric={"name": "revenue_delta", "aggregate": "SUM"},
        )
        assert config.x_axis.name == "month"
        assert config.breakdown is None
        assert config.show_total is True  # frontend controlPanel default

    def test_waterfall_missing_x_axis(self) -> None:
        with pytest.raises(ValidationError):
            WaterfallChartConfig(
                chart_type="waterfall",
                metric={"name": "revenue", "aggregate": "SUM"},
            )

    def test_waterfall_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            WaterfallChartConfig(chart_type="waterfall", x_axis={"name": "month"})

    def test_waterfall_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            WaterfallChartConfig(
                chart_type="waterfall",
                x_axis={"name": "month"},
                metric={"name": "revenue", "aggregate": "SUM"},
                bogus=1,
            )

    def test_waterfall_breakdown_rejects_saved_metric(self) -> None:
        """The breakdown is a dimension, not a metric."""
        with pytest.raises(ValidationError):
            WaterfallChartConfig(
                chart_type="waterfall",
                x_axis={"name": "month"},
                metric={"name": "revenue", "aggregate": "SUM"},
                breakdown={"name": "count", "saved_metric": True},
            )

    def test_waterfall_x_axis_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            WaterfallChartConfig(
                chart_type="waterfall",
                x_axis={"name": "count", "saved_metric": True},
                metric={"name": "revenue", "aggregate": "SUM"},
            )

    def test_groupby_alias_for_breakdown(self) -> None:
        """Superset-native 'groupby' is accepted for the breakdown field."""
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "month"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "groupby": {"name": "region"},
            }
        )
        assert config.breakdown is not None
        assert config.breakdown.name == "region"

    def test_chart_config_union_dispatches_waterfall(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "month"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
            }
        )
        assert isinstance(config, WaterfallChartConfig)


class TestMapWaterfallConfig:
    """form_data mapping must match the frontend Waterfall buildQuery."""

    def test_basic_waterfall_form_data(self) -> None:
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "month"},
            metric={"name": "revenue_delta", "aggregate": "SUM"},
        )
        form_data = map_waterfall_config(config)
        assert form_data["viz_type"] == "waterfall"
        assert form_data["x_axis"] == "month"
        assert form_data["groupby"] == []
        assert form_data["metric"]["label"] == "SUM(revenue_delta)"
        assert form_data["show_total"] is True

    def test_waterfall_form_data_with_breakdown_and_filters(self) -> None:
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "month"},
            metric={"name": "revenue", "aggregate": "SUM"},
            breakdown={"name": "region"},
            filters=[{"column": "year", "op": "=", "value": 2026}],
            show_total=False,
        )
        form_data = map_waterfall_config(config)
        # single breakdown maps to the groupby list (frontend multi: false)
        assert form_data["groupby"] == ["region"]
        assert form_data["show_total"] is False
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"


class TestWaterfallPluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_waterfall_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("waterfall")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "waterfall"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("waterfall") == "Waterfall Chart"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("waterfall")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "waterfall"})
        assert error is not None
        assert "x_axis" in error.message
        assert "metric" in error.message


class TestWaterfallTemporalAndNativeShape:
    """time_grain bucketing and native form_data groupby-list handling."""

    def test_time_grain_maps_to_time_grain_sqla(self) -> None:
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "order_date"},
            metric={"name": "revenue", "aggregate": "SUM"},
            time_grain="P1M",
        )
        form_data = map_waterfall_config(config)
        assert form_data["time_grain_sqla"] == "P1M"
        # the grain needs a temporal column to apply to
        assert form_data["granularity_sqla"] == "order_date"

    def test_time_grain_omitted_when_unset(self) -> None:
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "category"},
            metric={"name": "revenue", "aggregate": "SUM"},
        )
        assert "time_grain_sqla" not in map_waterfall_config(config)

    def test_time_grain_sqla_alias(self) -> None:
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "order_date"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "time_grain_sqla": "P1D",
            }
        )
        assert config.time_grain == "P1D"

    def test_groupby_list_unwrapped(self) -> None:
        """Native form_data stores the single breakdown as a one-item list."""
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "month"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "groupby": [{"name": "region"}],
            }
        )
        assert config.breakdown is not None
        assert config.breakdown.name == "region"

    def test_empty_groupby_list_is_no_breakdown(self) -> None:
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "month"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "groupby": [],
            }
        )
        assert config.breakdown is None

    def test_multi_item_groupby_rejected(self) -> None:
        with pytest.raises(ValidationError):
            WaterfallChartConfig.model_validate(
                {
                    "chart_type": "waterfall",
                    "x_axis": {"name": "month"},
                    "metric": {"name": "revenue", "aggregate": "SUM"},
                    "groupby": [{"name": "region"}, {"name": "product"}],
                }
            )

    def test_groupby_string_list_coerced(self) -> None:
        """Native form_data names physical columns as bare strings."""
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "month"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "groupby": ["region"],
            }
        )
        assert config.breakdown is not None
        assert config.breakdown.name == "region"

    def test_breakdown_scalar_string_coerced(self) -> None:
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": {"name": "month"},
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "breakdown": "region",
            }
        )
        assert config.breakdown is not None
        assert config.breakdown.name == "region"


class TestWaterfallNativeXAxisAndTemporalValidation:
    """x_axis string coercion, recommendation category, temporal grain check."""

    def test_x_axis_string_coerced(self) -> None:
        config = WaterfallChartConfig.model_validate(
            {
                "chart_type": "waterfall",
                "x_axis": "order_date",
                "metric": {"name": "revenue", "aggregate": "SUM"},
            }
        )
        assert config.x_axis.name == "order_date"

    def test_waterfall_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("waterfall") == "waterfall"

    def test_time_grain_on_non_temporal_x_axis_rejected(self) -> None:
        from unittest.mock import patch

        from superset.mcp_service.chart import registry

        plugin = registry.get("waterfall")
        assert plugin is not None
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "region"},
            metric={"name": "revenue", "aggregate": "SUM"},
            time_grain="P1M",
        )
        with patch(
            "superset.mcp_service.chart.plugins.waterfall.is_column_truly_temporal",
            return_value=False,
        ):
            error = plugin.post_map_validate(config, {}, dataset_id=1)
        assert error is not None
        assert error.error_type == "non_temporal_waterfall_grain"

    def test_time_grain_on_temporal_x_axis_passes(self) -> None:
        from unittest.mock import patch

        from superset.mcp_service.chart import registry

        plugin = registry.get("waterfall")
        assert plugin is not None
        config = WaterfallChartConfig(
            chart_type="waterfall",
            x_axis={"name": "order_date"},
            metric={"name": "revenue", "aggregate": "SUM"},
            time_grain="P1M",
        )
        with patch(
            "superset.mcp_service.chart.plugins.waterfall.is_column_truly_temporal",
            return_value=True,
        ):
            assert plugin.post_map_validate(config, {}, dataset_id=1) is None
