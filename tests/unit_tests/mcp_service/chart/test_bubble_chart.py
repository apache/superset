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

    def test_bubble_entity_rejects_aggregate(self) -> None:
        """An aggregate makes entity metric-like; entity is a dimension."""
        with pytest.raises(ValidationError):
            BubbleChartConfig(**_base(entity={"name": "country", "aggregate": "SUM"}))

    def test_bubble_series_rejects_aggregate(self) -> None:
        with pytest.raises(ValidationError):
            BubbleChartConfig(
                **_base(series={"name": "continent", "aggregate": "COUNT"})
            )

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


class TestBubbleMetricsResolution:
    """The MCP query path must fold x/y/size into metrics for bubble_v2.

    The mapper emits viz_type 'bubble_v2', so resolve_metrics must recognize
    it (not just the legacy 'bubble' key) or the query drops all three metrics.
    """

    def test_bubble_v2_metrics_resolved(self) -> None:
        from superset.mcp_service.chart.chart_helpers import resolve_metrics

        form_data = map_bubble_config(BubbleChartConfig(**_base()))
        metrics = resolve_metrics(form_data, "bubble_v2")
        labels = [m["label"] if isinstance(m, dict) else m for m in metrics]
        assert labels == ["AVG(gdp)", "AVG(life_expectancy)", "SUM(population)"]


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


class TestBubbleChartAnalyzers:
    """The shared analyzers must handle bubble's single-column x/y.

    Every other config in the union types ``y`` as a list of columns; bubble's
    is a single ColumnRef. generate_chart calls both analyzers unguarded, so a
    list assumption there crashes the whole tool.
    """

    def test_capabilities_classify_single_column_y(self) -> None:
        from superset.mcp_service.chart.chart_utils import analyze_chart_capabilities

        capabilities = analyze_chart_capabilities(
            "bubble_v2", BubbleChartConfig(**_base())
        )
        assert "metric" in capabilities.data_types

    def test_semantics_name_the_bubble_columns(self) -> None:
        from superset.mcp_service.chart.chart_utils import analyze_chart_semantics

        semantics = analyze_chart_semantics("bubble_v2", BubbleChartConfig(**_base()))
        assert "gdp" in semantics.data_story
        assert "life_expectancy" in semantics.data_story


class TestBubbleImplicitAggregate:
    """x/y/size are metric slots, so a bare column means SUM — say so.

    create_metric_object defaults a plain column to SUM. Left implicit the
    ref reports is_metric False, so the aggregate-compatibility check skips
    it and SUM(varchar_column) reaches the database, while spelling out that
    same SUM is rejected up front.
    """

    def test_bare_column_metric_records_the_implicit_sum(self) -> None:
        config = BubbleChartConfig(**_base(x={"name": "gdp"}))
        assert config.x.aggregate == "SUM"
        assert config.x.is_metric

    def test_explicit_aggregate_is_left_alone(self) -> None:
        config = BubbleChartConfig(**_base())
        assert config.x.aggregate == "AVG"

    @pytest.mark.parametrize("field", ["x", "y", "size"])
    def test_bare_column_metric_is_aggregate_checked(self, field: str) -> None:
        from superset.mcp_service.chart.plugins.bubble import BubbleChartPlugin
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )
        from superset.mcp_service.common.error_schemas import DatasetContext

        context = DatasetContext(
            id=1,
            table_name="countries",
            schema=None,
            database_name="database",
            available_columns=[
                {"name": "country", "type": "VARCHAR", "is_numeric": False},
                {"name": "gdp", "type": "BIGINT", "is_numeric": True},
                {"name": "life_expectancy", "type": "BIGINT", "is_numeric": True},
                {"name": "population", "type": "BIGINT", "is_numeric": True},
            ],
            available_metrics=[],
        )
        config = BubbleChartConfig(**_base(**{field: {"name": "country"}}))
        refs = BubbleChartPlugin().extract_column_refs(config)

        errors = DatasetValidator._validate_aggregations(refs, context)

        assert errors, "SUM(country) on a VARCHAR column must be rejected"
        assert errors[0].error_type == "invalid_aggregation"

    def test_entity_dimension_is_not_aggregate_checked(self) -> None:
        """The entity dimension stays aggregate-free (it is not a metric)."""
        config = BubbleChartConfig(**_base())
        assert config.entity.aggregate is None


