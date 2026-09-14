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

"""Product-path coverage for typed ECharts Bullet MCP support."""

import math
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from decimal import Decimal
from enum import Enum, IntEnum, StrEnum
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import pytest
import pytz
from dateutil import tz as dateutil_tz
from dateutil.zoneinfo import get_zonefile_instance
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
)
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    map_bullet_config,
    map_config_to_form_data,
    MCP_DASHBOARD_TIME_FILTER_SUBJECT,
    merge_update_form_data,
    validate_merged_bullet_form_data,
)
from superset.mcp_service.chart.compile import _compile_chart
from superset.mcp_service.chart.preview_utils import (
    _generate_ascii_preview_from_data,
    _generate_vega_lite_preview_from_data,
    _javascript_number_string,
    BulletOutputError,
    generate_preview_from_form_data,
    resolve_bullet_render_model,
)
from superset.mcp_service.chart.query_result import (
    _chart_data_duration_text,
    _chart_data_temporal_number,
)
from superset.mcp_service.chart.schemas import (
    ASCIIPreview,
    BulletChartConfig,
    ChartConfig,
    ChartError,
    DataColumn,
    GenerateChartRequest,
    GetChartPreviewRequest,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
    VegaLitePreview,
    XYChartConfig,
)
from superset.mcp_service.chart.tool.generate_chart import generate_chart
from superset.mcp_service.chart.tool.get_chart_data import (
    _candidates_single_numeric,
    _VIZ_CATEGORY,
)
from superset.mcp_service.chart.tool.get_chart_preview import (
    ASCIIPreviewStrategy,
    TablePreviewStrategy,
    VegaLitePreviewStrategy,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
    VALID_CHART_TYPES,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
    update_chart,
)
from superset.mcp_service.chart.tool.update_chart_preview import update_chart_preview
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.utils.json import json_int_dttm_ser


def _reject_scalar_conversion(*_args: object, **_kwargs: object) -> Any:
    raise AssertionError("hostile query scalar method must not run")


class _PathHostileStr(str):
    __getitem__ = _reject_scalar_conversion
    __str__ = _reject_scalar_conversion


class _PathHostileEnum(str, Enum):
    FAILED = "warehouse unavailable"

    @property
    def value(self) -> str:
        """Reject the public descriptor while preserving Enum's stored value."""
        return _reject_scalar_conversion()

    __getitem__ = _reject_scalar_conversion
    __str__ = _reject_scalar_conversion


class _OutputHostileInt(int):
    __float__ = _reject_scalar_conversion
    __str__ = _reject_scalar_conversion


class _OutputHostileFloat(float):
    __float__ = _reject_scalar_conversion
    __str__ = _reject_scalar_conversion


class _OutputHostileStr(str):
    __str__ = _reject_scalar_conversion
    strip = _reject_scalar_conversion


class _OutputHostileDecimal(Decimal):
    __float__ = _reject_scalar_conversion
    __str__ = _reject_scalar_conversion


class _OutputSafeIntEnum(IntEnum):
    VALUE = 12


class _OutputSafeStrEnum(StrEnum):
    VALUE = "12.5"


_OutputSafeIntEnum.__float__ = _reject_scalar_conversion  # type: ignore[method-assign]
_OutputSafeIntEnum.__str__ = _reject_scalar_conversion  # type: ignore[method-assign]
_OutputSafeStrEnum.__float__ = _reject_scalar_conversion  # type: ignore[attr-defined]
_OutputSafeStrEnum.__str__ = _reject_scalar_conversion  # type: ignore[method-assign]


def _simple_metric(name: str = "revenue") -> dict[str, str]:
    return {"name": name, "aggregate": "SUM"}


def _tool_user() -> SimpleNamespace:
    return SimpleNamespace(id=1, username="admin", roles=[], groups=[])


def _orm_dataset() -> SimpleNamespace:
    def column(
        name: str, type_: str, *, temporal: bool = False, numeric: bool = False
    ) -> SimpleNamespace:
        return SimpleNamespace(
            column_name=name,
            type=type_,
            is_temporal=temporal,
            is_numeric=numeric,
            is_dttm=temporal,
            python_date_format=None,
        )

    return SimpleNamespace(
        id=7,
        table_name="sales",
        schema=None,
        main_dttm_col="OrderDate",
        database=SimpleNamespace(database_name="main", db_engine_spec=None),
        columns=[
            column("Revenue", "NUMERIC", numeric=True),
            column("Region", "VARCHAR"),
            column("Team", "VARCHAR"),
            column("Status", "VARCHAR"),
            column("OrderDate", "TIMESTAMP", temporal=True),
            column("EventDate", "TIMESTAMP", temporal=True),
        ],
        metrics=[
            SimpleNamespace(
                metric_name="SavedRevenue",
                expression="SUM(Revenue)",
                description=None,
            )
        ],
    )


def test_bullet_discriminated_union_uses_exact_tag() -> None:
    config = TypeAdapter(ChartConfig).validate_python(
        {"chart_type": "bullet", "metric": _simple_metric()}
    )
    assert isinstance(config, BulletChartConfig)
    with pytest.raises(ValidationError):
        TypeAdapter(ChartConfig).validate_python(
            {"chart_type": "bullet_chart", "metric": _simple_metric()}
        )


def test_bullet_equal_dimension_aliases_are_order_independent_and_round_trip() -> None:
    for payload in (
        {
            "dimensions": [{"name": "Region", "label": "Market"}, "Team"],
            "groupby": ["Region", {"column_name": "Team"}],
        },
        {
            "groupby": ["Region", {"column": "Team"}],
            "dimensions": [{"name": "Region", "label": "Market"}, "Team"],
        },
    ):
        config = BulletChartConfig.model_validate(
            {"metric": _simple_metric(), **payload}
        )
        assert [dimension.name for dimension in config.dimensions or []] == [
            "Region",
            "Team",
        ]
        mapped = map_bullet_config(config)
        assert mapped["groupby"] == ["Region", "Team"]
        round_trip = BulletChartConfig.model_validate(mapped)
        assert [dimension.name for dimension in round_trip.dimensions or []] == [
            "Region",
            "Team",
        ]


def test_bullet_dimension_aliases_require_exact_physical_identity() -> None:
    """Schema-only alias resolution must not merge quoted case variants."""
    with pytest.raises(ValidationError, match="Conflicting Bullet dimension aliases"):
        BulletChartConfig.model_validate(
            {
                "metric": _simple_metric(),
                "dimensions": ["Region"],
                "groupby": ["region"],
            }
        )


@pytest.mark.parametrize(
    "request_payload",
    [
        {"dataset_id": 7},
        {"identifier": 9},
        {"dataset_id": 7, "form_data_key": "preview"},
    ],
)
@pytest.mark.parametrize("reverse", [False, True])
def test_bullet_request_models_reject_conflicting_dimension_aliases(
    request_payload: dict[str, object], reverse: bool
) -> None:
    aliases = [
        ("dimensions", [{"name": "Region"}, {"name": "Team"}]),
        ("groupby", ["Team", "Region"]),
    ]
    if reverse:
        aliases.reverse()
    config = {"chart_type": "bullet", "metric": _simple_metric(), **dict(aliases)}
    payload = {**request_payload, "config": config}
    request_type = (
        UpdateChartRequest
        if "identifier" in request_payload
        else (
            UpdateChartPreviewRequest
            if "form_data_key" in request_payload
            else GenerateChartRequest
        )
    )
    with pytest.raises(ValidationError, match="Conflicting Bullet dimension aliases"):
        request_type.model_validate(payload)


@pytest.mark.parametrize(
    "metric",
    [
        {"name": "revenue", "aggregate": "SUM", "label": "Revenue"},
        {"name": "saved_revenue", "saved_metric": True},
        {"sql_expression": "SUM(revenue) / COUNT(*)", "label": "Average"},
    ],
)
def test_bullet_accepts_simple_saved_and_sql_metrics(metric: dict[str, object]) -> None:
    config = BulletChartConfig(metric=metric)
    form_data = map_bullet_config(config)
    assert form_data["viz_type"] == "bullet"
    assert form_data["metric"]


def test_bullet_native_form_data_round_trip_is_semantically_stable() -> None:
    native = {
        "viz_type": "bullet",
        "datasource": "7__table",
        "metric": {
            "aggregate": "SUM",
            "column": {"column_name": "Revenue"},
            "expressionType": "SIMPLE",
            "label": "Total Revenue",
        },
        "groupby": ["Region", "Team"],
        "ranges": "100,250,500",
        "range_labels": "Minimum,Target,Stretch",
        "markers": "300",
        "marker_labels": "Plan",
        "marker_lines": "400",
        "marker_line_labels": "Forecast",
        "y_axis_format": "$,.0f",
        "show_labels": False,
        "show_legend": True,
        "row_limit": 250,
        "orderby": [["Region", True], ["Total Revenue", False]],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "Status",
                "operator": "==",
                "comparator": "Active",
            }
        ],
    }
    config = BulletChartConfig.model_validate(native)
    mapped = map_bullet_config(config)

    assert mapped["metric"]["label"] == "Total Revenue"
    assert mapped["groupby"] == ["Region", "Team"]
    assert mapped["ranges"] == "100,250,500"
    assert mapped["range_labels"] == "Minimum,Target,Stretch"
    assert mapped["markers"] == "300"
    assert mapped["marker_lines"] == "400"
    assert mapped["show_labels"] is False
    assert mapped["show_legend"] is True
    assert mapped["orderby"][0] == ["Region", True]
    assert mapped["orderby"][1][0]["label"] == "Total Revenue"
    assert mapped["adhoc_filters"][0]["subject"] == "Status"


def test_bullet_presentation_numbers_use_shortest_round_trip_safe_tokens() -> None:
    ranges = [1.2345678901234567, 1.7976931348623157e308]
    markers = [5e-324, -0.0]
    marker_lines = [9.876543210987654e-200]
    config = BulletChartConfig(
        metric=_simple_metric(),
        ranges=ranges,
        markers=markers,
        marker_lines=marker_lines,
        show_legend=True,
    )
    mapped = map_bullet_config(config)

    for key, expected in (
        ("ranges", ranges),
        ("markers", markers),
        ("marker_lines", marker_lines),
    ):
        tokens = mapped[key].split(",")
        assert [float(token) for token in tokens] == expected
        assert all(
            float(token).hex() == value.hex()
            for token, value in zip(tokens, expected, strict=True)
        )

    round_trip = BulletChartConfig.model_validate(mapped)
    assert round_trip.ranges == ranges
    assert round_trip.markers == markers
    assert round_trip.marker_lines == marker_lines

    model = resolve_bullet_render_model(
        [{"SUM(revenue)": 1.0}],
        mapped,
    )
    assert model.ranges == ranges
    assert model.markers == markers
    assert model.marker_lines == marker_lines
    assert (
        "1.7976931348623157e+308"
        in _generate_ascii_preview_from_data(
            [{"SUM(revenue)": 1.0}], mapped
        ).ascii_content
    )
    vega = _generate_vega_lite_preview_from_data([{"SUM(revenue)": 1.0}], mapped)
    assert vega.specification["layer"]


def test_bullet_native_saved_metric_and_legacy_metric_aliases() -> None:
    saved = BulletChartConfig.model_validate(
        {"viz_type": "bullet", "metric": "saved_revenue"}
    )
    legacy = BulletChartConfig.model_validate(
        {"viz_type": "bullet", "metric": "sum__revenue"}
    )
    assert saved.metric.saved_metric is True
    assert saved.metric.name == "saved_revenue"
    assert legacy.metric.name == "sum__revenue"
    assert legacy.metric.saved_metric is True


@pytest.mark.parametrize("metric_name", ["sum__num", "sum__SP_POP_TOTL"])
@pytest.mark.parametrize(
    ("request_type", "request_fields"),
    [
        (GenerateChartRequest, {"dataset_id": 7}),
        (UpdateChartRequest, {"identifier": 9}),
        (UpdateChartPreviewRequest, {"dataset_id": 7}),
    ],
)
def test_bullet_repository_metric_names_round_trip_as_saved_metrics_on_all_requests(
    metric_name: str,
    request_type: type[
        GenerateChartRequest | UpdateChartRequest | UpdateChartPreviewRequest
    ],
    request_fields: dict[str, object],
) -> None:
    request = request_type.model_validate(
        {**request_fields, "config": {"chart_type": "bullet", "metric": metric_name}}
    )
    config = request.config
    assert isinstance(config, BulletChartConfig)
    assert config.metric.saved_metric is True
    assert map_bullet_config(config)["metric"] == metric_name


