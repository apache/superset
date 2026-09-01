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

import importlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

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
    generate_preview_from_form_data,
)
from superset.mcp_service.chart.query_result import query_result_failure
from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ChartError,
    GanttChartConfig,
    GenerateChartRequest,
    GetChartPreviewRequest,
    TableChartConfig,
    TablePreview,
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
from superset.mcp_service.chart.validation.dataset_validator import (
    DatasetValidator,
    GanttSemanticNormalizationError,
)
from superset.mcp_service.chart.validation.pipeline import ValidationPipeline
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator
from superset.mcp_service.common.error_schemas import DatasetContext

update_chart_module = importlib.import_module(
    "superset.mcp_service.chart.tool.update_chart"
)
generate_chart_module = importlib.import_module(
    "superset.mcp_service.chart.tool.generate_chart"
)
update_chart_preview_module = importlib.import_module(
    "superset.mcp_service.chart.tool.update_chart_preview"
)


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


def _ambiguous_dataset_context() -> DatasetContext:
    return DatasetContext(
        id=1,
        table_name="ambiguous_tasks",
        database_name="main",
        available_columns=[
            {"name": "StartedAt", "type": "VARCHAR", "is_temporal": False},
            {"name": "startedat", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "EndedAt", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "Task", "type": "VARCHAR", "is_temporal": False},
        ],
        available_metrics=[],
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

    # These roles resolve labels case-insensitively in dataset canonicalization.
    with pytest.raises(ValidationError, match="start_time and end_time"):
        _config(end_time={"name": "START_TIME"})
    with pytest.raises(ValidationError, match="start_time and category"):
        _config(category={"name": "START_TIME"})
    with pytest.raises(ValidationError, match="end_time and category"):
        _config(category={"name": "END_TIME"})
    with pytest.raises(ValidationError, match="series and category"):
        _config(series={"name": "task"})
    with pytest.raises(ValidationError, match="series and category"):
        _config(series={"name": "TASK"}, subcategories=True)

    with pytest.raises(ValidationError, match=r"tooltip_columns\[0\].*dimension"):
        _config(tooltip_columns=[{"name": "Task", "aggregate": "MAX"}])
    with pytest.raises(ValidationError, match=r"tooltip_metrics\[0\]"):
        _config(tooltip_metrics=[{"name": "TASK"}])

    # The frontend permits a physical column in a tooltip as either a repeated
    # dimension or an aggregated metric; only the role shape must stay distinct.
    config = _config(
        tooltip_columns=[{"name": "TASK"}],
        tooltip_metrics=[{"name": "task", "aggregate": "COUNT"}],
    )
    assert config.tooltip_columns[0].name == "TASK"
    assert config.tooltip_metrics[0].aggregate == "COUNT"


@pytest.mark.parametrize("request_model", [GenerateChartRequest, UpdateChartRequest])
@pytest.mark.parametrize("generate_preview", [False, True])
def test_product_request_models_reject_case_insensitive_required_role_collisions(
    request_model: type[GenerateChartRequest] | type[UpdateChartRequest],
    generate_preview: bool,
) -> None:
    config = {
        "chart_type": "gantt",
        "start_time": {"name": "StartedAt"},
        "end_time": {"name": "EndedAt"},
        "category": {"name": "STARTEDAT"},
    }
    kwargs: dict[str, object] = {
        "config": config,
        "generate_preview": generate_preview,
    }
    if request_model is GenerateChartRequest:
        kwargs["dataset_id"] = 1
    else:
        kwargs["identifier"] = 1495

    with pytest.raises(ValidationError, match="start_time and category"):
        request_model(**kwargs)


@pytest.mark.parametrize("generate_preview", [False, True])
def test_update_preview_request_rejects_case_insensitive_role_collisions(
    generate_preview: bool,
) -> None:
    with pytest.raises(ValidationError, match="end_time and category"):
        UpdateChartPreviewRequest(
            dataset_id=1,
            generate_preview=generate_preview,
            config={
                "chart_type": "gantt",
                "start_time": {"name": "StartedAt"},
                "end_time": {"name": "EndedAt"},
                "category": {"name": "ENDEDAT"},
            },
        )


def test_preview_required_role_uniqueness_is_case_insensitive() -> None:
    result = _generate_gantt_vega_lite_preview(
        [],
        {
            "viz_type": "gantt_chart",
            "start_time": "StartedAt",
            "end_time": "EndedAt",
            "y_axis": "STARTEDAT",
        },
    )
    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidGanttFormData"
    assert "distinct" in result.error


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


def test_native_adapter_accepts_bounded_standard_explore_metadata() -> None:
    native = map_gantt_config(_config())
    native["adhoc_filters"] = [
        {
            "clause": "WHERE",
            "comparator": "Build",
            "datasourceWarning": False,
            "expressionType": "SIMPLE",
            "filterOptionName": "filter_123",
            "isExtra": False,
            "isNew": False,
            "operator": "==",
            "operatorId": "EQUALS",
            "sqlExpression": None,
            "subject": "task",
        },
        {
            "clause": "WHERE",
            "comparator": "Last 30 days",
            "datasourceWarning": False,
            "expressionType": "SIMPLE",
            "filterOptionName": "filter_456",
            "isExtra": True,
            "isNew": False,
            "operator": "TEMPORAL_RANGE",
            "operatorId": "TEMPORAL_RANGE",
            "sqlExpression": None,
            "subject": "start_time",
        },
    ]
    native["tooltip_metrics"] = [
        {
            "aggregate": "SUM",
            "column": {
                "advanced_data_type": None,
                "certification_details": None,
                "certified_by": "Data team",
                "column_name": "cost",
                "database_expression": None,
                "description": "Task cost",
                "expression": None,
                "filterBy": "cost",
                "filterable": True,
                "groupby": False,
                "id": 734,
                "is_certified": True,
                "is_dttm": False,
                "optionName": "cost",
                "python_date_format": None,
                "type": "DOUBLE PRECISION",
                "type_generic": 0,
                "uuid": None,
                "value": "cost",
                "verbose_name": None,
                "warning_markdown": "Certified source",
            },
            "datasourceWarning": False,
            "expressionType": "SIMPLE",
            "hasCustomLabel": False,
            "label": "SUM(cost)",
            "optionName": "metric_cost",
            "sqlExpression": None,
        }
    ]

    request = UpdateChartRequest(identifier=1495, config=native)
    assert isinstance(request.config, GanttChartConfig)
    adapted = request.config

    assert adapted.filters is not None
    assert adapted.filters[0].column == "task"
    assert adapted.time_range == "Last 30 days"
    assert adapted.tooltip_metrics[0].name == "cost"
    remapped = map_gantt_config(adapted)
    assert remapped["tooltip_metrics"] == [
        {
            "aggregate": "SUM",
            "column": {"column_name": "cost"},
            "datasourceWarning": False,
            "expressionType": "SIMPLE",
            "hasCustomLabel": False,
            "label": "SUM(cost)",
            "optionName": "metric_cost",
            "sqlExpression": None,
        }
    ]


@pytest.mark.parametrize(
    ("operator_id", "operator", "comparator", "expected_op"),
    [
        ("EQUALS", "==", "Build", "="),
        ("NOT_EQUALS", "!=", "Build", "!="),
        ("LESS_THAN", "<", 5, "<"),
        ("LESS_THAN_OR_EQUAL", "<=", 5, "<="),
        ("GREATER_THAN", ">", 5, ">"),
        ("GREATER_THAN_OR_EQUAL", ">=", 5, ">="),
        ("IN", "IN", ["Build", "Review"], "IN"),
        ("NOT_IN", "NOT IN", ["Deferred"], "NOT IN"),
        ("LIKE", "LIKE", "Build%", "LIKE"),
        ("ILIKE", "ILIKE", "build%", "ILIKE"),
        ("IS_NULL", "IS NULL", None, "IS NULL"),
        ("IS_NOT_NULL", "IS NOT NULL", None, "IS NOT NULL"),
    ],
)
def test_native_adapter_maps_supported_frontend_filter_operators(
    operator_id: str,
    operator: str,
    comparator: object,
    expected_op: str,
) -> None:
    native = map_gantt_config(_config())
    native.pop("_mcp_dashboard_time_filter_subject")
    native["adhoc_filters"] = [
        {
            "clause": "WHERE",
            "comparator": comparator,
            "expressionType": "SIMPLE",
            "operator": operator,
            "operatorId": operator_id,
            "sqlExpression": None,
            "subject": "task",
        }
    ]

    request = UpdateChartRequest(identifier=1495, config=native)

    assert isinstance(request.config, GanttChartConfig)
    assert request.config.filters is not None
    assert request.config.filters[0].op == expected_op
    assert request.config.filters[0].value == comparator


def test_native_adapter_maps_valid_temporal_operator_id() -> None:
    native = map_gantt_config(_config())
    native["adhoc_filters"] = [
        {
            "clause": "WHERE",
            "comparator": "Last 30 days",
            "expressionType": "SIMPLE",
            "operator": "TEMPORAL_RANGE",
            "operatorId": "TEMPORAL_RANGE",
            "sqlExpression": None,
            "subject": "start_time",
        }
    ]

    request = UpdateChartRequest(identifier=1495, config=native)

    assert isinstance(request.config, GanttChartConfig)
    assert request.config.filters is None
    assert request.config.temporal_column == "start_time"
    assert request.config.time_range == "Last 30 days"


@pytest.mark.parametrize(
    ("operator_id", "operator", "comparator", "message"),
    [
        ("EQAULS", "==", "Build", "not a recognized Explore operator ID"),
        ("EQUALS", "!=", "Build", "contradictory operator"),
        ("IS_NULL", "==", "Build", "contradictory operator"),
        ("IS_NULL", "IS NULL", "Build", "must not define comparator"),
        ("LATEST_PARTITION", "LATEST PARTITION", None, "not supported"),
        ("IN", "IN", "Build", "non-empty comparator array"),
    ],
)
def test_native_adapter_rejects_malformed_or_unsupported_operator_shapes(
    operator_id: str,
    operator: str,
    comparator: object,
    message: str,
) -> None:
    native = map_gantt_config(_config())
    native.pop("_mcp_dashboard_time_filter_subject")
    native["adhoc_filters"] = [
        {
            "clause": "WHERE",
            "comparator": comparator,
            "expressionType": "SIMPLE",
            "operator": operator,
            "operatorId": operator_id,
            "sqlExpression": None,
            "subject": "task",
        }
    ]

    with pytest.raises(ValidationError, match=message):
        UpdateChartRequest(identifier=1495, config=native)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("operator", {}, "operator must be a non-empty string"),
        ("operator", [], "operator must be a non-empty string"),
        ("operator", 7, "operator must be a non-empty string"),
        ("operator", None, "operator must be a non-empty string"),
        ("operatorId", {}, "operatorId must be a non-empty string"),
        ("operatorId", [], "operatorId must be a non-empty string"),
        ("operatorId", 7, "operatorId must be a non-empty string"),
        ("comparator", {}, "requires a scalar comparator"),
        ("comparator", [], "requires a scalar comparator"),
        ("comparator", None, "requires a scalar comparator"),
    ],
)
def test_native_filter_unhashable_values_are_structured_validation_errors(
    field: str, value: object, message: str
) -> None:
    native = map_gantt_config(_config())
    native["chart_type"] = "gantt"
    native.pop("_mcp_dashboard_time_filter_subject")
    native_filter: dict[str, object] = {
        "clause": "WHERE",
        "comparator": "Build",
        "expressionType": "SIMPLE",
        "operator": "==",
        "operatorId": "EQUALS",
        "sqlExpression": None,
        "subject": "task",
    }
    native_filter[field] = value
    native["adhoc_filters"] = [native_filter]

    valid, _request, error = SchemaValidator.validate_request(
        {"dataset_id": 1, "config": native}
    )

    assert valid is False
    assert error is not None
    assert error.error_type != "validation_system_error"
    assert message in f"{error.message} {error.details}"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("advanced_data_type", []),
        ("certification_details", {}),
        ("certified_by", 3),
        ("description", []),
        ("filterable", "true"),
        ("groupby", "definitely-not-bool"),
        ("id", True),
        ("is_certified", None),
        ("is_dttm", 0),
        ("python_date_format", False),
        ("type", 3),
        ("type_generic", "0"),
        ("type_generic", 5),
        ("uuid", 123),
        ("verbose_name", []),
        ("warning_markdown", {}),
    ],
)
def test_update_request_rejects_wrongly_typed_native_column_metadata(
    field: str, value: object
) -> None:
    native = map_gantt_config(_config())
    native["tooltip_metrics"] = [
        {
            "aggregate": "SUM",
            "column": {"column_name": "cost", field: value},
            "expressionType": "SIMPLE",
            "label": "SUM(cost)",
            "sqlExpression": None,
        }
    ]

    with pytest.raises(ValidationError, match=field):
        UpdateChartRequest(identifier=1495, config=native)


