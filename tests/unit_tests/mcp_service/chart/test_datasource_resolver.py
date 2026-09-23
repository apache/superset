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
    assert validate_semantic_view_form_data(form_data, target) is not None


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
                "order_by_cols": ['["revenue", false]'],
                "orderby": [["customer__region", True]],
            },
            target,
        )
        is None
    )