@pytest.mark.parametrize(
    ("native_operator", "typed_operator", "round_trip_operator"),
    [
        ("EQUALS", "=", "=="),
        ("NOT_EQUALS", "!=", "!="),
        ("LESS_THAN", "<", "<"),
        ("LESS_THAN_OR_EQUAL", "<=", "<="),
        ("GREATER_THAN", ">", ">"),
        ("GREATER_THAN_OR_EQUAL", ">=", ">="),
        ("IN", "IN", "IN"),
        ("NOT_IN", "NOT IN", "NOT IN"),
        ("LIKE", "LIKE", "LIKE"),
        ("ILIKE", "ILIKE", "ILIKE"),
        ("IS_NULL", "IS NULL", "IS NULL"),
        ("IS_NOT_NULL", "IS NOT NULL", "IS NOT NULL"),
    ],
)
def test_bullet_native_filter_operator_names_round_trip(
    native_operator: str, typed_operator: str, round_trip_operator: str
) -> None:
    comparator: object
    if native_operator.startswith("IS_"):
        comparator = None
    elif native_operator in {"IN", "NOT_IN"}:
        comparator = ["North"]
    else:
        comparator = "North"
    config = BulletChartConfig.model_validate(
        {
            "viz_type": "bullet",
            "metric": "SavedRevenue",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "Region",
                    "operator": native_operator,
                    "comparator": comparator,
                }
            ],
        }
    )

    assert config.filters is not None
    assert config.filters[0].op == typed_operator
    mapped = map_bullet_config(config)
    assert mapped["adhoc_filters"][0]["operator"] == round_trip_operator


def test_bullet_legacy_label_only_saved_metric_adapter_is_strict_and_bounded() -> None:
    config = BulletChartConfig.model_validate(
        {"viz_type": "bullet", "metric": {"label": "sum__num"}}
    )
    assert config.metric.saved_metric is True
    assert map_bullet_config(config)["metric"] == "sum__num"

    with pytest.raises(ValidationError):
        BulletChartConfig.model_validate(
            {
                "viz_type": "bullet",
                "metric": {"label": "sum__num", "aggregate": "SUM"},
            }
        )
    with pytest.raises(ValidationError, match="at most 255"):
        BulletChartConfig.model_validate(
            {"viz_type": "bullet", "metric": {"label": "m" * 256}}
        )


@pytest.mark.parametrize(
    "metric",
    [
        "SavedRevenue",
        {
            "aggregate": "SUM",
            "column": {"column_name": "Revenue"},
            "expressionType": "SIMPLE",
            "label": "Simple Revenue",
        },
        {
            "aggregate": None,
            "column": None,
            "expressionType": "SQL",
            "sqlExpression": "SUM(Revenue)",
            "label": "SQL Revenue",
        },
    ],
)
def test_bullet_all_metric_shapes_round_trip_full_native_presentation(
    metric: object,
) -> None:
    native = {
        "viz_type": "bullet",
        "metric": metric,
        "groupby": ["Region"],
        "ranges": "50,100",
        "range_labels": "Low,High",
        "markers": "75",
        "marker_labels": "Plan",
        "marker_lines": "90",
        "marker_line_labels": "Forecast",
        "y_axis_format": "$,.0f",
        "show_labels": True,
        "show_legend": True,
    }
    mapped = map_bullet_config(BulletChartConfig.model_validate(native))
    assert validate_merged_bullet_form_data(mapped) is not None
    assert mapped["groupby"] == ["Region"]
    assert mapped["ranges"] == "50,100"
    assert mapped["marker_line_labels"] == "Forecast"


def test_bullet_rejects_invalid_roles_and_output_collisions() -> None:
    with pytest.raises(ValidationError, match="physical dimension"):
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[{"name": "region", "aggregate": "COUNT"}],
        )
    with pytest.raises(ValidationError, match="Duplicate Bullet dimension"):
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[{"name": "Region"}, {"name": "Region"}],
        )
    with pytest.raises(ValidationError, match="conflicts with a dimension"):
        BulletChartConfig(
            metric={"name": "revenue", "aggregate": "SUM", "label": "Region"},
            dimensions=[{"name": "Region", "label": "Friendly"}],
        )


def test_bullet_accepts_short_labels_and_rejects_bad_order_target() -> None:
    config = BulletChartConfig(
        metric=_simple_metric(), ranges=[1, 2], range_labels=["Only one"]
    )
    assert config.range_labels == ["Only one"]
    with pytest.raises(ValidationError, match="unknown: not_a_role"):
        BulletChartConfig(metric=_simple_metric(), order_by=[{"column": "not_a_role"}])


def test_bullet_dimension_labels_are_input_aliases_not_result_aliases() -> None:
    config = BulletChartConfig(
        metric={"name": "Revenue", "aggregate": "SUM", "label": "Total"},
        dimensions=[
            {"name": "Team", "label": "Region"},
            {"name": "Region", "label": "Market"},
        ],
        # The exact physical Region must win over Team's display label.
        order_by=[
            {"column": "Region", "ascending": True},
            {"column": "Revenue", "ascending": False},
        ],
    )
    form_data = map_bullet_config(config)
    assert form_data["groupby"] == ["Team", "Region"]
    assert form_data["orderby"] == [
        ["Region", True],
        [form_data["metric"], False],
    ]

    label_order = map_bullet_config(
        BulletChartConfig(
            metric=config.metric,
            dimensions=config.dimensions,
            order_by=[{"column": "Market"}],
        )
    )
    assert label_order["orderby"] == [["Region", False]]

    model = resolve_bullet_render_model(
        [{"Team": "Blue", "Region": "North", "Total": 10}], form_data
    )
    assert model.dimensions == ["Team", "Region"]
    assert [model.rows[0][name] for name in model.dimensions] == ["Blue", "North"]


def test_bullet_rejects_ambiguous_display_alias_for_ordering() -> None:
    with pytest.raises(ValidationError, match="ambiguous display alias"):
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[
                {"name": "Region", "label": "Area"},
                {"name": "Team", "label": "area"},
            ],
            order_by=[{"column": "AREA"}],
        )


@pytest.mark.parametrize(
    ("metric", "order_target", "output"),
    [
        (
            {"name": "SavedRevenue", "saved_metric": True, "label": "Friendly"},
            "Friendly",
            "SavedRevenue",
        ),
        (
            {"name": "Revenue", "aggregate": "SUM", "label": "Simple Total"},
            "Revenue",
            "Simple Total",
        ),
        (
            {"sql_expression": "SUM(Revenue)", "label": "SQL Total"},
            "SQL Total",
            "SQL Total",
        ),
    ],
)
def test_bullet_metric_shapes_share_physical_dimension_output_contract(
    metric: dict[str, object], order_target: str, output: str
) -> None:
    config = BulletChartConfig(
        metric=metric,
        dimensions=[{"name": "Region", "label": "Market"}],
        order_by=[{"column": order_target}],
    )
    form_data = map_bullet_config(config)
    assert form_data["groupby"] == ["Region"]
    assert form_data["orderby"] == [[form_data["metric"], False]]
    model = resolve_bullet_render_model([{"Region": "North", output: 12}], form_data)
    assert model.metric_field == output
    assert model.dimensions == ["Region"]


def test_bullet_mapper_preserves_omission_and_honors_explicit_values() -> None:
    omitted = map_bullet_config(BulletChartConfig(metric=_simple_metric()))
    explicit = map_bullet_config(
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[],
            filters=[],
            ranges=[],
            show_labels=False,
            show_legend=False,
            row_limit=42,
            time_range=None,
        )
    )
    for key in (
        "groupby",
        "adhoc_filters",
        "ranges",
        "show_labels",
        "show_legend",
        "row_limit",
        "time_range",
    ):
        assert key not in omitted
    assert explicit["groupby"] == []
    assert explicit["adhoc_filters"] == []
    assert explicit["ranges"] == ""
    assert explicit["show_labels"] is False
    assert explicit["show_legend"] is False
    assert explicit["row_limit"] == 42
    assert explicit["time_range"] is None


def test_bullet_registry_schema_and_recommendation_metadata() -> None:
    from superset.mcp_service.app import get_default_instructions
    from superset.mcp_service.chart.registry import display_name_for_viz_type, get

    plugin = get("bullet")
    assert plugin is not None
    assert plugin.resolve_viz_type(None) == "bullet"
    assert display_name_for_viz_type("bullet") == "Bullet Chart"
    assert "bullet" in VALID_CHART_TYPES
    discovered = _get_chart_type_schema_impl("bullet")
    assert discovered["chart_type"] == "bullet"
    assert discovered["examples"][0]["ranges"] == [100000, 250000, 500000]
    assert _VIZ_CATEGORY["bullet"] == "bullet"
    candidates = _candidates_single_numeric(
        DataColumn(
            name="Revenue",
            display_name="Revenue",
            data_type="numeric",
            sample_values=[1],
            null_count=0,
            unique_count=1,
        ),
        row_count=1,
    )
    assert "bullet chart" in candidates
    guidance = get_default_instructions()
    assert 'chart_type="bullet": Bullet Chart' in guidance
    assert "waterfall, bullet, and interactive_pivot" in guidance


def test_bullet_dataset_normalization_canonicalizes_every_reference() -> None:
    from superset.mcp_service.chart.registry import get

    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[
            {"name": "Revenue", "type": "NUMERIC", "is_numeric": True},
            {"name": "Region", "type": "VARCHAR"},
            {"name": "OrderDate", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "Status", "type": "VARCHAR"},
        ],
        available_metrics=[],
    )
    config = BulletChartConfig(
        metric={"name": "revenue", "aggregate": "SUM"},
        dimensions=[{"name": "region"}],
        temporal_column="orderdate",
        filters=[{"column": "status", "op": "=", "value": "active"}],
        order_by=[{"column": "region", "ascending": True}],
    )
    plugin = get("bullet")
    assert plugin is not None
    normalized = plugin.normalize_column_refs(config, context)
    assert normalized.metric.name == "Revenue"
    assert normalized.dimensions[0].name == "Region"
    assert normalized.temporal_column == "OrderDate"
    assert normalized.filters[0].column == "Status"
    assert normalized.order_by[0].column == "Region"
    assert normalized.model_fields_set == config.model_fields_set


def test_bullet_dataset_normalization_rejects_ambiguous_casefold_candidates() -> None:
    from superset.mcp_service.chart.registry import get

    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[
            {"name": "Revenue", "type": "NUMERIC", "is_numeric": True},
            {"name": "revenue", "type": "NUMERIC", "is_numeric": True},
        ],
        available_metrics=[],
    )
    plugin = get("bullet")
    assert plugin is not None
    config = BulletChartConfig(metric={"name": "REVENUE", "aggregate": "SUM"})
    with pytest.raises(ValueError, match="Revenue, revenue"):
        plugin.normalize_column_refs(config, context)


def test_bullet_numeric_output_constraint_rejects_text_min() -> None:
    from superset.mcp_service.chart.registry import get

    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[{"name": "status", "type": "VARCHAR"}],
        available_metrics=[],
    )
    plugin = get("bullet")
    assert plugin is not None
    config = BulletChartConfig(metric={"name": "status", "aggregate": "MIN"})
    with patch.object(DatasetValidator, "_get_dataset_context", return_value=context):
        error = plugin.post_map_validate(config, {}, dataset_id=7)
    assert error is not None
    assert error.error_type == "non_numeric_bullet_metric"


@pytest.mark.parametrize("reverse_metadata", [False, True])
def test_bullet_exact_case_type_and_role_resolution_is_order_independent(
    reverse_metadata: bool,
) -> None:
    from superset.mcp_service.chart.registry import get

    columns = [
        {"name": "Revenue", "type": "NUMERIC", "is_numeric": True},
        {"name": "revenue", "type": "VARCHAR", "is_numeric": False},
        {"name": "Region", "type": "VARCHAR"},
    ]
    if reverse_metadata:
        columns.reverse()
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=columns,
        available_metrics=[],
    )
    plugin = get("bullet")
    assert plugin is not None

    numeric = BulletChartConfig(metric={"name": "Revenue", "aggregate": "SUM"})
    text = BulletChartConfig(metric={"name": "revenue", "aggregate": "MIN"})
    with patch.object(DatasetValidator, "_get_dataset_context", return_value=context):
        assert plugin.post_map_validate(numeric, {}, dataset_id=7) is None
        error = plugin.post_map_validate(text, {}, dataset_id=7)
    assert error is not None
    assert error.error_type == "non_numeric_bullet_metric"

    roles = BulletChartConfig(
        metric={"name": "Revenue", "aggregate": "SUM"},
        dimensions=[{"name": "revenue"}, {"name": "Region"}],
        filters=[{"column": "revenue", "op": "=", "value": "retail"}],
        order_by=[{"column": "revenue", "ascending": True}],
    )
    normalized = plugin.normalize_column_refs(roles, context)
    assert normalized.metric.name == "Revenue"
    assert [dimension.name for dimension in normalized.dimensions or []] == [
        "revenue",
        "Region",
    ]
    assert normalized.filters
    assert normalized.filters[0].column == "revenue"
    assert normalized.order_by[0].column == "revenue"

    ambiguous = BulletChartConfig(metric={"name": "REVENUE", "aggregate": "SUM"})
    with pytest.raises(ValueError, match="Ambiguous"):
        plugin.normalize_column_refs(ambiguous, context)