def test_native_adapter_uses_frontend_fallback_for_unlabeled_sql_metric() -> None:
    native = map_gantt_config(_config())
    native["tooltip_metrics"] = [
        {
            "aggregate": None,
            "column": None,
            "datasourceWarning": False,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "isNew": False,
            "label": None,
            "optionName": "metric_sql_123",
            "sqlExpression": "SUM(cost) / COUNT(*)",
        }
    ]

    adapted = GanttChartConfig.model_validate(native)
    metric = adapted.tooltip_metrics[0]

    assert metric.sql_expression == "SUM(cost) / COUNT(*)"
    assert metric.label == "SUM(cost) / COUNT(*)"
    assert map_gantt_config(adapted)["tooltip_metrics"][0]["label"] == metric.label


@pytest.mark.parametrize(
    ("container", "field", "value", "message"),
    [
        ("filter", "filterOptionName", 123, "filterOptionName"),
        ("filter", "isExtra", "false", "isExtra"),
        ("filter", "sqlExpression", "task = 'x'", "must be null"),
        ("filter", "filterOptionNmae", "typo", "filterOptionNmae"),
        ("metric", "isNew", "false", "isNew"),
        ("metric", "isNwe", False, "isNwe"),
    ],
)
def test_native_adapter_rejects_malformed_or_unknown_explore_metadata(
    container: str, field: str, value: object, message: str
) -> None:
    native = map_gantt_config(_config())
    if container == "filter":
        target = native["adhoc_filters"][0]
    else:
        native["tooltip_metrics"] = [
            {
                "aggregate": "SUM",
                "column": {"column_name": "cost"},
                "expressionType": "SIMPLE",
                "label": "SUM(cost)",
                "sqlExpression": None,
            }
        ]
        target = native["tooltip_metrics"][0]
    target[field] = value

    with pytest.raises(ValidationError, match=message):
        GanttChartConfig.model_validate(native)


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


