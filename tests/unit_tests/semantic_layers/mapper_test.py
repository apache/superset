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

from datetime import date, datetime, time, timezone
from typing import Any
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pandas as pd
import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    AdhocExpression,
    Dimension,
    Filter,
    Grain,
    Grains,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticViewFeature

from superset.semantic_layers.mapper import (
    _coerce_scalar_filter_value,
    _convert_query_object_filter,
    _convert_time_grain,
    _get_filters_from_extras,
    _get_filters_from_query_object,
    _get_group_limit_filters,
    _get_group_limit_from_query_object,
    _get_order_from_query_object,
    _get_time_bounds,
    _get_time_filter,
    _normalize_column,
    _validate_filters,
    _validate_granularity,
    _validate_group_limit,
    _validate_metrics,
    get_results,
    map_query_object,
    validate_query_object,
    ValidatedQueryObject,
    ValidatedQueryObjectFilterClause,
)
from superset.superset_typing import AdhocColumn
from superset.utils.core import FilterOperator

# Alias for convenience
Feature = SemanticViewFeature


class MockSemanticView:
    """
    Mock implementation of SemanticView protocol.
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
        type=pa.utf8(),
        description="Order date",
        definition="order_date",
    )
    category_dim = Dimension(
        id="products.category",
        name="category",
        type=pa.utf8(),
        description="Product category",
        definition="category",
    )
    region_dim = Dimension(
        id="customers.region",
        name="region",
        type=pa.utf8(),
        description="Customer region",
        definition="region",
    )

    # Create metrics
    sales_metric = Metric(
        id="orders.total_sales",
        name="total_sales",
        type=pa.float64(),
        definition="SUM(amount)",
        description="Total sales",
    )
    count_metric = Metric(
        id="orders.order_count",
        name="order_count",
        type=pa.int64(),
        definition="COUNT(*)",
        description="Order count",
    )

    # Create semantic view implementation
    implementation = MockSemanticView(
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
        ("PT1S", Grains.SECOND),
        ("PT1M", Grains.MINUTE),
        ("PT1H", Grains.HOUR),
        ("P1D", Grains.DAY),
        ("P1W", Grains.WEEK),
        ("P1M", Grains.MONTH),
        ("P1Y", Grains.YEAR),
        ("P3M", Grains.QUARTER),
        ("INVALID", None),
        ("", None),
    ],
)
def test_convert_date_time_grain(
    input_grain: str,
    expected_grain: Grain,
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
    assert isinstance(filter_, Filter)
    assert filter_.type == PredicateType.WHERE
    assert filter_.column is None
    assert filter_.operator == Operator.ADHOC
    assert filter_.value == "customer_id > 100"


def test_get_filters_from_extras_having() -> None:
    """
    Test extraction of HAVING clause from extras.
    """
    extras = {"having": "SUM(sales) > 1000"}
    result = _get_filters_from_extras(extras)

    assert result == {
        Filter(
            type=PredicateType.HAVING,
            column=None,
            operator=Operator.ADHOC,
            value="SUM(sales) > 1000",
        ),
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
        Filter(
            type=PredicateType.WHERE,
            column=None,
            operator=Operator.ADHOC,
            value="region = 'US'",
        ),
        Filter(
            type=PredicateType.HAVING,
            column=None,
            operator=Operator.ADHOC,
            value="COUNT(*) > 10",
        ),
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

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["category"],
            operator=Operator.IN,
            value=frozenset({"Electronics", "Books"}),
        )
    }


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

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["region"],
            operator=Operator.IS_NULL,
            value=None,
        )
    }


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
        Filter(
            type=PredicateType.WHERE,
            column=None,
            operator=Operator.ADHOC,
            value="customer_id > 100",
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
        Filter(
            type=PredicateType.WHERE,
            column=None,
            operator=Operator.ADHOC,
            value="tenant_id = 123",
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
        Filter(
            type=PredicateType.WHERE,
            column=None,
            operator=Operator.ADHOC,
            value="customer_id > 100",
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
                    type=pa.float64(),
                    definition="SUM(amount)",
                    description="Total sales",
                ),
            ],
            dimensions=[
                Dimension(
                    id="products.category",
                    name="category",
                    type=pa.utf8(),
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
                        type=pa.utf8(),
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
                        type=pa.utf8(),
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
                type=pa.utf8(),
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
                type=pa.utf8(),
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
                type=pa.utf8(),
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
                type=pa.utf8(),
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
                type=pa.utf8(),
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
                type=pa.utf8(),
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
    Test filter with unknown operator raises ValueError.
    """
    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": "UNKNOWN_OPERATOR",
        "col": "category",
        "val": "Electronics",
    }

    with pytest.raises(ValueError, match="Unsupported filter operator"):
        _convert_query_object_filter(filter_, all_dimensions)


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
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    sales_metric = Metric(
        "total_sales", "total_sales", pa.float64(), "SUM(amount)", "Sales"
    )

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
        "category": Dimension("category", "category", pa.utf8(), "category", "Category")
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": filter_op,
        "col": "category",
        "val": "Electronics",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["category"],
            operator=expected_operator,
            value="Electronics",
        )
    }


def test_convert_query_object_filter_like() -> None:
    """
    Test filter with LIKE operator.
    """
    all_dimensions = {"name": Dimension("name", "name", pa.utf8(), "name", "Name")}

    filter_: ValidatedQueryObjectFilterClause = {
        "op": "LIKE",
        "col": "name",
        "val": "%test%",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["name"],
            operator=Operator.LIKE,
            value="%test%",
        )
    }