@pytest.mark.parametrize("reverse_metadata", [False, True])
def test_generic_aggregation_validation_uses_exact_case_before_type(
    reverse_metadata: bool,
) -> None:
    from superset.mcp_service.chart.schemas import PieChartConfig

    columns = [
        {"name": "Amount", "type": "BIGINT", "is_numeric": True},
        {"name": "amount", "type": "VARCHAR", "is_numeric": False},
    ]
    if reverse_metadata:
        columns.reverse()
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=columns,
        available_metrics=[],
    )

    assert (
        DatasetValidator._validate_aggregations(
            [BulletChartConfig(metric={"name": "Amount", "aggregate": "SUM"}).metric],
            context,
        )
        == []
    )
    errors = DatasetValidator._validate_aggregations(
        [BulletChartConfig(metric={"name": "amount", "aggregate": "SUM"}).metric],
        context,
    )
    assert errors
    assert errors[0].error_type == "invalid_aggregation"

    ambiguous = DatasetValidator._validate_aggregations(
        [BulletChartConfig(metric={"name": "AMOUNT", "aggregate": "SUM"}).metric],
        context,
    )
    assert ambiguous
    assert ambiguous[0].error_type == "ambiguous_column_reference"

    valid, error = DatasetValidator.validate_against_dataset(
        PieChartConfig(
            dimension={"name": "amount"},
            metric={"name": "Amount", "aggregate": "SUM"},
        ),
        7,
        dataset_context=context,
    )
    assert valid is True
    assert error is None


@pytest.mark.parametrize(
    ("metric", "field"),
    [
        ({"name": "Revenue", "aggregate": "SUM", "label": "Simple"}, "Simple"),
        ({"name": "SavedRevenue", "saved_metric": True}, "SavedRevenue"),
        ({"sql_expression": "SUM(Revenue)", "label": "SQL Total"}, "SQL Total"),
    ],
)
def test_bullet_result_roles_are_exact_for_every_metric_shape(
    metric: dict[str, object], field: str
) -> None:
    form_data = map_bullet_config(BulletChartConfig(metric=metric))
    model = resolve_bullet_render_model([{field.swapcase(): "12.5"}], form_data)
    assert model.metric_field == field.swapcase()
    assert model.measures == [12.5]


@pytest.mark.parametrize(
    "rows, message",
    [
        ([{"other": 123}], "missing"),
        ([{"Revenue": "not a number"}], "non-numeric text"),
        ([{"Revenue": math.nan}], "NaN or infinite"),
        ([{"Revenue": math.inf}], "NaN or infinite"),
        ([{"Revenue": 1}, {}], "row 1.*missing"),
        ([{"REVENUE": 1, "revenue": 2}], "ambiguous"),
    ],
)
def test_bullet_result_validation_rejects_malformed_rows(
    rows: list[dict[str, object]], message: str
) -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "amount", "aggregate": "SUM", "label": "Revenue"}
        )
    )
    with pytest.raises(BulletOutputError, match=message):
        resolve_bullet_render_model(rows, form_data)


def test_bullet_result_validation_accepts_null_and_numeric_strings() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "amount", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
        )
    )
    model = resolve_bullet_render_model(
        [
            {"Region": "North", "Revenue": None},
            {"Region": "South", "Revenue": " 4.25 "},
        ],
        form_data,
    )
    assert model.measures == [0.0, 4.25]


@pytest.mark.parametrize(
    ("presentation", "message"),
    [
        ({"ranges": "10,nope"}, r"ranges\[1\].*not numeric"),
        ({"markers": "NaN"}, r"markers\[0\].*NaN or infinite"),
    ],
)
def test_bullet_result_validation_rejects_malformed_presentation(
    presentation: dict[str, object], message: str
) -> None:
    form_data = {
        **map_bullet_config(
            BulletChartConfig(metric={"name": "amount", "aggregate": "SUM"})
        ),
        **presentation,
    }
    with pytest.raises(BulletOutputError, match=message):
        resolve_bullet_render_model([{"SUM(amount)": 1}], form_data)


def test_bullet_compile_accepts_empty_ungrouped_result() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"}
        )
    )
    factory = MagicMock()
    factory.create.return_value = MagicMock()
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
    assert result.row_count == 0


def test_bullet_compile_inspects_top_level_and_query_error_envelopes() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(metric={"name": "Revenue", "aggregate": "SUM"})
    )
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = {
        "status": "success",
        "queries": [{"status": "failed", "message": "warehouse timeout"}],
    }
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
    assert result.success is False
    assert "warehouse timeout" in (result.error or "")


_MALFORMED_QUERY_ENVELOPES: list[object] = [
    None,
    [],
    {},
    {"queries": None},
    {"queries": []},
    {"queries": [None]},
    {"queries": [{}]},
    {"queries": [{"data": None}]},
    {"queries": [{"data": []}, {"data": "not-an-array"}]},
    {
        "queries": [
            {
                "data": [{"Revenue": 12}],
                "colnames": ["Revenue"],
                "coltypes": [],
            }
        ]
    },
]


def _compile_bullet_with_result(result: object) -> Any:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"}
        )
    )
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = result
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
        return _compile_chart(form_data, 7)


@pytest.mark.parametrize("envelope", _MALFORMED_QUERY_ENVELOPES)
def test_bullet_compile_returns_stable_error_for_malformed_envelopes(
    envelope: object,
) -> None:
    result = _compile_bullet_with_result(envelope)
    assert result.success is False
    assert result.error_code == "CHART_COMPILE_FAILED"
    assert result.error_obj is not None
    assert result.error_obj.error_type == "compile_error"


@pytest.mark.parametrize(
    ("data", "expected_code", "expected_type"),
    [
        ([1], "CHART_COMPILE_FAILED", "compile_error"),
        (
            [{"Revenue": 10**10000}],
            "CHART_COMPILE_FAILED",
            "compile_error",
        ),
    ],
)
def test_bullet_compile_returns_malformed_output_for_bad_rows(
    data: list[object],
    expected_code: str,
    expected_type: str,
) -> None:
    result = _compile_bullet_with_result({"queries": [{"data": data}]})
    assert result.success is False
    assert result.error_code == expected_code
    assert result.error_obj is not None
    assert result.error_obj.error_type == expected_type


def test_bullet_shared_query_builder_matches_frontend_build_query() -> None:
    metric = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            row_limit=25,
            order_by=[{"column": "Revenue", "ascending": False}],
        )
    )
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        queries = build_query_dicts_from_form_data(metric, 7, "table")
    assert len(queries) == 1
    assert queries[0]["columns"] == ["Region"]
    assert queries[0]["metrics"] == [metric["metric"]]
    assert queries[0]["orderby"] == metric["orderby"]
    assert queries[0]["row_limit"] == 25


def test_bullet_compile_path_uses_groupby_metric_orderby_and_usable_result() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            order_by=[{"column": "Revenue", "ascending": False}],
        )
    )
    context = MagicMock()
    factory = MagicMock()
    factory.create.return_value = context
    command = MagicMock()
    command.run.return_value = {
        "queries": [{"data": [{"Region": "North", "Revenue": "12.5"}]}]
    }
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
    query = factory.create.call_args.kwargs["queries"][0]
    assert query["columns"] == ["Region"]
    assert query["metrics"] == [form_data["metric"]]
    assert query["orderby"] == form_data["orderby"]
    assert result.success is True
    assert result.row_count == 1


def test_bullet_compile_projects_dataframe_timestamp_before_validation() -> None:
    from superset.dataframe import df_to_records

    dublin = dateutil_tz.gettz("Europe/Dublin")
    new_york = dateutil_tz.gettz("America/New_York")
    assert dublin is not None
    assert new_york is not None
    source_values = [
        pd.Timestamp("2024-01-02 03:04:05.123456789"),
        datetime(2024, 10, 27, 1, 30, tzinfo=dublin, fold=1),
        datetime(2024, 3, 10, 2, 30, tzinfo=new_york),
        datetime(2040, 7, 1, 12, tzinfo=new_york),
    ]
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Category"}],
        )
    )
    rows = df_to_records(
        pd.DataFrame(
            {
                "Category": pd.Series(source_values, dtype=object),
                "Revenue": range(1, len(source_values) + 1),
            }
        ),
        convert_big_integers=False,
    )
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": rows}]}
    captured: list[list[dict[str, Any]]] = []

    def validate(data: list[dict[str, Any]], config: dict[str, Any]) -> Any:
        captured.append(data)
        return resolve_bullet_render_model(data, config)

    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
        patch(
            "superset.mcp_service.chart.preview_utils.resolve_bullet_render_model",
            side_effect=validate,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert [row["Category"] for row in captured[0]] == [
        1704164645123.456,
        1729989000000.0,
        1710052200000.0,
        2224774800000.0,
    ]


def test_bullet_compile_projects_real_dataframe_durations_to_chart_data_wire() -> None:
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultType
    from superset.dataframe import df_to_records
    from superset.utils import json

    source_values = [
        timedelta(0),
        timedelta(days=1, seconds=2, microseconds=3),
        pd.Timedelta(-1, unit="ns"),
        pd.Timedelta("1 days 00:00:02.000003004"),
        np.timedelta64(123456789, "ns"),
        np.timedelta64("NaT"),
    ]
    rows = df_to_records(
        pd.DataFrame(
            {
                "Duration": pd.Series(source_values, dtype=object),
                "Revenue": range(1, len(source_values) + 1),
            }
        ),
        convert_big_integers=False,
    )
    assert type(rows[4]["Duration"]) is pd.Timedelta
    assert rows[5]["Duration"] is None
    expected = [
        None
        if row["Duration"] is None
        else json.loads(json.dumps(row["Duration"], default=json.json_int_dttm_ser))
        for row in rows
    ]

    class _ProducerContext:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {"queries": [{"data": rows, "rowcount": len(rows)}]}

    producer_result = ChartDataCommand(_ProducerContext()).run()  # type: ignore[arg-type]
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Duration"],
    }
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = producer_result
    captured: list[list[dict[str, Any]]] = []

    def validate(data: list[dict[str, Any]], config: dict[str, Any]) -> Any:
        captured.append(data)
        return resolve_bullet_render_model(data, config)

    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
        patch(
            "superset.mcp_service.chart.preview_utils.resolve_bullet_render_model",
            side_effect=validate,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert [row["Duration"] for row in captured[0]] == expected


def test_bullet_compile_accepts_transitionless_dateutil_dataframe_producer() -> None:
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultType
    from superset.dataframe import df_to_records

    names = [
        "UTC",
        "GMT",
        "Universal",
        "Zulu",
        "EST",
        "HST",
        "MST",
        "Etc/GMT+1",
        "Etc/GMT-2",
    ]
    values = []
    for getter in (dateutil_tz.gettz, get_zonefile_instance().get):
        for name in names:
            timezone_value = getter(name)
            assert timezone_value is not None
            values.append(
                datetime(2040, 7, 1, 12, 34, 56, 123456, tzinfo=timezone_value)
            )
    rows = df_to_records(
        pd.DataFrame(
            {
                "Category": pd.Series(values, dtype=object),
                "Revenue": range(1, len(values) + 1),
            }
        ),
        convert_big_integers=False,
    )

    class _ProducerContext:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": rows,
                        "colnames": ["Category", "Revenue"],
                        "rowcount": len(rows),
                    }
                ]
            }

    producer_result = ChartDataCommand(_ProducerContext()).run()  # type: ignore[arg-type]
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Category"}],
        )
    )
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = producer_result
    captured: list[list[dict[str, Any]]] = []

    def validate(data: list[dict[str, Any]], config: dict[str, Any]) -> Any:
        captured.append(data)
        return resolve_bullet_render_model(data, config)

    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
        patch(
            "superset.mcp_service.chart.preview_utils.resolve_bullet_render_model",
            side_effect=validate,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert result.row_count == len(values)
    assert [row["Category"] for row in captured[0]] == [
        json_int_dttm_ser(value) for value in values
    ]


def test_bullet_unsaved_preview_path_returns_faithful_vega_spec() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={
                "name": "revenue_amount",
                "aggregate": "SUM",
                "label": "Total Revenue",
            },
            dimensions=[{"name": "Region"}, {"name": "Team"}],
            ranges=[100, 200],
            markers=[150],
            marker_lines=[175],
        )
    )
    preview = _generate_vega_lite_preview_from_data(
        [{"Region": "North", "Team": "Blue", "Total Revenue": 123}], form_data
    )
    specification = preview.specification
    assert specification["data"]["values"][0]["__mcp_bullet_category"] == (
        "North, Blue"
    )
    bar_layer = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    assert bar_layer["encoding"]["x"]["field"] == "Total Revenue"
    assert bar_layer["encoding"]["y"]["field"] == "__mcp_bullet_category"
    assert [item["field"] for item in bar_layer["encoding"]["tooltip"]] == [
        "__mcp_bullet_category",
        "Total Revenue",
    ]
    assert bar_layer["encoding"]["tooltip"][0]["title"] == "Region, Team"
    assert {layer["mark"]["type"] for layer in specification["layer"]} == {
        "rect",
        "bar",
        "point",
        "rule",
        "text",
    }