def test_gantt_normalization_rejects_ambiguous_case_insensitive_dataset_names() -> None:
    config = _config(
        start_time={"name": "STARTEDAT"},
        end_time={"name": "endedat"},
        category={"name": "task"},
    )

    with pytest.raises(
        GanttSemanticNormalizationError,
        match="ambiguous.*StartedAt.*startedat.*exact physical column name",
    ):
        DatasetValidator.normalize_column_names(
            config, 1, dataset_context=_ambiguous_dataset_context()
        )


@pytest.mark.parametrize("reverse_metadata", [False, True])
def test_exact_case_wins_for_every_gantt_reference_and_temporal_check(
    reverse_metadata: bool,
) -> None:
    """Metadata order cannot redirect exact refs to a case-colliding column."""
    context = _ambiguous_dataset_context()
    if reverse_metadata:
        context.available_columns[0:2] = reversed(context.available_columns[0:2])
    context.available_metrics = [
        {"name": "Budget", "expression": "SUM(cost)"},
        {"name": "budget", "expression": "AVG(cost)"},
    ]
    config = _config(
        start_time={"name": "startedat"},
        end_time={"name": "EndedAt"},
        category={"name": "Task"},
        series={"name": "StartedAt"},
        tooltip_columns=[{"name": "startedat"}],
        tooltip_metrics=[{"name": "budget", "saved_metric": True}],
        temporal_column="startedat",
        filters=[{"column": "startedat", "op": ">=", "value": "2026-01-01"}],
        order_by=[{"column": "startedat", "ascending": True}],
    )

    valid, error = DatasetValidator.validate_against_dataset(
        config, 1, dataset_context=context
    )
    assert valid is True
    assert error is None
    normalized = DatasetValidator.normalize_column_names(
        config, 1, dataset_context=context
    )
    assert normalized.start_time.name == "startedat"
    assert normalized.series is not None
    assert normalized.series.name == "StartedAt"
    assert normalized.tooltip_columns[0].name == "startedat"
    assert normalized.tooltip_metrics[0].name == "budget"
    assert normalized.temporal_column == "startedat"
    assert normalized.filters is not None
    assert normalized.filters[0].column == "startedat"
    assert normalized.order_by[0].column == "startedat"

    plugin = __import__("superset.mcp_service.chart.registry", fromlist=["get"]).get(
        "gantt"
    )
    assert plugin is not None
    with patch.object(DatasetValidator, "_get_dataset_context", return_value=context):
        assert plugin.post_map_validate(normalized, {}, dataset_id=1) is None
        wrong_case_error = plugin.post_map_validate(
            _config(start_time={"name": "StartedAt"}), {}, dataset_id=1
        )
    assert wrong_case_error is not None
    assert wrong_case_error.error_code == "NON_TEMPORAL_GANTT_TIME_COLUMN"


