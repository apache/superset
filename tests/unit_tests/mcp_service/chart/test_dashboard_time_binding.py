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

"""Regression tests for MCP chart dashboard time-range binding."""

from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest

from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject
from superset.mcp_service.chart.chart_utils import (
    _bind_dashboard_time_range_filter,
    adhoc_filters_to_query_filters,
    map_config_to_form_data,
)
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    BoxPlotChartConfig,
    ChartConfig,
    ColumnRef,
    HandlebarsChartConfig,
    HistogramChartConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    TableChartConfig,
    WaterfallChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    build_dataset_context_from_orm,
    DatasetValidator,
)
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.utils.core import GenericDataType, merge_extra_form_data

METRIC = ColumnRef(name="revenue", aggregate="SUM")
CATEGORY = ColumnRef(name="region")


def _chart_configs() -> list[ChartConfig]:
    return [
        BigNumberChartConfig(chart_type="big_number", metric=METRIC),
        BoxPlotChartConfig(metrics=[METRIC], distribute_across=[CATEGORY]),
        HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="{{#each data}}{{region}}{{/each}}",
            groupby=[CATEGORY],
            metrics=[METRIC],
        ),
        HistogramChartConfig(column=ColumnRef(name="duration")),
        MixedTimeseriesChartConfig(
            x=CATEGORY,
            y=[METRIC],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
        ),
        PieChartConfig(dimension=CATEGORY, metric=METRIC),
        PivotTableChartConfig(rows=[CATEGORY], metrics=[METRIC]),
        TableChartConfig(columns=[CATEGORY, METRIC]),
        WaterfallChartConfig(
            x_axis=ColumnRef(name="event_time"),
            metric=METRIC,
        ),
        XYChartConfig(x=CATEGORY, y=[METRIC]),
    ]


@pytest.mark.parametrize("config", _chart_configs())
def test_every_chart_config_accepts_temporal_column(config: ChartConfig) -> None:
    updated = type(config).model_validate(
        {**config.model_dump(), "temporal_column": "created_at"}
    )

    assert updated.temporal_column == "created_at"


@pytest.mark.parametrize(
    ("config", "expected_subject"),
    [
        (
            BoxPlotChartConfig(metrics=[METRIC], distribute_across=[CATEGORY]),
            "order_date",
        ),
        (
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="{{region}}",
                groupby=[CATEGORY],
                metrics=[METRIC],
            ),
            "order_date",
        ),
        (HistogramChartConfig(column=ColumnRef(name="duration")), "order_date"),
        (
            MixedTimeseriesChartConfig(
                x=CATEGORY,
                y=[METRIC],
                y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            ),
            "order_date",
        ),
        (PieChartConfig(dimension=CATEGORY, metric=METRIC), "order_date"),
        (PivotTableChartConfig(rows=[CATEGORY], metrics=[METRIC]), "order_date"),
        (TableChartConfig(columns=[CATEGORY, METRIC]), "order_date"),
        (
            WaterfallChartConfig(
                x_axis=ColumnRef(name="event_time"),
                metric=METRIC,
            ),
            "event_time",
        ),
        (XYChartConfig(x=CATEGORY, y=[METRIC]), "order_date"),
    ],
)
@patch("superset.daos.dataset.DatasetDAO.find_by_id_or_uuid")
@patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
def test_unbound_charts_get_dashboard_temporal_filter(
    mock_is_temporal: MagicMock,
    mock_find_dataset: MagicMock,
    config: ChartConfig,
    expected_subject: str,
) -> None:
    mock_find_dataset.return_value = SimpleNamespace(main_dttm_col="order_date")
    mock_is_temporal.side_effect = lambda column, dataset_id, dataset=None: column in {
        "created_at",
        "event_time",
        "order_date",
    }

    form_data = map_config_to_form_data(config, dataset_id=42)

    temporal_filters = [
        filter_
        for filter_ in form_data["adhoc_filters"]
        if filter_["operator"] == "TEMPORAL_RANGE"
    ]
    assert temporal_filters == [
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": expected_subject,
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
        }
    ]


@pytest.mark.parametrize(
    "config",
    [
        TableChartConfig(
            columns=[CATEGORY, METRIC],
            temporal_column="created_at",
        ),
        WaterfallChartConfig(
            x_axis=CATEGORY,
            metric=METRIC,
            time_grain="P1D",
            temporal_column="created_at",
        ),
        BigNumberChartConfig(
            chart_type="big_number",
            metric=METRIC,
            temporal_column="created_at",
        ),
    ],
)
@patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
def test_explicit_temporal_column_takes_precedence(
    mock_is_temporal: MagicMock,
    config: ChartConfig,
) -> None:
    mock_is_temporal.return_value = True

    form_data = map_config_to_form_data(config, dataset_id=42)

    assert form_data["adhoc_filters"][0]["subject"] == "created_at"


