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

"""Product-path coverage for typed MCP Sunburst support."""

from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from pydantic import ValidationError

from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
)
from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
)
from superset.mcp_service.chart.chart_utils import map_config_to_form_data
from superset.mcp_service.chart.compile import _compile_chart
from superset.mcp_service.chart.preview_utils import (
    _generate_ascii_preview_from_data,
    _generate_table_preview_from_data,
    _generate_vega_lite_preview_from_data,
    generate_preview_from_form_data,
)
from superset.mcp_service.chart.registry import display_name_for_viz_type, get_registry
from superset.mcp_service.chart.schemas import (
    ChartError,
    ColumnRef,
    GenerateChartRequest,
    GetChartPreviewRequest,
    SunburstChartConfig,
    TableChartConfig,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
)
from superset.mcp_service.chart.sunburst import validate_sunburst_result_data
from superset.mcp_service.chart.tool.generate_chart import generate_chart
from superset.mcp_service.chart.tool.get_chart_preview import (
    ASCIIPreviewStrategy,
    VegaLitePreviewStrategy,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
    update_chart,
)
from superset.mcp_service.chart.tool.update_chart_preview import update_chart_preview
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.chart.validation.runtime.chart_type_suggester import (
    ChartTypeSuggester,
)
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.utils import json


def _config(**overrides: object) -> SunburstChartConfig:
    payload: dict[str, object] = {
        "chart_type": "sunburst",
        "hierarchy": [{"name": "region"}, {"name": "country"}],
        "metric": {"name": "sales", "aggregate": "SUM", "label": "Sales"},
    }
    payload.update(overrides)
    return SunburstChartConfig.model_validate(payload)


def _dataset() -> Mock:
    """Return dataset metadata sufficient for normalization product paths."""
    database = Mock(database_name="main", db_engine_spec=None)
    columns = []
    for name, type_, is_numeric in (
        ("Region", "VARCHAR", False),
        ("Country", "VARCHAR", False),
        ("Sales", "DOUBLE", True),
        ("Profit", "DOUBLE", True),
        ("Status", "VARCHAR", False),
        ("OrderDate", "TIMESTAMP", False),
    ):
        columns.append(
            Mock(
                column_name=name,
                type=type_,
                is_temporal=name == "OrderDate",
                is_dttm=name == "OrderDate",
                is_numeric=is_numeric,
            )
        )
    return Mock(
        id=7,
        table_name="sales",
        schema="analytics",
        database=database,
        columns=columns,
        metrics=[
            Mock(metric_name="SavedSales", expression="SUM(sales)", description=None)
        ],
    )


def test_schema_uses_typed_mcp_and_frontend_tags() -> None:
    config = _config()
    assert config.chart_type == "sunburst"
    assert config.viz_type == "sunburst_v2"
    assert get_registry().get("sunburst") is not None
    assert display_name_for_viz_type("sunburst_v2") == "Sunburst Chart"


def test_registering_sunburst_keeps_all_core_chart_plugins() -> None:
    assert {
        "xy",
        "table",
        "pie",
        "pivot_table",
        "mixed_timeseries",
        "handlebars",
        "big_number",
        "histogram",
        "box_plot",
        "waterfall",
        "sunburst",
    } <= set(get_registry().all_types())


def test_generate_request_accepts_native_viz_type_alias() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "count",
            },
        }
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert [column.name for column in request.config.hierarchy] == [
        "region",
        "country",
    ]
    assert request.config.metric.saved_metric is True


def test_native_simple_sql_and_saved_metrics_round_trip() -> None:
    config = SunburstChartConfig.model_validate(
        {
            "chart_type": "sunburst",
            "viz_type": "sunburst_v2",
            "columns": ["region", "country"],
            "metric": {
                "expressionType": "SIMPLE",
                "column": {"column_name": "sales", "type": "DOUBLE"},
                "aggregate": "SUM",
                "hasCustomLabel": True,
                "label": "Sales",
            },
            "secondary_metric": {
                "expressionType": "SQL",
                "sqlExpression": "SUM(profit)",
                "hasCustomLabel": True,
                "label": "Profit",
            },
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "status",
                    "operator": "==",
                    "comparator": "active",
                }
            ],
        }
    )
    assert config.metric.name == "sales"
    assert config.metric.aggregate == "SUM"
    assert config.secondary_metric is not None
    assert config.secondary_metric.sql_expression == "SUM(profit)"
    assert config.filters is not None
    assert config.filters[0].op == "="

    round_trip = map_config_to_form_data(config)
    assert round_trip["viz_type"] == "sunburst_v2"
    assert round_trip["columns"] == ["region", "country"]
    assert round_trip["metric"]["expressionType"] == "SIMPLE"
    assert round_trip["secondary_metric"]["expressionType"] == "SQL"