@pytest.mark.parametrize("reverse_metadata", [False, True])
def test_ambiguous_nonexact_reference_fails_validation_actionably(
    reverse_metadata: bool,
) -> None:
    context = _ambiguous_dataset_context()
    if reverse_metadata:
        context.available_columns[0:2] = reversed(context.available_columns[0:2])
    config = _config(start_time={"name": "STARTEDAT"})

    valid, error = DatasetValidator.validate_against_dataset(
        config, 1, dataset_context=context
    )

    assert valid is False
    assert error is not None
    assert error.error_code == "AMBIGUOUS_DATASET_REFERENCE"
    assert "StartedAt" in error.details
    assert "startedat" in error.details
    assert "exact physical column name" in error.details


def test_validation_pipeline_fails_closed_on_ambiguous_gantt_reference() -> None:
    request_data = {
        "dataset_id": 1,
        "config": {
            "chart_type": "gantt",
            "start_time": {"name": "STARTEDAT"},
            "end_time": {"name": "endedat"},
            "category": {"name": "task"},
        },
    }
    with (
        patch.object(
            ValidationPipeline,
            "_get_dataset_context",
            return_value=_ambiguous_dataset_context(),
        ),
        patch.object(
            ValidationPipeline, "_validate_runtime", return_value=(True, None)
        ),
    ):
        result = ValidationPipeline.validate_request_with_warnings(request_data)

    assert result.is_valid is False
    assert result.request is not None
    assert result.error is not None
    assert result.error.error_type == "ambiguous_dataset_reference"
    assert result.error.error_code == "AMBIGUOUS_DATASET_REFERENCE"
    assert "ambiguous" in result.error.details
    assert result.error.suggestions


def test_nonsemantic_normalization_error_remains_a_warning_for_other_charts(
    caplog: pytest.LogCaptureFixture,
) -> None:
    request = GenerateChartRequest(
        dataset_id=1,
        config={"chart_type": "table", "columns": [{"name": "Task"}]},
    )
    with patch.object(
        DatasetValidator,
        "normalize_column_names",
        side_effect=ValueError("temporary canonicalization issue"),
    ):
        normalized = ValidationPipeline._normalize_column_names(request)

    assert normalized is request
    assert "Column name normalization failed" in caplog.text


@pytest.mark.asyncio
async def test_generate_chart_maps_ambiguous_gantt_reference_to_error() -> None:
    request = GenerateChartRequest(
        dataset_id=1,
        config={
            "chart_type": "gantt",
            "start_time": {"name": "STARTEDAT"},
            "end_time": {"name": "endedat"},
            "category": {"name": "task"},
        },
        preview_formats=[],
    )
    ctx = Mock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            ValidationPipeline,
            "_get_dataset_context",
            return_value=_ambiguous_dataset_context(),
        ),
        patch.object(
            ValidationPipeline, "_validate_runtime", return_value=(True, None)
        ),
        patch.object(generate_chart_module, "map_config_to_form_data") as mapper,
    ):
        result = await generate_chart_module.generate_chart(request=request, ctx=ctx)

    assert result.success is False
    assert result.error is not None
    assert result.error.error_type == "ambiguous_dataset_reference"
    assert "ambiguous" in result.error.details
    mapper.assert_not_called()


@pytest.mark.asyncio
async def test_update_chart_maps_gantt_semantic_normalization_to_error() -> None:
    request = UpdateChartRequest(
        identifier=1495,
        config={
            "chart_type": "gantt",
            "start_time": {"name": "STARTEDAT"},
            "end_time": {"name": "endedat"},
            "category": {"name": "task"},
        },
        generate_preview=False,
        preview_formats=[],
    )
    chart = SimpleNamespace(
        id=1495,
        datasource_id=1,
        datasource=object(),
        params=__import__("json").dumps(_native_example()),
        slice_name="Gantt",
        uuid="chart-uuid",
        viz_type="gantt_chart",
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            update_chart_module, "find_chart_by_identifier", return_value=chart
        ),
        patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=SimpleNamespace(is_valid=True, error=None),
        ),
        patch.object(
            DatasetValidator,
            "_get_dataset_context",
            return_value=_ambiguous_dataset_context(),
        ),
        patch("superset.commands.chart.update.UpdateChartCommand") as command,
    ):
        result = await update_chart_module.update_chart(request=request, ctx=Mock())

    assert result.success is False
    assert result.error is not None
    assert result.error.error_type == "ValidationError"
    assert "ambiguous" in result.error.details
    command.assert_not_called()


def test_update_chart_preview_maps_gantt_semantic_normalization_to_error() -> None:
    context = _ambiguous_dataset_context()
    columns = [
        SimpleNamespace(
            column_name=column["name"],
            type=column["type"],
            is_temporal=column["is_temporal"],
            is_numeric=False,
        )
        for column in context.available_columns
    ]
    dataset = SimpleNamespace(
        id=1,
        table_name=context.table_name,
        schema=None,
        columns=columns,
        metrics=[],
        database=SimpleNamespace(database_name="main", db_engine_spec=None),
    )
    request = UpdateChartPreviewRequest(
        dataset_id=1,
        config={
            "chart_type": "gantt",
            "start_time": {"name": "STARTEDAT"},
            "end_time": {"name": "endedat"},
            "category": {"name": "task"},
        },
        preview_formats=[],
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            update_chart_preview_module, "_find_dataset", return_value=dataset
        ),
        patch.object(update_chart_preview_module, "generate_explore_link") as link,
    ):
        result = update_chart_preview_module.update_chart_preview(request, ctx=Mock())

    assert result["success"] is False
    assert result["error"]["error_type"] == "gantt_semantic_validation_error"
    assert "ambiguous" in result["error"]["details"]
    link.assert_not_called()