def test_convert_query_object_filter_coerces_integer_string_value() -> None:
    """Test scalar filter values are coerced to dimension type."""
    all_dimensions = {
        "birthyear": Dimension(
            "birthyear",
            "birthyear",
            pa.int64(),
            "birthyear",
            "Birthyear",
        )
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
        "col": "birthyear",
        "val": "1982",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["birthyear"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=1982,
        )
    }


def test_convert_query_object_filter_coerces_in_integer_values() -> None:
    """Test IN filter list values are coerced element-wise."""
    all_dimensions = {
        "order_id__amount": Dimension(
            "order_id__amount",
            "order_id__amount",
            pa.int64(),
            "order_id__amount",
            "Order amount",
        )
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.IN.value,
        "col": "order_id__amount",
        "val": ["58", "61"],
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_id__amount"],
            operator=Operator.IN,
            value=frozenset({58, 61}),
        )
    }


def test_convert_query_object_filter_invalid_integer_value_raises() -> None:
    """Test invalid integer value raises a clear error."""
    all_dimensions = {
        "birthyear": Dimension(
            "birthyear",
            "birthyear",
            pa.int64(),
            "birthyear",
            "Birthyear",
        )
    }

    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.GREATER_THAN_OR_EQUALS.value,
        "col": "birthyear",
        "val": "nineteen-eighty-two",
    }

    with pytest.raises(
        ValueError,
        match="Invalid integer value 'nineteen-eighty-two' for filter column birthyear",
    ):
        _convert_query_object_filter(filter_, all_dimensions)


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

    # Mock the semantic view's get_table method
    mock_result = SemanticResult(
        requests=[
            SemanticRequest(
                type="SQL",
                definition="SELECT category, SUM(amount) FROM orders GROUP BY category",
            )
        ],
        results=pa.Table.from_pandas(main_df),
    )

    mock_datasource.implementation.get_table = mocker.Mock(return_value=mock_result)

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

    # Verify result is a QueryResult
    assert result.df is not None
    assert "SQL" in result.query

    # Verify DataFrame matches main query result
    pd.testing.assert_frame_equal(result.df, main_df)


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

    # Mock the semantic view's get_table method
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
        results=pa.Table.from_pandas(main_df.copy()),
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
        results=pa.Table.from_pandas(offset_df.copy()),
    )

    mock_datasource.implementation.get_table = mocker.Mock(
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

    # Verify result structure - QueryResult with query containing both SQL statements
    assert result.df is not None
    assert "SQL" in result.query

    # Verify DataFrame has both main and offset metrics
    expected_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books", "Clothing"],
            "total_sales": [1000.0, 500.0, 750.0],
            "total_sales__1 week ago": [950.0, 480.0, 700.0],
        }
    )

    pd.testing.assert_frame_equal(result.df, expected_df)


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
        results=pa.Table.from_pandas(main_df.copy()),
    )

    mock_offset_1w_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET 1W QUERY")],
        results=pa.Table.from_pandas(offset_1w_df.copy()),
    )

    mock_offset_1m_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET 1M QUERY")],
        results=pa.Table.from_pandas(offset_1m_df.copy()),
    )

    mock_datasource.implementation.get_table = mocker.Mock(
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

    # Verify result structure - QueryResult with combined query strings
    assert result.df is not None
    assert "MAIN QUERY" in result.query
    assert "OFFSET 1W QUERY" in result.query
    assert "OFFSET 1M QUERY" in result.query

    # Verify DataFrame has all metrics
    expected_df = pd.DataFrame(
        {
            "region": ["US", "UK", "JP"],
            "order_count": [100, 50, 75],
            "order_count__1 week ago": [95, 48, 70],
            "order_count__1 month ago": [80, 40, 60],
        }
    )

    pd.testing.assert_frame_equal(result.df, expected_df)


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
        results=pa.Table.from_pandas(main_df.copy()),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET QUERY")],
        results=pa.Table.from_pandas(offset_df),
    )

    mock_datasource.implementation.get_table = mocker.Mock(
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
    assert result.df is not None
    assert "MAIN QUERY" in result.query
    assert "OFFSET QUERY" in result.query

    # Verify DataFrame has NaN for missing offset data
    assert "total_sales__1 week ago" in result.df.columns
    assert result.df["total_sales__1 week ago"].isna().all()


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
        results=pa.Table.from_pandas(main_df.copy()),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET QUERY")],
        results=pa.Table.from_pandas(offset_df.copy()),
    )

    mock_datasource.implementation.get_table = mocker.Mock(
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

    pd.testing.assert_frame_equal(result.df, expected_df)


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
        results=pa.Table.from_pandas(main_df.copy()),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET QUERY")],
        results=pa.Table.from_pandas(offset_df.copy()),
    )

    mock_datasource.implementation.get_table = mocker.Mock(
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

    pd.testing.assert_frame_equal(result.df, expected_df)


def test_get_results_no_datasource() -> None:
    """
    Test that get_results raises error when datasource is missing.
    """
    query_object = ValidatedQueryObject(
        datasource=None,
        metrics=["total_sales"],
        columns=["category"],
    )

    with pytest.raises(ValueError, match="QueryObject must have a datasource defined"):
        get_results(query_object)


def test_get_results_with_duplicate_columns(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results handles duplicate columns from merge gracefully.
    """
    # Create main dataframe
    main_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books"],
            "total_sales": [1000.0, 500.0],
        }
    )

    # Create offset dataframe with an extra column that will cause duplicate
    offset_df = pd.DataFrame(
        {
            "category": ["Electronics", "Books"],
            "total_sales": [950.0, 480.0],
            "category__duplicate": ["X", "Y"],  # Simulate a duplicate column
        }
    )

    mock_main_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="MAIN")],
        results=pa.Table.from_pandas(main_df.copy()),
    )

    mock_offset_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="OFFSET")],
        results=pa.Table.from_pandas(offset_df.copy()),
    )

    mock_datasource.implementation.get_table = mocker.Mock(
        side_effect=[mock_main_result, mock_offset_result]
    )

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        time_offsets=["1 week ago"],
    )

    result = get_results(query_object)

    # Verify duplicate columns are dropped
    assert "category__duplicate" not in result.df.columns


def test_get_results_empty_requests(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results with empty requests list.
    """
    main_df = pd.DataFrame(
        {
            "category": ["Electronics"],
            "total_sales": [1000.0],
        }
    )

    mock_result = SemanticResult(
        requests=[],  # Empty requests
        results=pa.Table.from_pandas(main_df),
    )

    mock_datasource.implementation.get_table = mocker.Mock(return_value=mock_result)

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
    )

    result = get_results(query_object)

    # Query string should be empty when no requests
    assert result.query == ""


def test_normalize_column_adhoc_not_in_dimensions() -> None:
    """
    Test _normalize_column raises error for AdhocColumn with sqlExpression not in dims.
    """
    dimension_names = {"category", "region"}
    adhoc_column: AdhocColumn = {
        "isColumnReference": True,
        "sqlExpression": "unknown_dimension",
    }

    with pytest.raises(ValueError, match="Adhoc dimensions are not supported"):
        _normalize_column(adhoc_column, dimension_names)


def test_normalize_column_adhoc_missing_sql_expression() -> None:
    """
    Test _normalize_column raises error for AdhocColumn without sqlExpression.
    """
    dimension_names = {"category", "region"}
    adhoc_column: AdhocColumn = {
        "isColumnReference": True,
    }

    with pytest.raises(ValueError, match="Adhoc dimensions are not supported"):
        _normalize_column(adhoc_column, dimension_names)


def test_normalize_column_adhoc_valid(mock_datasource: MagicMock) -> None:
    """
    Test _normalize_column with valid AdhocColumn reference.
    """
    dimension_names = {"category", "region"}
    adhoc_column: AdhocColumn = {
        "isColumnReference": True,
        "sqlExpression": "category",
    }

    result = _normalize_column(adhoc_column, dimension_names)
    assert result == "category"


def test_get_filters_from_query_object_with_filter_clauses(
    mock_datasource: MagicMock,
) -> None:
    """
    Test filter extraction with filter clauses including TEMPORAL_RANGE skip.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        filter=[
            {
                "op": FilterOperator.TEMPORAL_RANGE.value,
                "col": "order_date",
                "val": "Last 7 days",
            },
            {
                "op": FilterOperator.EQUALS.value,
                "col": "category",
                "val": "Electronics",
            },
        ],
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_filters_from_query_object(query_object, None, all_dimensions)

    # Should return a set of filters
    # TEMPORAL_RANGE should be skipped when granularity is set
    # The category EQUALS filter should be converted
    assert isinstance(result, set)
    # Should have at least time filters (from from_dttm/to_dttm)
    assert len(result) >= 2


def test_get_time_filter_unknown_granularity(mock_datasource: MagicMock) -> None:
    """
    Test _get_time_filter returns empty set when granularity is not in dimensions.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="unknown_time_column",  # Not in dimensions
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_time_filter(query_object, None, all_dimensions)

    assert result == set()


def test_get_time_filter_missing_bounds(mock_datasource: MagicMock) -> None:
    """
    Test _get_time_filter returns empty set when time bounds are missing.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=None,  # Missing
        to_dttm=None,  # Missing
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
    )

    all_dimensions = {
        dim.name: dim for dim in mock_datasource.implementation.dimensions
    }

    result = _get_time_filter(query_object, None, all_dimensions)

    assert result == set()


def test_get_time_bounds_with_offset_fallback_to_time_range(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test _get_time_bounds falls back to time_range parsing when bounds missing.
    """
    mocker.patch(
        "superset.semantic_layers.mapper.get_since_until_from_query_object",
        return_value=(datetime(2025, 10, 1), datetime(2025, 10, 15)),
    )

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=None,  # Missing
        to_dttm=None,  # Missing
        metrics=["total_sales"],
        columns=["category"],
        time_range="Last 14 days",
    )

    from_dttm, to_dttm = _get_time_bounds(query_object, "1 week ago")

    # Should have calculated offset bounds
    assert from_dttm is not None
    assert to_dttm is not None