def test_native_saved_form_data_ignores_stale_plugin_state_on_round_trip() -> None:
    config = SunburstChartConfig.model_validate(
        {
            "viz_type": "sunburst_v2",
            "columns": ["region", "country"],
            "groupby": [],
            "metric": "count",
            "since": "2025-01-01",
            "until": "2025-02-01",
            "annotation_layers": [],
            "compare_lag": "10",
            "plugin_only_ui_state": {"preserved_by_update_merge": True},
        }
    )

    assert config.metric.saved_metric is True
    assert config.time_range == "2025-01-01 : 2025-02-01"
    round_trip = map_config_to_form_data(config)
    assert round_trip["columns"] == ["region", "country"]
    assert round_trip["metric"] == "count"


def test_typed_input_still_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError, match="Unknown field 'show_lables'"):
        _config(show_lables=True)


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"hierarchy": [{"name": "Region"}, {"name": "region"}]}, "unique"),
        ({"metric": {"name": "sales"}}, "must define aggregate"),
        (
            {
                "secondary_metric": {
                    "name": "sales",
                    "aggregate": "SUM",
                    "label": "Sales",
                }
            },
            "Duplicate Sunburst query output label",
        ),
    ],
)
def test_role_and_output_constraints(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        _config(**overrides)


def test_mapper_covers_query_time_filter_limit_and_presentation_contract() -> None:
    config = _config(
        secondary_metric={"name": "profit", "aggregate": "SUM"},
        filters=[{"column": "status", "op": "=", "value": "active"}],
        temporal_column="order_date",
        time_range="Last year",
        time_grain="P1M",
        row_limit=321,
        sort_by_metric=False,
        color_scheme="supersetColors",
        linear_color_scheme="superset_seq_1",
        show_labels=True,
        show_labels_threshold=2.5,
        show_total=True,
        show_null_values=False,
        label_type="key_value",
        number_format="$,.2f",
        date_format="%Y-%m",
        currency_format={"symbol": "USD", "symbol_position": "prefix"},
    )

    form_data = map_config_to_form_data(config, dataset_id=None)
    assert form_data["viz_type"] == "sunburst_v2"
    assert form_data["columns"] == ["region", "country"]
    assert form_data["metric"]["column"] == {"column_name": "sales"}
    assert form_data["metric"]["label"] == "Sales"
    assert form_data["secondary_metric"]["column"] == {"column_name": "profit"}
    assert form_data["secondary_metric"]["label"] == "SUM(profit)"
    assert form_data["sort_by_metric"] is False
    assert form_data["row_limit"] == 321
    assert form_data["show_labels"] is True
    assert form_data["show_labels_threshold"] == 2.5
    assert form_data["show_total"] is True
    assert form_data["show_null_values"] is False
    assert form_data["label_type"] == "key_value"
    assert form_data["number_format"] == "$,.2f"
    assert form_data["date_format"] == "%Y-%m"
    assert form_data["color_scheme"] == "supersetColors"
    assert form_data["linear_color_scheme"] == "superset_seq_1"
    assert form_data["time_range"] == "Last year"
    assert form_data["time_grain_sqla"] == "P1M"
    assert form_data["granularity_sqla"] == "order_date"
    assert form_data["currency_format"] == {
        "symbol": "USD",
        "symbolPosition": "prefix",
    }
    assert form_data["adhoc_filters"][0] == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "status",
        "operator": "==",
        "comparator": "active",
    }
    assert form_data["adhoc_filters"][1]["subject"] == "order_date"
    assert form_data["adhoc_filters"][1]["operator"] == "TEMPORAL_RANGE"