def test_bullet_vega_internal_category_key_avoids_adversarial_row_aliases() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "value", "aggregate": "SUM", "label": "Metric"},
            dimensions=[{"name": "__mcp_bullet_category"}],
        )
    )
    preview = _generate_vega_lite_preview_from_data(
        [
            {
                "__mcp_bullet_category": "North",
                "__mcp_bullet_category_1": "occupied",
                "Metric": 10,
            }
        ],
        form_data,
    )
    specification = preview.specification
    bar = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    category_field = bar["encoding"]["y"]["field"]
    assert category_field == "__mcp_bullet_category_2"
    assert specification["data"]["values"][0][category_field] == "North"
    assert bar["encoding"]["y"]["field"] == category_field
    assert "transform" not in specification


def test_bullet_duration_categories_match_chart_data_wire_in_ascii_and_vega() -> None:
    values = [
        timedelta(0),
        timedelta(microseconds=-1),
        timedelta(days=1, seconds=2, microseconds=3),
        pd.Timedelta(0),
        pd.Timedelta(-1, unit="ns"),
        pd.Timedelta("1 days 00:00:02.000003004"),
        np.timedelta64(123456789, "ns"),
        np.timedelta64("NaT"),
    ]
    expected = []
    for value in values:
        projected, reason = _chart_data_duration_text(value)
        assert reason is None
        expected.append("null" if projected is None else projected)
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Duration"],
    }
    data = [
        {"Duration": value, "Revenue": index + 1} for index, value in enumerate(values)
    ]

    vega = _generate_vega_lite_preview_from_data(data, form_data).specification
    bar = next(layer for layer in vega["layer"] if layer["mark"]["type"] == "bar")
    category_field = bar["encoding"]["y"]["field"]
    assert [row[category_field] for row in vega["data"]["values"]] == expected
    assert [row["Duration"] for row in vega["data"]["values"]] == [
        None if value == "null" else value for value in expected
    ]
    assert bar["encoding"]["tooltip"][0]["field"] == category_field

    ascii_preview = _generate_ascii_preview_from_data(data, form_data).ascii_content
    for value in expected:
        assert value[:20] in ascii_preview


def test_bullet_duration_category_rejects_subclass_without_hooks() -> None:
    class HostileTimedelta(timedelta):
        calls = 0

        def _call(self, *_args: object) -> Any:
            type(self).calls += 1
            raise AssertionError("duration hook executed")

        __abs__ = _call
        __eq__ = _call
        __lt__ = _call
        __str__ = _call

    with pytest.raises(BulletOutputError, match="unsupported value type"):
        resolve_bullet_render_model(
            [{"Duration": HostileTimedelta(seconds=1), "Revenue": 1}],
            {"metric": "Revenue", "groupby": ["Duration"]},
        )
    assert HostileTimedelta.calls == 0


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (9007199254740993, "9007199254740992"),
        (9007199254740995, "9007199254740996"),
        (Decimal("1.0000000000000001"), "1"),
        (Decimal("1.0000000000000002"), "1.0000000000000002"),
        (Decimal("1e20"), "100000000000000000000"),
        (Decimal("1e21"), "1e+21"),
        (Decimal("1e-6"), "0.000001"),
        (Decimal("1e-7"), "1e-7"),
        (Decimal("1.7976931348623157e308"), "1.7976931348623157e+308"),
        (Decimal("1.7976931348623159e308"), "Infinity"),
        (Decimal("-1e309"), "-Infinity"),
        (10**400, "Infinity"),
        (Decimal("-0"), "0"),
    ],
)
def test_bullet_number_categories_match_node_ieee754_string_semantics(
    value: int | Decimal, expected: str
) -> None:
    assert _javascript_number_string(value) == expected


@pytest.mark.parametrize(
    "value",
    [float("inf"), Decimal("NaN"), Decimal("Infinity")],
)
def test_bullet_number_categories_reject_nonfinite_source_values(value: object) -> None:
    with pytest.raises(BulletOutputError, match="non-finite"):
        resolve_bullet_render_model(
            [{"Category": value, "Revenue": 1}],
            {"metric": "Revenue", "groupby": ["Category"]},
        )


def test_bullet_nan_category_retains_shared_null_normalization() -> None:
    model = resolve_bullet_render_model(
        [{"Category": float("nan"), "Revenue": 1}],
        {"metric": "Revenue", "groupby": ["Category"]},
    )
    assert model.rows[0]["Category"] is None


def test_bullet_number_category_boundaries_flow_through_ascii_and_vega() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    values = [
        9007199254740993,
        Decimal("1.0000000000000001"),
        Decimal("1e20"),
        Decimal("1e21"),
        Decimal("1e-7"),
        Decimal("1.7976931348623159e308"),
        Decimal("-0"),
    ]
    expected = [
        "9007199254740992",
        "1",
        "100000000000000000000",
        "1e+21",
        "1e-7",
        "Infinity",
        "0",
    ]
    data = [
        {"Category": value, "Revenue": index + 1} for index, value in enumerate(values)
    ]

    vega = _generate_vega_lite_preview_from_data(data, form_data).specification
    category_field = next(
        layer for layer in vega["layer"] if layer["mark"]["type"] == "bar"
    )["encoding"]["y"]["field"]
    assert [row[category_field] for row in vega["data"]["values"]] == expected
    assert "transform" not in vega
    tooltip = next(layer for layer in vega["layer"] if layer["mark"]["type"] == "bar")[
        "encoding"
    ]["tooltip"]
    assert tooltip[0] == {
        "field": category_field,
        "type": "nominal",
        "title": "Category",
    }
    assert all(item.get("field") != "Category" for item in tooltip)
    # Raw normalized dimensions stay available for inspection, while every
    # category-bearing encoding uses the frontend-coerced derived value.
    assert vega["data"]["values"][0]["Category"] == 9007199254740993
    assert vega["data"]["values"][1]["Category"] == Decimal("1.0000000000000001")

    ascii_preview = _generate_ascii_preview_from_data(data, form_data)
    for category in ("9007199254740992", "1e+21", "1e-7", "Infinity"):
        assert category in ascii_preview.ascii_content


def test_bullet_vega_tooltip_uses_joined_derived_numeric_category() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Large integer", "Precise decimal"],
    }
    specification = _generate_vega_lite_preview_from_data(
        [
            {
                "Large integer": 9007199254740993,
                "Precise decimal": Decimal("1.0000000000000001"),
                "Revenue": 1,
            }
        ],
        form_data,
    ).specification
    bar = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    category_field = bar["encoding"]["y"]["field"]

    assert specification["data"]["values"][0][category_field] == ("9007199254740992, 1")
    assert bar["encoding"]["tooltip"][0] == {
        "field": category_field,
        "type": "nominal",
        "title": "Large integer, Precise decimal",
    }
    assert "transform" not in specification


def test_bullet_temporal_category_rejects_hostile_timezone_without_hooks() -> None:
    class _HostileTimezone(tzinfo):
        calls = 0

        def utcoffset(self, _value: datetime | None) -> None:
            type(self).calls += 1
            raise AssertionError("timezone hook invoked")

        def dst(self, _value: datetime | None) -> None:
            type(self).calls += 1
            raise AssertionError("timezone hook invoked")

        def tzname(self, _value: datetime | None) -> str | None:
            type(self).calls += 1
            raise AssertionError("timezone hook invoked")

    with pytest.raises(BulletOutputError, match="unsupported timezone"):
        resolve_bullet_render_model(
            [
                {
                    "Category": datetime(2026, 9, 2, tzinfo=_HostileTimezone()),
                    "Revenue": 1,
                }
            ],
            {"metric": "Revenue", "groupby": ["Category"]},
        )
    assert _HostileTimezone.calls == 0


def test_bullet_timestamp_categories_match_chart_data_wire_and_all_previews() -> None:
    zoneinfo_tz = ZoneInfo("America/New_York")
    pytz_tz = pytz.timezone("America/New_York")
    values = [
        pd.Timestamp("2024-01-02 03:04:05.123456789"),
        pd.Timestamp("2024-01-02 03:04:05.123456789", tz="UTC"),
        pd.Timestamp("2024-01-02 08:34:05.123456789+05:30"),
        pd.Timestamp(datetime(2024, 11, 3, 1, 30, tzinfo=zoneinfo_tz, fold=0)),
        pd.Timestamp(datetime(2024, 11, 3, 1, 30, tzinfo=zoneinfo_tz, fold=1)),
        pd.Timestamp(pytz_tz.localize(datetime(2024, 11, 3, 1, 30), is_dst=True)),
        pd.Timestamp(pytz_tz.localize(datetime(2024, 11, 3, 1, 30), is_dst=False)),
        pd.Timestamp("1969-12-31 23:59:59.999999999"),
        pd.Timestamp("1970-01-01 00:00:00.000000001"),
        np.datetime64("2024-01-02", "D"),
        np.datetime64("2024-01-02T03:04:05.123456789"),
        date(2024, 1, 2),
        pd.NaT,
        np.datetime64("NaT"),
    ]
    expected = [
        "1704164645123.456",
        "1704164645123.456",
        "1704164645123.456",
        "1730611800000",
        "1730615400000",
        "1730611800000",
        "1730615400000",
        "-0.0010000000000287557",
        "0",
        "1704153600000",
        "1704164645123.456",
        "1704153600000",
        "null",
        "null",
    ]
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    data = [
        {"Category": value, "Revenue": index + 1} for index, value in enumerate(values)
    ]

    # Exact pandas Timestamp values match Superset's production serializer,
    # including its pre-epoch/sub-millisecond float behavior.
    for value in values[:9]:
        number, reason = _chart_data_temporal_number(value)
        assert reason is None
        assert number == json_int_dttm_ser(value)

    vega = _generate_vega_lite_preview_from_data(data, form_data).specification
    bar = next(layer for layer in vega["layer"] if layer["mark"]["type"] == "bar")
    category_field = bar["encoding"]["y"]["field"]
    assert [row[category_field] for row in vega["data"]["values"]] == expected
    assert bar["encoding"]["tooltip"][0]["field"] == category_field
    assert bar["encoding"]["tooltip"][0]["title"] == "Category"
    assert "transform" not in vega

    for row, category in zip(data, expected, strict=True):
        ascii_content = _generate_ascii_preview_from_data(
            [row], form_data
        ).ascii_content
        assert category[:20] in ascii_content