def test_get_time_bounds_with_offset_no_bounds(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test _get_time_bounds returns None when no bounds available.
    """
    mocker.patch(
        "superset.semantic_layers.mapper.get_since_until_from_query_object",
        return_value=(None, None),
    )

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=None,
        to_dttm=None,
        metrics=["total_sales"],
        columns=["category"],
    )

    from_dttm, to_dttm = _get_time_bounds(query_object, "1 week ago")

    assert from_dttm is None
    assert to_dttm is None


def test_convert_query_object_filter_temporal_range_with_value() -> None:
    """
    Test conversion of TEMPORAL_RANGE filter with valid string value.
    """
    all_dimensions = {
        "order_date": Dimension(
            "order_date", "order_date", pa.utf8(), "order_date", "Order date"
        )
    }
    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": "2025-01-01 : 2025-12-31",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value="2025-01-01",
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value="2025-12-31",
        ),
    }


def test_convert_query_object_filter_temporal_range_coerces_date_bounds() -> None:
    """
    TEMPORAL_RANGE bounds should be coerced against the dimension's dtype so
    date/timestamp columns are not compared against raw strings.
    """
    all_dimensions = {
        "order_date": Dimension(
            "order_date", "order_date", pa.date32(), "order_date", "Order date"
        )
    }
    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": "2025-01-01 : 2025-12-31",
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    assert result == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=date(2025, 1, 1),
        ),
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=date(2025, 12, 31),
        ),
    }


def test_convert_query_object_filter_temporal_range_open_ended() -> None:
    """
    Open-ended TEMPORAL_RANGE bounds should emit only the bounded predicate.
    """
    all_dimensions = {
        "order_date": Dimension(
            "order_date", "order_date", pa.date32(), "order_date", "Order date"
        )
    }

    only_start: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": "2025-01-01 : ",
    }
    assert _convert_query_object_filter(only_start, all_dimensions) == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=date(2025, 1, 1),
        ),
    }

    only_end: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": " : 2025-12-31",
    }
    assert _convert_query_object_filter(only_end, all_dimensions) == {
        Filter(
            type=PredicateType.WHERE,
            column=all_dimensions["order_date"],
            operator=Operator.LESS_THAN,
            value=date(2025, 12, 31),
        ),
    }

    empty: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": " : ",
    }
    assert _convert_query_object_filter(empty, all_dimensions) is None


def test_get_order_adhoc_with_none_sql_expression(mock_datasource: MagicMock) -> None:
    """
    Test order extraction skips adhoc expression with None sqlExpression.
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
        orderby=[
            ({"label": "custom", "sqlExpression": None}, True),  # None sqlExpression
        ],
    )

    result = _get_order_from_query_object(query_object, all_metrics, all_dimensions)

    # Should be empty - the adhoc with None sqlExpression is skipped
    assert result == []


