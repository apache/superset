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

from collections.abc import Callable
from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_utils import (
    map_config_to_form_data,
    map_gauge_config,
    MCP_DASHBOARD_TIME_FILTER_SUBJECT,
    merge_chart_form_data,
)
from superset.mcp_service.chart.preview_utils import (
    generate_gauge_ascii_preview,
    generate_gauge_vega_lite_preview,
)
from superset.mcp_service.chart.query_result import (
    metric_result_label,
    validate_gauge_query_result,
)
from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ChartError,
    GaugeChartConfig,
    GenerateChartRequest,
)
from superset.mcp_service.common.error_schemas import DatasetContext


class TestGaugeChartConfigSchema:
    """GaugeChartConfig schema validation."""

    def test_basic_gauge_config(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "progress", "aggregate": "AVG"},
        )
        assert config.metric.name == "progress"
        assert config.groupby is None  # groupby is optional (single dial)
        assert config.row_limit == 10  # frontend controlPanel default
        assert config.min_val is None
        assert config.max_val is None

    def test_gauge_missing_metric(self) -> None:
        with pytest.raises(ValidationError):
            GaugeChartConfig(chart_type="gauge", groupby=[{"name": "team"}])

    def test_gauge_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                bogus=1,
            )

    def test_gauge_groupby_rejects_saved_metric(self) -> None:
        """A groupby dial dimension is a category, not a metric."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                groupby=[{"name": "count", "saved_metric": True}],
            )

    def test_gauge_groupby_rejects_aggregate(self) -> None:
        """An aggregate makes a dial dimension metric-like; reject it."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                groupby=[{"name": "team", "aggregate": "SUM"}],
            )

    def test_gauge_rejects_inverted_bounds(self) -> None:
        """min_val >= max_val yields an inverted dial; reject it."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                min_val=100,
                max_val=0,
            )

    def test_gauge_row_limit_capped_at_ten(self) -> None:
        """The frontend limits gauge dials to 10."""
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                row_limit=25,
            )

    def test_chart_config_union_dispatches_gauge(self) -> None:
        config = TypeAdapter(ChartConfig).validate_python(
            {
                "chart_type": "gauge",
                "metric": {"name": "progress", "aggregate": "AVG"},
            }
        )
        assert isinstance(config, GaugeChartConfig)

    def test_public_union_rejects_native_viz_type_as_discriminator(self) -> None:
        with pytest.raises(ValidationError):
            TypeAdapter(ChartConfig).validate_python(
                {
                    "chart_type": "gauge_chart",
                    "metric": {"name": "progress", "aggregate": "AVG"},
                }
            )

    def test_request_aliases_native_gauge_form_data(self) -> None:
        request = GenerateChartRequest.model_validate(
            {
                "datasource_id": 7,
                "config": {
                    "viz_type": "gauge_chart",
                    "metric": "saved_progress",
                    "groupby": ["team"],
                },
            }
        )
        assert request.dataset_id == 7
        assert request.config.chart_type == "gauge"
        assert request.config.metric.saved_metric is True

    def test_native_form_data_full_control_surface_round_trips(self) -> None:
        native = {
            "viz_type": "gauge_chart",
            "datasource": "7__table",
            "slice_id": 11,
            "metric": {
                "expressionType": "SQL",
                "sqlExpression": "AVG(progress)",
                "label": "SLA",
            },
            "groupby": ["team", {"name": "region"}],
            "sort_by_metric": False,
            "row_limit": 5,
            "min_val": 0,
            "max_val": 100,
            "color_scheme": "lyftColors",
            "font_size": 18,
            "number_format": ",.1f",
            "currency_format": {"symbol": "%", "symbolPosition": "suffix"},
            "value_formatter": "Progress: {value}",
            "start_angle": 180,
            "end_angle": 0,
            "show_pointer": False,
            "animation": False,
            "show_axis_tick": True,
            "show_split_line": True,
            "split_number": 8,
            "show_progress": False,
            "overlap": False,
            "round_cap": True,
            "intervals": "50,80,100",
            "interval_color_indices": "1,3,6",
            "time_range": "Last week",
            "granularity_sqla": "event_time",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "country",
                    "operator": "==",
                    "comparator": "US",
                }
            ],
        }
        config = GaugeChartConfig.model_validate(native)
        mapped = map_gauge_config(config)
        for field in (
            "groupby",
            "sort_by_metric",
            "row_limit",
            "min_val",
            "max_val",
            "color_scheme",
            "font_size",
            "number_format",
            "currency_format",
            "value_formatter",
            "start_angle",
            "end_angle",
            "show_pointer",
            "animation",
            "show_axis_tick",
            "show_split_line",
            "split_number",
            "show_progress",
            "overlap",
            "round_cap",
            "intervals",
            "interval_color_indices",
            "time_range",
            "granularity_sqla",
        ):
            expected = ["team", "region"] if field == "groupby" else native[field]
            assert mapped[field] == expected
        assert mapped["metric"]["sqlExpression"] == "AVG(progress)"
        assert mapped["adhoc_filters"][0]["operator"] == "=="

    @pytest.mark.parametrize(
        "metric",
        [
            {"name": "progress"},
            {"name": "progress", "aggregate": None},
        ],
    )
    def test_gauge_rejects_unaggregated_metric(self, metric: dict[str, Any]) -> None:
        with pytest.raises(ValidationError, match="metric must define"):
            GaugeChartConfig(chart_type="gauge", metric=metric)

    def test_gauge_rejects_duplicate_casefold_groupby(self) -> None:
        with pytest.raises(ValidationError, match="duplicates"):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                groupby=[{"name": "Team"}, {"name": "team"}],
            )

    @pytest.mark.parametrize(
        ("field", "value"),
        [("min_val", float("nan")), ("max_val", float("inf"))],
    )
    def test_gauge_rejects_nonfinite_bounds(self, field: str, value: float) -> None:
        with pytest.raises(ValidationError):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                **{field: value},
            )

    def test_gauge_rejects_misaligned_intervals(self) -> None:
        with pytest.raises(ValidationError, match="same length"):
            GaugeChartConfig(
                chart_type="gauge",
                metric={"name": "progress", "aggregate": "AVG"},
                intervals="50,100",
                interval_color_indices="1",
            )


class TestMapGaugeConfig:
    """form_data mapping must match the frontend Gauge buildQuery."""

    def test_basic_gauge_form_data(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "progress", "aggregate": "AVG"},
        )
        form_data = map_gauge_config(config)
        assert form_data["viz_type"] == "gauge_chart"
        assert form_data["groupby"] == []  # no dials -> single gauge
        assert form_data["metric"]["label"] == "AVG(progress)"
        assert form_data["row_limit"] == 10

    def test_gauge_form_data_with_dials_and_range(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
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
            chart_type="gauge",
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
                chart_type="gauge",
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
            chart_type="gauge",
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
            chart_type="gauge",
            metric={"name": "sla_attainment", "saved_metric": True},
        )
        assert map_gauge_config(config)["metric"] == "sla_attainment"


class TestGaugePluginRegistry:
    """Plugin registration and viz-type resolution."""

    def test_gauge_plugin_registered(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("gauge")
        assert plugin is not None
        assert plugin.resolve_viz_type(None) == "gauge_chart"

    def test_display_name_resolves(self) -> None:
        from superset.mcp_service.chart.registry import display_name_for_viz_type

        assert display_name_for_viz_type("gauge_chart") == "Gauge Chart"

    def test_pre_validate_missing_metric(self) -> None:
        from superset.mcp_service.chart import registry

        plugin = registry.get("gauge")
        assert plugin is not None
        error = plugin.pre_validate({"chart_type": "gauge"})
        assert error is not None
        assert "metric" in error.message

    def test_pre_validate_passes_without_groupby(self) -> None:
        """groupby is optional; metric alone is a valid gauge."""
        from superset.mcp_service.chart import registry

        plugin = registry.get("gauge")
        assert plugin is not None
        assert plugin.pre_validate({"chart_type": "gauge", "metric": {}}) is None


class TestGaugeRecommendationCategory:
    """Gauge is categorized for chart recommendations and schema discovery."""

    def test_gauge_in_recommendation_category_map(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_data import _VIZ_CATEGORY

        assert _VIZ_CATEGORY.get("gauge_chart") == "gauge"

    def test_get_chart_type_schema_includes_gauge(self) -> None:
        from superset.mcp_service.chart.tool.get_chart_type_schema import (
            _CHART_TYPE_ADAPTERS,
        )

        assert "gauge" in _CHART_TYPE_ADAPTERS

    def test_chart_config_resource_uses_public_gauge_identity(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from unittest.mock import Mock

        from superset.mcp_service.chart.resources.chart_configs import (
            get_chart_configs_resource,
        )
        from superset.utils import json

        monkeypatch.setattr(
            "superset.mcp_service.auth.get_user_from_request",
            lambda: Mock(id=1, username="admin"),
        )
        resource = json.loads(get_chart_configs_resource())
        example = resource["gauge_configs"]["attainment_gauge"]["config"]
        assert example["chart_type"] == "gauge"
        assert "gauge_charts" in resource["best_practices"]


class TestGaugeUpdateRoundTrip:
    """Gauge updates preserve omissions but honor explicit clears."""

    @staticmethod
    def existing_form_data() -> dict[str, Any]:
        return {
            "viz_type": "gauge_chart",
            "datasource": "1__table",
            "metric": "saved_progress",
            "groupby": ["team"],
            "row_limit": 4,
            "sort_by_metric": False,
            "min_val": 0,
            "max_val": 100,
            "font_size": 19,
            "number_format": ",.1f",
            "currency_format": {"symbol": "%", "symbolPosition": "suffix"},
            "value_formatter": "{value} complete",
            "show_pointer": False,
            "show_progress": False,
            "intervals": "50,100",
            "interval_color_indices": "2,4",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "country",
                    "operator": "==",
                    "comparator": "US",
                }
            ],
        }

    def test_same_viz_omissions_preserve_native_controls(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "progress", "aggregate": "AVG"},
        )
        merged = merge_chart_form_data(
            self.existing_form_data(), map_gauge_config(config), config
        )
        assert merged["metric"]["label"] == "AVG(progress)"
        assert merged["groupby"] == ["team"]
        assert merged["row_limit"] == 4
        assert merged["font_size"] == 19
        assert merged["currency_format"]["symbol"] == "%"
        assert merged["adhoc_filters"][0]["subject"] == "country"

    def test_explicit_clears_clear_optional_controls(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "progress", "aggregate": "AVG"},
            groupby=[],
            filters=[],
            color_scheme=None,
            currency_format=None,
            time_range=None,
            granularity_sqla=None,
            intervals="",
            interval_color_indices="",
        )
        merged = merge_chart_form_data(
            self.existing_form_data(), map_gauge_config(config), config
        )
        assert merged["groupby"] == []
        assert "adhoc_filters" not in merged
        assert "color_scheme" not in merged
        assert "currency_format" not in merged
        assert merged["intervals"] == ""

    def test_dataset_rebind_scrubs_roles_and_preserves_presentation(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "new_progress", "aggregate": "AVG"},
        )
        merged = merge_chart_form_data(
            self.existing_form_data(),
            map_gauge_config(config),
            config,
            dataset_rebind=True,
        )
        assert merged["metric"]["label"] == "AVG(new_progress)"
        assert "groupby" not in merged
        assert "adhoc_filters" not in merged
        assert merged["font_size"] == 19
        assert merged["number_format"] == ",.1f"

    def test_filter_clear_keeps_explicit_temporal_binding(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "progress", "aggregate": "AVG"},
            filters=[],
            temporal_column="event_time",
        )
        mapped = map_config_to_form_data(config)
        merged = merge_chart_form_data(self.existing_form_data(), mapped, config)
        assert merged[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "event_time"
        assert merged["adhoc_filters"] == [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "event_time",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            }
        ]

    def test_cross_viz_does_not_inherit_gauge_controls(self) -> None:
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "progress", "aggregate": "AVG"},
        )
        existing = {**self.existing_form_data(), "viz_type": "pie", "donut": True}
        merged = merge_chart_form_data(existing, map_gauge_config(config), config)
        assert "donut" not in merged
        assert merged["viz_type"] == "gauge_chart"


class TestGaugeResultAndPreview:
    """Gauge data and previews share exact frontend metric-label semantics."""

    @staticmethod
    def form_data() -> dict[str, Any]:
        return {
            "viz_type": "gauge_chart",
            "metric": {
                "expressionType": "SIMPLE",
                "aggregate": "AVG",
                "column": {"column_name": "progress"},
                "label": "AVG(progress)",
            },
            "groupby": ["team"],
            "min_val": 0,
            "max_val": 100,
            "number_format": ",.1f",
            "value_formatter": "{value} complete",
            "intervals": "50,100",
            "interval_color_indices": "1,4",
        }

    @pytest.mark.parametrize(
        ("metric", "expected"),
        [
            ("saved_progress", "saved_progress"),
            (
                {
                    "expressionType": "SIMPLE",
                    "aggregate": "AVG",
                    "column": {"columnName": "progress"},
                    "label": None,
                },
                "AVG(progress)",
            ),
            (
                {
                    "expressionType": "SQL",
                    "sqlExpression": "AVG(progress)",
                    "label": "SLA",
                },
                "SLA",
            ),
        ],
    )
    def test_metric_result_aliases(self, metric: object, expected: str) -> None:
        assert metric_result_label(metric) == expected

    @pytest.mark.parametrize("bad_value", ["12", True, float("nan"), float("inf")])
    def test_rejects_non_numeric_or_nonfinite_results(self, bad_value: object) -> None:
        failure = validate_gauge_query_result(
            {"queries": [{"data": [{"AVG(progress)": bad_value}]}]},
            self.form_data(),
        )
        assert isinstance(failure, ChartError)

    def test_rejects_errors_and_missing_metric_alias(self) -> None:
        query_error = validate_gauge_query_result(
            {"queries": [{"error": "database exploded", "data": []}]},
            self.form_data(),
        )
        assert isinstance(query_error, ChartError)
        assert "database exploded" in query_error.error
        missing = validate_gauge_query_result(
            {"queries": [{"data": [{"wrong": 12}]}]}, self.form_data()
        )
        assert isinstance(missing, ChartError)
        assert "missing metric output" in missing.error

    def test_ascii_preview_is_gauge_faithful_and_formatted(self) -> None:
        preview = generate_gauge_ascii_preview(
            [{"team": "Blue", "AVG(progress)": 67.25}], self.form_data()
        )
        assert isinstance(preview, str)
        assert "Gauge Chart" in preview
        assert "Range: 0 to 100" in preview
        assert "Intervals: 50, 100" in preview
        assert "Blue" in preview
        assert "67.3 complete" in preview

    def test_vega_preview_uses_radial_layers_and_controls(self) -> None:
        form_data = {
            **self.form_data(),
            "show_progress": False,
            "show_pointer": True,
            "start_angle": 180,
            "end_angle": 0,
        }
        preview = generate_gauge_vega_lite_preview(
            [{"team": "Blue", "AVG(progress)": 67.25}], form_data
        )
        assert not isinstance(preview, ChartError)
        spec = preview.specification
        assert spec["usermeta"]["viz_type"] == "gauge_chart"
        assert spec["columns"] == 1
        marks = [layer["mark"]["type"] for layer in spec["spec"]["layer"]]
        assert marks.count("arc") == 2  # two colored interval bands, no progress
        assert "rule" in marks  # pointer
        assert "text" in marks

    def test_empty_preview_is_safe(self) -> None:
        ascii_preview = generate_gauge_ascii_preview([], self.form_data())
        assert isinstance(ascii_preview, str)
        assert "No data available" in ascii_preview
        vega_preview = generate_gauge_vega_lite_preview([], self.form_data())
        assert not isinstance(vega_preview, ChartError)
        assert vega_preview.specification["data"]["values"] == []


class TestGaugeDatasetValidation:
    """Dataset resolution is exact-first and never guesses on collisions."""

    @staticmethod
    def context() -> DatasetContext:
        return DatasetContext(
            id=1,
            table_name="metrics",
            schema="public",
            database_name="db",
            available_columns=[
                {"name": "Score", "type": "DOUBLE", "is_numeric": True},
                {"name": "score", "type": "VARCHAR", "is_numeric": False},
                {"name": "Team", "type": "VARCHAR", "is_numeric": False},
            ],
            available_metrics=[
                {"name": "SLA", "expression": "AVG(Score)"},
                {"name": "sla", "expression": "AVG(Score)"},
            ],
        )

    def test_exact_case_wins_and_unique_casefold_normalizes(self) -> None:
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        context = self.context()
        assert DatasetValidator.get_canonical_column_name("Score", context) == "Score"
        assert DatasetValidator.get_canonical_column_name("team", context) == "Team"

    def test_ambiguous_nonexact_column_and_metric_are_rejected(self) -> None:
        from superset.mcp_service.chart.validation.dataset_validator import (
            AmbiguousDatasetReferenceError,
            DatasetValidator,
        )

        context = self.context()
        with pytest.raises(AmbiguousDatasetReferenceError):
            DatasetValidator.get_canonical_column_name("SCORE", context)
        with pytest.raises(AmbiguousDatasetReferenceError):
            DatasetValidator.get_canonical_metric_name("sLa", context)

    def test_dataset_validation_surfaces_ambiguity(self) -> None:
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "SCORE", "aggregate": "AVG"},
        )
        valid, error = DatasetValidator.validate_against_dataset(
            config, 1, self.context()
        )
        assert valid is False
        assert error is not None
        assert error.error_code == "AMBIGUOUS_DATASET_REFERENCE"

    def test_non_numeric_simple_metric_rejected_but_count_allowed(
        self, monkeypatch
    ) -> None:
        from superset.mcp_service.chart.plugins.gauge import GaugeChartPlugin
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        context = self.context()
        monkeypatch.setattr(
            DatasetValidator, "_get_dataset_context", lambda dataset_id: context
        )
        plugin = GaugeChartPlugin()
        config = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "Team", "aggregate": "AVG"},
        )
        error = plugin.post_map_validate(config, map_gauge_config(config), 1)
        assert error is not None
        assert error.error_code == "NON_NUMERIC_GAUGE_METRIC"
        count = GaugeChartConfig(
            chart_type="gauge",
            metric={"name": "Team", "aggregate": "COUNT"},
        )
        assert plugin.post_map_validate(count, map_gauge_config(count), 1) is None


@pytest.mark.parametrize("value", [5, -5, 75])
@pytest.mark.parametrize(
    "preview_fn",
    [
        generate_gauge_ascii_preview,
        generate_gauge_vega_lite_preview,
    ],
)
def test_gauge_auto_bounds_accept_stable_intervals(
    value: int,
    preview_fn: Callable[..., Any],
) -> None:
    """Data-derived bounds must not invalidate stable configured thresholds."""
    result = preview_fn(
        [{"score": value}],
        {
            "metric": "score",
            "intervals": "30,70,100",
        },
    )
    assert not isinstance(result, ChartError)


@pytest.mark.parametrize("bounds", [{"min_val": 40}, {"max_val": 90}])
def test_gauge_explicit_bounds_still_reject_outside_intervals(
    bounds: dict[str, int],
) -> None:
    """Only explicitly configured bounds constrain threshold validation."""
    result = generate_gauge_ascii_preview(
        [{"score": 5}],
        {
            "metric": "score",
            "intervals": "30,70,100",
            **bounds,
        },
    )
    assert isinstance(result, ChartError)


@pytest.mark.parametrize("angles", [(225, -45), (0, 180), (180, 0)])
def test_gauge_vega_bands_span_adjacent_thresholds(angles: tuple[int, int]) -> None:
    """Every background arc has explicit adjacent endpoints without stacking."""
    result = generate_gauge_vega_lite_preview(
        [{"score": 5}],
        {
            "metric": "score",
            "min_val": 0,
            "max_val": 100,
            "intervals": "30,70,100",
            "show_progress": False,
            "start_angle": angles[0],
            "end_angle": angles[1],
        },
    )
    assert not isinstance(result, ChartError)
    arcs = [
        layer["encoding"]
        for layer in result.specification["layer"]
        if layer["mark"]["type"] == "arc"
    ]
    assert [(arc["theta"]["datum"], arc["theta2"]["datum"]) for arc in arcs] == [
        (0, 0.3),
        (0.3, 0.7),
        (0.7, 1),
    ]
    assert all(arc["theta"]["stack"] is None for arc in arcs)


def test_gauge_vega_clips_intervals_to_automatic_range() -> None:
    """Off-dial bands are clipped rather than overlapping or rejecting data."""
    result = generate_gauge_vega_lite_preview(
        [{"score": 5}],
        {
            "metric": "score",
            "intervals": "3,7,100",
            "show_progress": False,
        },
    )
    assert not isinstance(result, ChartError)
    arcs = [
        layer["encoding"]
        for layer in result.specification["layer"]
        if layer["mark"]["type"] == "arc"
    ]
    assert [(arc["theta"]["datum"], arc["theta2"]["datum"]) for arc in arcs] == [
        (0, 0.3),
        (0.3, 0.7),
        (0.7, 1),
    ]


@pytest.mark.parametrize("comparator", [None, 123])
def test_gauge_native_temporal_range_requires_comparator(comparator: Any) -> None:
    """Native filters cannot silently discard a missing temporal restriction."""
    with pytest.raises(ValidationError, match="requires a temporal comparator"):
        GaugeChartConfig.model_validate(
            {
                "chart_type": "gauge",
                "metric": "score",
                "time_range": "Last week",
                "adhoc_filters": [
                    {
                        "subject": "event_time",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": comparator,
                    }
                ],
            }
        )


@pytest.mark.parametrize("temporal_column", [None, "other_time"])
@pytest.mark.parametrize("comparator", ["No filter", "Last month"])
def test_gauge_temporal_rebind_preserves_user_ranges(
    temporal_column: str | None,
    comparator: str,
) -> None:
    """A stale provenance subject does not make an edited range mapper-owned."""
    original_filter = {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "event_time",
        "operator": "TEMPORAL_RANGE",
        "comparator": comparator,
    }
    user_filter = {**original_filter, "comparator": "Last week"}
    existing = {
        "viz_type": "gauge_chart",
        "metric": "score",
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "event_time",
        "adhoc_filters": [original_filter, user_filter],
    }
    config = GaugeChartConfig(
        chart_type="gauge",
        metric={"name": "score", "saved_metric": True},
        temporal_column=temporal_column,
    )
    mapped = map_config_to_form_data(config)
    merged = merge_chart_form_data(existing, mapped, config)
    expected = (
        [user_filter] if comparator == "No filter" else [original_filter, user_filter]
    )
    if temporal_column:
        expected += mapped["adhoc_filters"]
    assert merged["adhoc_filters"] == expected
    assert existing["adhoc_filters"] == [original_filter, user_filter]


@pytest.mark.parametrize(
    "renderer", [generate_gauge_ascii_preview, generate_gauge_vega_lite_preview]
)
def test_gauge_all_zero_auto_range(renderer: Callable[..., Any]) -> None:
    """Zero-valued results remain renderable without weakening explicit bounds."""
    result = renderer([{"score": 0}], {"viz_type": "gauge_chart", "metric": "score"})
    assert not isinstance(result, ChartError)
    if isinstance(result, str):
        assert "Range: 0 to 1" in result
    else:
        assert result.specification["usermeta"]["min_val"] == 0
        assert result.specification["usermeta"]["max_val"] == 1
    for bounds in ({"min_val": 0, "max_val": 0}, {"max_val": 0}):
        invalid = renderer(
            [{"score": 0}], {"viz_type": "gauge_chart", "metric": "score", **bounds}
        )
        assert isinstance(invalid, ChartError)
        assert invalid.error_type == "InvalidGaugeRange"


@pytest.mark.parametrize("viz_type", [None, "table"])
@pytest.mark.parametrize(
    "renderer", [generate_gauge_ascii_preview, generate_gauge_vega_lite_preview]
)
def test_gauge_renderer_always_validates(
    viz_type: str | None, renderer: Callable[..., Any]
) -> None:
    """Direct Gauge rendering validates regardless of the caller's discriminator."""
    for data, metric, error in (
        ([{"score": "bad"}], "score", "NonNumericGaugeMetric"),
        ({}, "score", "InvalidGaugeResult"),
        ([{}], None, "InvalidGaugeFormData"),
    ):
        result = renderer(data, {"viz_type": viz_type, "metric": metric})
        assert isinstance(result, ChartError)
        assert result.error_type == error


