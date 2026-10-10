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
"""Tests for the chart tools' semantic-view target resolution (sc-120959)."""

from typing import Any
from unittest.mock import Mock, patch, PropertyMock
from uuid import UUID

import pytest

from superset.daos.exceptions import DatasourceNotFound
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.chart.datasource_resolver import (
    build_context_from_explorable,
    ChartDatasource,
    resolve_semantic_view,
    SEMANTIC_VIEW_ADHOC_ERROR,
    validate_semantic_view_config,
    validate_semantic_view_form_data,
    VIEW_NOT_FOUND_ERROR,
    view_not_found_error,
)
from superset.mcp_service.chart.schemas import ColumnRef, XYChartConfig
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)
from superset.utils.core import DatasourceType

GET_DATASOURCE: str = "superset.daos.datasource.DatasourceDAO.get_datasource"


def _mock_view(view_id: int = 7, name: str = "Jaffle Shop") -> Mock:
    view: Mock = Mock()
    view.id = view_id
    view.name = name
    time_col: Mock = Mock()
    time_col.column_name = "metric_time"
    time_col.type = "TIMESTAMP"
    time_col.is_dttm = True
    region: Mock = Mock()
    region.column_name = "customer__region"
    region.type = "STRING"
    region.is_dttm = False
    view.columns = [time_col, region]
    revenue: Mock = Mock()
    revenue.metric_name = "revenue"
    revenue.expression = "revenue"
    revenue.description = "Sum of order revenue"
    view.metrics = [revenue]
    return view


class TestResolveSemanticView:
    def test_resolves_through_the_explorable_registry(self) -> None:
        view: Mock = _mock_view()
        with patch(GET_DATASOURCE, return_value=view) as get_datasource:
            target: ChartDatasource | None = resolve_semantic_view(7)

        get_datasource.assert_called_once_with(DatasourceType.SEMANTIC_VIEW, 7)
        view.raise_for_access.assert_called_once_with()
        assert target == ChartDatasource(
            explorable=view,
            datasource_type=DatasourceType.SEMANTIC_VIEW,
            id=7,
            name="Jaffle Shop",
        )
        assert target.datasource_type == DatasourceType.SEMANTIC_VIEW
        assert target.form_data_datasource == "7__semantic_view"
        assert (
            target.explore_url_path
            == "/explore/?datasource_type=semantic_view&datasource_id=7"
        )

    def test_missing_view_is_none(self) -> None:
        with patch(GET_DATASOURCE, side_effect=DatasourceNotFound()):
            assert resolve_semantic_view(99) is None

    def test_access_denied_is_none(self) -> None:
        view: Mock = _mock_view()
        view.raise_for_access.side_effect = SupersetSecurityException(
            SupersetError(
                message="denied",
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            )
        )
        with patch(GET_DATASOURCE, return_value=view):
            assert resolve_semantic_view(7) is None

    def test_unexpected_access_failure_does_not_produce_a_target(self) -> None:
        view: Mock = _mock_view()
        view.raise_for_access.side_effect = PermissionError("nope")
        with patch(GET_DATASOURCE, return_value=view):
            with pytest.raises(PermissionError):
                resolve_semantic_view(7)


def test_view_not_found_error_is_typed() -> None:
    error: ChartGenerationError = view_not_found_error(5)
    assert error.error_type == VIEW_NOT_FOUND_ERROR
    assert error.error_code == "MCP_SEMANTIC_VIEW_NOT_FOUND"
    assert "5" in error.message


def test_build_context_from_explorable_maps_columns_and_metrics() -> None:
    target: ChartDatasource = ChartDatasource(
        explorable=_mock_view(),
        datasource_type=DatasourceType.SEMANTIC_VIEW,
        id=7,
        name="Jaffle Shop",
    )
    context: DatasetContext = build_context_from_explorable(target)
    assert context.id == 7
    assert context.table_name == "Jaffle Shop"
    assert [c["name"] for c in context.available_columns] == [
        "metric_time",
        "customer__region",
    ]
    assert context.available_columns[0]["is_temporal"] is True
    assert context.available_columns[1]["is_temporal"] is False
    assert context.available_metrics == [
        {
            "name": "revenue",
            "expression": "revenue",
            "description": "Sum of order revenue",
        }
    ]