class TestBubbleSavedChartOrdering:
    """A saved bubble chart's "Sort query by" metric must reach the query.

    Bubble's buildQuery pairs form_data['orderby'] with the negated
    order_desc flag. The MCP path builds query dicts directly, so without
    that translation row_limit truncates an unordered result and the chart
    shows arbitrary bubbles rather than the largest.
    """

    @staticmethod
    def _size_metric():
        return map_bubble_config(BubbleChartConfig(**_base()))["size"]

    @staticmethod
    def _query(monkeypatch, **overrides):
        from superset.mcp_service.chart import chart_helpers

        monkeypatch.setattr(
            chart_helpers,
            "resolve_datasource_engine",
            lambda datasource_id, datasource_type: "base",
        )
        form_data = map_bubble_config(BubbleChartConfig(**_base()))
        form_data.update(overrides)
        return chart_helpers.build_query_dicts_from_form_data(form_data, 1, "table")[0]

    def test_sort_metric_orders_descending_by_default(self, monkeypatch) -> None:
        size = self._size_metric()
        query = self._query(monkeypatch, orderby=size, row_limit=1)
        assert query["orderby"] == [(size, False)]

    def test_order_desc_false_sorts_ascending(self, monkeypatch) -> None:
        size = self._size_metric()
        query = self._query(monkeypatch, orderby=size, order_desc=False)
        assert query["orderby"] == [(size, True)]

    def test_sort_metric_stored_as_a_list_is_accepted(self, monkeypatch) -> None:
        size = self._size_metric()
        query = self._query(monkeypatch, orderby=[size])
        assert query["orderby"] == [(size, False)]

    def test_no_sort_metric_leaves_the_query_unordered(self, monkeypatch) -> None:
        assert "orderby" not in self._query(monkeypatch)


class TestBubbleVegaLitePreview:
    """The advertised Vega-Lite preview must draw bubbles, not an empty bar.

    Bubble form_data carries its metrics under x/y/size and its dimensions
    under entity/series, none of which the generic spec builder reads, so
    the preview fell back to a bar mark with no encoding at all.
    """

    @staticmethod
    def _preview(form_data, rows):
        from superset.mcp_service.chart.preview_utils import (
            _generate_vega_lite_preview_from_data,
        )

        return _generate_vega_lite_preview_from_data(rows, form_data)

    @staticmethod
    def _rows():
        return [
            {
                "country": "France",
                "continent": "Europe",
                "AVG(gdp)": 44.5,
                "AVG(life_expectancy)": 82.5,
                "SUM(population)": 67000000,
            },
            {
                "country": "Brazil",
                "continent": "South America",
                "AVG(gdp)": 8.9,
                "AVG(life_expectancy)": 75.9,
                "SUM(population)": 214000000,
            },
        ]

    def test_metrics_become_position_and_size_encodings(self) -> None:
        form_data = map_bubble_config(
            BubbleChartConfig(**_base(series={"name": "continent"}))
        )
        encoding = self._preview(form_data, self._rows()).specification["encoding"]

        assert encoding["x"]["field"] == "AVG(gdp)"
        assert encoding["x"]["type"] == "quantitative"
        assert encoding["y"]["field"] == "AVG(life_expectancy)"
        assert encoding["size"]["field"] == "SUM(population)"
        assert encoding["color"]["field"] == "continent"

    def test_mark_is_a_circle(self) -> None:
        form_data = map_bubble_config(BubbleChartConfig(**_base()))
        assert self._preview(form_data, self._rows()).specification["mark"] == "circle"

    def test_entity_colors_the_bubbles_without_a_series(self) -> None:
        form_data = map_bubble_config(BubbleChartConfig(**_base()))
        encoding = self._preview(form_data, self._rows()).specification["encoding"]

        assert encoding["color"]["field"] == "country"

    def test_saved_metric_names_are_used_as_fields(self) -> None:
        """A saved bubble chart stores saved metrics as plain name strings."""
        form_data = map_bubble_config(
            BubbleChartConfig(**_base(size={"name": "headcount", "saved_metric": True}))
        )
        rows = [
            {
                "country": "France",
                "AVG(gdp)": 1,
                "AVG(life_expectancy)": 2,
                "headcount": 3,
            }
        ]
        encoding = self._preview(form_data, rows).specification["encoding"]

        assert encoding["size"]["field"] == "headcount"
