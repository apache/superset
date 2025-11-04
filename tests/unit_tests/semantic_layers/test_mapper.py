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

from datetime import datetime
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.semantic_layers.mapper import (
    _convert_query_object_filter,
    _convert_time_grain,
    _get_filters_from_extras,
    _get_filters_from_query_object,
    _get_group_limit_filters,
    _get_group_limit_from_query_object,
    _get_order_from_query_object,
    _get_time_bounds,
    _get_time_filter,
    get_results,
    map_query_object,
    validate_query_object,
    ValidatedQueryObject,
    ValidatedQueryObjectFilterClause,
)
from superset.semantic_layers.types import (
    AdhocExpression,
    AdhocFilter,
    DateGrain,
    Dimension,
    Filter,
    GroupLimit,
    INTEGER,
    Metric,
    NUMBER,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
    SemanticViewFeature,
    STRING,
    TimeGrain,
)
from superset.utils.core import FilterOperator

# Alias for convenience
Feature = SemanticViewFeature


class MockSemanticViewImplementation:
    """
    Mock implementation of SemanticViewImplementation protocol.
    """

    def __init__(
        self,
        dimensions: set[Dimension],
        metrics: set[Metric],
        features: frozenset[SemanticViewFeature],
    ):
        self.dimensions = dimensions
        self.metrics = metrics
        self.features = features

    def uid(self) -> str:
        return "mock_semantic_view"

    def get_dimensions(self) -> set[Dimension]:
        return self.dimensions

    def get_metrics(self) -> set[Metric]:
        return self.metrics


@pytest.fixture
def mock_datasource(mocker: MockerFixture) -> MagicMock:
    """
    Create a mock datasource with semantic view implementation.
    """
    datasource = mocker.Mock()

    # Create dimensions
    time_dim = Dimension(
        id="orders.order_date",
        name="order_date",
        type=STRING,
        description="Order date",
        definition="order_date",
    )
    category_dim = Dimension(
        id="products.category",
        name="category",
        type=STRING,
        description="Product category",
        definition="category",
    )
    region_dim = Dimension(
        id="customers.region",
        name="region",
        type=STRING,
        description="Customer region",
        definition="region",
    )

    # Create metrics
    sales_metric = Metric(
        id="orders.total_sales",
        name="total_sales",
        type=NUMBER,
        definition="SUM(amount)",
        description="Total sales",
    )
    count_metric = Metric(
        id="orders.order_count",
        name="order_count",
        type=INTEGER,
        definition="COUNT(*)",
        description="Order count",
    )

    # Create semantic view implementation
    implementation = MockSemanticViewImplementation(
        dimensions={time_dim, category_dim, region_dim},
        metrics={sales_metric, count_metric},
        features=frozenset(
            {
                SemanticViewFeature.GROUP_LIMIT,
                SemanticViewFeature.GROUP_OTHERS,
            }
        ),
    )

    datasource.implementation = implementation
    datasource.fetch_values_predicate = None

    return datasource


@pytest.mark.parametrize(
    "input_grain, expected_grain",
    [
        ("PT1S", TimeGrain.PT1S),
        ("PT1M", TimeGrain.PT1M),
        ("PT1H", TimeGrain.PT1H),
        ("P1D", DateGrain.P1D),
        ("P1W", DateGrain.P1W),
        ("P1M", DateGrain.P1M),
        ("P1Y", DateGrain.P1Y),
        ("P3M", DateGrain.P3M),
        ("INVALID", None),
        ("", None),
    ],
)
def test_convert_date_time_grain(
    input_grain: str,
    expected_grain: TimeGrain | DateGrain,
) -> None:
    """
    Test conversion of time grains (hour, minute, second).
    """
    assert _convert_time_grain(input_grain) == expected_grain


def test_get_filters_from_extras_empty() -> None:
    """
    Test that empty extras returns empty set.
    """
    result = _get_filters_from_extras({})
    assert result == set()