def test_denied_view_does_not_read_metadata_or_fall_back_to_table() -> None:
    """A table grant cannot authorize a colliding semantic view."""
    view: Mock = _mock_view(1)
    view.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="denied",
            level=ErrorLevel.ERROR,
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
        )
    )
    with (
        patch(GET_DATASOURCE, return_value=view),
        patch("superset.daos.dataset.DatasetDAO.find_by_id") as table_lookup,
        patch.object(
            type(view), "columns", new_callable=PropertyMock, create=True
        ) as columns,
        patch.object(
            type(view), "metrics", new_callable=PropertyMock, create=True
        ) as metrics,
    ):
        columns.side_effect = AssertionError("Metadata must not precede access")
        metrics.side_effect = AssertionError("Metadata must not precede access")
        assert resolve_semantic_view(1) is None
        columns.assert_not_called()
        metrics.assert_not_called()
        table_lookup.assert_not_called()


def test_uuid_view_uses_only_semantic_registry_lookup() -> None:
    """Resolve UUIDs within the explicitly selected family."""
    identity: UUID = UUID("60bbdebe-f30c-4699-88dc-cbe7355fb4c1")
    with patch(GET_DATASOURCE, return_value=_mock_view(1)) as lookup:
        target: ChartDatasource | None = resolve_semantic_view(identity)
    assert target is not None
    assert target.id == 1
    lookup.assert_called_once_with(DatasourceType.SEMANTIC_VIEW, str(identity))


class TestValidateSemanticViewConfig:
    @pytest.fixture
    def target(self) -> ChartDatasource:
        return ChartDatasource(
            explorable=_mock_view(),
            datasource_type=DatasourceType.SEMANTIC_VIEW,
            id=7,
            name="Jaffle Shop",
        )

    def test_saved_metric_and_saved_dimension_pass(
        self, target: ChartDatasource
    ) -> None:
        config: XYChartConfig = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="metric_time"),
            y=[ColumnRef(name="revenue", saved_metric=True)],
            kind="line",
        )
        is_valid: bool
        error: ChartGenerationError | None
        context: DatasetContext
        is_valid, error, context = validate_semantic_view_config(config, target)
        assert is_valid, error
        assert error is None
        assert context.id == 7

    def test_adhoc_aggregate_is_rejected_with_typed_error(
        self, target: ChartDatasource
    ) -> None:
        config: XYChartConfig = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="metric_time"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="line",
        )
        is_valid: bool
        error: ChartGenerationError | None
        is_valid, error, _ = validate_semantic_view_config(config, target)
        assert not is_valid
        assert error is not None
        assert error.error_type == SEMANTIC_VIEW_ADHOC_ERROR
        assert error.error_code == "MCP_SEMANTIC_VIEW_ADHOC_NOT_SUPPORTED"
        assert "SUM(revenue)" in error.message
        assert any("revenue" in s for s in error.suggestions)

    def test_unknown_dimension_is_rejected_by_the_dataset_validator(
        self, target: ChartDatasource
    ) -> None:
        config: XYChartConfig = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="not_a_dimension"),
            y=[ColumnRef(name="revenue", saved_metric=True)],
            kind="line",
        )
        is_valid: bool
        error: ChartGenerationError | None
        is_valid, error, _ = validate_semantic_view_config(config, target)
        assert not is_valid
        assert error is not None
        assert "not_a_dimension" in (error.message + error.details)


def _valid_gantt_form_data() -> dict[str, Any]:
    return {
        "viz_type": "gantt_chart",
        "start_time": "metric_time",
        "end_time": "metric_time",
        "y_axis": "customer__region",
    }


@pytest.mark.parametrize(
    "form_data",
    [
        {"metrics": [{"expressionType": "SQL", "sqlExpression": "count(*)"}]},
        {"metrics": ["unknown"]},
        {"groupby": ["unknown"]},
        {"where": "region = 'secret'"},
        {"having": "SUM(revenue) > 100"},
        {"order_by_cols": ['["unknown", true]']},
        {"orderby": [[{"sqlExpression": "SUM(revenue)"}, True]]},
        {"adhoc_filters": [{"expressionType": "SQL", "sqlExpression": "1=1"}]},
    ],
)
def test_retained_invalid_query_roles_are_rejected(form_data: dict[str, Any]) -> None:
    """Reject stale or ad-hoc state before a view rebind writes anything."""
    target: ChartDatasource = ChartDatasource(
        explorable=_mock_view(),
        datasource_type=DatasourceType.SEMANTIC_VIEW,
        id=7,
        name="Jaffle Shop",
    )
    assert (
        validate_semantic_view_form_data({"viz_type": "table", **form_data}, target)
        is not None
    )


def test_retained_saved_sort_is_accepted() -> None:
    """Preserve valid named sorting instead of dropping a query constraint."""
    target: ChartDatasource = ChartDatasource(
        explorable=_mock_view(),
        datasource_type=DatasourceType.SEMANTIC_VIEW,
        id=7,
        name="Jaffle Shop",
    )
    assert (
        validate_semantic_view_form_data(
            {
                "viz_type": "table",
                "order_by_cols": ['["revenue", false]'],
                "orderby": [["customer__region", True]],
            },
            target,
        )
        is None
    )