def test_shared_query_builder_mirrors_frontend_build_query() -> None:
    form_data = map_config_to_form_data(
        _config(
            secondary_metric={"name": "profit", "aggregate": "SUM"},
            temporal_column="order_date",
            time_range="Last year",
            time_grain="P1M",
            row_limit=25,
            sort_by_metric=True,
        )
    )
    query = build_query_context_from_form_data(
        form_data,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]

    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [
        form_data["metric"],
        form_data["secondary_metric"],
    ]
    assert query["orderby"] == [[form_data["metric"], False]]
    assert query["granularity"] == "order_date"
    assert query["extras"]["time_grain_sqla"] == "P1M"
    assert query["time_range"] == "Last year"
    assert query["row_limit"] == 25


def test_get_chart_data_fallback_query_keeps_hierarchy_metrics_and_order() -> None:
    form_data = map_config_to_form_data(
        _config(
            secondary_metric={"name": "profit", "aggregate": "SUM"},
            sort_by_metric=True,
        )
    )
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(
            form_data,
            datasource_id=7,
            datasource_type="table",
        )[0]

    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [
        form_data["metric"],
        form_data["secondary_metric"],
    ]
    assert query["orderby"] == [[form_data["metric"], False]]


@pytest.mark.parametrize("sort_by_metric", [False, True])
def test_query_builders_have_matching_sunburst_ordering(
    sort_by_metric: bool,
) -> None:
    form_data = map_config_to_form_data(
        _config(sort_by_metric=sort_by_metric, row_limit=17)
    )
    common_query = build_query_context_from_form_data(
        form_data,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        chart_query = build_query_dicts_from_form_data(
            form_data,
            datasource_id=7,
            datasource_type="table",
        )[0]

    expected = [[form_data["metric"], False]] if sort_by_metric else []
    assert common_query["orderby"] == expected
    assert chart_query.get("orderby", []) == expected
    assert common_query["row_limit"] == chart_query["row_limit"] == 17


def test_compile_path_uses_chart_faithful_query() -> None:
    form_data = map_config_to_form_data(
        _config(
            secondary_metric={"name": "profit", "aggregate": "SUM"},
            sort_by_metric=True,
        )
    )
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": []}]}

    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    query = factory.create.call_args.kwargs["queries"][0]
    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [
        form_data["metric"],
        form_data["secondary_metric"],
    ]
    assert query["orderby"] == [[form_data["metric"], False]]
    assert query["row_limit"] == 2


@pytest.mark.parametrize(
    "metric, result_label",
    [
        (
            {"name": "sales", "aggregate": "SUM", "label": "Simple Sales"},
            "Simple Sales",
        ),
        ({"name": "SavedSales", "saved_metric": True}, "SavedSales"),
        ({"sql_expression": "SUM(sales)", "label": "SQL Sales"}, "SQL Sales"),
    ],
)
def test_compile_proves_numeric_metric_by_resolved_alias(
    metric: dict[str, object], result_label: str
) -> None:
    form_data = map_config_to_form_data(_config(metric=metric))
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "status": "success",
                "data": [
                    {"region": "A", "country": "B", result_label: 4.5},
                ],
            }
        ]
    }
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert result.row_count == 1


@pytest.mark.parametrize(
    "data",
    [
        [{"region": "A", "country": "B"}],
        [{"region": "A", "country": "B", "Sales": "four"}],
        [{"region": "A", "country": "B", "Sales": float("nan")}],
        [{"region": "A", "country": "B", "Sales": float("inf")}],
    ],
)
def test_compile_rejects_invalid_sunburst_metric_results(
    data: list[dict[str, object]],
) -> None:
    form_data = map_config_to_form_data(_config())
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": data}]}
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is False
    assert result.error_code == "INVALID_SUNBURST_RESULT"


def test_compile_allows_legitimate_empty_sunburst_result() -> None:
    form_data = map_config_to_form_data(_config())
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"status": "success", "data": []}]}
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert result.row_count == 0


def test_ascii_preview_keeps_hierarchy_and_both_metric_aliases() -> None:
    form_data = map_config_to_form_data(
        _config(secondary_metric={"name": "profit", "aggregate": "SUM"})
    )
    preview = _generate_ascii_preview_from_data(
        [
            {
                "region": "Americas",
                "country": "Brazil",
                "Sales": 120,
                "SUM(profit)": 18,
            }
        ],
        form_data,
    )

    assert "Americas > Brazil" in preview.ascii_content
    assert "Sales=120" in preview.ascii_content
    assert "SUM(profit)=18" in preview.ascii_content