def test_gauge_metric_label_has_no_arbitrary_size_caps() -> None:
    """Query output labels follow getMetricLabel, not incidental metadata size."""
    from superset.utils.core import get_metric_name

    metrics: list[Any] = [
        {"expressionType": "SQL", "sqlExpression": "x + " * 600 + "1"},
        {
            "expressionType": "SIMPLE",
            "aggregate": "AVG",
            "column": {"column_name": "score"},
            **{f"metadata_{i}": i for i in range(30)},
        },
        "saved_score",
    ]
    for metric in metrics:
        label = get_metric_name(metric)
        assert metric_result_label(metric) == label
        assert (
            validate_gauge_query_result(
                {"queries": [{"data": [{label: 42}]}]},
                {"viz_type": "gauge_chart", "metric": metric},
            )
            is None
        )


@pytest.mark.parametrize(
    "second,top_level",
    [
        ({"subject": "other_time"}, {}),
        ({"comparator": "Last month"}, {}),
        (None, {"time_range": "Last month"}),
        (None, {"granularity_sqla": "other_time"}),
    ],
)
def test_gauge_native_temporal_conflicts_reject(
    second: dict[str, str] | None, top_level: dict[str, str]
) -> None:
    """Native restrictions cannot disappear during typed normalization."""
    temporal = {
        "expressionType": "SIMPLE",
        "clause": "WHERE",
        "subject": "event_time",
        "operator": "TEMPORAL_RANGE",
        "comparator": "Last week",
    }
    with pytest.raises(ValidationError, match="conflicts with another temporal range"):
        GaugeChartConfig.model_validate(
            {
                "viz_type": "gauge_chart",
                "metric": "score",
                "adhoc_filters": [temporal, {**temporal, **second}]
                if second
                else [temporal],
                **top_level,
            }
        )