def test_bullet_dateutil_categories_preserve_chart_data_selected_instants() -> None:
    dublin = dateutil_tz.gettz("Europe/Dublin")
    new_york = dateutil_tz.gettz("America/New_York")
    assert dublin is not None
    assert new_york is not None
    dateutil_values = [
        datetime(2024, 10, 27, 1, 30, 0, 123456, tzinfo=dublin, fold=1),
        datetime(2024, 3, 10, 2, 30, 0, 123456, tzinfo=new_york),
        datetime(2040, 7, 1, 12, 0, 0, 123456, tzinfo=new_york),
        datetime(
            2024,
            3,
            10,
            2,
            30,
            0,
            123456,
            tzinfo=dateutil_tz.tzoffset("EDT", -4 * 3600),
        ),
        datetime(1969, 12, 31, 23, 59, 59, 999999, tzinfo=dateutil_tz.UTC),
    ]
    equivalent_values = [
        datetime(2024, 3, 10, 6, 30, 0, 123456, tzinfo=timezone.utc),
        pytz.timezone("America/New_York").localize(
            datetime(2024, 3, 10, 1, 30, 0, 123456), is_dst=False
        ),
        datetime(
            2024,
            3,
            10,
            1,
            30,
            0,
            123456,
            tzinfo=ZoneInfo("America/New_York"),
        ),
    ]
    pandas_values = [pd.Timestamp(value) for value in dateutil_values[:3]]
    values = [*dateutil_values, *equivalent_values, *pandas_values]
    expected_numbers = [json_int_dttm_ser(value) for value in values]
    expected_categories = [
        "1729989000123.456",
        "1710052200123.456",
        "2224774800123.456",
        "1710052200123.456",
        "-0.001",
        "1710052200123.456",
        "1710052200123.456",
        "1710052200123.456",
        "1729989000123.456",
        "1710052200123.456",
        "2224774800123.456",
    ]
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    data = [
        {"Category": value, "Revenue": index + 1} for index, value in enumerate(values)
    ]

    for value, expected_number in zip(values, expected_numbers, strict=True):
        projected, reason = _chart_data_temporal_number(value)
        assert reason is None
        assert projected == expected_number

    vega = _generate_vega_lite_preview_from_data(data, form_data).specification
    bar = next(layer for layer in vega["layer"] if layer["mark"]["type"] == "bar")
    category_field = bar["encoding"]["y"]["field"]
    assert [row[category_field] for row in vega["data"]["values"]] == (
        expected_categories
    )
    assert bar["encoding"]["tooltip"][0]["field"] == category_field

    for row, category in zip(data, expected_categories, strict=True):
        ascii_content = _generate_ascii_preview_from_data(
            [row], form_data
        ).ascii_content
        assert category[:20] in ascii_content


def test_bullet_pandas_timestamp_rejects_hostile_timezone_without_hooks() -> None:
    class _ArmedTimezone(tzinfo):
        armed = False
        calls = 0

        def _offset(self) -> timedelta:
            type(self).calls += 1
            if self.armed:
                raise AssertionError("timezone hook invoked")
            return timedelta(hours=1)

        def utcoffset(self, _value: datetime | None) -> timedelta:
            return self._offset()

        def dst(self, _value: datetime | None) -> timedelta:
            return timedelta(0)

        def tzname(self, _value: datetime | None) -> str:
            return "armed"

    hostile_tz = _ArmedTimezone()
    value = pd.Timestamp(datetime(2024, 1, 2, tzinfo=hostile_tz))
    _ArmedTimezone.calls = 0
    _ArmedTimezone.armed = True

    with pytest.raises(BulletOutputError, match="unsupported timezone"):
        resolve_bullet_render_model(
            [{"Category": value, "Revenue": 1}],
            {"metric": "Revenue", "groupby": ["Category"]},
        )
    assert _ArmedTimezone.calls == 0


def test_bullet_categories_match_frontend_string_coercion_and_preserve_values() -> None:
    identifier = UUID("12345678-1234-5678-1234-567812345678")
    values = [
        None,
        "",
        True,
        False,
        12.0,
        12.5,
        -0.0,
        Decimal("12.00"),
        Decimal("12.50"),
        date(2026, 9, 2),
        datetime(2026, 9, 2, 3, 4, 5, tzinfo=timezone.utc),
        datetime(
            2023,
            11,
            5,
            1,
            30,
            tzinfo=ZoneInfo("America/New_York"),
            fold=0,
        ),
        datetime(
            2023,
            11,
            5,
            1,
            30,
            tzinfo=ZoneInfo("America/New_York"),
            fold=1,
        ),
        time(3, 4, 5),
        identifier,
        "null",
        "true",
        12,
    ]
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    preview = _generate_vega_lite_preview_from_data(
        [
            {"Category": value, "Revenue": index + 1}
            for index, value in enumerate(values)
        ],
        form_data,
    )
    rows = preview.specification["data"]["values"]
    categories = [row["__mcp_bullet_category"] for row in rows]
    assert categories == [
        "null",
        "",
        "true",
        "false",
        "12",
        "12.5",
        "0",
        "12",
        "12.5",
        "1788307200000",
        "1788318245000",
        "1699162200000",
        "1699165800000",
        "03:04:05",
        str(identifier),
        "null",
        "true",
        "12",
    ]
    # Null, string, boolean, integral-float, Decimal, and integer collisions
    # are intentional because they are the same frontend category strings.
    assert categories.count("null") == 2
    assert categories.count("true") == 2
    assert categories.count("12") == 3
    assert rows[0]["Category"] is None
    assert rows[2]["Category"] is True
    assert rows[4]["Category"] == 12.0
    assert rows[7]["Category"] == Decimal("12.00")
    assert rows[9]["Category"] == 1788307200000.0
    assert rows[11]["Category"] == 1699162200000.0
    assert rows[12]["Category"] == 1699165800000.0

    ascii_preview = _generate_ascii_preview_from_data(
        [{"Category": None, "Revenue": 1}, {"Category": True, "Revenue": 2}],
        form_data,
    )
    assert "null" in ascii_preview.ascii_content
    assert "true" in ascii_preview.ascii_content


def test_bullet_category_text_is_bounded_without_truncation_collisions() -> None:
    with pytest.raises(BulletOutputError, match="size limit"):
        resolve_bullet_render_model(
            [{"Category": "x" * 2001, "Revenue": 1}],
            {"metric": "Revenue", "groupby": ["Category"]},
        )


def test_grouped_empty_bullet_has_clear_no_data_without_fabricated_category() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Region"],
    }
    model = resolve_bullet_render_model([], form_data)
    assert model.rows == []
    assert model.measures == []
    assert model.dimensions == ["Region"]

    vega = _generate_vega_lite_preview_from_data([], form_data)
    assert vega.specification["data"]["values"] == []
    assert vega.specification["description"] == (
        "No data available for grouped Bullet chart"
    )
    ascii_preview = _generate_ascii_preview_from_data([], form_data)
    assert ascii_preview.ascii_content == ("No data available for grouped Bullet chart")


def test_bullet_derived_category_amplification_is_rejected_at_preview_boundary() -> (
    None
):
    category = "x" * 1800
    rows = [{"Region": category, "Revenue": 1} for _ in range(4800)]
    envelope = {"queries": [{"data": rows}]}
    source_size = len(
        __import__("json").dumps(envelope, separators=(",", ":")).encode()
    )
    assert source_size < 16 * 1024 * 1024

    preview = _unsaved_bullet_result_with_result(
        envelope,
        {
            "viz_type": "bullet",
            "metric": "Revenue",
            "groupby": ["Region"],
        },
    )
    assert isinstance(preview, ChartError)
    assert preview.error_type == "MalformedQueryResult"
    assert "response exceeds" in preview.error


def test_bullet_derived_range_amplification_is_rejected_at_preview_boundary() -> None:
    rows = [{"Region": "x", "Revenue": 1} for _ in range(9500)]
    envelope = {"queries": [{"data": rows}]}
    source_size = len(
        __import__("json").dumps(envelope, separators=(",", ":")).encode()
    )
    assert source_size < 16 * 1024 * 1024

    preview = _unsaved_bullet_result_with_result(
        envelope,
        {
            "viz_type": "bullet",
            "metric": "Revenue",
            "groupby": ["Region"],
            "ranges": "10",
            "range_labels": "x" * 1800,
        },
    )
    assert isinstance(preview, ChartError)
    assert preview.error_type == "MalformedQueryResult"
    assert "response exceeds" in preview.error


def test_bullet_preview_applies_default_band_and_every_presentation_control() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            range_labels=["Baseline", "Capacity"],
            markers=[90],
            marker_labels=["Plan"],
            marker_lines=[105],
            marker_line_labels=["Forecast"],
            y_axis_format="$,.1f",
            show_labels=True,
            show_legend=True,
        )
    )
    preview = _generate_vega_lite_preview_from_data(
        [
            {"Region": "North", "Revenue": 100},
            {"Region": "South", "Revenue": 50},
        ],
        form_data,
    )
    bullet = preview.specification["usermeta"]["bullet"]
    assert bullet["metric"] == "Revenue"
    assert bullet["dimensions"] == ["Region"]
    assert bullet["ranges"] == pytest.approx([0, 110])
    assert bullet["range_labels"] == ["Baseline", "Capacity"]
    assert bullet["markers"] == [90.0]
    assert bullet["marker_labels"] == ["Plan"]
    assert bullet["marker_lines"] == [105.0]
    assert bullet["marker_line_labels"] == ["Forecast"]
    assert bullet["y_axis_format"] == "$,.1f"
    assert bullet["show_labels"] is True
    assert bullet["show_legend"] is True
    bar = next(
        layer
        for layer in preview.specification["layer"]
        if layer["mark"]["type"] == "bar"
    )
    range_tooltip = next(
        item for item in bar["encoding"]["tooltip"] if item.get("title") == "Range"
    )
    assert preview.specification["data"]["values"][0][range_tooltip["field"]] == (
        "Capacity"
    )
    assert any(
        layer["mark"]["type"] == "text" for layer in preview.specification["layer"]
    )
    assert any(
        encoding.get("color", {}).get("legend") == {"title": None}
        for layer in preview.specification["layer"]
        if isinstance((encoding := layer.get("encoding")), dict)
    )


@pytest.mark.parametrize(
    ("measure", "ranges", "labels", "expected"),
    [
        (100, [300, 100, 200], ["High", "Low", "Mid"], "Low"),
        (120.0, [300, 100, 200], ["High", "Low", "Mid"], "Mid"),
        (Decimal("450"), [300, 100, 200], ["High", "Low", "Mid"], "> High"),
        (-5, [10, -10, 0], ["Positive", "Negative", "Zero"], "Zero"),
        (0, [10, 0], ["Positive", "Zero"], "Zero"),
        (50, [100, 200], ["", "High"], None),
        (250, [100, 200], ["Low", ""], None),
    ],
)
def test_bullet_vega_measure_tooltip_matches_frontend_containing_range(
    measure: int | float | Decimal,
    ranges: list[int],
    labels: list[str],
    expected: str | None,
) -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "ranges": ",".join(str(value) for value in ranges),
        "range_labels": ",".join(labels),
    }
    specification = _generate_vega_lite_preview_from_data(
        [{"Revenue": measure}], form_data
    ).specification
    bar = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    range_tooltip = [
        item for item in bar["encoding"]["tooltip"] if item.get("title") == "Range"
    ]

    if expected is None:
        assert range_tooltip == []
        assert all(
            not key.startswith("__mcp_bullet_range")
            for key in specification["data"]["values"][0]
        )
    else:
        assert len(range_tooltip) == 1
        range_field = range_tooltip[0]["field"]
        assert specification["data"]["values"][0][range_field] == expected


def test_bullet_vega_range_tooltip_is_grouped_per_row_and_collision_safe() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Region"],
        "ranges": "100,200,300",
        "range_labels": "Low,Mid,High",
    }
    rows = [
        {
            "Region": "North",
            "Revenue": 100,
            "__mcp_bullet_range": "occupied",
            "__mcp_bullet_range_1": "occupied",
        },
        {
            "Region": "South",
            "Revenue": 120,
            "__mcp_bullet_range": "occupied",
            "__mcp_bullet_range_1": "occupied",
        },
        {
            "Region": "West",
            "Revenue": 350,
            "__mcp_bullet_range": "occupied",
            "__mcp_bullet_range_1": "occupied",
        },
    ]
    specification = _generate_vega_lite_preview_from_data(rows, form_data).specification
    bar = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    range_tooltip = next(
        item for item in bar["encoding"]["tooltip"] if item.get("title") == "Range"
    )
    range_field = range_tooltip["field"]

    assert range_field == "__mcp_bullet_range_2"
    assert [row[range_field] for row in specification["data"]["values"]] == [
        "Low",
        "Mid",
        "> High",
    ]
    assert "transform" not in specification


def test_bullet_vega_omits_range_tooltip_for_frontend_default_labels() -> None:
    specification = _generate_vega_lite_preview_from_data(
        [{"Revenue": 5}],
        {"viz_type": "bullet", "metric": "Revenue", "ranges": "10,20"},
    ).specification
    bar = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    assert all(item.get("title") != "Range" for item in bar["encoding"]["tooltip"])


def test_bullet_vega_empty_range_tooltip_matches_grouping_semantics() -> None:
    presentation = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "ranges": "-1,1",
        "range_labels": "Negative,Positive",
    }
    ungrouped = _generate_vega_lite_preview_from_data([], presentation).specification
    grouped = _generate_vega_lite_preview_from_data(
        [], {**presentation, "groupby": ["Region"]}
    ).specification
    ungrouped_bar = next(
        layer for layer in ungrouped["layer"] if layer["mark"]["type"] == "bar"
    )
    grouped_bar = next(
        layer for layer in grouped["layer"] if layer["mark"]["type"] == "bar"
    )

    range_tooltip = next(
        item
        for item in ungrouped_bar["encoding"]["tooltip"]
        if item.get("title") == "Range"
    )
    assert ungrouped["data"]["values"][0][range_tooltip["field"]] == "Positive"
    assert all(
        item.get("title") != "Range" for item in grouped_bar["encoding"]["tooltip"]
    )
    assert grouped["data"]["values"] == []


