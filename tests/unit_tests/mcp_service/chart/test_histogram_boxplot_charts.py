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

"""Tests for the histogram and box plot chart type plugins.

Schema validation, form_data mapping (matching the frontend buildQuery
contracts for viz_type ``histogram_v2`` and ``box_plot``), and registry
integration.
"""

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import (
    map_box_plot_config,
    map_histogram_config,
)
from superset.mcp_service.chart.schemas import (
    BoxPlotChartConfig,
    ChartConfig,
    HistogramChartConfig,
)


class TestHistogramChartConfigSchema:
    """HistogramChartConfig schema validation."""

    def test_basic_histogram_config(self) -> None:
        config = HistogramChartConfig(
            chart_type="histogram",
            column={"name": "trip_duration"},
        )
        assert config.column.name == "trip_duration"
        assert config.bins == 5  # frontend controlPanel default
        assert config.normalize is False
        assert config.cumulative is False
        assert config.groupby is None

    def test_histogram_config_with_all_options(self) -> None:
        config = HistogramChartConfig(
            chart_type="histogram",
            column={"name": "fare_amount"},
            groupby=[{"name": "payment_type"}],
            bins=20,
            normalize=True,
            cumulative=True,
            row_limit=500,
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        assert config.bins == 20
        assert config.normalize is True
        assert config.cumulative is True
        assert [g.name for g in config.groupby or []] == ["payment_type"]

    def test_histogram_missing_column(self) -> None:
        with pytest.raises(ValidationError):
            HistogramChartConfig(chart_type="histogram")

    def test_histogram_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            HistogramChartConfig(
                chart_type="histogram",
                column={"name": "x"},
                nonsense_field=True,
            )

    def test_histogram_bins_bounds(self) -> None:
        with pytest.raises(ValidationError):
            HistogramChartConfig(chart_type="histogram", column={"name": "x"}, bins=0)
        with pytest.raises(ValidationError):
            HistogramChartConfig(
                chart_type="histogram", column={"name": "x"}, bins=1001
            )

    def test_histogram_column_rejects_saved_metric(self) -> None:
        """The binned column is a physical column, not a metric."""
        with pytest.raises(ValidationError):
            HistogramChartConfig(
                chart_type="histogram",
                column={"name": "count", "saved_metric": True},
            )

    def test_chart_config_union_dispatches_histogram(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {"chart_type": "histogram", "column": {"name": "duration"}}
        )
        assert isinstance(config, HistogramChartConfig)


class TestMapHistogramConfig:
    """form_data mapping must match the frontend Histogram buildQuery."""

    def test_basic_histogram_form_data(self) -> None:
        config = HistogramChartConfig(
            chart_type="histogram", column={"name": "trip_duration"}
        )
        form_data = map_histogram_config(config)
        assert form_data["viz_type"] == "histogram_v2"
        assert form_data["column"] == "trip_duration"
        assert form_data["groupby"] == []
        assert form_data["bins"] == 5
        assert form_data["normalize"] is False
        assert form_data["cumulative"] is False

    def test_histogram_form_data_with_options_and_filters(self) -> None:
        config = HistogramChartConfig(
            chart_type="histogram",
            column={"name": "fare_amount"},
            groupby=[{"name": "payment_type"}],
            bins=20,
            normalize=True,
            cumulative=True,
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_histogram_config(config)
        assert form_data["groupby"] == ["payment_type"]
        assert form_data["bins"] == 20
        assert form_data["normalize"] is True
        assert form_data["cumulative"] is True
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"


class TestBoxPlotChartConfigSchema:
    """BoxPlotChartConfig schema validation."""

    def test_basic_box_plot_config(self) -> None:
        config = BoxPlotChartConfig(
            chart_type="box_plot",
            metrics=[{"name": "fare_amount", "aggregate": "AVG"}],
            distribute_across=[{"name": "day_of_week"}],
        )
        assert config.whisker_type == "tukey"
        assert config.dimensions is None
        assert [c.name for c in config.distribute_across] == ["day_of_week"]

    def test_box_plot_missing_metrics(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                distribute_across=[{"name": "day"}],
            )

    def test_box_plot_empty_distribute_across(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                metrics=[{"name": "x", "aggregate": "AVG"}],
                distribute_across=[],
            )

    def test_box_plot_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                metrics=[{"name": "x", "aggregate": "AVG"}],
                distribute_across=[{"name": "day"}],
                bogus=1,
            )

    def test_box_plot_percentile_requires_bounds(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                metrics=[{"name": "x", "aggregate": "AVG"}],
                distribute_across=[{"name": "day"}],
                whisker_type="percentile",
            )

    def test_box_plot_percentile_bounds_must_be_ordered(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                metrics=[{"name": "x", "aggregate": "AVG"}],
                distribute_across=[{"name": "day"}],
                whisker_type="percentile",
                percentile_low=90,
                percentile_high=10,
            )

    def test_chart_config_union_dispatches_box_plot(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "box_plot",
                "metrics": [{"name": "fare", "aggregate": "AVG"}],
                "distribute_across": [{"name": "day"}],
            }
        )
        assert isinstance(config, BoxPlotChartConfig)