@patch(
    "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
    return_value=True,
)
@patch(
    "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
    return_value=SimpleNamespace(main_dttm_col="event_time"),
)
def test_temporal_xy_binding_records_generated_subject(
    mock_find_dataset: MagicMock,
    mock_is_temporal: MagicMock,
) -> None:
    form_data = map_config_to_form_data(
        XYChartConfig(x=ColumnRef(name="event_time"), y=[METRIC]),
        dataset_id=42,
    )

    assert form_data["_mcp_dashboard_time_filter_subject"] == "event_time"


@pytest.mark.parametrize(
    "config",
    [
        XYChartConfig(
            x=ColumnRef(name="event_time"),
            y=[METRIC],
            temporal_column="created_at",
        ),
        MixedTimeseriesChartConfig(
            x=ColumnRef(name="event_time"),
            y=[METRIC],
            y_secondary=[ColumnRef(name="orders", aggregate="COUNT")],
            temporal_column="created_at",
        ),
        WaterfallChartConfig(
            x_axis=CATEGORY,
            metric=METRIC,
            time_grain="P1D",
            temporal_column="created_at",
        ),
    ],
)
@patch(
    "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
    return_value=True,
)
def test_explicit_temporal_column_overrides_temporal_granularity(
    mock_is_temporal: MagicMock,
    config: ChartConfig,
) -> None:
    form_data = map_config_to_form_data(config, dataset_id=42)

    # QueryContextFactory gives granularity precedence over temporal filters, so
    # retaining event_time here would silently bind the range to both columns.
    assert form_data["granularity_sqla"] is None
    assert form_data["adhoc_filters"] == [
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "created_at",
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
        }
    ]

    query_object = QueryObject(
        columns=[form_data.get("x_axis") or "event_time"],
        filters=cast(Any, adhoc_filters_to_query_filters(form_data["adhoc_filters"])),
        granularity=form_data["granularity_sqla"],
        time_range="Last week",
    )
    datasource = SimpleNamespace(
        columns=[
            SimpleNamespace(column_name="event_time", is_dttm=True),
            SimpleNamespace(column_name="created_at", is_dttm=True),
        ],
        main_dttm_col="event_time",
        currency_code_column=None,
    )

    processed = QueryContextFactory()._process_query_object(
        datasource, form_data, query_object
    )

    assert processed.granularity is None
    assert processed.filter == [
        {"col": "created_at", "op": "TEMPORAL_RANGE", "val": "Last week"}
    ]


@patch("superset.daos.dataset.DatasetDAO.find_by_id_or_uuid")
@patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
def test_non_temporal_waterfall_granularity_falls_back_to_dataset_time_column(
    mock_is_temporal: MagicMock,
    mock_find_dataset: MagicMock,
) -> None:
    mock_find_dataset.return_value = SimpleNamespace(main_dttm_col="order_date")
    mock_is_temporal.side_effect = (
        lambda column, dataset_id, dataset=None: column == "order_date"
    )
    config = WaterfallChartConfig(
        x_axis=CATEGORY,
        metric=METRIC,
        time_grain="P1D",
    )

    form_data = map_config_to_form_data(config, dataset_id=42)

    assert form_data["granularity_sqla"] == "region"
    assert form_data["adhoc_filters"] == [
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "order_date",
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
        }
    ]


@pytest.mark.parametrize(
    "config",
    [
        TableChartConfig(
            columns=[CATEGORY, METRIC],
            temporal_column="fiscal_year",
        ),
        BigNumberChartConfig(
            chart_type="big_number",
            metric=METRIC,
            temporal_column="fiscal_year",
        ),
    ],
)
@patch("superset.daos.dataset.DatasetDAO.find_by_id_or_uuid")
@patch("superset.mcp_service.chart.chart_utils.is_column_truly_temporal")
def test_explicit_non_temporal_column_does_not_fall_back(
    mock_is_temporal: MagicMock,
    mock_find_dataset: MagicMock,
    config: ChartConfig,
) -> None:
    mock_find_dataset.return_value = SimpleNamespace(main_dttm_col="order_date")
    mock_is_temporal.return_value = False

    form_data = map_config_to_form_data(config, dataset_id=42)

    assert "adhoc_filters" not in form_data
    mock_find_dataset.assert_not_called()


@patch("superset.daos.dataset.DatasetDAO.find_by_id_or_uuid")
def test_dataset_without_main_temporal_column_remains_unbound(
    mock_find_dataset: MagicMock,
) -> None:
    mock_find_dataset.return_value = SimpleNamespace(main_dttm_col=None)

    form_data = map_config_to_form_data(
        TableChartConfig(columns=[CATEGORY, METRIC]),
        dataset_id=42,
    )

    assert "adhoc_filters" not in form_data


@patch(
    "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
    return_value=True,
)
def test_explicit_temporal_column_binds_alongside_different_temporal_filter(
    mock_is_temporal: MagicMock,
) -> None:
    form_data = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Last year",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "processed_at",
            }
        ]
    }
    config = TableChartConfig(
        columns=[CATEGORY, METRIC],
        temporal_column="created_at",
    )

    _bind_dashboard_time_range_filter(form_data, config, dataset_id=42)

    assert [filter_["subject"] for filter_ in form_data["adhoc_filters"]] == [
        "processed_at",
        "created_at",
    ]


