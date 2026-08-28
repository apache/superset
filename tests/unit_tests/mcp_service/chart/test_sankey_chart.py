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

"""Tests for the sankey chart type plugin.

Schema validation, form_data mapping (matching the frontend Sankey buildQuery
contract for viz_type ``sankey_v2`` — a ``source`` and ``target`` column plus
one ``metric`` weighting each edge), and registry integration.
"""

from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.common.form_data_query_context import columns_from_form_data
from superset.mcp_service.chart.chart_helpers import resolve_groupby
from superset.mcp_service.chart.chart_utils import map_sankey_config
from superset.mcp_service.chart.schemas import ChartConfig, SankeyChartConfig


class TestSankeyChartConfigSchema:
    """SankeyChartConfig schema validation."""

    def test_basic_sankey_config(self) -> None:
        config = SankeyChartConfig(
            chart_type="sankey_v2",
            source={"name": "from_stage"},
            target={"name": "to_stage"},
            metric={"name": "users", "aggregate": "SUM"},
        )
        assert config.source.name == "from_stage"
        assert config.target.name == "to_stage"
        assert config.sort_by_metric is True  # shared control default

    @pytest.mark.parametrize("missing", ["source", "target", "metric"])
    def test_sankey_missing_required(self, missing: str) -> None:
        cfg = {
            "chart_type": "sankey_v2",
            "source": {"name": "from_stage"},
            "target": {"name": "to_stage"},
            "metric": {"name": "users", "aggregate": "SUM"},
        }
        del cfg[missing]
        with pytest.raises(ValidationError):
            SankeyChartConfig(**cfg)

    def test_sankey_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            SankeyChartConfig(
                chart_type="sankey_v2",
                source={"name": "from_stage"},
                target={"name": "to_stage"},
                metric={"name": "users", "aggregate": "SUM"},
                bogus=1,
            )

    def test_sankey_source_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            SankeyChartConfig(
                chart_type="sankey_v2",
                source={"name": "count", "saved_metric": True},
                target={"name": "to_stage"},
                metric={"name": "users", "aggregate": "SUM"},
            )

    def test_sankey_target_rejects_saved_metric(self) -> None:
        with pytest.raises(ValidationError):
            SankeyChartConfig(
                chart_type="sankey_v2",
                source={"name": "from_stage"},
                target={"name": "count", "saved_metric": True},
                metric={"name": "users", "aggregate": "SUM"},
            )

    def test_sankey_source_rejects_aggregate(self) -> None:
        """An aggregate makes source metric-like; source is a node dimension."""
        with pytest.raises(ValidationError):
            SankeyChartConfig(
                chart_type="sankey_v2",
                source={"name": "amount", "aggregate": "SUM"},
                target={"name": "to_stage"},
                metric={"name": "users", "aggregate": "SUM"},
            )

    def test_sankey_target_rejects_aggregate(self) -> None:
        with pytest.raises(ValidationError):
            SankeyChartConfig(
                chart_type="sankey_v2",
                source={"name": "from_stage"},
                target={"name": "amount", "aggregate": "SUM"},
                metric={"name": "users", "aggregate": "SUM"},
            )

    def test_chart_config_union_dispatches_sankey(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "sankey_v2",
                "source": {"name": "from_stage"},
                "target": {"name": "to_stage"},
                "metric": {"name": "users", "aggregate": "SUM"},
            }
        )
        assert isinstance(config, SankeyChartConfig)


class TestMapSankeyConfig:
    """form_data mapping must match the frontend Sankey buildQuery."""

    def test_basic_sankey_form_data(self) -> None:
        config = SankeyChartConfig(
            chart_type="sankey_v2",
            source={"name": "from_stage"},
            target={"name": "to_stage"},
            metric={"name": "users", "aggregate": "SUM"},
        )
        form_data = map_sankey_config(config)
        assert form_data["viz_type"] == "sankey_v2"
        assert form_data["source"] == "from_stage"
        assert form_data["target"] == "to_stage"
        assert form_data["groupby"] == ["from_stage", "to_stage"]
        assert form_data["metric"]["label"] == "SUM(users)"
        assert form_data["sort_by_metric"] is True
        # sort_by_metric must translate to an explicit orderby (buildQuery is
        # bypassed on the MCP path), or row-limited results drop heavy edges
        assert form_data["orderby"] == [[form_data["metric"], False]]

    def test_sankey_form_data_with_filters_and_no_sort(self) -> None:
        config = SankeyChartConfig(
            chart_type="sankey_v2",
            source={"name": "from_stage"},
            target={"name": "to_stage"},
            metric={"name": "users", "aggregate": "SUM"},
            sort_by_metric=False,
            filters=[{"column": "year", "op": "=", "value": 2026}],
        )
        form_data = map_sankey_config(config)
        assert form_data["sort_by_metric"] is False
        assert "orderby" not in form_data  # no metric ordering when unset
        assert form_data["adhoc_filters"], "filters must map to adhoc_filters"

    def test_sankey_saved_metric_maps_to_name_string(self) -> None:
        config = SankeyChartConfig(
            chart_type="sankey_v2",
            source={"name": "from_stage"},
            target={"name": "to_stage"},
            metric={"name": "flow_volume", "saved_metric": True},
        )
        assert map_sankey_config(config)["metric"] == "flow_volume"


class TestSankeySourceTargetReachQueryBuilders:
    """The emitted form_data must group by the edge's node columns.

    ``source``/``target`` are the frontend Sankey buildQuery field names; the
    backend query builders derive grouping columns from ``groupby`` and have no
    alias for them (unlike ``entity``/``series``). Without an explicit
    ``groupby`` the query aggregates the whole dataset into a single row instead
    of one row per edge, so assert against the real consumers rather than the
    emitted key alone.
    """

    @staticmethod
    def _form_data() -> dict[str, Any]:
        return map_sankey_config(
            SankeyChartConfig(
                chart_type="sankey_v2",
                source={"name": "from_stage"},
                target={"name": "to_stage"},
                metric={"name": "users", "aggregate": "SUM"},
            )
        )

    def test_resolve_groupby_returns_the_node_columns(self) -> None:
        """The ``get_chart_data`` path groups by source and target."""
        assert resolve_groupby(self._form_data()) == ["from_stage", "to_stage"]

    def test_columns_from_form_data_returns_the_node_columns(self) -> None:
        """The chart-preview path groups by source and target."""
        assert columns_from_form_data(self._form_data()) == [
            "from_stage",
            "to_stage",
        ]


class TestSankeyPluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_sankey_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("sankey_v2")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "sankey_v2"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("sankey_v2") == "Sankey Diagram"

    def test_pre_validate_missing_fields(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("sankey_v2")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "sankey_v2"})
        assert error is not None
        assert "source" in error.message
        assert "target" in error.message
        assert "metric" in error.message


class TestSankeyRecommendationCategory:
    """Sankey is categorized for chart recommendations and schema discovery."""

    def test_sankey_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("sankey_v2") == "sankey"

    def test_get_chart_type_schema_includes_sankey(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "sankey_v2" in _CHART_TYPE_ADAPTERS