def test_get_filters_from_extras_where() -> None:
    """
    Test extraction of WHERE clause from extras.
    """
    extras = {"where": "customer_id > 100"}
    result = _get_filters_from_extras(extras)

    assert len(result) == 1
    filter_ = next(iter(result))
    assert isinstance(filter_, AdhocFilter)
    assert filter_.type == PredicateType.WHERE
    assert filter_.definition == "customer_id > 100"


def test_get_filters_from_extras_having() -> None:
    """
    Test extraction of HAVING clause from extras.
    """
    extras = {"having": "SUM(sales) > 1000"}
    result = _get_filters_from_extras(extras)

    assert result == {
        AdhocFilter(type=PredicateType.HAVING, definition="SUM(sales) > 1000"),
    }


def test_get_filters_from_extras_both() -> None:
    """
    Test extraction of both WHERE and HAVING from extras.
    """
    extras = {
        "where": "region = 'US'",
        "having": "COUNT(*) > 10",
    }
    result = _get_filters_from_extras(extras)

    assert result == {
        AdhocFilter(type=PredicateType.WHERE, definition="region = 'US'"),
        AdhocFilter(type=PredicateType.HAVING, definition="COUNT(*) > 10"),
    }


def test_get_time_bounds_no_offset(mock_datasource: MagicMock) -> None:
    """
    Test time bounds without offset.
    """
    from_dttm = datetime(2025, 10, 15, 0, 0, 0)
    to_dttm = datetime(2025, 10, 22, 23, 59, 59)

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=from_dttm,
        to_dttm=to_dttm,
        metrics=["total_sales"],
        columns=["category"],
    )

    result_from, result_to = _get_time_bounds(query_object, None)

    assert result_from == from_dttm
    assert result_to == to_dttm


def test_get_time_filter_no_granularity(mock_datasource: MagicMock) -> None:
    """
    Test that no time filter is created without granularity.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity=None,
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_time_filter(query_object, None, all_dimensions)

    assert result == set()


def test_get_time_filter_with_granularity(mock_datasource: MagicMock) -> None:
    """
    Test time filter creation with granularity.
    """
    from_dttm = datetime(2025, 10, 15, 0, 0, 0)
    to_dttm = datetime(2025, 10, 22, 23, 59, 59)

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=from_dttm,
        to_dttm=to_dttm,
        metrics=["total_sales"],
        columns=["order_date", "category"],
        granularity="order_date",
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_time_filter(query_object, None, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=from_dttm,
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=to_dttm,
        ),
    }


def test_convert_query_object_filter_temporal_range() -> None:
    """
    Test that TEMPORAL_RANGE filters are skipped.
    """
    all_dimensions: dict[str, Dimension] = {}
    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": "Last 7 days",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result is None


def test_convert_query_object_filter_in(mock_datasource: MagicMock) -> None:
    """
    Test conversion of IN filter.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }
    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.IN.value,
        "col": "category",
        "val": ["Electronics", "Books"],
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == Filter(
        type=PredicateType.WHERE,
        column=all_dimensions["category"],
        operator=Operator.IN,
        value={"Electronics", "Books"},
    )


def test_convert_query_object_filter_is_null(mock_datasource: MagicMock) -> None:
    """
    Test conversion of IS_NULL filter.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }
    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.IS_NULL.value,
        "col": "region",
        "val": None,
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == Filter(
        type=PredicateType.WHERE,
        column=all_dimensions["region"],
        operator=Operator.IS_NULL,
        value=None,
    )


def test_get_filters_from_query_object_basic(mock_datasource: MagicMock) -> None:
    """
    Test basic filter extraction from query object.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["order_date", "category"],
        granularity="order_date",
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_filters_from_query_object(query_object, None, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 10, 15),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 22),
        ),
    }