@pytest.mark.parametrize(
    "operator",
    [
        "NOT ILIKE",
        "IS TRUE",
        "IS FALSE",
        "CONTAINS_ANY",
        "CONTAINS_ALL",
        "IS_EMPTY",
        "IS_NOT_EMPTY",
        "LENGTH_EQUALS",
    ],
)
def test_gauge_unsupported_native_operator_has_indexed_error(operator: str) -> None:
    """Unsupported native operators are rejected at the adaptation boundary."""
    with pytest.raises(
        ValidationError, match=r"adhoc_filters\[0\] uses unsupported operator"
    ):
        GaugeChartConfig.model_validate(
            {
                "viz_type": "gauge_chart",
                "metric": "score",
                "adhoc_filters": [
                    {"subject": "team", "operator": operator, "comparator": "a"}
                ],
            }
        )


@pytest.mark.parametrize("groupby", [[], ["team"]])
@pytest.mark.parametrize("show_pointer", [True, False])
def test_gauge_pointer_uses_cartesian_endpoints(
    groupby: list[str], show_pointer: bool
) -> None:
    """Vega-Lite rules need Cartesian endpoints even on a polar dial."""
    preview = generate_gauge_vega_lite_preview(
        [{"score": 50, "team": "Blue"}],
        {
            "metric": "score",
            "groupby": groupby,
            "show_pointer": show_pointer,
            "min_val": 0,
            "max_val": 100,
        },
    )
    assert not isinstance(preview, ChartError)
    specification = preview.specification
    unit = specification["spec"] if groupby else specification
    if groupby:
        assert unit["width"] == 200
        assert unit["height"] == 300
        assert "width" not in specification
    rules = [layer for layer in unit["layer"] if layer["mark"]["type"] == "rule"]
    assert len(rules) == int(show_pointer)
    if show_pointer:
        encoding = rules[0]["encoding"]
        assert set(encoding) == {"x", "y", "x2", "y2", "tooltip"}
        if groupby:
            # Numeric child-scoped origins must not depend on outer Vega signals.
            assert float(encoding["x"]["value"]["expr"]) == unit["width"] / 2
            assert float(encoding["y"]["value"]["expr"]) == unit["height"] / 2
        else:
            assert encoding["x"]["value"]["expr"] == "width / 2"
            assert encoding["y"]["value"]["expr"] == "height / 2"
        arc = next(
            layer["mark"] for layer in unit["layer"] if layer["mark"]["type"] == "arc"
        )
        radius = (arc["innerRadius"] + arc["outerRadius"]) / 2
        assert f"+ {radius} * sin" in encoding["x2"]["value"]["expr"]
        assert f"- {radius} * cos" in encoding["y2"]["value"]["expr"]
        assert "sin(datum.__mcp_gauge_angle)" in encoding["x2"]["value"]["expr"]
        assert "cos(datum.__mcp_gauge_angle)" in encoding["y2"]["value"]["expr"]