@pytest.mark.parametrize("generate_query_preview", [False, True])
def test_update_chart_preview_normalizes_all_gantt_refs_before_url_and_query_preview(
    generate_query_preview: bool,
) -> None:
    columns = [
        SimpleNamespace(
            column_name=column["name"],
            type=column["type"],
            is_temporal=column["is_temporal"],
            is_numeric=False,
        )
        for column in _dataset_context().available_columns
    ]
    metrics = [
        SimpleNamespace(
            metric_name="Completion",
            expression="AVG(progress)",
            description=None,
        )
    ]
    dataset = SimpleNamespace(
        id=1,
        table_name="tasks",
        schema=None,
        columns=columns,
        metrics=metrics,
        database=SimpleNamespace(database_name="main", db_engine_spec=None),
    )
    request = UpdateChartPreviewRequest(
        dataset_id=1,
        config=_config(
            start_time={"name": "start_time"},
            end_time={"name": "end_time"},
            category={"name": "task"},
            series={"name": "owner"},
            temporal_column="end_time",
            tooltip_columns=[{"name": "project"}],
            tooltip_metrics=[{"name": "completion", "saved_metric": True}],
            filters=[{"column": "owner", "op": "=", "value": "Amin"}],
            order_by=[{"column": "priority", "ascending": False}],
            time_range="Last 7 days",
        ),
        generate_preview=generate_query_preview,
        preview_formats=["vega_lite"],
    )

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            update_chart_preview_module, "_find_dataset", return_value=dataset
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch.object(
            update_chart_preview_module, "has_dataset_access", return_value=True
        ),
        patch.object(update_chart_preview_module, "validate_and_compile") as validate,
        patch.object(
            update_chart_preview_module,
            "generate_explore_link",
            return_value="http://superset/explore/?form_data_key=canonical",
        ) as generate_link,
        patch.object(
            update_chart_preview_module, "generate_preview_from_form_data"
        ) as generate_preview,
        patch.object(
            update_chart_preview_module, "analyze_chart_capabilities", return_value=None
        ),
        patch.object(
            update_chart_preview_module, "analyze_chart_semantics", return_value=None
        ),
    ):
        validate.return_value = SimpleNamespace(success=True)
        generate_preview.return_value = VegaLitePreview(
            specification={"mark": "bar"},
            data_url=None,
            supports_streaming=False,
        )
        result = update_chart_preview_module.update_chart_preview(
            request=request, ctx=Mock()
        )

    assert result["success"] is True
    form_data = generate_link.call_args.args[1]
    assert form_data["start_time"] == "Start_Time"
    assert form_data["end_time"] == "End_Time"
    assert form_data["y_axis"] == "Task"
    assert form_data["series"] == "Owner"
    assert form_data["tooltip_columns"] == ["Project"]
    assert form_data["tooltip_metrics"] == ["Completion"]
    assert form_data["order_by_cols"] == ['["Priority", false]']
    assert form_data["adhoc_filters"][0]["subject"] == "Owner"
    temporal = [
        filter_
        for filter_ in form_data["adhoc_filters"]
        if filter_["operator"] == "TEMPORAL_RANGE"
    ]
    assert temporal == [
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "End_Time",
            "operator": "TEMPORAL_RANGE",
            "comparator": "Last 7 days",
        }
    ]
    if generate_query_preview:
        preview_form_data = generate_preview.call_args.kwargs["form_data"]
        assert preview_form_data == form_data
    else:
        generate_preview.assert_not_called()


@pytest.mark.parametrize(
    (
        "overrides",
        "expected_subject",
        "expected_range",
        "keeps_unrelated",
        "expected_series",
        "expected_subcategories",
    ),
    [
        (
            {"temporal_column": "end_time", "time_range": "Last 7 days"},
            "End_Time",
            "Last 7 days",
            True,
            "Owner",
            True,
        ),
        (
            {"temporal_column": "start_time", "time_range": "Last 7 days"},
            "Start_Time",
            "Last 7 days",
            True,
            "Owner",
            True,
        ),
        ({}, "Start_Time", "No filter", True, "Owner", True),
        ({"filters": []}, "Start_Time", "No filter", False, "Owner", True),
        (
            {"subcategories": False},
            "Start_Time",
            "No filter",
            True,
            "Owner",
            False,
        ),
        ({"series": None}, "Start_Time", "No filter", True, None, False),
    ],
)
def test_cached_update_chart_preview_replaces_generated_temporal_binding(
    overrides: dict[str, object],
    expected_subject: str,
    expected_range: str,
    keeps_unrelated: bool,
    expected_series: str | None,
    expected_subcategories: bool,
) -> None:
    columns = [
        SimpleNamespace(
            column_name=column["name"],
            type=column["type"],
            is_temporal=column["is_temporal"],
            is_numeric=False,
        )
        for column in _dataset_context().available_columns
    ]
    dataset = SimpleNamespace(
        id=1,
        table_name="tasks",
        schema=None,
        columns=columns,
        metrics=[],
        database=SimpleNamespace(database_name="main", db_engine_spec=None),
    )
    old_binding = {
        "clause": "WHERE",
        "comparator": "Last 30 days",
        "expressionType": "SIMPLE",
        "operator": "TEMPORAL_RANGE",
        "subject": "Start_Time",
    }
    unrelated = {
        "clause": "WHERE",
        "comparator": "MCP",
        "expressionType": "SIMPLE",
        "operator": "==",
        "subject": "Project",
    }
    previous = {
        "viz_type": "gantt_chart",
        "adhoc_filters": [old_binding, unrelated],
        "_mcp_dashboard_time_filter_subject": "Start_Time",
        "series": "Owner",
        "subcategories": True,
    }
    request = UpdateChartPreviewRequest(
        form_data_key="previous",
        dataset_id=1,
        config=_config(**overrides),
        generate_preview=False,
    )

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            update_chart_preview_module, "_find_dataset", return_value=dataset
        ),
        patch.object(
            update_chart_preview_module,
            "_get_previous_form_data",
            return_value=previous,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch.object(
            update_chart_preview_module, "has_dataset_access", return_value=True
        ),
        patch.object(update_chart_preview_module, "validate_and_compile") as validate,
        patch.object(
            update_chart_preview_module,
            "generate_explore_link",
            return_value="http://superset/explore/?form_data_key=current",
        ) as generate_link,
        patch.object(
            update_chart_preview_module, "analyze_chart_capabilities", return_value=None
        ),
        patch.object(
            update_chart_preview_module, "analyze_chart_semantics", return_value=None
        ),
    ):
        validate.return_value = SimpleNamespace(success=True)
        result = update_chart_preview_module.update_chart_preview(
            request=request, ctx=Mock()
        )

    assert result["success"] is True
    form_data = generate_link.call_args.args[1]
    temporal = [
        filter_
        for filter_ in form_data["adhoc_filters"]
        if filter_["operator"] == "TEMPORAL_RANGE"
    ]
    assert len(temporal) == 1
    assert temporal[0]["subject"] == expected_subject
    assert temporal[0]["comparator"] == expected_range
    assert form_data["_mcp_dashboard_time_filter_subject"] == expected_subject
    assert (unrelated in form_data["adhoc_filters"]) is keeps_unrelated
    assert form_data.get("series") == expected_series
    assert form_data.get("subcategories", False) is expected_subcategories
    assert not form_data.get("subcategories") or form_data.get("series")
    GanttChartConfig.model_validate(form_data)


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