@patch("superset.daos.dataset.DatasetDAO.find_by_id_or_uuid")
@patch(
    "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
    return_value=True,
)
def test_dashboard_time_range_updates_generated_filter(
    mock_is_temporal: MagicMock,
    mock_find_dataset: MagicMock,
) -> None:
    mock_find_dataset.return_value = SimpleNamespace(main_dttm_col="order_date")
    form_data = map_config_to_form_data(
        TableChartConfig(columns=[CATEGORY, METRIC]),
        dataset_id=42,
    )
    form_data["extra_form_data"] = {"time_range": "Last week"}

    merge_extra_form_data(form_data)

    assert form_data["adhoc_filters"][0]["subject"] == "order_date"
    assert form_data["adhoc_filters"][0]["comparator"] == "Last week"
    assert adhoc_filters_to_query_filters(form_data["adhoc_filters"]) == [
        {
            "col": "order_date",
            "op": "TEMPORAL_RANGE",
            "val": "Last week",
        }
    ]


def test_temporal_column_is_included_in_dataset_validation() -> None:
    config = TableChartConfig(
        columns=[CATEGORY, METRIC],
        temporal_column="created_at",
    )

    refs = DatasetValidator._extract_column_references(config)

    assert [ref.name for ref in refs].count("created_at") == 1


def test_dataset_validation_rejects_non_temporal_time_column() -> None:
    config = TableChartConfig(
        columns=[CATEGORY, METRIC],
        temporal_column="fiscal_year",
    )
    dataset_context = DatasetContext(
        id=42,
        table_name="orders",
        schema="public",
        database_name="examples",
        available_columns=[
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "revenue", "type": "NUMERIC", "is_temporal": False},
            {"name": "fiscal_year", "type": "INTEGER", "is_temporal": False},
        ],
        available_metrics=[],
    )

    is_valid, error = DatasetValidator.validate_against_dataset(
        config,
        dataset_id=42,
        dataset_context=dataset_context,
    )

    assert not is_valid
    assert error is not None
    assert error.error_code == "NON_TEMPORAL_COLUMN"
    assert "fiscal_year" in error.message


def test_dataset_validation_rejects_missing_explicit_time_column() -> None:
    config = TableChartConfig(
        columns=[CATEGORY, METRIC],
        temporal_column="missing_at",
    )
    dataset_context = DatasetContext(
        id=42,
        table_name="orders",
        schema="public",
        database_name="examples",
        available_columns=[
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "revenue", "type": "NUMERIC", "is_temporal": False},
        ],
        available_metrics=[],
    )

    is_valid, error = DatasetValidator.validate_against_dataset(
        config, dataset_id=42, dataset_context=dataset_context
    )

    assert not is_valid
    assert error is not None
    assert error.error_code == "MISSING_TEMPORAL_COLUMN"


def test_saved_metric_name_does_not_hide_explicit_temporal_column_reference() -> None:
    config = BigNumberChartConfig(
        chart_type="big_number",
        metric=ColumnRef(name="created_at", saved_metric=True),
        temporal_column="created_at",
    )

    refs = DatasetValidator._extract_column_references(config)

    assert [(ref.name, ref.saved_metric) for ref in refs] == [
        ("created_at", True),
        ("created_at", False),
    ]


def test_dataset_context_uses_binding_temporal_predicate() -> None:
    engine_spec = MagicMock()
    engine_spec.get_column_spec.return_value = SimpleNamespace(
        generic_type=GenericDataType.NUMERIC
    )
    column = SimpleNamespace(
        column_name="fiscal_year",
        type="INTEGER",
        is_dttm=True,
        is_temporal=True,
        is_numeric=True,
        python_date_format=None,
    )
    dataset = SimpleNamespace(
        id=42,
        table_name="orders",
        schema="public",
        columns=[column],
        metrics=[],
        database=SimpleNamespace(database_name="examples", db_engine_spec=engine_spec),
    )

    context = build_dataset_context_from_orm(dataset)

    assert context is not None
    assert context.available_columns[0]["is_temporal"] is False


@pytest.mark.parametrize(
    "config",
    [
        TableChartConfig(
            columns=[CATEGORY, METRIC],
            temporal_column="created_at",
        ),
        BigNumberChartConfig(
            chart_type="big_number",
            metric=METRIC,
            temporal_column="created_at",
        ),
    ],
)
def test_temporal_column_is_normalized_to_dataset_casing(
    config: ChartConfig,
) -> None:
    dataset_context = DatasetContext(
        id=42,
        table_name="orders",
        schema="public",
        database_name="examples",
        available_columns=[
            {"name": "region", "type": "VARCHAR"},
            {"name": "revenue", "type": "NUMERIC"},
            {"name": "Created_At", "type": "TIMESTAMP"},
        ],
        available_metrics=[],
    )

    normalized = DatasetValidator.normalize_column_names(
        config,
        dataset_id=42,
        dataset_context=dataset_context,
    )

    assert normalized.temporal_column == "Created_At"