@pytest.mark.parametrize(
    "renderer", [generate_gauge_ascii_preview, generate_gauge_vega_lite_preview]
)
def test_gauge_mixed_finite_dials_survive(renderer: Callable[..., Any]) -> None:
    """Empty aggregates do not discard other groups, in either preview format."""
    rows = [
        {"team": str(i), "score": value}
        for i, value in enumerate(
            [None, float("nan"), float("inf"), -float("inf"), "bad", True, 0, 42]
        )
    ]
    result = renderer(rows, {"metric": "score", "groupby": ["team"]})
    assert not isinstance(result, ChartError)
    if renderer == generate_gauge_vega_lite_preview:
        assert [r["score"] for r in result.specification["data"]["values"]] == [0, 42]
    else:
        assert "42" in result
        assert "nan" not in result.lower()
    assert len(rows) == 8


@pytest.mark.parametrize("temporal_column", ["omitted", "event_time", None])
def test_gauge_duplicate_generated_binding_self_heals(
    temporal_column: str | None,
) -> None:
    """Updating a legacy Gauge removes redundant neutral filters, not user ranges."""
    binding = {
        "expressionType": "SIMPLE",
        "clause": "WHERE",
        "subject": "event_time",
        "operator": "TEMPORAL_RANGE",
        "comparator": "No filter",
    }
    config = GaugeChartConfig.model_validate(
        {
            "metric": {"name": "score", "saved_metric": True},
            **(
                {"temporal_column": temporal_column}
                if temporal_column != "omitted"
                else {}
            ),
        }
    )
    existing = {
        "viz_type": "gauge_chart",
        "metric": "score",
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "event_time",
        "adhoc_filters": [
            binding,
            dict(binding),
            {**binding, "comparator": "Last week"},
        ],
    }
    mapped = map_config_to_form_data(config)
    merged = merge_chart_form_data(existing, mapped, config)
    assert (
        len([f for f in merged["adhoc_filters"] if f["comparator"] == "No filter"]) <= 1
    )
    assert [f for f in merged["adhoc_filters"] if f["comparator"] == "Last week"] == [
        {**binding, "comparator": "Last week"}
    ]