@pytest.mark.parametrize(
    ("metric", "result_label"),
    [
        ("Completion", "Completion"),
        (
            {
                "expressionType": "SIMPLE",
                "aggregate": "SUM",
                "column": {"column_name": "cost"},
                "label": "Total cost",
            },
            "Total cost",
        ),
        (
            {
                "expressionType": "SIMPLE",
                "aggregate": "AVG",
                "column": {"columnName": "hours"},
            },
            "AVG(hours)",
        ),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(cost) / COUNT(*)",
                "label": "Unit cost",
            },
            "Unit cost",
        ),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(cost) / COUNT(*)",
            },
            "SUM(cost) / COUNT(*)",
        ),
    ],
)
def test_saved_and_unsaved_preview_resolve_metric_result_labels(
    metric: object, result_label: str
) -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
        "tooltip_metrics": [metric],
    }
    data = [
        {
            "start_time": "2026-01-01",
            "end_time": "2026-01-02",
            "task": "Build",
            result_label: 42,
        }
    ]

    unsaved = _generate_gantt_vega_lite_preview(data, form_data)
    assert isinstance(unsaved, VegaLitePreview)
    assert result_label in {
        item["field"] for item in unsaved.specification["encoding"]["tooltip"]
    }

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
    saved = strategy._create_vega_lite_spec(data)
    assert result_label in {item["field"] for item in saved["encoding"]["tooltip"]}


@pytest.mark.parametrize(
    "metric",
    [
        {},
        {"expressionType": "SIMPLE", "aggregate": "SUM", "column": {}},
        {"expressionType": "SIMPLE", "aggregate": 1, "column": {}},
        {"expressionType": "SQL", "sqlExpression": ""},
        {"expressionType": "SQL", "sqlExpression": 123},
        {"expressionType": "UNKNOWN", "sqlExpression": "SUM(cost)"},
    ],
)
def test_gantt_preview_rejects_malformed_metric_objects(metric: object) -> None:
    result = _generate_gantt_vega_lite_preview(
        [
            {
                "start_time": "2026-01-01",
                "end_time": "2026-01-02",
                "task": "Build",
            }
        ],
        {
            "viz_type": "gantt_chart",
            "start_time": "start_time",
            "end_time": "end_time",
            "y_axis": "task",
            "tooltip_metrics": [metric],
        },
    )

    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidGanttFormData"


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