def test_get_filters_from_query_object_with_extras(mock_datasource: MagicMock) -> None:
    """
    Test filter extraction with extras.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        extras={"where": "customer_id > 100"},
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_filters_from_query_object(query_object, None, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 10, 15),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 22),
        ),
        AdhocFilter(
            type=PredicateType.WHERE,
            definition="customer_id > 100",
        ),
    }


def test_get_filters_from_query_object_with_fetch_values(
    mock_datasource: MagicMock,
) -> None:
    """
    Test filter extraction with fetch values predicate.
    """
    mock_datasource.fetch_values_predicate = "tenant_id = 123"

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        apply_fetch_values_predicate=True,
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_filters_from_query_object(query_object, None, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 10, 15),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 22),
        ),
        AdhocFilter(
            type=PredicateType.WHERE,
            definition="tenant_id = 123",
        ),
    }


def test_get_order_from_query_object_metric(mock_datasource: MagicMock) -> None:
    """
    Test order extraction with metric.
    """
    all_metrics = {
        metric.name: metric for metric in mock_datasource.implementation.metrics
    }
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        orderby=[("total_sales", False)],  # DESC
    )

    result = _get_order_from_query_object(query_object, all_metrics, all_dimensions)

    assert result == [(all_metrics["total_sales"], OrderDirection.DESC)]


def test_get_order_from_query_object_dimension(mock_datasource: MagicMock) -> None:
    """
    Test order extraction with dimension.
    """
    all_metrics = {
        metric.name: metric for metric in mock_datasource.implementation.metrics
    }
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        orderby=[("category", True)],  # ASC
    )

    result = _get_order_from_query_object(query_object, all_metrics, all_dimensions)

    assert result == [(all_dimensions["category"], OrderDirection.ASC)]


def test_get_order_from_query_object_adhoc(mock_datasource: MagicMock) -> None:
    """
    Test order extraction with adhoc expression.
    """
    all_metrics = {
        metric.name: metric for metric in mock_datasource.implementation.metrics
    }
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        orderby=[({"label": "custom_order", "sqlExpression": "RAND()"}, True)],
    )

    result = _get_order_from_query_object(query_object, all_metrics, all_dimensions)

    assert result == [
        (
            AdhocExpression(
                id="custom_order",
                definition="RAND()",
            ),
            OrderDirection.ASC,
        )
    ]


def test_get_group_limit_from_query_object_none(mock_datasource: MagicMock) -> None:
    """
    Test that None is returned with no columns.
    """
    all_metrics = {
        metric.name: metric for metric in mock_datasource.implementation.metrics
    }
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=[],  # No columns
    )

    result = _get_group_limit_from_query_object(
        query_object,
        all_metrics,
        all_dimensions,
    )

    assert result is None


def test_get_group_limit_from_query_object_basic(mock_datasource: MagicMock) -> None:
    """
    Test basic group limit creation.
    """
    all_metrics = {
        metric.name: metric for metric in mock_datasource.implementation.metrics
    }
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category", "region"],
        series_columns=["category"],
        series_limit=10,
        series_limit_metric="total_sales",
        order_desc=True,
    )

    result = _get_group_limit_from_query_object(
        query_object,
        all_metrics,
        all_dimensions,
    )

    assert result == GroupLimit(
        top=10,
        dimensions=[all_dimensions["category"]],
        metric=all_metrics["total_sales"],
        direction=OrderDirection.DESC,
        group_others=False,
        filters=None,
    )


def test_get_group_limit_from_query_object_with_group_others(
    mock_datasource: MagicMock,
) -> None:
    """
    Test group limit with group_others enabled.
    """
    all_metrics = {
        metric.name: metric for metric in mock_datasource.implementation.metrics
    }
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        series_columns=["category"],
        series_limit=5,
        series_limit_metric="total_sales",
        group_others_when_limit_reached=True,
    )

    result = _get_group_limit_from_query_object(
        query_object,
        all_metrics,
        all_dimensions,
    )

    assert result
    assert result.group_others is True


def test_get_group_limit_filters_no_inner_bounds(mock_datasource: MagicMock) -> None:
    """
    Test that None is returned when no inner bounds.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        inner_from_dttm=None,
        inner_to_dttm=None,
        metrics=["total_sales"],
        columns=["category"],
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    assert result is None