@pytest.mark.parametrize(
    "metric, result_label",
    [
        ({"name": "sales", "aggregate": "SUM", "label": "Sales Alias"}, "Sales Alias"),
        ({"name": "SavedSales", "saved_metric": True}, "SavedSales"),
        ({"sql_expression": "SUM(sales)", "label": "SQL Sales"}, "SQL Sales"),
    ],
)
def test_result_validation_resolves_simple_saved_and_sql_aliases(
    metric: dict[str, object], result_label: str
) -> None:
    form_data = map_config_to_form_data(_config(metric=metric))
    roles, error = validate_sunburst_result_data(
        [{"region": "Americas", "country": "Brazil", result_label: 10.5}],
        form_data,
    )

    assert error is None
    assert roles is not None
    assert roles.primary_metric == result_label


@pytest.mark.parametrize(
    "bad_row, error_text",
    [
        ({"region": "A", "country": "B"}, "missing required"),
        ({"region": "A", "country": "B", "Sales": "12"}, "finite numeric"),
        ({"region": "A", "country": "B", "Sales": float("nan")}, "finite numeric"),
        ({"region": "A", "country": "B", "Sales": float("inf")}, "finite numeric"),
        ({"region": ["A"], "country": "B", "Sales": 12}, "malformed hierarchy"),
    ],
)
def test_result_validation_rejects_malformed_rows(
    bad_row: dict[str, object], error_text: str
) -> None:
    _, error = validate_sunburst_result_data(
        [
            {"region": "valid", "country": "valid", "Sales": 1},
            *[
                {"region": f"row-{index}", "country": "valid", "Sales": index}
                for index in range(2, 22)
            ],
            bad_row,
        ],
        map_config_to_form_data(_config()),
    )

    assert error is not None
    assert error_text in error.error
    assert "row 22" in error.error


def test_sunburst_table_is_validated_and_vega_is_explicitly_unsupported() -> None:
    form_data = map_config_to_form_data(_config())
    table = _generate_table_preview_from_data(
        [{"region": "A", "country": "B", "Sales": 3}], form_data
    )
    vega = _generate_vega_lite_preview_from_data(
        [{"region": "A", "country": "B", "Sales": 3}], form_data
    )

    assert not isinstance(table, ChartError)
    assert "region" in table.table_data
    assert isinstance(vega, ChartError)
    assert vega.error_type == "UnsupportedFormat"


@pytest.mark.parametrize(
    "data, expected, error_type",
    [
        ([], "No data available for sunburst chart", None),
        (["malformed"], None, "InvalidSunburstResult"),
    ],
)
def test_ascii_preview_handles_empty_and_malformed_results(
    data: list[object], expected: str | None, error_type: str | None
) -> None:
    form_data = map_config_to_form_data(_config())
    preview = _generate_ascii_preview_from_data(data, form_data)  # type: ignore[arg-type]
    if error_type:
        assert isinstance(preview, ChartError)
        assert preview.error_type == error_type
    else:
        assert not isinstance(preview, ChartError)
        assert preview.ascii_content == expected


def test_dataset_validation_and_casefold_canonicalization() -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "Region", "type": "VARCHAR", "is_temporal": False},
            {"name": "Country", "type": "VARCHAR", "is_temporal": False},
            {"name": "Sales", "type": "DOUBLE", "is_temporal": False},
            {"name": "Status", "type": "VARCHAR", "is_temporal": False},
        ],
        available_metrics=[
            {"name": "Profit", "expression": "SUM(profit)"},
        ],
    )
    config = _config(
        hierarchy=[{"name": "REGION"}, {"name": "country"}],
        metric={"name": "sales", "aggregate": "SUM"},
        secondary_metric={"name": "profit", "saved_metric": True},
        filters=[{"column": "status", "op": "=", "value": "active"}],
    )
    normalized = DatasetValidator.normalize_column_names(
        config, 7, dataset_context=context
    )
    assert [column.name for column in normalized.hierarchy] == ["Region", "Country"]
    assert normalized.metric.name == "Sales"
    assert normalized.secondary_metric is not None
    assert normalized.secondary_metric.name == "Profit"
    assert normalized.filters is not None
    assert normalized.filters[0].column == "Status"
    assert DatasetValidator.validate_against_dataset(
        normalized, 7, dataset_context=context
    ) == (True, None)