class TestMapBoxPlotConfig:
    """form_data mapping must match the frontend BoxPlot buildQuery."""

    def test_basic_box_plot_form_data(self) -> None:
        config = BoxPlotChartConfig(
            chart_type="box_plot",
            metrics=[{"name": "fare_amount", "aggregate": "AVG"}],
            distribute_across=[{"name": "day_of_week"}],
            dimensions=[{"name": "payment_type"}],
        )
        form_data = map_box_plot_config(config)
        assert form_data["viz_type"] == "box_plot"
        assert form_data["columns"] == ["day_of_week"]
        assert form_data["groupby"] == ["payment_type"]
        assert form_data["whiskerOptions"] == "Tukey"
        assert len(form_data["metrics"]) == 1

    def test_box_plot_whisker_min_max(self) -> None:
        config = BoxPlotChartConfig(
            chart_type="box_plot",
            metrics=[{"name": "x", "aggregate": "AVG"}],
            distribute_across=[{"name": "day"}],
            whisker_type="min_max",
        )
        assert map_box_plot_config(config)["whiskerOptions"] == (
            "Min/max (no outliers)"
        )

    def test_box_plot_whisker_percentiles(self) -> None:
        """Percentiles serialize to the exact string the frontend
        boxplotOperator PERCENTILE_REGEX parses: '<low>/<high> percentiles'."""
        config = BoxPlotChartConfig(
            chart_type="box_plot",
            metrics=[{"name": "x", "aggregate": "AVG"}],
            distribute_across=[{"name": "day"}],
            whisker_type="percentile",
            percentile_low=10,
            percentile_high=90,
        )
        assert map_box_plot_config(config)["whiskerOptions"] == "10/90 percentiles"


class TestPluginRegistry:
    """Both plugins must be registered and resolve their viz types."""

    def test_histogram_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("histogram")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "histogram_v2"

    def test_box_plot_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("box_plot")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "box_plot"

    def test_display_names_resolve(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("histogram_v2") == "Histogram"
        assert display_name_for_viz_type("box_plot") == "Box Plot"

    def test_histogram_pre_validate_missing_column(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("histogram")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "histogram"})
        assert error is not None
        assert "column" in error.message

    def test_box_plot_pre_validate_missing_metrics(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("box_plot")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "box_plot"})
        assert error is not None
        assert "metrics" in error.message


class TestDimensionFieldsRejectSavedMetrics:
    """Dimension-position fields must reject metric-style refs."""

    def test_histogram_groupby_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            HistogramChartConfig(
                chart_type="histogram",
                column={"name": "x"},
                groupby=[{"name": "revenue", "saved_metric": True}],
            )

    def test_box_plot_distribute_across_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                metrics=[{"name": "x", "aggregate": "AVG"}],
                distribute_across=[{"name": "revenue", "saved_metric": True}],
            )

    def test_box_plot_dimensions_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            BoxPlotChartConfig(
                chart_type="box_plot",
                metrics=[{"name": "x", "aggregate": "AVG"}],
                distribute_across=[{"name": "day"}],
                dimensions=[{"name": "revenue", "saved_metric": True}],
            )