def test_get_group_limit_filters_same_bounds(mock_datasource: MagicMock) -> None:
    """
    Test that None is returned when inner bounds equal outer bounds.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    from_dttm = datetime(2025, 10, 15)
    to_dttm = datetime(2025, 10, 22)

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=from_dttm,
        to_dttm=to_dttm,
        inner_from_dttm=from_dttm,  # Same
        inner_to_dttm=to_dttm,  # Same
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    assert result is None


def test_get_group_limit_filters_different_bounds(mock_datasource: MagicMock) -> None:
    """
    Test filter creation when inner bounds differ.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        inner_from_dttm=datetime(2025, 9, 22),  # Different (30 days)
        inner_to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 9, 22),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 22),
        ),
    }


def test_get_group_limit_filters_with_extras(mock_datasource: MagicMock) -> None:
    """
    Test that extras filters are included in group limit filters.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        inner_from_dttm=datetime(2025, 9, 22),
        inner_to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        extras={"where": "customer_id > 100"},
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 9, 22),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 22),
        ),
        AdhocFilter(
            type=PredicateType.WHERE,
            definition="customer_id > 100",
        ),
    }


def test_map_query_object_basic(mock_datasource: MagicMock) -> None:
    """
    Test basic query object mapping.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        row_limit=100,
        row_offset=10,
    )

    result = map_query_object(query_object)

    assert result == [
        SemanticQuery(
            metrics=[
                Metric(
                    id="orders.total_sales",
                    name="total_sales",
                    type=NUMBER,
                    definition="SUM(amount)",
                    description="Total sales",
                ),
            ],
            dimensions=[
                Dimension(
                    id="products.category",
                    name="category",
                    type=STRING,
                    definition="category",
                    description="Product category",
                    grain=None,
                ),
            ],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=Dimension(
                        id="orders.order_date",
                        name="order_date",
                        type=STRING,
                        definition="order_date",
                        description="Order date",
                        grain=None,
                    ),
                    operator=Operator.GREATER_THAN_OR_EQUAL,
                    value=datetime(2025, 10, 15, 0, 0),
                ),
                Filter(
                    type=PredicateType.WHERE,
                    column=Dimension(
                        id="orders.order_date",
                        name="order_date",
                        type=STRING,
                        definition="order_date",
                        description="Order date",
                        grain=None,
                    ),
                    operator=Operator.LESS_THAN,
                    value=datetime(2025, 10, 22, 0, 0),
                ),
            },
            order=[],
            limit=100,
            offset=10,
            group_limit=None,
        )
    ]


def test_map_query_object_with_time_offsets(mock_datasource: MagicMock) -> None:
    """
    Test mapping with time offsets.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        time_offsets=["1 week ago", "1 month ago"],
    )

    result = map_query_object(query_object)

    # Should have 3 queries: main + 2 offsets
    assert len(result) == 3
    assert result[0].filters == {
        Filter(
            type=PredicateType.WHERE,
            column=Dimension(
                id="orders.order_date",
                name="order_date",
                type=STRING,
                definition="order_date",
                description="Order date",
                grain=None,
            ),
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 10, 15, 0, 0),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=Dimension(
                id="orders.order_date",
                name="order_date",
                type=STRING,
                definition="order_date",
                description="Order date",
                grain=None,
            ),
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 22, 0, 0),
        ),
    }
    assert result[1].filters == {
        Filter(
            type=PredicateType.WHERE,
            column=Dimension(
                id="orders.order_date",
                name="order_date",
                type=STRING,
                definition="order_date",
                description="Order date",
                grain=None,
            ),
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 10, 8, 0, 0),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=Dimension(
                id="orders.order_date",
                name="order_date",
                type=STRING,
                definition="order_date",
                description="Order date",
                grain=None,
            ),
            operator=Operator.LESS_THAN,
            value=datetime(2025, 10, 15, 0, 0),
        ),
    }
    assert result[2].filters == {
        Filter(
            type=PredicateType.WHERE,
            column=Dimension(
                id="orders.order_date",
                name="order_date",
                type=STRING,
                definition="order_date",
                description="Order date",
                grain=None,
            ),
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=datetime(2025, 9, 15, 0, 0),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=Dimension(
                id="orders.order_date",
                name="order_date",
                type=STRING,
                definition="order_date",
                description="Order date",
                grain=None,
            ),
            operator=Operator.LESS_THAN,
            value=datetime(2025, 9, 22, 0, 0),
        ),
    }


def test_convert_query_object_filter_unknown_operator(
    mock_datasource: MagicMock,
) -> None:
    """
    Test filter with unknown operator returns None.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": "UNKNOWN_OPERATOR",
        "col": "category",
        "val": "Electronics",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result is None