def test_exact_dataset_reference_wins_and_ambiguous_casefold_is_rejected() -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "Region", "type": "VARCHAR", "is_temporal": False},
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "Country", "type": "VARCHAR", "is_temporal": False},
            {"name": "Sales", "type": "DOUBLE", "is_numeric": True},
        ],
    )
    exact = _config(
        hierarchy=[{"name": "Region"}, {"name": "Country"}],
        metric={"name": "Sales", "aggregate": "SUM"},
    )
    ambiguous = _config(
        hierarchy=[{"name": "REGION"}, {"name": "Country"}],
        metric={"name": "Sales", "aggregate": "SUM"},
    )

    assert DatasetValidator.validate_against_dataset(
        exact, 7, dataset_context=context
    ) == (True, None)
    valid, error = DatasetValidator.validate_against_dataset(
        ambiguous, 7, dataset_context=context
    )
    assert valid is False
    assert error is not None
    assert error.error_code == "AMBIGUOUS_DATASET_REFERENCE"
    assert "'Region'" in error.details
    assert "'region'" in error.details


@pytest.mark.parametrize("aggregate", ["MIN", "MAX"])
def test_text_physical_metrics_are_rejected_for_sunburst(aggregate: str) -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "country", "type": "VARCHAR", "is_temporal": False},
            {"name": "category", "type": "VARCHAR", "is_temporal": False},
        ],
    )

    valid, error = DatasetValidator.validate_against_dataset(
        _config(metric={"name": "category", "aggregate": aggregate}),
        7,
        dataset_context=context,
    )

    assert valid is False
    assert error is not None
    assert error.error_code == "INVALID_AGGREGATION"


def test_count_of_text_is_a_numeric_sunburst_metric() -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "country", "type": "VARCHAR", "is_temporal": False},
            {"name": "category", "type": "VARCHAR", "is_temporal": False},
        ],
    )
    assert DatasetValidator.validate_against_dataset(
        _config(metric={"name": "category", "aggregate": "COUNT"}),
        7,
        dataset_context=context,
    ) == (True, None)


def test_schema_discovery_exposes_sunburst_example() -> None:
    result = _get_chart_type_schema_impl("sunburst")
    assert result["chart_type"] == "sunburst"
    assert result["schema"]["properties"]["viz_type"]["const"] == "sunburst_v2"
    assert result["examples"][0]["hierarchy"]


def test_recommendation_metadata_includes_sunburst_for_hierarchical_data() -> None:
    assert "hierarchical" in ChartTypeSuggester.get_chart_type_description("sunburst")
    is_appropriate, suggestion = ChartTypeSuggester.analyze_and_suggest(
        TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="country"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        ),
        dataset_id=7,
    )
    assert is_appropriate is False
    assert suggestion is not None
    assert "sunburst" in suggestion["recommended_types"]


def test_update_tool_preserves_omitted_state_and_honors_explicit_values() -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["old_region", "old_country"],
                "metric": "old_metric",
                "color_scheme": "savedScheme",
                "show_labels": True,
                "show_total": True,
                "show_null_values": True,
                "adhoc_filters": [
                    {
                        "expressionType": "SIMPLE",
                        "clause": "WHERE",
                        "subject": "status",
                        "operator": "==",
                        "comparator": "active",
                    }
                ],
                "plugin_only_ui_state": {"kept": True},
            }
        ),
    )
    config = _config(show_labels=False, secondary_metric=None)
    request = UpdateChartRequest(
        identifier=19,
        config=config,
        generate_preview=False,
    )

    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)

    assert isinstance(payload, dict)
    assert isinstance(preview, dict)
    persisted = json.loads(payload["params"])
    for form_data in (persisted, preview):
        assert form_data["columns"] == ["region", "country"]
        assert form_data["show_labels"] is False
        assert form_data["show_total"] is True
        assert form_data["color_scheme"] == "savedScheme"
        assert form_data["adhoc_filters"][0]["subject"] == "status"
        assert form_data["plugin_only_ui_state"] == {"kept": True}
        assert "secondary_metric" not in form_data


