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

from unittest.mock import MagicMock, Mock, patch

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    map_bubble_config,
)
from superset.mcp_service.chart.compile import _compile_chart
from superset.mcp_service.chart.preview_utils import _build_query_fields
from superset.mcp_service.chart.schemas import (
    BubbleChartConfig,
    ChartConfig,
    GenerateChartRequest,
    UpdateChartRequest,
)
from superset.utils import json


def _base(**overrides):
    cfg = {
        "chart_type": "bubble",
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

    def test_native_viz_type_and_form_data_round_trip(self) -> None:
        native_form_data = map_bubble_config(
            BubbleChartConfig(
                **_base(filters=[{"column": "year", "op": "=", "value": 2026}])
            )
        )

        generate_request = GenerateChartRequest.model_validate(
            {"dataset_id": 7, "config": dict(native_form_data)}
        )
        update_request = UpdateChartRequest.model_validate(
            {"identifier": 9, "config": dict(native_form_data)}
        )

        for config in (generate_request.config, update_request.config):
            assert isinstance(config, BubbleChartConfig)
            assert config.chart_type == "bubble"
            assert config.entity.name == "country"
            assert config.x.aggregate == "AVG"
            assert config.filters is not None
            assert config.filters[0].column == "year"
            assert config.filters[0].op == "="

    def test_native_saved_and_sql_metrics_round_trip(self) -> None:
        request = UpdateChartRequest.model_validate(
            {
                "identifier": 9,
                "config": {
                    "viz_type": "bubble_v2",
                    "entity": "country",
                    "x": "saved_x",
                    "y": {
                        "expressionType": "SQL",
                        "sqlExpression": "AVG(revenue / NULLIF(cost, 0))",
                        "label": "Efficiency",
                    },
                    "size": {
                        "expressionType": "SIMPLE",
                        "column": {"column_name": "population"},
                        "aggregate": "SUM",
                        "label": "Population",
                        "hasCustomLabel": True,
                    },
                },
            }
        )

        assert isinstance(request.config, BubbleChartConfig)
        assert request.config.x.saved_metric is True
        assert request.config.y.sql_expression is not None
        assert request.config.size.label == "Population"


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

    def test_compile_and_preview_fields_include_bubble_contract(self) -> None:
        form_data = map_bubble_config(
            BubbleChartConfig(**_base(series={"name": "continent"}))
        )

        columns, metrics = _build_query_fields(form_data)
        labels = [metric["label"] for metric in metrics]

        assert columns == ["country", "continent"]
        assert labels == ["AVG(gdp)", "AVG(life_expectancy)", "SUM(population)"]

    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
    @patch("superset.common.query_context_factory.QueryContextFactory")
    def test_compile_builds_non_empty_bubble_query(
        self, mock_factory_cls: MagicMock, mock_command_cls: MagicMock
    ) -> None:
        mock_factory_cls.return_value.create.return_value = MagicMock()
        mock_command_cls.return_value.run.return_value = {"queries": [{"data": []}]}
        form_data = map_bubble_config(BubbleChartConfig(**_base()))

        result = _compile_chart(form_data, dataset_id=7)

        assert result.success is True
        query = mock_factory_cls.return_value.create.call_args.kwargs["queries"][0]
        assert query["columns"] == ["country"]
        assert [metric["label"] for metric in query["metrics"]] == [
            "AVG(gdp)",
            "AVG(life_expectancy)",
            "SUM(population)",
        ]


class TestBubblePluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_bubble_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("bubble")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "bubble_v2"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("bubble_v2") == "Bubble Chart"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("bubble")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "bubble"})
        assert error is not None
        assert "entity" in error.message
        assert "x" in error.message

    def test_update_preserves_native_viz_type(self) -> None:
        from superset.mcp_service.chart.tool.update_chart import _build_update_payload

        config = BubbleChartConfig(**_base())
        request = UpdateChartRequest(identifier=9, config=config)
        chart = Mock(datasource_id=7, slice_name="Bubble", params="{}")

        payload = _build_update_payload(request, chart, parsed_config=config)

        assert isinstance(payload, dict)
        assert payload["viz_type"] == "bubble_v2"
        assert json.loads(payload["params"])["viz_type"] == "bubble_v2"

    def test_capabilities_and_semantics_cover_bubble(self) -> None:
        config = BubbleChartConfig(**_base())

        capabilities = analyze_chart_capabilities("bubble_v2", config)
        semantics = analyze_chart_semantics("bubble_v2", config)

        assert capabilities.supports_interaction is True
        assert set(capabilities.data_types) == {"categorical", "metric"}
        assert "three metrics" in semantics.primary_insight
        assert "country" in semantics.data_story


class TestBubbleRecommendationCategory:
    """Bubble is categorized for chart recommendations and schema discovery."""

    def test_bubble_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("bubble_v2") == "bubble"

    def test_get_chart_type_schema_includes_bubble(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "bubble" in _CHART_TYPE_ADAPTERS