def test_validate_query_object_undefined_metric_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error for undefined metrics.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["undefined_metric"],
        columns=["order_date"],
    )

    with pytest.raises(ValueError, match="All metrics must be defined"):
        validate_query_object(query_object)


def test_validate_query_object_undefined_dimension_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error for undefined dimensions.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["undefined_dimension"],
    )

    with pytest.raises(ValueError, match="All dimensions must be defined"):
        validate_query_object(query_object)


def test_validate_query_object_time_grain_without_column_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error when time grain provided without time column.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["order_date", "category"],
        granularity=None,  # No time column
        extras={"time_grain_sqla": "P1D"},
    )

    with pytest.raises(ValueError, match="time column must be specified"):
        validate_query_object(query_object)


def test_validate_query_object_unsupported_time_grain_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error for unsupported time grain.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["order_date", "category"],
        granularity="order_date",
        extras={"time_grain_sqla": "P1Y"},  # Year grain not supported
    )

    with pytest.raises(
        ValueError,
        match=(
            "The time grain is not supported for the time column in the Semantic View."
        ),
    ):
        validate_query_object(query_object)


def test_validate_query_object_group_limit_not_supported_error(
    mocker: MockerFixture,
) -> None:
    """
    Test validation error when group limit not supported.
    """
    mock_datasource = mocker.Mock()
    time_dim = Dimension("order_date", "order_date", STRING, "order_date", "Date")
    category_dim = Dimension("category", "category", STRING, "category", "Category")
    sales_metric = Metric("total_sales", "total_sales", NUMBER, "SUM(amount)", "Sales")

    mock_datasource.implementation.dimensions = {time_dim, category_dim}
    mock_datasource.implementation.metrics = {sales_metric}
    mock_datasource.implementation.features = frozenset()  # No GROUP_LIMIT feature

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["order_date", "category"],
        series_columns=["category"],
        series_limit=10,
    )

    with pytest.raises(ValueError, match="Group limit is not supported"):
        validate_query_object(query_object)


def test_validate_query_object_undefined_series_column_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error for undefined series columns.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["order_date", "category"],
        series_columns=["undefined_column"],
        series_limit=10,
    )

    with pytest.raises(ValueError, match="All series columns must be defined"):
        validate_query_object(query_object)