def test_bullet_ascii_uses_shared_roles_labels_and_format() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            ranges=[100],
            range_labels=["Healthy"],
            markers=[80],
            marker_labels=["Plan"],
            marker_lines=[90],
            marker_line_labels=["Forecast"],
            y_axis_format="$,.0f",
            show_legend=True,
        )
    )
    preview = _generate_ascii_preview_from_data(
        [{"Region": "North", "Revenue": "75"}], form_data
    )
    assert "North" in preview.ascii_content
    assert "$75" in preview.ascii_content
    assert "Healthy" in preview.ascii_content
    assert "Plan" in preview.ascii_content
    assert "Forecast" in preview.ascii_content


@pytest.mark.parametrize("show_labels", [False, True])
def test_bullet_marker_line_labels_ignore_show_labels_like_frontend(
    show_labels: bool,
) -> None:
    config = BulletChartConfig(
        metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
        marker_lines=[90, 110],
        marker_line_labels=["Plan", "Stretch"],
        show_labels=show_labels,
    )
    form_data = map_bullet_config(config)
    round_trip = map_bullet_config(BulletChartConfig.model_validate(form_data))
    assert round_trip["marker_lines"] == "90,110"
    assert round_trip["marker_line_labels"] == "Plan,Stretch"

    vega = _generate_vega_lite_preview_from_data(
        [{"Revenue": 100}], form_data
    ).specification
    visible_text = [
        layer["encoding"]["text"]["value"]
        for layer in vega["layer"]
        if layer["mark"]["type"] == "text"
        and layer.get("encoding", {}).get("text", {}).get("value")
        in {"Plan", "Stretch"}
    ]
    assert visible_text == ["Plan", "Stretch"]

    ascii_preview = _generate_ascii_preview_from_data([{"Revenue": 100}], form_data)
    assert ascii_preview.ascii_content.count("line Plan") == 1
    assert ascii_preview.ascii_content.count("line Stretch") == 1


def test_bullet_unsaved_preview_handles_empty_and_error_results() -> None:
    dataset = SimpleNamespace(id=7)
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = {"queries": []}
    with (
        patch("superset.extensions.db.session.get", return_value=dataset),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = generate_preview_from_form_data(
            {"viz_type": "bullet", "metric": "count"}, 7, "table"
        )
    assert isinstance(result, ChartError)
    assert result.error_type == "UnsupportedFormat"


def test_bullet_unsaved_preview_rejects_embedded_query_error() -> None:
    dataset = SimpleNamespace(id=7)
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = {
        "queries": [{"status": "error", "error": "metric failed"}]
    }
    with (
        patch("superset.extensions.db.session.get", return_value=dataset),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = generate_preview_from_form_data(
            {"viz_type": "bullet", "metric": "count"}, 7, "vega_lite"
        )
    assert isinstance(result, ChartError)
    assert result.error_type == "QueryError"
    assert "metric failed" in result.error


def _unsaved_bullet_result_with_result(
    result: object, form_data: dict[str, Any] | None = None, format_: str = "vega_lite"
) -> ChartError | ASCIIPreview | VegaLitePreview:
    dataset = SimpleNamespace(id=7)
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = result
    with (
        patch("superset.extensions.db.session.get", return_value=dataset),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        preview = generate_preview_from_form_data(
            form_data or {"viz_type": "bullet", "metric": "Revenue"}, 7, format_
        )
    assert isinstance(preview, (ChartError, ASCIIPreview, VegaLitePreview))
    return preview


def _unsaved_bullet_preview_with_result(result: object) -> ChartError:
    preview = _unsaved_bullet_result_with_result(result)
    assert isinstance(preview, ChartError)
    return preview


@pytest.mark.parametrize("envelope", _MALFORMED_QUERY_ENVELOPES)
def test_bullet_unsaved_preview_structures_malformed_envelopes(
    envelope: object,
) -> None:
    preview = _unsaved_bullet_preview_with_result(envelope)
    assert preview.error_type == "MalformedQueryResult"


def test_bullet_unsaved_preview_structures_oversized_numeric_output() -> None:
    preview = _unsaved_bullet_preview_with_result(
        {"queries": [{"data": [{"Revenue": 10**10000}]}]}
    )
    assert preview.error_type == "MalformedQueryResult"


def test_bullet_empty_saved_and_unsaved_vega_use_same_no_data_contract() -> None:
    envelope: dict[str, Any] = {"queries": [{"data": []}]}
    unsaved = _unsaved_bullet_result_with_result(envelope)
    saved = _saved_bullet_result_with_result(envelope, "vega_lite")
    assert isinstance(unsaved, VegaLitePreview)
    assert isinstance(saved, VegaLitePreview)
    for preview in (unsaved, saved):
        assert preview.specification["data"]["values"] == [
            {"Revenue": 0.0, "__mcp_bullet_category": ""}
        ]
        assert preview.specification["usermeta"]["bullet"]["ranges"] == [0.0, 0.0]

    chart = SimpleNamespace(
        id=9,
        params=__import__("json").dumps(
            {"viz_type": "bullet", "metric": "SavedRevenue"}
        ),
        viz_type="bullet",
        slice_name="Saved Bullet",
    )
    strategy = VegaLitePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=9, format="vega_lite")
    )
    specification = strategy._create_vega_lite_spec([])
    assert specification["data"]["values"] == [
        {"SavedRevenue": 0.0, "__mcp_bullet_category": ""}
    ]


def _saved_bullet_result_with_result(
    result: object,
    format_: str,
    form_data: dict[str, Any] | None = None,
) -> ChartError | ASCIIPreview | VegaLitePreview:
    form_data = form_data or {"viz_type": "bullet", "metric": "Revenue"}
    chart = SimpleNamespace(
        id=9,
        params=__import__("json").dumps(form_data),
        viz_type="bullet",
        slice_name="Saved Bullet",
        datasource_id=7,
        datasource_type="table",
    )
    request = GetChartPreviewRequest(identifier=9, format=format_)
    strategy = (
        ASCIIPreviewStrategy(chart, request)
        if format_ == "ascii"
        else VegaLitePreviewStrategy(chart, request)
    )
    command = MagicMock()
    command.run.return_value = result
    with (
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "build_query_context_from_form_data",
            return_value=MagicMock(),
        ),
        patch.object(strategy, "_authorize_guest_query"),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        preview = strategy.generate()
    assert isinstance(preview, (ChartError, ASCIIPreview, VegaLitePreview))
    return preview


def _saved_bullet_preview_with_result(result: object, format_: str) -> ChartError:
    preview = _saved_bullet_result_with_result(result, format_)
    assert isinstance(preview, ChartError)
    return preview


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        (_PathHostileStr("x" * 1_000_000), "<_PathHostileStr object>"),
        (_PathHostileEnum.FAILED, "warehouse unavailable"),
    ],
)
def test_bullet_compile_and_preview_paths_safely_render_hostile_scalars(
    payload: object, message: str
) -> None:
    envelope = {"error": payload}
    compiled = _compile_bullet_with_result(envelope)
    assert compiled.success is False
    assert message in (compiled.error or "")
    assert len((compiled.error or "").encode("utf-8")) <= 2100

    unsaved = _unsaved_bullet_preview_with_result(envelope)
    saved = _saved_bullet_preview_with_result(envelope, "vega_lite")
    assert unsaved.error_type == saved.error_type == "QueryError"
    assert message in unsaved.error
    assert message in saved.error
    assert len(unsaved.error.encode("utf-8")) <= 2100
    assert len(saved.error.encode("utf-8")) <= 2100


@pytest.mark.parametrize("message", ["short\ud800error", "é\ud800中" * 2000])
def test_bullet_query_paths_replacement_sanitize_surrogate_errors(
    message: str,
) -> None:
    envelope = {"error": message}
    compiled = _compile_bullet_with_result(envelope)
    unsaved = _unsaved_bullet_preview_with_result(envelope)
    saved = _saved_bullet_preview_with_result(envelope, "ascii")

    assert "\ud800" not in (compiled.error or "")
    assert "\ud800" not in unsaved.error
    assert "\ud800" not in saved.error
    assert len((compiled.error or "").encode("utf-8")) <= 2100
    assert len(unsaved.error.encode("utf-8")) <= 2100
    assert len(saved.error.encode("utf-8")) <= 2100


@pytest.mark.parametrize("format_", ["ascii", "vega_lite"])
@pytest.mark.parametrize("envelope", _MALFORMED_QUERY_ENVELOPES)
def test_bullet_saved_preview_structures_malformed_envelopes(
    envelope: object, format_: str
) -> None:
    preview = _saved_bullet_preview_with_result(envelope, format_)
    assert preview.error_type == "MalformedQueryResult"


@pytest.mark.parametrize("format_", ["ascii", "vega_lite"])
def test_bullet_saved_preview_structures_oversized_numeric_output(format_: str) -> None:
    preview = _saved_bullet_preview_with_result(
        {"queries": [{"data": [{"Revenue": 10**10000}]}]}, format_
    )
    assert preview.error_type == "MalformedQueryResult"


@pytest.mark.parametrize(
    "value",
    [
        _OutputHostileInt(12),
        _OutputHostileFloat(12.5),
        _OutputHostileStr("12.5"),
        _OutputHostileDecimal("12.5"),
    ],
    ids=["int-subclass", "float-subclass", "str-subclass", "decimal-subclass"],
)
def test_bullet_output_rejects_scalar_subclasses_on_every_query_path(
    value: object,
) -> None:
    envelope = {"queries": [{"data": [{"Revenue": value}]}]}
    compiled = _compile_bullet_with_result(envelope)
    unsaved = _unsaved_bullet_preview_with_result(envelope)
    saved = _saved_bullet_preview_with_result(envelope, "vega_lite")

    assert compiled.success is False
    assert compiled.error_code == "CHART_COMPILE_FAILED"
    assert unsaved.error_type == saved.error_type == "MalformedQueryResult"
    assert len((compiled.error or "").encode("utf-8")) <= 2000
    assert len(unsaved.error.encode("utf-8")) <= 2000
    assert len(saved.error.encode("utf-8")) <= 2000


@pytest.mark.parametrize(
    "value",
    [_OutputSafeIntEnum.VALUE, _OutputSafeStrEnum.VALUE],
    ids=["int-enum", "str-enum"],
)
def test_bullet_output_uses_enum_backing_without_conversion(value: object) -> None:
    model = resolve_bullet_render_model([{"Revenue": value}], {"metric": "Revenue"})
    assert model.measures == [12.0 if isinstance(value, IntEnum) else 12.5]


def test_bullet_dimension_rejects_custom_values_without_string_conversion() -> None:
    class HostileDimension:
        __repr__ = _reject_scalar_conversion
        __str__ = _reject_scalar_conversion

    with pytest.raises(BulletOutputError, match="unsupported value type"):
        resolve_bullet_render_model(
            [{"Region": HostileDimension(), "Revenue": 12}],
            {"metric": "Revenue", "groupby": ["Region"]},
        )


def test_bullet_rejects_dict_subclass_rows_without_invoking_overrides() -> None:
    class HostileRow(dict[str, object]):
        __contains__ = _reject_scalar_conversion
        __getitem__ = _reject_scalar_conversion
        __iter__ = _reject_scalar_conversion
        __len__ = _reject_scalar_conversion

    envelope = {"queries": [{"data": [HostileRow(Revenue=12)]}]}
    assert _compile_bullet_with_result(envelope).error_code == "CHART_COMPILE_FAILED"
    assert _unsaved_bullet_preview_with_result(envelope).error_type == (
        "MalformedQueryResult"
    )


def test_bullet_saved_table_preview_is_explicitly_unsupported() -> None:
    chart = SimpleNamespace(
        id=9,
        params=__import__("json").dumps(
            {"viz_type": "bullet", "metric": "SavedRevenue"}
        ),
        viz_type="bullet",
        slice_name="Saved Bullet",
    )
    result = TablePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=9, format="table")
    ).generate()
    assert isinstance(result, ChartError)
    assert result.error_type == "UnsupportedFormat"