@pytest.mark.parametrize("top_range", ["Last week", "No filter", None])
def test_gauge_native_no_filter_is_a_dashboard_binding(top_range: str | None) -> None:
    """The neutral native sentinel must not conflict with a real time restriction."""
    config = GaugeChartConfig.model_validate(
        {
            "metric": "score",
            "time_range": top_range,
            "granularity_sqla": "event_time",
            "adhoc_filters": [
                {
                    "subject": "event_time",
                    "operator": "TEMPORAL_RANGE",
                    "comparator": "No filter",
                },
                {
                    "subject": "event_time",
                    "operator": "TEMPORAL_RANGE",
                    "comparator": "Last week",
                },
            ],
        }
    )
    assert config.time_range == "Last week"
    assert config.temporal_column == "event_time"
    mapped = map_config_to_form_data(config)
    assert mapped["time_range"] == "Last week"
    assert mapped["adhoc_filters"][0]["comparator"] == "No filter"


def test_gauge_finite_normalization_does_not_mutate_cached_result() -> None:
    """Filtering dials copies the envelope and updates the returned row count."""
    from superset.mcp_service.chart.query_result import normalize_gauge_query_result

    rows = [{"score": None}, {"score": 0}, {"score": 42}, {"score": float("inf")}]
    original = {"queries": [{"data": rows, "rowcount": 4, "colnames": ["score"]}]}
    normalized = normalize_gauge_query_result(
        original, {"viz_type": "gauge_chart", "metric": "score"}
    )
    assert not isinstance(normalized, ChartError)
    assert normalized["queries"][0]["data"] == [{"score": 0}, {"score": 42}]
    assert normalized["queries"][0]["rowcount"] == 2
    assert normalized["queries"][0]["colnames"] == ["score"]
    assert original["queries"][0]["data"] is rows
    assert original["queries"][0]["rowcount"] == 4
    assert len(rows) == 4


@pytest.mark.parametrize("top_range", ["", "   ", "\t", "No filter", " No filter "])
@pytest.mark.parametrize("comparator", ["Last week", "", "   ", "No filter"])
def test_gauge_native_time_sentinels_are_neutral(
    top_range: str, comparator: str
) -> None:
    """Explicit blank sentinels are neutral; absent comparators still reject."""
    config = GaugeChartConfig.model_validate(
        {
            "metric": "score",
            "time_range": top_range,
            "adhoc_filters": [
                {
                    "subject": "event_time",
                    "operator": "TEMPORAL_RANGE",
                    "comparator": comparator,
                }
            ],
        }
    )
    if comparator == "Last week":
        assert config.time_range == "Last week"
        assert config.granularity_sqla == "event_time"
    else:
        assert config.temporal_column == "event_time"
        assert config.time_range in (None, "No filter")