@pytest.mark.parametrize(
    "filter_op, expected_operator",
    [
        ("==", Operator.EQUALS),
        ("!=", Operator.NOT_EQUALS),
        ("<", Operator.LESS_THAN),
        (">", Operator.GREATER_THAN),
        ("<=", Operator.LESS_THAN_OR_EQUAL),
        (">=", Operator.GREATER_THAN_OR_EQUAL),
    ],
)
def test_convert_query_object_filter(
    filter_op: str,
    expected_operator: Operator,
) -> None:
    """
    Test filter with different operators.
    """
    all_dimensions = {
        "category": Dimension("category", "category", STRING, "category", "Category")
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": filter_op,
        "col": "category",
        "val": "Electronics",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == Filter(
        type=PredicateType.WHERE,
        column=all_dimensions["category"],
        operator=expected_operator,
        value="Electronics",
    )


def test_convert_query_object_filter_like() -> None:
    """
    Test filter with LIKE operator.
    """
    all_dimensions = {"name": Dimension("name", "name", STRING, "name", "Name")}

    filter_: ValidatedQueryObjectFilterClause = {
        "op": "LIKE",
        "col": "name",
        "val": "%test%",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == Filter(
        type=PredicateType.WHERE,
        column=all_dimensions["name"],
        operator=Operator.LIKE,
        value="%test%",
    )


def test_get_results_without_time_offsets(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results without time offsets returns main query result.
    """
    # Create mock dataframe for main query
    main_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [1000.0, 500.0, 750.0],
        }
    )

    # Mock the semantic view's get_dataframe method
    mock_result = SemanticResult(
        requests=[
            SemanticRequest(
                type="SQL",
                definition="SELECT category, SUM(amount) FROM orders GROUP BY category",
            )
        ],
        results=main_df,
    )

    mock_datasource.implementation.get_dataframe = mocker.Mock(return_value=mock_result)

    # Create query object without time offsets
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
    )

    # Call get_results
    result = get_results(query_object)

    # Verify result
    assert isinstance(result, SemanticResult)
    assert len(result.requests) == 1
    assert result.requests[0].type == "SQL"

    # Verify DataFrame matches main query result
    pd.testing.assert_frame_equal(result.results, main_df)


def test_get_results_with_single_time_offset(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results with a single time offset joins correctly.
    """
    # Create mock dataframes
    main_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [1000.0, 500.0, 750.0],
        }
    )

    offset_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [950.0, 480.0, 700.0],
        }
    )

    # Mock the semantic view's get_dataframe method
    # It will be called twice: once for main, once for offset
    mock_main_result = SemanticResult(
        requests=[
            SemanticRequest(
                type="SQL",
                definition=(
                    "SELECT category, SUM(amount) FROM orders "
                    "WHERE date >= '2025-10-15' GROUP BY category"
                ),
            )
        ],
        results=main_df.copy(),
    )

    mock_offset_result = SemanticResult(
        requests=[
            SemanticRequest(
                type="SQL",
                definition=(
                    "SELECT category, SUM(amount) FROM orders "
                    "WHERE date >= '2025-10-08' GROUP BY category"
                ),
            )
        ],
        results=offset_df.copy(),
    )

    mock_datasource.implementation.get_dataframe = mocker.Mock(
        side_effect=[mock_main_result, mock_offset_result]
    )

    # Create query object with time offset
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        time_offsets=["1 week ago"],
    )

    # Call get_results
    result = get_results(query_object)

    # Verify result structure
    assert isinstance(result, SemanticResult)
    assert len(result.requests) == 2  # Main + offset query

    # Verify DataFrame has both main and offset metrics
    expected_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [1000.0, 500.0, 750.0],
            "total_sales__1 week ago": [950.0, 480.0, 700.0],
        }
    )

    pd.testing.assert_frame_equal(result.results, expected_df)