def test_update_tool_explicit_empty_filters_clear_saved_filters() -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region"],
                "metric": "count",
                "adhoc_filters": [{"subject": "status"}],
            }
        ),
    )
    config = _config(filters=[])
    request = UpdateChartRequest(identifier=19, config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert "adhoc_filters" not in json.loads(payload["params"])


@pytest.mark.parametrize(
    "overrides, expected_column, expected_grain",
    [
        ({}, "order_date", "P1M"),
        ({"temporal_column": None}, None, None),
        ({"time_grain": None}, "order_date", None),
        ({"time_grain": "P1Y"}, "order_date", "P1Y"),
        ({"temporal_column": "ship_date"}, "ship_date", "P1M"),
        (
            {"temporal_column": "ship_date", "time_grain": "P1W"},
            "ship_date",
            "P1W",
        ),
    ],
)
def test_temporal_pair_merges_atomically_for_cached_and_immediate_paths(
    overrides: dict[str, object],
    expected_column: str | None,
    expected_grain: str | None,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "SavedSales",
                "granularity_sqla": "order_date",
                "time_grain_sqla": "P1M",
            }
        ),
    )
    config = _config(**overrides)
    request = UpdateChartRequest(identifier=19, config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert isinstance(preview, dict)

    for state in (json.loads(payload["params"]), preview):
        assert state.get("granularity_sqla") == expected_column
        assert state.get("time_grain_sqla") == expected_grain


def test_update_chart_preview_product_path_preserves_cached_sunburst_state() -> None:
    config = _config(show_labels=False)
    request = UpdateChartPreviewRequest(
        form_data_key="saved-sunburst-key",
        dataset_id=7,
        config=config,
        generate_preview=False,
    )
    dataset = _dataset()
    cached_form_data = {
        "viz_type": "sunburst_v2",
        "columns": ["old_region", "old_country"],
        "metric": "count",
        "color_scheme": "savedScheme",
        "show_labels": True,
        "show_total": True,
        "adhoc_filters": [{"subject": "status"}],
        "plugin_only_ui_state": {"kept": True},
    }
    captured_form_data: dict[str, object] = {}

    def generate_link(
        dataset_id: int | str,
        form_data: dict[str, object],
        prefer_permalink: bool,
    ) -> str:
        assert dataset_id == 7
        assert prefer_permalink is False
        captured_form_data.update(form_data)
        return "http://localhost/explore/?form_data_key=new-sunburst-key"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value=cached_form_data,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            side_effect=generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert result["form_data_key"] == "new-sunburst-key"
    assert result["chart"]["viz_type"] == "sunburst_v2"
    assert captured_form_data["columns"] == ["Region", "Country"]
    metric = captured_form_data["metric"]
    filters = captured_form_data["adhoc_filters"]
    assert isinstance(metric, dict)
    assert isinstance(filters, list)
    assert metric["column"] == {"column_name": "Sales"}
    assert filters[0]["subject"] == "Status"
    assert captured_form_data["show_labels"] is False
    assert captured_form_data["show_total"] is True
    assert captured_form_data["color_scheme"] == "savedScheme"
    assert captured_form_data["plugin_only_ui_state"] == {"kept": True}


def test_unsaved_preview_validates_query_envelopes_and_all_rows() -> None:
    form_data = map_config_to_form_data(_config())
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "status": "success",
                "data": [
                    {"region": "A", "country": "B", "Sales": 1},
                    {"region": "C", "country": "D", "Sales": "bad"},
                ],
            }
        ]
    }
    with (
        patch("superset.extensions.db.session.get", return_value=Mock(id=7)),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = generate_preview_from_form_data(form_data, 7, "ascii")

    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidSunburstMetric"

    command.run.return_value = {
        "status": "failed",
        "message": "warehouse timeout",
        "queries": [],
    }
    with (
        patch("superset.extensions.db.session.get", return_value=Mock(id=7)),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        failure = generate_preview_from_form_data(form_data, 7, "table")

    assert isinstance(failure, ChartError)
    assert failure.error_type == "QueryError"
    assert "warehouse timeout" in failure.error


def test_saved_preview_is_sunburst_faithful_and_vega_is_unsupported() -> None:
    form_data = map_config_to_form_data(
        _config(metric={"sql_expression": "SUM(sales)", "label": "SQL Sales"})
    )
    chart = Mock(
        id=11,
        slice_name="Hierarchy",
        viz_type="sunburst_v2",
        datasource_id=7,
        datasource_type="table",
        params=json.dumps(form_data),
    )
    request = GetChartPreviewRequest(identifier=11, format="ascii")
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "data": [
                    {
                        "region": "Americas",
                        "country": "Brazil",
                        "SQL Sales": 10,
                    }
                ]
            }
        ]
    }
    with (
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        ascii_result = ASCIIPreviewStrategy(chart, request).generate()

    assert not isinstance(ascii_result, ChartError)
    assert "Americas > Brazil" in ascii_result.ascii_content
    assert "SQL Sales=10" in ascii_result.ascii_content

    vega_result = VegaLitePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=11, format="vega_lite")
    ).generate()
    assert isinstance(vega_result, ChartError)
    assert vega_result.error_type == "UnsupportedFormat"
    command.run.assert_called_once()