@pytest.mark.parametrize("key", ["groupby", "groupby_b", "columns", "all_columns"])
def test_scalar_dimension_roles_keep_complete_names(key: str) -> None:
    """Scalar persisted dimensions have the same meaning as singleton lists."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    assert (
        validate_semantic_view_form_data(
            {"viz_type": "table", key: "customer__region"}, target
        )
        is None
    )


@pytest.mark.parametrize(
    "form_data",
    [
        {"timeseries_limit_metric_b": "missing"},
        {"timeseries_limit_metric_b": {"expressionType": "SQL", "sqlExpression": "1"}},
        {"metrics_b": ["missing"]},
        {"metrics_b": [{"expressionType": "SQL", "sqlExpression": "count(*)"}]},
        {"orderby_b": [["missing", True]]},
        {"adhoc_filters_b": [{"expressionType": "SQL", "sqlExpression": "1=1"}]},
        {
            "adhoc_filters_b": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "missing",
                    "operator": "==",
                    "comparator": "x",
                    "clause": "WHERE",
                }
            ]
        },
    ],
)
def test_secondary_roles_reject_invalid_saved_state(form_data: dict[str, Any]) -> None:
    """The second query must validate the same saved references as the first."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    assert (
        validate_semantic_view_form_data(
            {"viz_type": "mixed_timeseries", **form_data}, target
        )
        is not None
    )


def test_valid_secondary_roles_are_preserved() -> None:
    """Valid secondary roles remain usable without rewriting query constraints."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    form_data: dict[str, Any] = {
        "viz_type": "mixed_timeseries",
        "timeseries_limit_metric_b": "revenue",
        "metrics_b": ["revenue"],
        "groupby_b": ["customer__region"],
        "orderby_b": [["revenue", False]],
        "adhoc_filters_b": [
            {
                "expressionType": "SIMPLE",
                "subject": "customer__region",
                "operator": "==",
                "comparator": "west",
                "clause": "WHERE",
            }
        ],
    }
    assert validate_semantic_view_form_data(form_data, target) is None
    assert form_data["adhoc_filters_b"][0]["comparator"] == "west"


@pytest.mark.parametrize("key", ["x", "y", "size", "series_limit_metric"])
@pytest.mark.parametrize(
    "value", ["missing", {"expressionType": "SQL", "sqlExpression": "1"}]
)
def test_retained_specialized_metrics_are_validated(key: str, value: object) -> None:
    """Retained bubble and pivot metrics must be published saved metrics."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    assert (
        validate_semantic_view_form_data({"viz_type": "bubble_v2", key: value}, target)
        is not None
    )
    assert (
        validate_semantic_view_form_data(
            {"viz_type": "bubble_v2", key: "revenue"}, target
        )
        is None
    )


@pytest.mark.parametrize("key", ["entity", "series", "groupbyRows", "groupbyColumns"])
@pytest.mark.parametrize("scalar", [False, True])
def test_retained_specialized_dimensions_are_validated(key: str, scalar: bool) -> None:
    """Bubble and pivot dimensions retain their identity, in either saved shape."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    assert (
        validate_semantic_view_form_data(
            {"viz_type": "bubble_v2", key: "missing" if scalar else ["missing"]}, target
        )
        is not None
    )
    assert (
        validate_semantic_view_form_data(
            {
                "viz_type": "bubble_v2",
                key: "customer__region" if scalar else ["customer__region"],
            },
            target,
        )
        is None
    )


@pytest.mark.parametrize(
    "viz_type,key,invalid,valid",
    [
        ("gantt_chart", "start_time", "missing", "metric_time"),
        ("gantt_chart", "end_time", "missing", "metric_time"),
        ("gantt_chart", "y_axis", "missing", "customer__region"),
        ("gantt_chart", "tooltip_columns", ["missing"], ["customer__region"]),
        (
            "gantt_chart",
            "tooltip_metrics",
            [{"expressionType": "SQL", "sqlExpression": "1"}],
            ["revenue"],
        ),
        ("histogram_v2", "column", "missing", "customer__region"),
        ("table", "percent_metrics", ["missing"], ["revenue"]),
    ],
)
def test_retained_gantt_histogram_and_percent_roles(
    viz_type: str, key: str, invalid: object, valid: object
) -> None:
    """Every retained role must name a published member, without ad-hoc SQL."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    base: dict[str, Any] = (
        _valid_gantt_form_data()
        if viz_type == "gantt_chart"
        else {"viz_type": viz_type}
    )
    error: ChartGenerationError | None = validate_semantic_view_form_data(
        {**base, key: invalid}, target
    )
    assert error is not None
    assert error.error_type in {"column_not_found", SEMANTIC_VIEW_ADHOC_ERROR}
    assert validate_semantic_view_form_data({**base, key: valid}, target) is None