@pytest.mark.parametrize(
    "query_payload",
    [
        {"queries": [{"error": "empty query failure", "data": []}]},
        {
            "queries": [
                {
                    "error": "nonempty query failure",
                    "data": [
                        {
                            "start_time": "2026-01-01",
                            "end_time": "2026-01-02",
                            "task": "Build",
                        }
                    ],
                }
            ]
        },
        {"error": "top-level failure", "queries": [{"data": []}]},
        {"errors": ["top-level failure"], "queries": [{"data": []}]},
        {
            "queries": [
                {"data": []},
                {"status": "failed", "message": "second query failure", "data": []},
            ]
        },
    ],
)
def test_saved_and_unsaved_gantt_previews_fail_on_embedded_query_errors(
    query_payload: dict[str, object],
) -> None:
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
    }
    chart = SimpleNamespace(
        id=1,
        slice_name="Schedule",
        viz_type="gantt_chart",
        datasource_id=1,
        datasource_type="table",
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
        command.return_value.run.return_value = query_payload
        saved = strategy.generate()

    with (
        patch("superset.extensions.db.session.get", return_value=object()),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = query_payload
        unsaved = generate_preview_from_form_data(form_data, 1, "vega_lite")

    assert isinstance(saved, ChartError)
    assert saved.error_type == "QueryError"
    assert isinstance(unsaved, ChartError)
    assert unsaved.error_type == "QueryError"


def test_valid_empty_query_result_stays_a_successful_empty_gantt_preview() -> None:
    payload = {"queries": [{"status": "success", "data": []}]}
    assert query_result_failure(payload) is None
    form_data = {
        "viz_type": "gantt_chart",
        "start_time": "start_time",
        "end_time": "end_time",
        "y_axis": "task",
    }
    with (
        patch("superset.extensions.db.session.get", return_value=object()),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = payload
        preview = generate_preview_from_form_data(form_data, 1, "vega_lite")

    assert isinstance(preview, VegaLitePreview)
    assert preview.specification["data"]["values"] == []

    chart = SimpleNamespace(
        id=1,
        slice_name="Schedule",
        viz_type="gantt_chart",
        datasource_id=1,
        datasource_type="table",
        params=__import__("json").dumps(form_data),
    )
    strategy = VegaLitePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=1, format="vega_lite")
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
        command.return_value.run.return_value = payload
        saved_preview = strategy.generate()

    assert isinstance(saved_preview, VegaLitePreview)
    assert saved_preview.specification["data"]["values"] == []


def test_query_failure_detection_applies_without_changing_valid_table_preview() -> None:
    failure = query_result_failure(
        {"queries": [{"status": "timed_out", "message": "timeout", "data": []}]}
    )
    assert isinstance(failure, ChartError)
    assert failure.error_type == "QueryError"

    with (
        patch("superset.extensions.db.session.get", return_value=object()),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = {"queries": [{"data": []}]}
        preview = generate_preview_from_form_data(
            {"viz_type": "table", "all_columns": ["task"]}, 1, "table"
        )

    assert isinstance(preview, TablePreview)


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
    ("overrides", "expected_series", "expected_subcategories"),
    [
        ({}, "owner", True),
        ({"subcategories": False}, "owner", False),
        ({"series": {"name": "project"}}, "project", True),
        ({"series": None}, None, False),
        ({"series": None, "subcategories": False}, None, False),
    ],
)
def test_saved_and_cached_update_merges_keep_gantt_series_dependency_coherent(
    overrides: dict[str, object],
    expected_series: str | None,
    expected_subcategories: bool,
) -> None:
    existing = {
        **_native_example(),
        "series": "owner",
        "subcategories": True,
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
    cached_preview = _build_preview_form_data(request, chart, parsed_config=config)

    assert isinstance(payload, dict)
    assert isinstance(cached_preview, dict)
    persisted = __import__("json").loads(payload["params"])
    assert persisted.get("series") == expected_series
    assert persisted.get("subcategories", False) is expected_subcategories
    assert cached_preview.get("series") == expected_series
    assert cached_preview.get("subcategories", False) is expected_subcategories
    assert not persisted.get("subcategories") or persisted.get("series")
    round_trip = GanttChartConfig.model_validate(persisted)
    assert round_trip.subcategories is expected_subcategories
    assert (round_trip.series.name if round_trip.series else None) == expected_series


def test_merge_repairs_stale_subcategories_without_series() -> None:
    replacement = map_gantt_config(_config())
    merge_gantt_ui_config(
        {"viz_type": "gantt_chart", "subcategories": True}, replacement
    )

    assert replacement.get("subcategories", False) is False
    assert not replacement.get("series")
    GanttChartConfig.model_validate(replacement)


@pytest.mark.parametrize("generate_preview", [True, False], ids=["preview", "save"])
@pytest.mark.parametrize(
    "category",
    ["Owner", "owner", "OwNeR"],
    ids=["exact", "casefold", "canonical_alias"],
)
@pytest.mark.asyncio
async def test_update_chart_rejects_preserved_series_colliding_with_new_category(
    generate_preview: bool,
    category: str,
) -> None:
    """Preview and save reject conflicts introduced by native-state merging."""
    existing = {
        **_native_example(),
        "y_axis": "Task",
        "series": "Owner",
        "subcategories": True,
    }
    chart = SimpleNamespace(
        id=1495,
        datasource_id=1,
        datasource=object(),
        slice_name="Gantt",
        params=__import__("json").dumps(existing),
        uuid="chart-uuid",
        viz_type="gantt_chart",
    )
    request = UpdateChartRequest(
        identifier=1495,
        config=_config(category={"name": category}),
        generate_preview=generate_preview,
        preview_formats=[],
    )

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            update_chart_module, "find_chart_by_identifier", return_value=chart
        ),
        patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=SimpleNamespace(is_valid=True, error=None),
        ),
        patch.object(
            DatasetValidator,
            "_get_dataset_context",
            return_value=_dataset_context(),
        ),
        patch("superset.commands.chart.update.UpdateChartCommand") as command,
        patch.object(update_chart_module, "_create_preview_url") as create_preview,
    ):
        result = await update_chart_module.update_chart(request=request, ctx=Mock())

    assert result.success is False
    assert result.error is not None
    assert result.error.error_type == "ValidationError"
    assert (
        "series and category must reference different columns" in result.error.details
    )
    command.assert_not_called()
    create_preview.assert_not_called()


@pytest.mark.parametrize(
    "category",
    ["Owner", "owner", "OwNeR"],
    ids=["exact", "casefold", "canonical_alias"],
)
def test_update_chart_preview_rejects_cached_series_colliding_with_new_category(
    category: str,
) -> None:
    """Standalone cached previews apply the same final-state semantic gate."""
    context = _dataset_context()
    columns = [
        SimpleNamespace(
            column_name=column["name"],
            type=column["type"],
            is_temporal=column["is_temporal"],
            is_numeric=False,
        )
        for column in context.available_columns
    ]
    dataset = SimpleNamespace(
        id=1,
        table_name=context.table_name,
        schema=None,
        columns=columns,
        metrics=[],
        database=SimpleNamespace(database_name="main", db_engine_spec=None),
    )
    request = UpdateChartPreviewRequest(
        form_data_key="previous",
        dataset_id=1,
        config=_config(category={"name": category}),
        generate_preview=False,
        preview_formats=[],
    )
    previous = {
        "viz_type": "gantt_chart",
        "start_time": "Start_Time",
        "end_time": "End_Time",
        "y_axis": "Task",
        "series": "Owner",
        "subcategories": True,
    }

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1),
        ),
        patch.object(
            update_chart_preview_module, "_find_dataset", return_value=dataset
        ),
        patch.object(
            update_chart_preview_module,
            "_get_previous_form_data",
            return_value=previous,
        ),
        patch.object(update_chart_preview_module, "generate_explore_link") as link,
    ):
        result = update_chart_preview_module.update_chart_preview(request, ctx=Mock())

    assert result["success"] is False
    assert result["error"]["error_type"] == "gantt_semantic_validation_error"
    assert (
        "series and category must reference different columns"
        in result["error"]["details"]
    )
    link.assert_not_called()