@pytest.mark.asyncio
async def test_generate_chart_product_path_returns_sunburst_preview() -> None:
    request = GenerateChartRequest(
        dataset_id=7,
        config=_config(),
        preview_formats=["url"],
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    validation_result = Mock(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    user = Mock(id=1, username="admin", roles=[], groups=[])

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=user,
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            return_value="http://localhost/explore/?form_data_key=sunburst-key",
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
    ):
        result = await generate_chart(request, ctx=context)

    assert result.success is True
    assert result.chart is None  # Preview-only requests do not persist a chart.
    assert result.form_data is not None
    assert result.form_data["viz_type"] == "sunburst_v2"
    assert result.form_data["columns"] == ["region", "country"]
    assert result.form_data_key == "sunburst-key"


@pytest.mark.asyncio
async def test_cross_viz_preview_update_and_immediate_save_report_sunburst_state() -> (
    None
):
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Old pie",
        viz_type="pie",
        uuid="chart-uuid",
        params=json.dumps(
            {"viz_type": "pie", "groupby": ["region"], "metric": "count"}
        ),
    )
    config = _config()
    context = MagicMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    access = Mock(is_valid=True, error=None)

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch("superset.mcp_service.auth.check_chart_data_access", return_value=access),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart."
            "_validate_update_against_dataset",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart._create_preview_url",
            return_value=(
                "http://localhost/explore/?form_data_key=cross-viz-key&slice_id=19",
                "cross-viz-key",
                [],
            ),
        ),
    ):
        preview = await update_chart(
            request=UpdateChartRequest(identifier=19, config=config), ctx=context
        )

    assert preview.success is True
    assert preview.chart is not None
    assert preview.chart.viz_type == "sunburst_v2"
    assert preview.form_data["viz_type"] == "sunburst_v2"
    assert preview.form_data["columns"] == ["region", "country"]

    dataset = _dataset()
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value=preview.form_data,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            return_value="http://localhost/explore/?form_data_key=updated-key",
        ),
    ):
        updated_preview = update_chart_preview(
            request=UpdateChartPreviewRequest(
                form_data_key="cross-viz-key",
                dataset_id=7,
                config=_config(show_total=True),
                generate_preview=False,
            ),
            ctx=MagicMock(),
        )

    assert updated_preview["success"] is True
    assert updated_preview["chart"]["viz_type"] == "sunburst_v2"

    updated_chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Old pie",
        viz_type="sunburst_v2",
        uuid="chart-uuid",
    )
    update_command = Mock()
    update_command.run.return_value = updated_chart
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch("superset.mcp_service.auth.check_chart_data_access", return_value=access),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart."
            "_validate_update_against_dataset",
            return_value=None,
        ),
        patch(
            "superset.commands.chart.update.UpdateChartCommand",
            return_value=update_command,
        ),
    ):
        saved = await update_chart(
            request=UpdateChartRequest(
                identifier=19,
                config=config,
                generate_preview=False,
                preview_formats=[],
            ),
            ctx=context,
        )

    assert saved.success is True
    assert saved.chart is not None
    assert saved.chart.viz_type == "sunburst_v2"
    assert saved.form_data["viz_type"] == "sunburst_v2"