def test_bullet_capabilities_match_implemented_preview_and_data_roles() -> None:
    ungrouped = BulletChartConfig(metric=_simple_metric())
    grouped = BulletChartConfig(
        metric=_simple_metric(), dimensions=[{"name": "Region"}]
    )
    assert analyze_chart_capabilities("bullet", ungrouped).model_dump() == {
        "supports_interaction": True,
        "supports_real_time": False,
        "supports_drill_down": False,
        "supports_export": True,
        "optimal_formats": ["url", "vega_lite", "ascii"],
        "data_types": ["metric"],
    }
    assert analyze_chart_capabilities("bullet", grouped).data_types == [
        "metric",
        "categorical",
    ]


def test_bullet_saved_preview_uses_native_roles_aliases_and_overlays() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": {
            "aggregate": "SUM",
            "column": {"column_name": "revenue_amount"},
            "expressionType": "SIMPLE",
            "label": "Total Revenue",
        },
        "groupby": ["Region", "Team"],
        "ranges": "100,250",
        "markers": "200",
        "marker_lines": "225",
    }
    chart = SimpleNamespace(
        id=9,
        params=__import__("json").dumps(form_data),
        viz_type="bullet",
        slice_name="Saved Bullet",
    )
    strategy = VegaLitePreviewStrategy(
        chart,
        GetChartPreviewRequest(identifier=9, format="vega_lite"),
    )
    specification = strategy._create_vega_lite_spec(
        [{"Region": "North", "Team": "Blue", "Total Revenue": 123}]
    )

    assert specification["data"]["values"][0]["__mcp_bullet_category"] == (
        "North, Blue"
    )
    assert "transform" not in specification
    bar_layer = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    assert bar_layer["encoding"]["x"]["field"] == "Total Revenue"
    assert bar_layer["encoding"]["y"]["field"] == "__mcp_bullet_category"
    range_layers = [
        layer for layer in specification["layer"] if layer["mark"]["type"] == "rect"
    ]
    assert range_layers
    assert all(
        layer["encoding"]["y"] == bar_layer["encoding"]["y"] for layer in range_layers
    )
    assert {layer["mark"]["type"] for layer in specification["layer"]} == {
        "rect",
        "bar",
        "point",
        "rule",
        "text",
    }


def test_bullet_saved_sql_metric_without_label_uses_expression_result_field() -> None:
    expression = "SUM(revenue) / COUNT(*)"
    preview = _generate_vega_lite_preview_from_data(
        [{"Region": "North", expression: 12.5}],
        {
            "viz_type": "bullet",
            "metric": {
                "expressionType": "SQL",
                "sqlExpression": expression,
            },
            "groupby": ["Region"],
            "ranges": "10,20",
        },
    )

    bar = next(
        layer
        for layer in preview.specification["layer"]
        if layer["mark"]["type"] == "bar"
    )
    assert bar["encoding"]["x"]["field"] == expression


def test_bullet_update_paths_preserve_omitted_native_state() -> None:
    existing = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region"],
        "ranges": "10,20",
        "markers": "15",
        "show_labels": True,
        "show_legend": True,
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "Status",
                "operator": "==",
                "comparator": "Active",
            }
        ],
    }
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    request = UpdateChartRequest(
        identifier=9,
        config=BulletChartConfig(metric=_simple_metric("NewRevenue")),
        generate_preview=False,
    )
    payload = _build_update_payload(request, chart, request.config)
    assert isinstance(payload, dict)
    persisted = __import__("json").loads(payload["params"])
    assert persisted["metric"]["column"]["column_name"] == "NewRevenue"
    assert persisted["groupby"] == ["Region"]
    assert persisted["ranges"] == "10,20"
    assert persisted["markers"] == "15"
    assert persisted["show_labels"] is True
    assert persisted["adhoc_filters"] == existing["adhoc_filters"]

    preview = _build_preview_form_data(request, chart, request.config)
    assert isinstance(preview, dict)
    assert preview["ranges"] == "10,20"
    assert preview["show_legend"] is True


def test_bullet_update_paths_honor_explicit_clear_and_false() -> None:
    existing = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region"],
        "ranges": "10,20",
        "show_labels": True,
        "adhoc_filters": [{"subject": "Status"}],
    }
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    config = BulletChartConfig(
        metric=_simple_metric(),
        dimensions=[],
        filters=[],
        ranges=[],
        show_labels=False,
    )
    request = UpdateChartRequest(identifier=9, config=config, generate_preview=False)
    payload = _build_update_payload(request, chart, config)
    assert isinstance(payload, dict)
    persisted = __import__("json").loads(payload["params"])
    assert persisted["groupby"] == []
    assert persisted["ranges"] == ""
    assert persisted["show_labels"] is False
    assert persisted["adhoc_filters"] == []


def _saved_bullet_with_filters() -> dict[str, object]:
    return {
        "viz_type": "bullet",
        "metric": "SavedRevenue",
        "groupby": ["Region"],
        "time_range": "Last year",
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "OrderDate",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "Status",
                "operator": "==",
                "comparator": "Active",
            },
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "OrderDate",
                "operator": "TEMPORAL_RANGE",
                "comparator": "Last year",
            },
        ],
    }


def _saved_bullet_with_opaque_filters() -> dict[str, object]:
    return {
        "viz_type": "bullet",
        "metric": "SavedRevenue",
        "groupby": ["Region"],
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "OrderDate",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SQL",
                "sqlExpression": "Status = 'Active'  ",
            },
            {
                "clause": "HAVING",
                "expressionType": "SIMPLE",
                "subject": "SavedRevenue",
                "operator": ">",
                "comparator": 100,
            },
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "OrderDate",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            },
        ],
    }


@pytest.mark.parametrize("binding_index", [0, 1, 2, None])
@pytest.mark.parametrize("preview_first", [False, True])
def test_bullet_omitted_filters_preserve_exact_native_sequence_at_every_position(
    binding_index: int | None, preview_first: bool
) -> None:
    opaque = _saved_bullet_with_opaque_filters()
    raw_filters = opaque["adhoc_filters"]
    assert isinstance(raw_filters, list)
    filters = list(raw_filters)
    binding = filters.pop()
    if binding_index is not None:
        filters.insert(binding_index, binding)
    existing = {**opaque, "adhoc_filters": filters}
    if binding_index is None:
        existing.pop(MCP_DASHBOARD_TIME_FILTER_SUBJECT)
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    config = BulletChartConfig(metric=_simple_metric("Revenue"))
    request = UpdateChartRequest(identifier=9, config=config)
    with patch(
        "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
        return_value=_orm_dataset(),
    ):
        if preview_first:
            merged = _build_preview_form_data(request, chart, config)
            assert isinstance(merged, dict)
        else:
            payload = _build_update_payload(request, chart, config)
            assert isinstance(payload, dict)
            merged = __import__("json").loads(payload["params"])

    assert merged["adhoc_filters"] == filters

    cached = map_config_to_form_data(config, dataset_id=7)
    merge_update_form_data(existing, cached, config)
    assert cached["adhoc_filters"] == filters