def test_get_order_unknown_element(mock_datasource: MagicMock) -> None:
    """
    Test order extraction skips unknown elements.
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
        orderby=[
            ("unknown_column", True),  # Not in dimensions or metrics
        ],
    )

    result = _get_order_from_query_object(query_object, all_metrics, all_dimensions)

    # Should be empty - unknown element is skipped
    assert result == []


def test_get_group_limit_filters_with_granularity_no_time_dimension(
    mock_datasource: MagicMock,
) -> None:
    """
    Test group limit filters when granularity doesn't match any dimension.
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
        granularity="unknown_time_col",  # Not in dimensions
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should return None since no filters could be created
    assert result is None


def test_get_group_limit_filters_with_fetch_values_predicate(
    mock_datasource: MagicMock,
) -> None:
    """
    Test group limit filters include fetch values predicate.
    """
    mock_datasource.fetch_values_predicate = "tenant_id = 123"

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
        apply_fetch_values_predicate=True,
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    assert result is not None
    assert (
        Filter(
            type=PredicateType.WHERE,
            column=None,
            operator=Operator.ADHOC,
            value="tenant_id = 123",
        )
        in result
    )


def test_get_group_limit_filters_with_filter_clauses(
    mock_datasource: MagicMock,
) -> None:
    """
    Test group limit filters include converted filter clauses.
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
        filter=[
            {
                "op": FilterOperator.TEMPORAL_RANGE.value,
                "col": "order_date",
                "val": "Last 7 days",
            },
            {
                "op": FilterOperator.EQUALS.value,
                "col": "category",
                "val": "Electronics",
            },
        ],
    )

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should return filters including time filters from inner bounds
    # TEMPORAL_RANGE should be skipped
    assert result is not None
    assert isinstance(result, set)
    assert len(result) >= 2  # At least inner time filters


def test_validate_query_object_no_datasource() -> None:
    """
    Test validate_query_object returns False when no datasource.
    """
    query_object = ValidatedQueryObject(
        datasource=None,
        metrics=["total_sales"],
        columns=["category"],
    )

    result = validate_query_object(query_object)

    assert result is False


def test_validate_metrics_adhoc_error(
    mocker: MockerFixture,
) -> None:
    """
    Test validation error for adhoc metrics.
    """
    mock_datasource = mocker.Mock()
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    sales_metric = Metric(
        "total_sales", "total_sales", pa.float64(), "SUM(amount)", "Sales"
    )

    mock_datasource.implementation.dimensions = {category_dim}
    mock_datasource.implementation.metrics = {sales_metric}

    # Manually create a query object with an adhoc metric
    query_object = mocker.Mock()
    query_object.datasource = mock_datasource
    query_object.metrics = [{"label": "adhoc", "sqlExpression": "SUM(x)"}]

    with pytest.raises(ValueError, match="Adhoc metrics are not supported"):
        _validate_metrics(query_object)


def test_validate_filters_adhoc_column_error(
    mocker: MockerFixture,
) -> None:
    """
    Test validation error for adhoc column in filter.
    """

    query_object = mocker.Mock()
    query_object.filter = [
        {
            "op": FilterOperator.EQUALS.value,
            "col": {"sqlExpression": "custom_col"},  # Adhoc column
            "val": "test",
        },
    ]

    with pytest.raises(ValueError, match="Adhoc columns are not supported"):
        _validate_filters(query_object)


def test_validate_filters_missing_operator_error(
    mocker: MockerFixture,
) -> None:
    """
    Test validation error for filter without operator.
    """

    query_object = mocker.Mock()
    query_object.filter = [
        {
            "op": None,  # Missing operator
            "col": "category",
            "val": "test",
        },
    ]

    with pytest.raises(ValueError, match="All filters must have an operator defined"):
        _validate_filters(query_object)


def test_validate_query_object_granularity_not_in_dimensions_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error when time column not in dimensions.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        granularity="unknown_time_col",  # Not in dimensions
    )

    with pytest.raises(
        ValueError, match="time column must be defined in the Semantic View"
    ):
        validate_query_object(query_object)


def test_validate_query_object_adhoc_series_column_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error for adhoc dimension in series columns.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        series_columns=[{"sqlExpression": "custom"}],  # Adhoc
        series_limit=10,
    )

    with pytest.raises(
        ValueError, match="Adhoc dimensions are not supported in series columns"
    ):
        validate_query_object(query_object)


def test_validate_query_object_series_limit_metric_not_string_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error when series_limit_metric is not a string.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        series_columns=["category"],
        series_limit=10,
        series_limit_metric={"sqlExpression": "SUM(x)"},  # Not a string
    )

    with pytest.raises(
        ValueError, match="series limit metric must be defined in the Semantic View"
    ):
        validate_query_object(query_object)


def test_validate_query_object_group_others_not_supported_error(
    mocker: MockerFixture,
) -> None:
    """
    Test validation error when group_others feature not supported.
    """
    mock_datasource = mocker.Mock()
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    sales_metric = Metric(
        "total_sales", "total_sales", pa.float64(), "SUM(amount)", "Sales"
    )

    mock_datasource.implementation.dimensions = {time_dim, category_dim}
    mock_datasource.implementation.metrics = {sales_metric}
    # Has GROUP_LIMIT but not GROUP_OTHERS
    mock_datasource.implementation.features = frozenset(
        {SemanticViewFeature.GROUP_LIMIT}
    )

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        series_columns=["category"],
        series_limit=10,
        group_others_when_limit_reached=True,  # Not supported
    )

    with pytest.raises(
        ValueError, match="Grouping others when limit is reached is not supported"
    ):
        validate_query_object(query_object)


def test_validate_query_object_adhoc_orderby_not_supported_error(
    mocker: MockerFixture,
) -> None:
    """
    Test validation error when adhoc expressions in orderby not supported.
    """
    mock_datasource = mocker.Mock()
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    sales_metric = Metric(
        "total_sales", "total_sales", pa.float64(), "SUM(amount)", "Sales"
    )

    mock_datasource.implementation.dimensions = {category_dim}
    mock_datasource.implementation.metrics = {sales_metric}
    mock_datasource.implementation.features = (
        frozenset()
    )  # No ADHOC_EXPRESSIONS_IN_ORDERBY

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        orderby=[
            ({"label": "custom", "sqlExpression": "RAND()"}, True),
        ],
    )

    with pytest.raises(
        ValueError, match="Adhoc expressions in order by are not supported"
    ):
        validate_query_object(query_object)


def test_validate_query_object_orderby_undefined_element_error(
    mock_datasource: MagicMock,
) -> None:
    """
    Test validation error when orderby element not defined.
    """
    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        metrics=["total_sales"],
        columns=["category"],
        orderby=[
            ("undefined_column", True),  # Not in dimensions or metrics
        ],
    )

    with pytest.raises(ValueError, match="All order by elements must be defined"):
        validate_query_object(query_object)


def test_get_results_with_is_rowcount(
    mock_datasource: MagicMock,
    mocker: MockerFixture,
) -> None:
    """
    Test get_results uses get_row_count when is_rowcount is True.
    """
    main_df = pd.DataFrame({"count": [100]})

    mock_result = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="SELECT COUNT(*)")],
        results=pa.Table.from_pandas(main_df),
    )

    mock_datasource.implementation.get_row_count = mocker.Mock(return_value=mock_result)
    mock_datasource.implementation.get_table = mocker.Mock()

    query_object = ValidatedQueryObject(
        datasource=mock_datasource,
        from_dttm=datetime(2025, 10, 15),
        to_dttm=datetime(2025, 10, 22),
        metrics=["total_sales"],
        columns=["category"],
        granularity="order_date",
        is_rowcount=True,
    )

    result = get_results(query_object)

    # Should have called get_row_count, not get_table
    mock_datasource.implementation.get_row_count.assert_called_once()
    mock_datasource.implementation.get_table.assert_not_called()
    pd.testing.assert_frame_equal(result.df, main_df)


def test_get_filters_from_query_object_with_filter_loop(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_filters_from_query_object processes filter array correctly.
    """
    # Create dimensions
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"order_date": time_dim, "category": category_dim}

    # Create mock query object with filters
    query_object = mocker.Mock()
    query_object.granularity = "order_date"
    query_object.from_dttm = datetime(2025, 10, 15)
    query_object.to_dttm = datetime(2025, 10, 22)
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = [
        # TEMPORAL_RANGE filter - should be skipped when granularity is set
        {
            "op": FilterOperator.TEMPORAL_RANGE.value,
            "col": "order_date",
            "val": "Last 7 days",
        },
        # EQUALS filter - should be converted
        {
            "op": FilterOperator.EQUALS.value,
            "col": "category",
            "val": "Electronics",
        },
    ]

    result = _get_filters_from_query_object(query_object, None, all_dimensions)

    # Should have filters: time range filters + category equals filter
    assert isinstance(result, set)
    # Check that we have a category filter
    category_filters = [
        f
        for f in result
        if isinstance(f, Filter)
        and f.column
        and f.column.name == "category"
        and f.operator == Operator.EQUALS
    ]
    assert len(category_filters) == 1