@pytest.mark.asyncio
async def test_real_update_preserves_omitted_and_overrides_explicit_defaults() -> None:
    saved_presentation = {
        "color_scheme": "legacyColors",
        "show_legend": False,
        "legendOrientation": "right",
        "legendType": "plain",
        "legendMargin": 91,
        "legendSort": "desc",
        "zoomable": True,
        "subcategories": True,
        "show_extra_controls": True,
        "x_axis_time_bounds": ["08:00:00", "19:00:00"],
        "x_axis_time_format": "%Y-%m-%d",
        "tooltipTimeFormat": "%H:%M",
        "tooltipValuesFormat": ",.2f",
        "x_axis_title": "Saved X title",
        "x_axis_title_margin": 23,
        "y_axis_title": "Saved Y title",
        "y_axis_title_margin": 37,
    }
    chart = SimpleNamespace(
        id=1495,
        datasource_id=1,
        datasource=object(),
        slice_name="Gantt",
        params=__import__("json").dumps(
            {
                **_native_example(),
                **saved_presentation,
                "series": "priority",
                "y_axis_title_position": "start",
            }
        ),
        uuid="chart-uuid",
        viz_type="gantt_chart",
    )
    updated_chart = SimpleNamespace(
        id=1495,
        slice_name="Gantt",
        uuid="chart-uuid",
        viz_type="gantt_chart",
    )

    async def run_update(config: GanttChartConfig) -> dict[str, object]:
        request = UpdateChartRequest(
            identifier=1495,
            config=config,
            generate_preview=False,
            preview_formats=[],
        )
        with (
            patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=Mock(id=1),
            ),
            patch.object(
                update_chart_module, "find_chart_by_identifier", return_value=chart
            ),
            patch(
                "superset.mcp_service.auth.check_chart_data_access",
                return_value=SimpleNamespace(is_valid=True, error=None),
            ),
            patch.object(
                DatasetValidator,
                "_get_dataset_context",
                return_value=_dataset_context(),
            ),
            patch.object(
                update_chart_module,
                "_validate_update_against_dataset",
                return_value=None,
            ),
            patch("superset.commands.chart.update.UpdateChartCommand") as command,
            patch.object(
                update_chart_module, "analyze_chart_capabilities", return_value=None
            ),
            patch.object(
                update_chart_module, "analyze_chart_semantics", return_value=None
            ),
            patch.object(
                update_chart_module,
                "get_superset_base_url",
                return_value="http://superset",
            ),
        ):
            command.return_value.run.return_value = updated_chart
            result = await update_chart_module.update_chart(request=request, ctx=Mock())

        assert result.success is True
        payload = command.call_args.args[1]
        return __import__("json").loads(payload["params"])

    omitted = await run_update(
        _config(
            series={"name": "priority"},
            tooltip_columns=[{"name": "project"}],
            order_by=[{"column": "priority", "ascending": True}],
        )
    )
    assert {key: omitted[key] for key in saved_presentation} == saved_presentation
    assert "y_axis_title_position" not in omitted
    assert omitted["start_time"] == "Start_Time"
    assert omitted["end_time"] == "End_Time"
    assert omitted["y_axis"] == "Task"
    assert omitted["series"] == "Priority"
    assert omitted["tooltip_columns"] == ["Project"]
    assert omitted["order_by_cols"] == ['["Priority", true]']

    explicit_defaults = {
        "color_scheme": None,
        "show_legend": True,
        "legend_orientation": "top",
        "legend_type": "scroll",
        "legend_margin": None,
        "legend_sort": None,
        "zoomable": False,
        "subcategories": False,
        "show_extra_controls": False,
        "x_axis_time_bounds": None,
        "x_axis_time_format": "smart_date",
        "tooltip_time_format": "smart_date",
        "tooltip_values_format": "SMART_NUMBER",
        "x_axis_title": None,
        "x_axis_title_margin": None,
        "y_axis_title": None,
        "y_axis_title_margin": None,
    }
    overridden = await run_update(
        _config(series={"name": "priority"}, **explicit_defaults)
    )
    expected_native_defaults = {
        "color_scheme": None,
        "show_legend": True,
        "legendOrientation": "top",
        "legendType": "scroll",
        "legendMargin": None,
        "legendSort": None,
        "zoomable": False,
        "subcategories": False,
        "show_extra_controls": False,
        "x_axis_time_bounds": None,
        "x_axis_time_format": "smart_date",
        "tooltipTimeFormat": "smart_date",
        "tooltipValuesFormat": "SMART_NUMBER",
        "x_axis_title": None,
        "x_axis_title_margin": None,
        "y_axis_title": None,
        "y_axis_title_margin": None,
    }
    assert {
        key: overridden[key] for key in expected_native_defaults
    } == expected_native_defaults

    omitted_dependency = await run_update(_config())
    assert omitted_dependency["series"] == "priority"
    assert omitted_dependency["subcategories"] is True
    GanttChartConfig.model_validate(omitted_dependency)

    removed_dependency = await run_update(_config(series=None))
    assert removed_dependency.get("series") is None
    assert removed_dependency["subcategories"] is False
    GanttChartConfig.model_validate(removed_dependency)


def test_gantt_rejects_false_success_y_axis_title_position() -> None:
    schema = _get_chart_type_schema_impl("gantt")["schema"]
    assert "y_axis_title_position" not in schema["properties"]
    with pytest.raises(ValidationError, match="unsupported by Gantt"):
        GanttChartConfig.model_validate(
            {**_config().model_dump(), "y_axis_title_position": "start"}
        )


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