@pytest.mark.parametrize(
    "key,column_name",
    [
        ("start_time", "metric_time"),
        ("end_time", "metric_time"),
        ("y_axis", "customer__region"),
        ("series", "customer__region"),
        ("tooltip_columns", "customer__region"),
    ],
)
def test_retained_gantt_saved_column_objects_are_valid(
    key: str, column_name: str
) -> None:
    """Saved Gantt column objects should resolve to published dimension names."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    column: dict[str, str] = {"column_name": column_name}
    value: object = [column] if key == "tooltip_columns" else column

    assert (
        validate_semantic_view_form_data(
            {**_valid_gantt_form_data(), key: value}, target
        )
        is None
    )


@pytest.mark.parametrize(
    "column",
    [
        {"column_name": "missing"},
        {
            "column_name": "metric_time",
            "expressionType": "SQL",
            "sqlExpression": "1",
            "label": "expression",
        },
        {"metric_time": "not_a_column_reference"},
    ],
)
def test_retained_gantt_invalid_column_objects_fail_closed(
    column: dict[str, str],
) -> None:
    """Unknown, ad-hoc, and malformed column objects cannot pass validation."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )

    error: ChartGenerationError | None = validate_semantic_view_form_data(
        {**_valid_gantt_form_data(), "start_time": column}, target
    )

    assert error is not None
    assert error.error_type == "column_not_found"


def test_non_gantt_column_objects_remain_rejected() -> None:
    """Other plugins must prove their query path before accepting object refs."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )

    error: ChartGenerationError | None = validate_semantic_view_form_data(
        {
            "viz_type": "table",
            "groupby": [{"column_name": "customer__region"}],
        },
        target,
    )

    assert error is not None
    assert error.error_type == "column_not_found"


@pytest.mark.parametrize(
    "key,value",
    [
        ("tooltip_columns", {"column_name": "customer__region"}),
        ("start_time", [{"column_name": "metric_time"}]),
        ("series", [{"column_name": "customer__region"}] * 51),
        ("start_time", ""),
        ("end_time", None),
        ("tooltip_columns", ["customer__region"] * 51),
    ],
)
def test_gantt_column_roles_reject_non_queryable_shapes(
    key: str, value: object
) -> None:
    """Source-only rebind cannot save shapes the Gantt builder rejects."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )

    error: ChartGenerationError | None = validate_semantic_view_form_data(
        {**_valid_gantt_form_data(), key: value},
        target,
    )

    assert error is not None
    assert error.error_type == "column_not_found"


@pytest.mark.parametrize("viz_type", [None, "", "unregistered_viz", 123])
def test_retained_unknown_viz_fails_closed(viz_type: object) -> None:
    """Unrecognized query roles cannot be accepted via a generic fallback."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    error: ChartGenerationError | None = validate_semantic_view_form_data(
        {"viz_type": viz_type, "custom_metric": "missing"}, target
    )
    assert error is not None
    assert error.error_type == "unsupported_chart_type"


@pytest.mark.parametrize("viz_type", ["bubble", "bubble_v2"])
@pytest.mark.parametrize("orderby", ["revenue", ["revenue"]])
def test_retained_bubble_saved_sort_is_accepted(viz_type: str, orderby: object) -> None:
    """Bubble's native single-metric sort retains its saved metric identity."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    assert (
        validate_semantic_view_form_data(
            {"viz_type": viz_type, "orderby": orderby, "order_desc": True}, target
        )
        is None
    )


@pytest.mark.parametrize(
    "orderby",
    [
        "missing",
        ["missing"],
        "customer__region",
        {"expressionType": "SQL", "sqlExpression": "1"},
        [
            {
                "expressionType": "SIMPLE",
                "aggregate": "SUM",
                "column": {"column_name": "revenue"},
            }
        ],
    ],
)
def test_retained_bubble_invalid_sort_is_rejected(orderby: object) -> None:
    """Bubble sorting requires a saved metric, not a dimension or expression."""
    target: ChartDatasource = ChartDatasource(
        _mock_view(), DatasourceType.SEMANTIC_VIEW, 7, "Jaffle Shop"
    )
    error: ChartGenerationError | None = validate_semantic_view_form_data(
        {"viz_type": "bubble_v2", "orderby": orderby}, target
    )
    assert error is not None
    assert error.error_type == SEMANTIC_VIEW_ADHOC_ERROR