def test_convert_query_object_filter_temporal_range_non_string_value() -> None:
    """
    Test TEMPORAL_RANGE filter returns None when value is not a string.
    """
    all_dimensions = {
        "order_date": Dimension(
            "order_date", "order_date", pa.utf8(), "order_date", "Order date"
        )
    }
    filter_: ValidatedQueryObjectFilterClause = {
        "op": FilterOperator.TEMPORAL_RANGE.value,
        "col": "order_date",
        "val": ["2025-01-01", "2025-12-31"],  # List instead of string
    }

    result = _convert_query_object_filter(filter_, all_dimensions)

    # Should return None because value is not a string
    assert result is None


def test_get_group_limit_filters_with_filter_loop(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_group_limit_filters processes filter array correctly.
    """
    # Create dimensions
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"order_date": time_dim, "category": category_dim}

    # Create mock query object with filters
    query_object = mocker.Mock()
    query_object.granularity = "order_date"
    query_object.inner_from_dttm = datetime(2025, 9, 22)
    query_object.inner_to_dttm = datetime(2025, 10, 22)
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = [
        # TEMPORAL_RANGE filter - should be skipped when granularity is set
        {
            "op": FilterOperator.TEMPORAL_RANGE.value,
            "col": "order_date",
            "val": "Last 7 days",
        },
        # EQUALS filter - should be converted
        {
            "op": FilterOperator.EQUALS.value,
            "col": "category",
            "val": "Electronics",
        },
    ]

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should have filters
    assert result is not None
    assert isinstance(result, set)
    # Check that we have a category filter
    category_filters = [
        f
        for f in result
        if isinstance(f, Filter)
        and f.column
        and f.column.name == "category"
        and f.operator == Operator.EQUALS
    ]
    assert len(category_filters) == 1


def test_validate_filters_empty(mocker: MockerFixture) -> None:
    """
    Test _validate_filters with empty filter list (the loop doesn't run).
    """

    query_object = mocker.Mock()
    query_object.filter = []  # Empty filter list

    # Should not raise any error
    _validate_filters(query_object)


def test_validate_granularity_valid(mocker: MockerFixture) -> None:
    """
    Test _validate_granularity with valid granularity and time grain.
    """

    mock_datasource = mocker.Mock()
    time_dim = Dimension(
        "order_date", "order_date", pa.utf8(), "order_date", "Date", Grains.DAY
    )

    mock_datasource.implementation.dimensions = {time_dim}

    query_object = mocker.Mock()
    query_object.datasource = mock_datasource
    query_object.granularity = "order_date"
    query_object.extras = {"time_grain_sqla": "P1D"}

    # Should not raise any error - valid granularity with supported time grain
    _validate_granularity(query_object)


def test_validate_group_limit_valid(mocker: MockerFixture) -> None:
    """
    Test _validate_group_limit with valid group limit settings.
    """

    mock_datasource = mocker.Mock()
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    sales_metric = Metric(
        "total_sales", "total_sales", pa.float64(), "SUM(amount)", "Sales"
    )

    mock_datasource.implementation.dimensions = {category_dim}
    mock_datasource.implementation.metrics = {sales_metric}
    mock_datasource.implementation.features = frozenset(
        {SemanticViewFeature.GROUP_LIMIT, SemanticViewFeature.GROUP_OTHERS}
    )

    query_object = mocker.Mock()
    query_object.datasource = mock_datasource
    query_object.series_limit = 10
    query_object.series_columns = ["category"]
    query_object.series_limit_metric = "total_sales"
    query_object.group_others_when_limit_reached = True

    # Should not raise any error - all settings are valid
    _validate_group_limit(query_object)


def test_get_filters_from_query_object_filter_returns_none(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_filters_from_query_object when _convert_query_object_filter returns None.
    This covers the branch where the filter conversion fails and loop continues.
    """
    # Create dimensions
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"order_date": time_dim, "category": category_dim}

    # Create mock query object with a filter that will return None
    query_object = mocker.Mock()
    query_object.granularity = "order_date"
    query_object.from_dttm = datetime(2025, 10, 15)
    query_object.to_dttm = datetime(2025, 10, 22)
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = [
        # Filter with unknown column - returns None from _convert_query_object_filter
        {
            "op": FilterOperator.EQUALS.value,
            "col": "unknown_column",
            "val": "test",
        },
        # Valid filter - will be converted
        {
            "op": FilterOperator.EQUALS.value,
            "col": "category",
            "val": "Electronics",
        },
    ]

    result = _get_filters_from_query_object(query_object, None, all_dimensions)

    # Should have filters (time filters + category, but not unknown_column)
    assert isinstance(result, set)
    # Check that we have a category filter
    category_filters = [
        f
        for f in result
        if isinstance(f, Filter)
        and f.column
        and f.column.name == "category"
        and f.operator == Operator.EQUALS
    ]
    assert len(category_filters) == 1


def test_get_group_limit_filters_filter_returns_none(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_group_limit_filters when _convert_query_object_filter returns None.
    This covers the branch where the filter conversion fails and loop continues.
    """
    # Create dimensions
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"order_date": time_dim, "category": category_dim}

    # Create mock query object with filters
    query_object = mocker.Mock()
    query_object.granularity = "order_date"
    query_object.inner_from_dttm = datetime(2025, 9, 22)
    query_object.inner_to_dttm = datetime(2025, 10, 22)
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = [
        # Filter with unknown column - returns None from _convert_query_object_filter
        {
            "op": FilterOperator.EQUALS.value,
            "col": "unknown_column",
            "val": "test",
        },
        # Valid filter - will be converted
        {
            "op": FilterOperator.EQUALS.value,
            "col": "category",
            "val": "Electronics",
        },
    ]

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should have filters
    assert result is not None
    assert isinstance(result, set)
    # Check that we have a category filter
    category_filters = [
        f
        for f in result
        if isinstance(f, Filter)
        and f.column
        and f.column.name == "category"
        and f.operator == Operator.EQUALS
    ]
    assert len(category_filters) == 1


def test_validate_filters_with_valid_filters(mocker: MockerFixture) -> None:
    """
    Test _validate_filters with valid filters that pass validation.
    This covers the branch where the loop completes without raising.
    """

    query_object = mocker.Mock()
    query_object.filter = [
        {
            "op": FilterOperator.EQUALS.value,
            "col": "category",  # String column, not dict
            "val": "test",
        },
        {
            "op": FilterOperator.IN.value,  # Has operator
            "col": "region",
            "val": ["US", "UK"],
        },
    ]

    # Should not raise any error - filters are valid
    _validate_filters(query_object)


def test_get_group_limit_filters_granularity_missing_inner_from(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_group_limit_filters with granularity but missing inner_from_dttm.
    Covers branch 704->729 where time_dimension exists but inner_from_dttm is None.
    """
    # Create dimensions
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"order_date": time_dim, "category": category_dim}

    # Create mock query object with granularity but missing inner_from_dttm
    query_object = mocker.Mock()
    query_object.granularity = "order_date"  # Granularity is set
    query_object.inner_from_dttm = None  # Missing inner_from
    query_object.inner_to_dttm = datetime(2025, 10, 22)  # But inner_to exists
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = []

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should return None since no filters were added (time filters require both bounds)
    assert result is None


def test_get_group_limit_filters_granularity_missing_inner_to(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_group_limit_filters with granularity but missing inner_to_dttm.
    Covers branch 704->729 where time_dimension exists but inner_to_dttm is None.
    """
    # Create dimensions
    time_dim = Dimension("order_date", "order_date", pa.utf8(), "order_date", "Date")
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"order_date": time_dim, "category": category_dim}

    # Create mock query object with granularity but missing inner_to_dttm
    query_object = mocker.Mock()
    query_object.granularity = "order_date"  # Granularity is set
    query_object.inner_from_dttm = datetime(2025, 9, 22)  # inner_from exists
    query_object.inner_to_dttm = None  # But missing inner_to
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = []

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should return None since no filters were added (time filters require both bounds)
    assert result is None


def test_get_group_limit_filters_no_granularity(
    mocker: MockerFixture,
) -> None:
    """
    Test _get_group_limit_filters when granularity is None/empty.
    This explicitly covers the branch 704->729 where granularity is Falsy.
    """
    # Create dimensions
    category_dim = Dimension("category", "category", pa.utf8(), "category", "Category")
    all_dimensions = {"category": category_dim}

    # Create mock query object with no granularity
    query_object = mocker.Mock()
    query_object.granularity = None  # No granularity
    query_object.inner_from_dttm = datetime(2025, 9, 22)
    query_object.inner_to_dttm = datetime(2025, 10, 22)
    query_object.extras = {}
    query_object.apply_fetch_values_predicate = False
    query_object.datasource = mocker.Mock()
    query_object.datasource.fetch_values_predicate = None
    query_object.filter = []

    result = _get_group_limit_filters(query_object, all_dimensions)

    # Should return None - no granularity means no time filters added
    assert result is None


# ---------------------------------------------------------------------------
# _coerce_scalar_filter_value: per-dtype branches
# ---------------------------------------------------------------------------


def _dim(dtype: pa.DataType, name: str = "d") -> Dimension:
    return Dimension(name, name, dtype, name, name.capitalize())


def test_coerce_none_returns_none() -> None:
    assert _coerce_scalar_filter_value(None, _dim(pa.int64())) is None


def test_coerce_unsupported_dtype_passes_through() -> None:
    # utf8 (and any dtype not branched in the function) returns the value as-is.
    assert _coerce_scalar_filter_value("abc", _dim(pa.utf8())) == "abc"


@pytest.mark.parametrize(
    "raw,expected",
    [
        (True, True),
        (False, False),
        (1, True),
        (0, False),
        (1.0, True),
        (0.0, False),
        ("true", True),
        ("T", True),
        (" 1 ", True),
        ("yes", True),
        ("Y", True),
        ("on", True),
        ("false", False),
        ("F", False),
        ("0", False),
        ("no", False),
        ("N", False),
        ("off", False),
    ],
)
def test_coerce_boolean(raw: Any, expected: bool) -> None:
    assert _coerce_scalar_filter_value(raw, _dim(pa.bool_())) is expected


@pytest.mark.parametrize("raw", ["maybe", 2, 0.5, -1])
def test_coerce_boolean_invalid_raises(raw: Any) -> None:
    with pytest.raises(ValueError, match="Invalid boolean value"):
        _coerce_scalar_filter_value(raw, _dim(pa.bool_()))


def test_coerce_integer_passthrough() -> None:
    assert _coerce_scalar_filter_value(42, _dim(pa.int64())) == 42


def test_coerce_integer_accepts_integer_valued_float() -> None:
    # JSON round-trips can turn an int into ``42.0``; accept losslessly.
    assert _coerce_scalar_filter_value(42.0, _dim(pa.int64())) == 42


def test_coerce_integer_rejects_bool() -> None:
    # bool is a subclass of int; we explicitly reject it.
    with pytest.raises(ValueError, match="Invalid integer value"):
        _coerce_scalar_filter_value(True, _dim(pa.int64()))


def test_coerce_integer_rejects_non_integer_float() -> None:
    with pytest.raises(ValueError, match="Invalid integer value"):
        _coerce_scalar_filter_value(1.5, _dim(pa.int64()))


def test_coerce_integer_rejects_other_types() -> None:
    with pytest.raises(ValueError, match="Invalid integer value"):
        _coerce_scalar_filter_value([1], _dim(pa.int64()))


@pytest.mark.parametrize(
    "dtype",
    [pa.float64(), pa.decimal128(10, 2)],
)
def test_coerce_floating_or_decimal(dtype: pa.DataType) -> None:
    assert _coerce_scalar_filter_value(1, _dim(dtype)) == 1.0
    assert _coerce_scalar_filter_value(1.5, _dim(dtype)) == 1.5
    assert _coerce_scalar_filter_value(" 2.5 ", _dim(dtype)) == 2.5


def test_coerce_floating_rejects_bool() -> None:
    with pytest.raises(ValueError, match="Invalid numeric value"):
        _coerce_scalar_filter_value(True, _dim(pa.float64()))


def test_coerce_floating_invalid_string_raises() -> None:
    with pytest.raises(ValueError, match="Invalid numeric value"):
        _coerce_scalar_filter_value("not-a-number", _dim(pa.float64()))


def test_coerce_floating_rejects_other_types() -> None:
    with pytest.raises(ValueError, match="Invalid numeric value"):
        _coerce_scalar_filter_value([1.0], _dim(pa.float64()))


def test_coerce_date_from_datetime() -> None:
    out = _coerce_scalar_filter_value(datetime(2025, 1, 2, 12, 0), _dim(pa.date32()))
    assert out == date(2025, 1, 2)


def test_coerce_date_passthrough() -> None:
    out = _coerce_scalar_filter_value(date(2025, 1, 2), _dim(pa.date32()))
    assert out == date(2025, 1, 2)


def test_coerce_date_from_iso_string() -> None:
    out = _coerce_scalar_filter_value(" 2025-01-02 ", _dim(pa.date32()))
    assert out == date(2025, 1, 2)


def test_coerce_date_invalid_string_raises() -> None:
    with pytest.raises(ValueError, match="Invalid date value"):
        _coerce_scalar_filter_value("not-a-date", _dim(pa.date32()))


def test_coerce_date_rejects_other_types() -> None:
    with pytest.raises(ValueError, match="Invalid date value"):
        _coerce_scalar_filter_value(20250102, _dim(pa.date32()))


def test_coerce_timestamp_from_datetime_passthrough() -> None:
    dt = datetime(2025, 1, 2, 3, 4, 5)
    # Naive dtype: returned as-is, still naive.
    assert _coerce_scalar_filter_value(dt, _dim(pa.timestamp("us"))) == dt


def test_coerce_timestamp_from_date() -> None:
    out = _coerce_scalar_filter_value(date(2025, 1, 2), _dim(pa.timestamp("us")))
    assert out == datetime(2025, 1, 2, 0, 0)


def test_coerce_timestamp_from_iso_string_with_z() -> None:
    out = _coerce_scalar_filter_value("2025-01-02T03:04:05Z", _dim(pa.timestamp("us")))
    assert out == datetime.fromisoformat("2025-01-02T03:04:05+00:00")


def test_coerce_timestamp_invalid_string_raises() -> None:
    with pytest.raises(ValueError, match="Invalid timestamp value"):
        _coerce_scalar_filter_value("not-a-ts", _dim(pa.timestamp("us")))


def test_coerce_timestamp_rejects_other_types() -> None:
    with pytest.raises(ValueError, match="Invalid timestamp value"):
        _coerce_scalar_filter_value(1234567890, _dim(pa.timestamp("us")))


def test_coerce_timestamp_tz_aware_dtype_attaches_tz_to_naive_datetime() -> None:
    dt = datetime(2025, 1, 2, 3, 4, 5)
    out = _coerce_scalar_filter_value(dt, _dim(pa.timestamp("us", tz="UTC")))
    assert out == datetime(2025, 1, 2, 3, 4, 5, tzinfo=ZoneInfo("UTC"))


def test_coerce_timestamp_tz_aware_dtype_converts_aware_datetime() -> None:
    dt = datetime(2025, 1, 2, 12, 0, tzinfo=timezone.utc)
    out = _coerce_scalar_filter_value(
        dt, _dim(pa.timestamp("us", tz="America/New_York"))
    )
    # 12:00 UTC == 07:00 in New York
    assert out == datetime(2025, 1, 2, 7, 0, tzinfo=ZoneInfo("America/New_York"))


def test_coerce_timestamp_tz_aware_dtype_attaches_tz_to_date() -> None:
    out = _coerce_scalar_filter_value(
        date(2025, 1, 2), _dim(pa.timestamp("us", tz="UTC"))
    )
    assert out == datetime(2025, 1, 2, 0, 0, tzinfo=ZoneInfo("UTC"))


def test_coerce_timestamp_tz_aware_dtype_parses_string_with_tz() -> None:
    out = _coerce_scalar_filter_value(
        "2025-01-02T03:04:05", _dim(pa.timestamp("us", tz="UTC"))
    )
    # Naive string gets UTC attached.
    assert out == datetime(2025, 1, 2, 3, 4, 5, tzinfo=ZoneInfo("UTC"))


def test_coerce_time_passthrough() -> None:
    out = _coerce_scalar_filter_value(time(3, 4, 5), _dim(pa.time64("us")))
    assert out == time(3, 4, 5)


def test_coerce_time_from_iso_string() -> None:
    out = _coerce_scalar_filter_value(" 03:04:05 ", _dim(pa.time64("us")))
    assert out == time(3, 4, 5)


def test_coerce_time_invalid_string_raises() -> None:
    with pytest.raises(ValueError, match="Invalid time value"):
        _coerce_scalar_filter_value("not-a-time", _dim(pa.time64("us")))


def test_coerce_time_rejects_other_types() -> None:
    with pytest.raises(ValueError, match="Invalid time value"):
        _coerce_scalar_filter_value(123, _dim(pa.time64("us")))
