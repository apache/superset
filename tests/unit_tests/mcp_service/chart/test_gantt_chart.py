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

"""Typed MCP coverage for the existing ECharts Gantt visualization."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import yaml
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
    resolve_gantt_query_fields,
)
from superset.mcp_service.chart.chart_utils import (
    map_gantt_config,
    merge_gantt_ui_config,
)
from superset.mcp_service.chart.preview_utils import (
    _generate_gantt_vega_lite_preview,
)
from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ChartError,
    GanttChartConfig,
    GenerateChartRequest,
    GetChartPreviewRequest,
    TableChartConfig,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
    VegaLitePreview,
)
from superset.mcp_service.chart.tool.get_chart_preview import (
    VegaLitePreviewStrategy,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator
from superset.mcp_service.common.error_schemas import DatasetContext


def _config(**overrides: object) -> GanttChartConfig:
    values: dict[str, object] = {
        "chart_type": "gantt",
        "start_time": {"name": "start_time"},
        "end_time": {"name": "end_time"},
        "category": {"name": "task"},
    }
    values.update(overrides)
    return GanttChartConfig.model_validate(values)


def _native_example() -> dict[str, object]:
    document = yaml.safe_load(
        Path("superset/examples/featured_charts/charts/Gantt.yaml").read_text()
    )
    return document["params"]


def _dataset_context() -> DatasetContext:
    return DatasetContext(
        id=1,
        table_name="tasks",
        database_name="main",
        available_columns=[
            {"name": "Start_Time", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "End_Time", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "Task", "type": "VARCHAR", "is_temporal": False},
            {"name": "Owner", "type": "VARCHAR", "is_temporal": False},
            {"name": "Project", "type": "VARCHAR", "is_temporal": False},
            {"name": "Priority", "type": "INTEGER", "is_temporal": False},
        ],
        available_metrics=[
            {"name": "Completion", "expression": "AVG(progress)"},
        ],
    )


def test_gantt_discriminator_is_exposed_in_every_request_model() -> None:
    payload = {
        "chart_type": "gantt",
        "start_time": {"name": "start_time"},
        "end_time": {"name": "end_time"},
        "category": {"name": "task"},
    }
    generated = GenerateChartRequest(dataset_id=1, config=payload)
    updated = UpdateChartRequest(identifier=7, config=payload)
    previewed = UpdateChartPreviewRequest(dataset_id=1, config=payload)
    assert isinstance(generated.config, GanttChartConfig)
    assert isinstance(updated.config, GanttChartConfig)
    assert isinstance(previewed.config, GanttChartConfig)
    union_config = TypeAdapter(ChartConfig).validate_python(payload)
    assert isinstance(union_config, GanttChartConfig)


def test_native_viz_type_alias_and_existing_type_regression() -> None:
    request = GenerateChartRequest(
        dataset_id=1,
        config={
            "viz_type": "gantt_chart",
            "start_time": "start_time",
            "end_time": "end_time",
            "y_axis": "task",
        },
    )
    assert isinstance(request.config, GanttChartConfig)
    assert request.config.category.name == "task"
    table = GenerateChartRequest(
        dataset_id=1,
        config={"chart_type": "table", "columns": [{"name": "task"}]},
    )
    assert isinstance(table.config, TableChartConfig)


def test_schema_and_typo_protection() -> None:
    schema_result = _get_chart_type_schema_impl("gantt")
    assert schema_result["chart_type"] == "gantt"
    schema = schema_result["schema"]
    assert set(schema["required"]) >= {"start_time", "end_time", "category"}
    assert schema["properties"]["chart_type"]["const"] == "gantt"
    assert schema_result["examples"][0]["chart_type"] == "gantt"

    with pytest.raises(ValidationError, match="did you mean 'start_time'"):
        _config(start_tiem={"name": "wrong"})


def test_role_and_cross_field_validation_is_conservative() -> None:
    with pytest.raises(ValidationError, match="start_time.*dimension"):
        _config(start_time={"name": "start_time", "aggregate": "MIN"})
    with pytest.raises(ValidationError, match=r"tooltip_metrics\[0\]"):
        _config(tooltip_metrics=[{"name": "progress"}])
    with pytest.raises(ValidationError, match="requires series"):
        _config(subcategories=True)
    with pytest.raises(ValidationError, match="different columns"):
        _config(end_time={"name": "start_time"})


def test_native_input_rejects_malformed_filters_order_and_bounds() -> None:
    with pytest.raises(ValidationError, match="free-form SQL"):
        GanttChartConfig.model_validate(
            {
                **_config().model_dump(exclude={"filters"}),
                "adhoc_filters": [
                    {"expressionType": "SQL", "sqlExpression": "task IS NOT NULL"}
                ],
            }
        )
    with pytest.raises(ValidationError, match="not valid JSON"):
        _config(order_by_cols=["not-json"])
    with pytest.raises(ValidationError, match="HH:MM:SS"):
        _config(x_axis_time_bounds=["8am", None])
    with pytest.raises(ValidationError, match="Unrecognized time_range"):
        _config(time_range="whenever")


def test_real_saved_example_adapts_and_round_trips_presentation() -> None:
    config = GanttChartConfig.model_validate(_native_example())
    assert isinstance(
        GenerateChartRequest(dataset_id=61, config=_native_example()).config,
        GanttChartConfig,
    )
    assert isinstance(
        UpdateChartRequest(identifier=1495, config=_native_example()).config,
        GanttChartConfig,
    )
    assert isinstance(
        UpdateChartPreviewRequest(dataset_id=61, config=_native_example()).config,
        GanttChartConfig,
    )
    assert config.temporal_column == "start_time"
    assert config.category.name == "status"
    assert config.series is not None
    assert config.series.name == "priority"
    assert config.order_by[0].column == "status"
    assert config.order_by[0].ascending is False

    form_data = map_gantt_config(config)
    assert form_data["viz_type"] == "gantt_chart"
    assert form_data["start_time"] == "start_time"
    assert form_data["end_time"] == "end_time"
    assert form_data["y_axis"] == "status"
    assert form_data["series"] == "priority"
    assert form_data["tooltip_columns"] == ["project", "phase"]
    assert form_data["order_by_cols"] == ['["status", false]']
    assert form_data["legendOrientation"] == "right"
    assert form_data["legendMargin"] == 100
    assert form_data["x_axis_time_bounds"] == ["08:00:00", "19:00:00"]
    assert form_data["tooltipTimeFormat"] == "smart_date"
    assert form_data["adhoc_filters"] == [
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "start_time",
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
        }
    ]


def test_mapper_output_round_trips_saved_adhoc_and_sql_tooltip_metrics() -> None:
    original = map_gantt_config(
        _config(
            tooltip_metrics=[
                {"name": "Completion", "saved_metric": True},
                {"name": "cost", "aggregate": "SUM"},
                {"name": "hours", "aggregate": "AVG", "label": "Avg hours"},
                {"sql_expression": "SUM(cost) / COUNT(*)", "label": "Unit cost"},
            ],
            time_range="Last 30 days",
        )
    )

    adapted = GanttChartConfig.model_validate(original)
    assert adapted.tooltip_metrics[0].saved_metric is True
    assert adapted.tooltip_metrics[1].aggregate == "SUM"
    assert adapted.tooltip_metrics[1].label is None
    assert adapted.tooltip_metrics[2].label == "Avg hours"
    assert adapted.tooltip_metrics[3].sql_expression == "SUM(cost) / COUNT(*)"
    assert map_gantt_config(adapted) == original

    cached = dict(original)
    cached_metric = dict(original["tooltip_metrics"][1])
    cached_metric["column"] = {
        "advanced_data_type": None,
        "certification_details": None,
        "certified_by": None,
        "column_name": "cost",
        "description": "Task cost",
        "expression": None,
        "filterable": True,
        "groupby": True,
        "id": 734,
        "is_certified": False,
        "is_dttm": False,
        "python_date_format": None,
        "type": "DOUBLE PRECISION",
        "type_generic": 0,
        "verbose_name": None,
        "warning_markdown": None,
    }
    cached["tooltip_metrics"] = [cached_metric]
    normalized_cached = map_gantt_config(GanttChartConfig.model_validate(cached))
    assert normalized_cached["tooltip_metrics"] == [original["tooltip_metrics"][1]]
    GanttChartConfig.model_validate(normalized_cached)

    malformed = dict(original)
    malformed_metric = dict(original["tooltip_metrics"][1])
    malformed_metric["expressonType"] = malformed_metric.pop("expressionType")
    malformed["tooltip_metrics"] = [malformed_metric]
    with pytest.raises(ValidationError, match="expressonType"):
        GanttChartConfig.model_validate(malformed)


def test_native_temporal_filters_reject_multiple_or_conflicting_bindings() -> None:
    base = map_gantt_config(_config())
    second = {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "end_time",
        "operator": "TEMPORAL_RANGE",
        "comparator": "No filter",
    }
    for filters in (
        [*base["adhoc_filters"], second],
        [*base["adhoc_filters"], dict(base["adhoc_filters"][0])],
    ):
        with pytest.raises(ValidationError, match="at most one TEMPORAL_RANGE"):
            GanttChartConfig.model_validate({**base, "adhoc_filters": filters})

    with pytest.raises(
        ValidationError, match="_mcp_dashboard_time_filter_subject conflicts"
    ):
        GanttChartConfig.model_validate(
            {**base, "_mcp_dashboard_time_filter_subject": "end_time"}
        )
    with pytest.raises(ValidationError, match="time_range conflicts"):
        GanttChartConfig.model_validate(
            {
                **base,
                "time_range": "Last 7 days",
                "adhoc_filters": [
                    {**base["adhoc_filters"][0], "comparator": "Last 30 days"}
                ],
            }
        )

    one_filter = GanttChartConfig.model_validate(base)
    assert map_gantt_config(one_filter) == base


def test_typed_mapping_matches_frontend_build_query_contract() -> None:
    form_data = map_gantt_config(
        _config(
            series={"name": "owner"},
            subcategories=True,
            tooltip_columns=[{"name": "project"}],
            tooltip_metrics=[{"name": "Completion", "saved_metric": True}],
            order_by=[
                {"column": "start_time", "ascending": True},
                {"column": "priority", "ascending": False},
            ],
            filters=[{"column": "owner", "op": "=", "value": "Amin"}],
            time_range="Last 30 days",
            color_scheme="supersetColors",
        )
    )
    assert form_data["tooltip_metrics"] == ["Completion"]
    assert form_data["adhoc_filters"][0] == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "owner",
        "operator": "==",
        "comparator": "Amin",
    }
    assert form_data["time_range"] == "Last 30 days"
    assert form_data["subcategories"] is True
    temporal_filter = next(
        filter_
        for filter_ in form_data["adhoc_filters"]
        if filter_["operator"] == "TEMPORAL_RANGE"
    )
    assert temporal_filter["subject"] == "start_time"
    assert temporal_filter["comparator"] == "Last 30 days"


def test_query_fields_and_query_context_shape_match_frontend() -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
        "series": "owner",
        "tooltip_columns": ["project"],
        "tooltip_metrics": ["Completion"],
        "order_by_cols": [
            '["start_time", true]',
            '["priority", false]',
        ],
        "row_limit": 321,
    }
    columns, metrics, orderby, series_columns = resolve_gantt_query_fields(form_data)
    assert columns == [
        "start_time",
        "end_time",
        "task",
        "owner",
        "project",
        "priority",
    ]
    assert metrics == ["Completion"]
    assert orderby == [["start_time", True], ["priority", False]]
    assert series_columns == ["owner"]

    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(form_data, 1, "table")[0]
    assert query["columns"] == columns
    assert query["metrics"] == metrics
    assert query["orderby"] == orderby
    assert query["series_columns"] == series_columns
    assert query["row_limit"] == 321


def test_saved_query_fallback_rejects_malformed_native_order() -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
        "order_by_cols": [["start_time", "yes"]],
    }
    with pytest.raises(ValueError, match="ascending_boolean"):
        resolve_gantt_query_fields(form_data)


def test_dataset_validation_and_case_normalization() -> None:
    config = _config(
        series={"name": "owner"},
        tooltip_columns=[{"name": "project"}],
        tooltip_metrics=[{"name": "completion", "saved_metric": True}],
        order_by=[{"column": "priority", "ascending": False}],
    )
    valid, error = DatasetValidator.validate_against_dataset(
        config, 1, dataset_context=_dataset_context()
    )
    assert valid is True
    assert error is None

    normalized = DatasetValidator.normalize_column_names(
        config, 1, dataset_context=_dataset_context()
    )
    assert normalized.start_time.name == "Start_Time"
    assert normalized.end_time.name == "End_Time"
    assert normalized.category.name == "Task"
    assert normalized.series is not None
    assert normalized.series.name == "Owner"
    assert normalized.tooltip_metrics[0].name == "Completion"
    assert normalized.order_by[0].column == "Priority"

    missing = _config(category={"name": "tasx"})
    valid, error = DatasetValidator.validate_against_dataset(
        missing, 1, dataset_context=_dataset_context()
    )
    assert valid is False
    assert error is not None
    assert any("Task" in suggestion for suggestion in error.suggestions)


def test_temporal_dataset_semantics() -> None:
    from superset.mcp_service.chart import registry

    plugin = registry.get("gantt")
    assert plugin is not None
    config = _config()
    context = _dataset_context()
    context.available_columns[0]["is_temporal"] = False
    with patch.object(DatasetValidator, "_get_dataset_context", return_value=context):
        error = plugin.post_map_validate(config, {}, dataset_id=1)
    assert error is not None
    assert error.error_code == "NON_TEMPORAL_GANTT_TIME_COLUMN"


def test_unsaved_gantt_vega_preview_representative_empty_and_invalid_data() -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
        "series": "owner",
        "subcategories": True,
        "tooltip_columns": ["project"],
    }
    data = [
        {
            "start_time": "2026-01-01T00:00:00",
            "end_time": "2026-01-03T00:00:00",
            "task": "Build",
            "owner": "Amin",
            "project": "MCP",
        }
    ]
    preview = _generate_gantt_vega_lite_preview(data, form_data)
    assert isinstance(preview, VegaLitePreview)
    assert preview.specification["mark"]["type"] == "bar"
    assert preview.specification["encoding"]["x2"] == {"field": "end_time"}
    assert preview.specification["encoding"]["yOffset"]["field"] == "owner"

    empty = _generate_gantt_vega_lite_preview([], form_data)
    assert isinstance(empty, VegaLitePreview)
    assert empty.specification["data"]["values"] == []

    missing = _generate_gantt_vega_lite_preview([{"task": "Build"}], form_data)
    assert isinstance(missing, ChartError)
    assert missing.error_type == "InvalidGanttResult"


@pytest.mark.parametrize(
    ("bad_row", "message"),
    [
        (
            {"start_time": None, "end_time": "2026-01-02", "task": "Build"},
            "invalid temporal value for start_time",
        ),
        (
            {"start_time": True, "end_time": "2026-01-02", "task": "Build"},
            "invalid temporal value for start_time",
        ),
        (
            {"start_time": "not-a-date", "end_time": "2026-01-02", "task": "Build"},
            "invalid temporal value for start_time",
        ),
        (
            {"start_time": "2026-01-03", "end_time": "2026-01-02", "task": "Build"},
            "ends before it starts",
        ),
        (
            {"start_time": "2026-01-01", "end_time": "2026-01-02", "task": None},
            "invalid category value for task",
        ),
        (
            {"start_time": "2026-01-01", "end_time": "2026-01-02", "task": True},
            "invalid category value for task",
        ),
    ],
)
def test_gantt_preview_rejects_invalid_values_in_every_row(
    bad_row: dict[str, object], message: str
) -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
    }
    valid = {
        "start_time": 1767225600000,
        "end_time": 1767312000000,
        "task": "Plan",
    }
    result = _generate_gantt_vega_lite_preview([valid, bad_row], form_data)
    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidGanttResult"
    assert "row 1" in result.error
    assert message in result.error


def test_gantt_preview_resolves_custom_column_and_metric_aliases() -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": {
            "expressionType": "SQL",
            "sqlExpression": "MIN(started_at)",
            "label": "Start alias",
        },
        "end_time": {
            "expressionType": "SQL",
            "sqlExpression": "MAX(ended_at)",
            "label": "End alias",
        },
        "y_axis": {
            "expressionType": "SQL",
            "sqlExpression": "task",
            "label": "Task alias",
        },
        "tooltip_columns": [
            {
                "expressionType": "SQL",
                "sqlExpression": "owner",
                "label": "Owner alias",
            }
        ],
        "tooltip_metrics": [{"label": "Total cost"}],
    }
    data = [
        {
            "Start alias": "2026-01-01T00:00:00Z",
            "End alias": "2026-01-02T00:00:00Z",
            "Task alias": "Build",
            "Owner alias": "Amin",
            "Total cost": 42,
        }
    ]
    preview = _generate_gantt_vega_lite_preview(data, form_data)
    assert isinstance(preview, VegaLitePreview)
    assert preview.specification["encoding"]["x"]["field"] == "Start alias"
    assert {item["field"] for item in preview.specification["encoding"]["tooltip"]} >= {
        "Owner alias",
        "Total cost",
    }

    missing_later_alias = _generate_gantt_vega_lite_preview(
        [
            data[0],
            {key: value for key, value in data[0].items() if key != "Owner alias"},
        ],
        form_data,
    )
    assert isinstance(missing_later_alias, ChartError)
    assert "row 1" in missing_later_alias.error
    assert "Owner alias" in missing_later_alias.error


def test_saved_gantt_vega_preview_supports_valid_empty_result() -> None:
    form_data = {
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
    }
    chart = SimpleNamespace(
        id=1,
        slice_name="Schedule",
        viz_type="gantt_chart",
        params=__import__("json").dumps(form_data),
    )
    request = GetChartPreviewRequest(
        identifier=1,
        format="vega_lite",
        width=640,
        height=320,
    )
    strategy = VegaLitePreviewStrategy(chart, request)
    spec = strategy._create_vega_lite_spec([])
    assert spec["data"]["values"] == []
    assert spec["mark"]["type"] == "bar"
    assert spec["encoding"]["x"]["field"] == "start_time"

    representative = strategy._create_vega_lite_spec(
        [
            {
                "start_time": "2026-01-01T00:00:00",
                "end_time": "2026-01-02T00:00:00",
                "task": "Review",
            }
        ]
    )
    assert representative["encoding"]["x2"] == {"field": "end_time"}
    with pytest.raises(ValueError, match="missing required output fields: end_time"):
        strategy._create_vega_lite_spec(
            [{"start_time": "2026-01-01T00:00:00", "task": "Review"}]
        )


def test_saved_and_unsaved_gantt_preview_return_the_same_structured_error() -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
    }
    data = [
        {
            "start_time": "2026-01-03",
            "end_time": "2026-01-02",
            "task": "Review",
        }
    ]
    unsaved = _generate_gantt_vega_lite_preview(data, form_data)
    assert isinstance(unsaved, ChartError)

    chart = SimpleNamespace(
        id=1,
        slice_name="Schedule",
        viz_type="gantt_chart",
        params=__import__("json").dumps(form_data),
    )
    strategy = VegaLitePreviewStrategy(
        chart,
        GetChartPreviewRequest(identifier=1, format="vega_lite"),
    )
    with (
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
        patch.object(strategy, "_authorize_guest_query"),
    ):
        command.return_value.run.return_value = {"queries": [{"data": data}]}
        saved = strategy.generate()

    assert isinstance(saved, ChartError)
    assert saved.error_type == unsaved.error_type
    assert saved.error == unsaved.error


def test_saved_update_and_preview_first_paths_preserve_native_gantt_state() -> None:
    existing = _native_example()
    chart = SimpleNamespace(
        id=1495,
        datasource_id=None,
        slice_name="Gantt",
        params=__import__("json").dumps(existing),
    )
    config = _config(series={"name": "priority"})
    request = UpdateChartRequest(identifier=1495, config=config)

    payload = _build_update_payload(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    saved_form_data = __import__("json").loads(payload["params"])
    assert saved_form_data["viz_type"] == "gantt_chart"
    assert saved_form_data["legendOrientation"] == "right"
    assert saved_form_data["legendMargin"] == 100
    assert saved_form_data["x_axis_time_bounds"] == ["08:00:00", "19:00:00"]
    assert payload["query_context"] is None

    preview_form_data = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(preview_form_data, dict)
    assert preview_form_data["legendOrientation"] == "right"
    assert preview_form_data["zoomable"] is False
    assert preview_form_data["slice_id"] == 1495


@pytest.mark.parametrize(
    "overrides",
    [
        {},
        {"filters": []},
        {"filters": [{"column": "owner", "op": "=", "value": "Amin"}]},
        {"temporal_column": "end_time", "time_range": "Last 7 days"},
    ],
)
def test_gantt_update_preview_matches_would_be_persisted_state(
    overrides: dict[str, object],
) -> None:
    existing = {
        **_native_example(),
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "project",
                "operator": "==",
                "comparator": "Legacy",
            }
        ],
    }
    chart = SimpleNamespace(
        id=1495,
        datasource_id=None,
        slice_name="Gantt",
        params=__import__("json").dumps(existing),
    )
    config = _config(**overrides)
    request = UpdateChartRequest(identifier=1495, config=config)

    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert isinstance(preview, dict)
    persisted = __import__("json").loads(payload["params"])
    preview_state = {
        key: value
        for key, value in preview.items()
        if key not in {"datasource", "slice_id", "slice_name"}
    }
    assert preview_state == persisted

    marker = persisted["_mcp_dashboard_time_filter_subject"]
    temporal_filters = [
        filter_
        for filter_ in persisted["adhoc_filters"]
        if filter_["operator"] == "TEMPORAL_RANGE"
    ]
    assert len(temporal_filters) == 1
    assert temporal_filters[0]["subject"] == marker
    expected_range = overrides.get("time_range", "No filter")
    assert temporal_filters[0]["comparator"] == expected_range


def test_registry_schema_validation_and_presentation_merge_wiring() -> None:
    from superset.mcp_service.chart import registry

    plugin = registry.get("gantt")
    assert plugin is not None
    assert plugin.resolve_viz_type(None) == "gantt_chart"
    assert registry.display_name_for_viz_type("gantt_chart") == "Gantt Chart"
    valid, parsed, error = SchemaValidator.validate_request(
        {
            "dataset_id": 1,
            "config": {
                "chart_type": "gantt",
                "start_time": {"name": "start_time"},
                "end_time": {"name": "end_time"},
                "category": {"name": "task"},
            },
        }
    )
    assert valid is True
    assert parsed is not None
    assert error is None

    previous = {
        "viz_type": "gantt_chart",
        "legendOrientation": "right",
        "legendMargin": 100,
        "zoomable": True,
        "x_axis_time_bounds": ["08:00:00", "19:00:00"],
    }
    replacement = map_gantt_config(_config())
    merge_gantt_ui_config(previous, replacement)
    assert replacement["legendOrientation"] == "right"
    assert replacement["legendMargin"] == 100
    assert replacement["zoomable"] is True
    assert replacement["x_axis_time_bounds"] == ["08:00:00", "19:00:00"]