def test_get_results_with_multiple_time_offsets(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results with multiple time offsets joins all correctly.
    """
    # Create mock dataframes
    main_df = pd.DataFrame(
        {
            "region": ["US", "UK", "JP"],
            "order_count": [100, 50, 75],
        }
    )

    offset_1w_df = pd.DataFrame(
        {
            "region": ["US", "UK", "JP"],
            "order_count": [95, 48, 70],
        }
    )

    offset_1m_df = pd.DataFrame(
        {
            "region": ["US", "UK", "JP"],
            "order_count": [80, 40, 60],
        }
    )

    # Mock results
    mock_main_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="MAIN QUERY")],
        results=main_df.copy(),
    )

    mock_offset_1w_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET 1W QUERY")],
        results=offset_1w_df.copy(),
    )

    mock_offset_1m_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET 1M QUERY")],
        results=offset_1m_df.copy(),
    )

    mock_datasource.implementation.get_dataframe = mocker.Mock(
        side_effect=[mock_main_result, mock_offset_1w_result, mock_offset_1m_result]
    )

    # Create query object with multiple time offsets
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["order_count"],
        columns=["region"],
        granularity="order_date",
        time_offsets=["1 week ago", "1 month ago"],
    )

    # Call get_results
    result = get_results(query_object)

    # Verify result structure
    assert isinstance(result, SemanticResult)
    assert len(result.requests) == 3  # Main + 2 offset queries

    # Verify all requests are collected
    assert result.requests[0].definition == "MAIN QUERY"
    assert result.requests[1].definition == "OFFSET 1W QUERY"
    assert result.requests[2].definition == "OFFSET 1M QUERY"

    # Verify DataFrame has all metrics
    expected_df = pd.DataFrame(
        {
            "region": ["US", "UK", "JP"],
            "order_count": [100, 50, 75],
            "order_count__1 week ago": [95, 48, 70],
            "order_count__1 month ago": [80, 40, 60],
        }
    )

    pd.testing.assert_frame_equal(result.results, expected_df)


def test_get_results_with_empty_offset_result(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results handles empty offset results gracefully.
    """
    # Create mock dataframes
    main_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books"],
            "total_sales": [1000.0, 500.0],
        }
    )

    # Empty offset result
    offset_df = pd.DataFrame()

    # Mock results
    mock_main_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="MAIN QUERY")],
        results=main_df.copy(),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET QUERY")],
        results=offset_df,
    )

    mock_datasource.implementation.get_dataframe = mocker.Mock(
        side_effect=[mock_main_result, mock_offset_result]
    )

    # Create query object with time offset
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        time_offsets=["1 week ago"],
    )

    # Call get_results
    result = get_results(query_object)

    # Verify result structure
    assert isinstance(result, SemanticResult)
    assert len(result.requests) == 2

    # Verify DataFrame has NaN for missing offset data
    assert "total_sales__1 week ago" in result.results.columns
    assert result.results["total_sales__1 week ago"].isna().all()


def test_get_results_with_partial_offset_match(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results with partial matches in offset data (left join behavior).
    """
    # Main query has 3 categories
    main_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [1000.0, 500.0, 750.0],
        }
    )

    # Offset query only has 2 categories (Books missing)
    offset_df = pd.DataFrame(
        {
            "category": ["Electronics", "Clothing"],
            "total_sales": [950.0, 700.0],
        }
    )

    # Mock results
    mock_main_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="MAIN QUERY")],
        results=main_df.copy(),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET QUERY")],
        results=offset_df.copy(),
    )

    mock_datasource.implementation.get_dataframe = mocker.Mock(
        side_effect=[mock_main_result, mock_offset_result]
    )

    # Create query object
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        time_offsets=["1 week ago"],
    )

    # Call get_results
    result = get_results(query_object)

    # Verify DataFrame structure
    expected_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [1000.0, 500.0, 750.0],
            "total_sales__1 week ago": [950.0, None, 700.0],
        }
    )

    pd.testing.assert_frame_equal(result.results, expected_df)


def test_get_results_with_multiple_dimensions(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results with multiple dimension columns in join.
    """
    # Create mock dataframes with multiple dimensions
    main_df = pd.DataFrame(
        {
            "category": ["Electronics", "Electronics", "Books"],
            "region": ["US", "UK", "US"],
            "total_sales": [1000.0, 800.0, 500.0],
        }
    )

    offset_df = pd.DataFrame(
        {
            "category": ["Electronics", "Electronics", "Books"],
            "region": ["US", "UK", "US"],
            "total_sales": [950.0, 780.0, 480.0],
        }
    )

    # Mock results
    mock_main_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="MAIN QUERY")],
        results=main_df.copy(),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET QUERY")],
        results=offset_df.copy(),
    )

    mock_datasource.implementation.get_dataframe = mocker.Mock(
        side_effect=[mock_main_result, mock_offset_result]
    )

    # Create query object with multiple dimensions
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category", "region"],
        granularity="order_date",
        time_offsets=["1 week ago"],
    )

    # Call get_results
    result = get_results(query_object)

    # Verify DataFrame structure - join should be on both category and region
    expected_df = pd.DataFrame(
        {
            "category": ["Electronics", "Electronics", "Books"],
            "region": ["US", "UK", "US"],
            "total_sales": [1000.0, 800.0, 500.0],
            "total_sales__1 week ago": [950.0, 780.0, 480.0],
        }
    )

    pd.testing.assert_frame_equal(result.results, expected_df)