def test_bullet_temporal_binding_override_replaces_in_place() -> None:
    existing = _saved_bullet_with_opaque_filters()
    raw_filters = existing["adhoc_filters"]
    assert isinstance(raw_filters, list)
    filters = list(raw_filters)
    binding = filters.pop()
    filters.insert(1, binding)
    existing["adhoc_filters"] = filters
    config = BulletChartConfig(
        metric=_simple_metric(),
        temporal_column="EventDate",
        time_range="Last 30 days",
    )
    with patch(
        "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    merge_update_form_data(existing, mapped, config)

    assert mapped["adhoc_filters"][0] == filters[0]
    assert mapped["adhoc_filters"][2] == filters[2]
    assert mapped["adhoc_filters"][1]["subject"] == "EventDate"
    assert mapped["adhoc_filters"][1]["comparator"] == "Last 30 days"


@pytest.mark.parametrize(
    ("time_range", "expected_comparator"),
    [("Last 30 days", "Last 30 days"), (None, "No filter")],
)
@pytest.mark.parametrize("path", ["immediate", "preview_first", "cached"])
def test_bullet_time_range_only_updates_saved_subject_on_every_update_path(
    time_range: str | None, expected_comparator: str, path: str
) -> None:
    existing = _saved_bullet_with_filters()
    existing[MCP_DASHBOARD_TIME_FILTER_SUBJECT] = "EventDate"
    existing_filters = existing["adhoc_filters"]
    assert isinstance(existing_filters, list)
    existing_filters[1] = {**existing_filters[1], "subject": "EventDate"}
    config = BulletChartConfig(metric=_simple_metric(), time_range=time_range)
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    request = UpdateChartRequest(identifier=9, config=config)

    with (
        patch(
            "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
            return_value=_orm_dataset(),
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
            return_value=True,
        ),
    ):
        if path == "immediate":
            payload = _build_update_payload(request, chart, config)
            assert isinstance(payload, dict)
            merged = __import__("json").loads(payload["params"])
        elif path == "preview_first":
            result = _build_preview_form_data(request, chart, config)
            assert isinstance(result, dict)
            merged = result
        else:
            merged = map_config_to_form_data(config, dataset_id=7)
            merge_update_form_data(existing, merged, config)

    assert merged[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "EventDate"
    assert [item["subject"] for item in merged["adhoc_filters"]] == [
        "Status",
        "EventDate",
    ]
    assert merged["adhoc_filters"][1]["comparator"] == expected_comparator


def test_bullet_subject_only_update_preserves_saved_active_range() -> None:
    existing = _saved_bullet_with_filters()
    config = BulletChartConfig(metric=_simple_metric(), temporal_column="EventDate")
    with patch(
        "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    merge_update_form_data(existing, mapped, config)
    assert mapped[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "EventDate"
    assert mapped["adhoc_filters"][1]["subject"] == "EventDate"
    assert mapped["adhoc_filters"][1]["comparator"] == "Last year"


def test_bullet_rejects_ambiguous_provenance_subject_operator_matches() -> None:
    existing = _saved_bullet_with_filters()
    filters = existing["adhoc_filters"]
    assert isinstance(filters, list)
    filters.append({**filters[1], "comparator": "Last month"})
    config = BulletChartConfig(metric=_simple_metric())
    with pytest.raises(ValueError, match="must match exactly one"):
        merge_update_form_data(existing, map_bullet_config(config), config)

    with pytest.raises(ValidationError, match="must match exactly one"):
        BulletChartConfig.model_validate(existing)


def test_bullet_omitted_filters_preserve_missing_native_filter_key() -> None:
    existing = {"viz_type": "bullet", "metric": "SavedRevenue"}
    config = BulletChartConfig(metric=_simple_metric())
    mapped = {
        "viz_type": "bullet",
        "metric": "new",
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "OrderDate",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "OrderDate",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            }
        ],
    }

    merge_update_form_data(existing, mapped, config)

    assert "adhoc_filters" not in mapped
    assert MCP_DASHBOARD_TIME_FILTER_SUBJECT not in mapped


@pytest.mark.parametrize("preview_first", [False, True])
def test_bullet_update_paths_preserve_opaque_filters_byte_for_byte(
    preview_first: bool,
) -> None:
    existing = _saved_bullet_with_opaque_filters()
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    config = BulletChartConfig(metric=_simple_metric("Revenue"))
    request = UpdateChartRequest(identifier=9, config=config)
    with (
        patch(
            "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
            return_value=_orm_dataset(),
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
            return_value=True,
        ),
    ):
        if preview_first:
            merged = _build_preview_form_data(request, chart, config)
            assert isinstance(merged, dict)
        else:
            payload = _build_update_payload(request, chart, config)
            assert isinstance(payload, dict)
            merged = __import__("json").loads(payload["params"])

    assert merged["adhoc_filters"] == existing["adhoc_filters"]
    assert validate_merged_bullet_form_data(merged, config) is not None


def test_bullet_filter_provenance_keeps_strict_replacement_validation() -> None:
    existing = _saved_bullet_with_opaque_filters()
    config = BulletChartConfig(metric=_simple_metric(), filters=[])
    mapped = map_bullet_config(config)
    merge_update_form_data(existing, mapped, config)
    assert mapped["adhoc_filters"] == []

    # A native SQL filter cannot masquerade as an explicitly supplied typed
    # replacement: only omitted, provenance-preserved filters get that path.
    existing_filters = existing["adhoc_filters"]
    assert isinstance(existing_filters, list)
    mapped["adhoc_filters"] = [existing_filters[0]]
    with pytest.raises(ValidationError, match="expressionType='SIMPLE'"):
        validate_merged_bullet_form_data(mapped, config)


@pytest.mark.parametrize("preview_first", [False, True])
def test_bullet_saved_update_paths_preserve_omitted_user_filters_with_binding(
    preview_first: bool,
) -> None:
    existing = _saved_bullet_with_filters()
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    config = BulletChartConfig(metric=_simple_metric("Revenue"))
    request = UpdateChartRequest(identifier=9, config=config)
    with (
        patch(
            "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
            return_value=_orm_dataset(),
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
            return_value=True,
        ),
    ):
        if preview_first:
            merged = _build_preview_form_data(request, chart, config)
            assert isinstance(merged, dict)
        else:
            payload = _build_update_payload(request, chart, config)
            assert isinstance(payload, dict)
            merged = __import__("json").loads(payload["params"])

    assert merged["adhoc_filters"] == existing["adhoc_filters"]
    assert merged[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "OrderDate"


@pytest.mark.parametrize(
    ("filters", "expected_subjects"),
    [
        ([], []),
        (
            [{"column": "Status", "op": "=", "value": "Inactive"}],
            ["Status", "OrderDate"],
        ),
    ],
)
def test_bullet_filter_clear_and_replacement_are_authoritative(
    filters: list[dict[str, object]], expected_subjects: list[str]
) -> None:
    existing = _saved_bullet_with_filters()
    config = BulletChartConfig(metric=_simple_metric("Revenue"), filters=filters)
    mapped: dict[str, Any] = {"viz_type": "bullet", "metric": "new"}
    if filters:
        mapped["adhoc_filters"] = [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "Status",
                "operator": "==",
                "comparator": "Inactive",
            }
        ]
    merge_update_form_data(existing, mapped, config)
    assert [item["subject"] for item in mapped["adhoc_filters"]] == expected_subjects


def test_bullet_temporal_override_replaces_only_provenanced_binding() -> None:
    existing = _saved_bullet_with_filters()
    config = BulletChartConfig(
        metric=_simple_metric("Revenue"),
        temporal_column="EventDate",
        time_range="Last 30 days",
    )
    with (
        patch(
            "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
            return_value=_orm_dataset(),
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
            return_value=True,
        ),
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    merge_update_form_data(existing, mapped, config)
    assert [item["subject"] for item in mapped["adhoc_filters"]] == [
        "Status",
        "EventDate",
    ]
    assert mapped["adhoc_filters"][1]["comparator"] == "Last 30 days"
    assert mapped[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "EventDate"


@pytest.mark.parametrize("path", ["immediate", "preview_first", "cached"])
def test_bullet_filter_only_update_ignores_mapper_temporal_fallback(path: str) -> None:
    existing = _saved_bullet_with_filters()
    config = BulletChartConfig(
        metric=_simple_metric(),
        filters=[{"column": "Status", "op": "=", "value": "Inactive"}],
    )
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    request = UpdateChartRequest(identifier=9, config=config)
    dataset = _orm_dataset()
    dataset.main_dttm_col = "EventDate"
    with (
        patch(
            "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
            return_value=True,
        ),
    ):
        if path == "immediate":
            payload = _build_update_payload(request, chart, config)
            assert isinstance(payload, dict)
            merged = __import__("json").loads(payload["params"])
        elif path == "preview_first":
            result = _build_preview_form_data(request, chart, config)
            assert isinstance(result, dict)
            merged = result
        else:
            merged = map_config_to_form_data(config, dataset_id=7)
            merge_update_form_data(existing, merged, config)

    assert merged[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "OrderDate"
    assert [filter_["subject"] for filter_ in merged["adhoc_filters"]] == [
        "Status",
        "OrderDate",
    ]
    assert merged["adhoc_filters"][1]["comparator"] == "Last year"


def test_xy_native_axis_change_replaces_obsolete_provenanced_binding() -> None:
    existing = {
        "viz_type": "echarts_timeseries_line",
        "x_axis": "OrderDate",
        "granularity_sqla": "OrderDate",
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "OrderDate",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "OrderDate",
                "operator": "TEMPORAL_RANGE",
                "comparator": "Last year",
            }
        ],
    }
    config = XYChartConfig(
        x={"name": "EventDate"},
        y=[_simple_metric()],
        filters=[{"column": "Status", "op": "=", "value": "Active"}],
    )
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    merge_update_form_data(existing, mapped, config)

    assert mapped[MCP_DASHBOARD_TIME_FILTER_SUBJECT] == "EventDate"
    assert [filter_["subject"] for filter_ in mapped["adhoc_filters"]] == [
        "Status",
        "EventDate",
    ]
    assert mapped["adhoc_filters"][1]["comparator"] == "Last year"


def test_bullet_presentation_updates_are_atomic_and_comma_safe() -> None:
    with pytest.raises(ValidationError, match="cannot contain commas"):
        BulletChartConfig(
            metric=_simple_metric(), ranges=[1], range_labels=["Low, medium"]
        )

    partial = BulletChartConfig.model_validate(
        {
            "viz_type": "bullet",
            "metric": "SavedRevenue",
            "ranges": "10,20,30",
            "range_labels": "Low,,High",
        }
    )
    assert partial.range_labels == ["Low", "", "High"]
    assert map_bullet_config(partial)["range_labels"] == "Low,,High"

    existing = {
        "viz_type": "bullet",
        "metric": "SavedRevenue",
        "ranges": "10,20",
        "range_labels": "Low,High",
        "markers": "15,18",
        "marker_labels": "Plan,Stretch",
    }
    config = BulletChartConfig(metric=_simple_metric(), ranges=[30], markers=[25])
    mapped = map_bullet_config(config)
    merge_update_form_data(existing, mapped, config)
    assert mapped["ranges"] == "30"
    assert mapped["range_labels"] == ""
    assert mapped["markers"] == "25"
    assert mapped["marker_labels"] == ""
    assert validate_merged_bullet_form_data(mapped) is not None

    stale = dict(existing)
    stale["ranges"] = "10"
    assert validate_merged_bullet_form_data(stale) is not None


def test_mapping_other_registered_chart_type_is_unchanged() -> None:
    from superset.mcp_service.chart.schemas import PieChartConfig

    form_data = map_config_to_form_data(
        PieChartConfig(dimension={"name": "region"}, metric=_simple_metric("revenue"))
    )
    assert form_data["viz_type"] == "pie"
    assert form_data["groupby"] == ["region"]


@pytest.mark.asyncio
async def test_generate_chart_tool_emits_native_bullet_form_data() -> None:
    request = GenerateChartRequest(
        dataset_id=7,
        config=BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            ranges=[100, 250],
            markers=[200],
        ),
        preview_formats=["url"],
    )
    validation_result = SimpleNamespace(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    ctx = MagicMock()
    ctx.info = AsyncMock()
    ctx.debug = AsyncMock()
    ctx.warning = AsyncMock()
    ctx.error = AsyncMock()
    ctx.report_progress = AsyncMock()
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=_tool_user(),
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            return_value=(
                "http://localhost:8088/explore/?form_data_key=bullet_preview_key"
            ),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
    ):
        result = await generate_chart(request, ctx=ctx)

    assert result.success is True
    assert result.form_data["viz_type"] == "bullet"
    assert result.form_data["groupby"] == ["Region"]
    assert result.form_data["ranges"] == "100,250"
    assert result.form_data["markers"] == "200"


def test_update_chart_preview_tool_preserves_omitted_bullet_state() -> None:
    request = UpdateChartPreviewRequest(
        form_data_key="previous_bullet_key",
        dataset_id=7,
        config=BulletChartConfig(metric=_simple_metric("revenue")),
        generate_preview=False,
    )
    dataset = _orm_dataset()
    previous = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region", "Team"],
        "ranges": "100,250",
        "show_labels": True,
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "OrderDate",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SQL",
                "sqlExpression": "Status = 'Active'  ",
            },
            {
                "clause": "HAVING",
                "expressionType": "SIMPLE",
                "subject": "SavedRevenue",
                "operator": ">",
                "comparator": 100,
            },
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "OrderDate",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            },
        ],
    }
    link = MagicMock(
        return_value="http://localhost:8088/explore/?form_data_key=new_bullet_key"
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=_tool_user(),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value=previous,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._is_temporal_for_dashboard_binding",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=SimpleNamespace(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            link,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "analyze_chart_capabilities",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "analyze_chart_semantics",
            return_value=None,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    preview_form_data = link.call_args.args[1]
    assert preview_form_data["metric"]["column"]["column_name"] == "Revenue"
    assert preview_form_data["groupby"] == ["Region", "Team"]
    assert preview_form_data["ranges"] == "100,250"
    assert preview_form_data["show_labels"] is True
    assert preview_form_data["adhoc_filters"] == previous["adhoc_filters"]


@pytest.mark.asyncio
async def test_update_chart_tool_persists_native_bullet_round_trip() -> None:
    existing = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region"],
        "ranges": "100,250",
        "range_labels": "Low",
        "show_legend": True,
    }
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
        viz_type="bullet",
        uuid="bullet-uuid",
    )
    updated_chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        viz_type="bullet",
        uuid="bullet-uuid",
    )
    command = MagicMock()
    command.return_value.run.return_value = updated_chart
    request = UpdateChartRequest(
        identifier=9,
        config=BulletChartConfig(metric=_simple_metric("NewRevenue")),
        generate_preview=False,
        preview_formats=[],
    )
    ctx = MagicMock()
    ctx.warning = AsyncMock()
    ctx.error = AsyncMock()
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=_tool_user(),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=SimpleNamespace(is_valid=True, error=None),
        ),
        patch.object(
            DatasetValidator,
            "normalize_column_names",
            side_effect=lambda config, dataset_id: config,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart."
            "_validate_update_against_dataset",
            return_value=None,
        ),
        patch("superset.commands.chart.update.UpdateChartCommand", command),
        patch(
            "superset.mcp_service.chart.tool.update_chart.analyze_chart_capabilities",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.analyze_chart_semantics",
            return_value=None,
        ),
    ):
        result = await update_chart(request, ctx=ctx)

    assert result.success is True
    payload = command.call_args.args[1]
    persisted = __import__("json").loads(payload["params"])
    assert persisted["metric"]["column"]["column_name"] == "NewRevenue"
    assert persisted["groupby"] == ["Region"]
    assert persisted["ranges"] == "100,250"
    assert persisted["range_labels"] == "Low"
    assert persisted["show_legend"] is True


def test_bullet_exact_case_dimensions_survive_normalization_and_query() -> None:
    from superset.mcp_service.chart.registry import get

    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[
            {"name": "Revenue", "type": "NUMERIC", "is_numeric": True},
            {"name": "Region", "type": "VARCHAR"},
            {"name": "region", "type": "VARCHAR"},
        ],
        available_metrics=[],
    )
    config = BulletChartConfig(
        metric={"name": "Revenue", "aggregate": "SUM", "label": "REGION"},
        dimensions=[{"name": "Region"}, {"name": "region"}],
        order_by=[{"column": "Region"}, {"column": "region"}],
    )
    plugin = get("bullet")
    assert plugin is not None
    normalized = plugin.normalize_column_refs(config, context)
    assert [item.column for item in normalized.order_by] == ["Region", "region"]
    form_data = map_bullet_config(normalized)
    assert build_query_dicts_from_form_data(form_data, 7, "table")[0]["columns"] == [
        "Region",
        "region",
    ]
    model = resolve_bullet_render_model(
        [{"Region": "North", "region": "South", "REGION": 42}],
        form_data,
    )
    assert model.dimensions == ["Region", "region"]
    assert model.metric_field == "REGION"
    with pytest.raises(ValueError, match="Ambiguous Bullet dimension"):
        plugin.normalize_column_refs(
            BulletChartConfig(metric=_simple_metric(), dimensions=[{"name": "rEgIoN"}]),
            context,
        )
    with pytest.raises(ValidationError, match="ambiguous"):
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[{"name": "Region"}, {"name": "region"}],
            order_by=[{"column": "REGION"}],
        )


@pytest.mark.parametrize("scale", ["linear", "log", None])
def test_explicit_axis_scale_update_writes_native_boolean(scale: str | None) -> None:
    config = XYChartConfig(
        x={"name": "Region"},
        y=[_simple_metric()],
        y_axis={"scale": scale},
    )
    mapped = map_config_to_form_data(config)
    from superset.mcp_service.chart.chart_utils import merge_same_viz_form_data

    merge_same_viz_form_data(
        {"viz_type": mapped["viz_type"], "logAxis": True}, mapped, config
    )
    assert mapped["logAxis"] is (None if scale is None else scale == "log")


def test_bullet_ignores_foreign_sort_flag_after_master_merge() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Region"],
        "sort_by_metric": True,
        "orderby": [["Region", True]],
    }
    query = build_query_dicts_from_form_data(form_data, 7, "table")[0]
    assert query["orderby"] == [["Region", True]]
