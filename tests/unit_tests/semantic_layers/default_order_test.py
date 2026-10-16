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

"""The host's default chronological order for unordered semantic queries."""

from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    Metric,
    OrderDirection,
    OrderTuple,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers import mapper
from superset.semantic_layers.cache import SemanticCacheOutcome

SALES: Metric = Metric(
    id="orders.total_sales",
    name="total_sales",
    type=pa.float64(),
    definition="SUM(amount)",
)
REGION: Dimension = Dimension(
    id="customers.region", name="region", type=pa.utf8(), definition="region"
)
ORDER_DATE: Dimension = Dimension(
    id="orders.order_date", name="order_date", type=pa.date32(), definition="d"
)
SHIPPED_AT: Dimension = Dimension(
    id="orders.shipped_at",
    name="shipped_at",
    type=pa.timestamp("us"),
    definition="s",
)
EMPTY_RESULT: SemanticResult = SemanticResult(
    requests=[], results=pa.table({"total_sales": pa.array([], pa.float64())})
)


def _dispatch(mocker: MockerFixture, query: SemanticQuery) -> SemanticQuery:
    """Dispatch *query* and return the query the provider received."""
    provider: MagicMock = mocker.Mock(return_value=EMPTY_RESULT)
    mapper._dispatch_semantic_query(mocker.Mock(), provider, query, cacheable=False)
    provider.assert_called_once()
    received: SemanticQuery = provider.call_args.args[0]
    return received


@pytest.mark.parametrize(
    "dimensions, expected",
    [
        # The first selected temporal dimension, ascending.
        ([REGION, SHIPPED_AT, ORDER_DATE], [(SHIPPED_AT, OrderDirection.ASC)]),
        ([ORDER_DATE, SHIPPED_AT], [(ORDER_DATE, OrderDirection.ASC)]),
        # No temporal dimension: the query stays unordered.
        ([REGION], None),
        ([], None),
    ],
)
def test_unordered_query_gets_default_chronological_order(
    mocker: MockerFixture,
    dimensions: list[Dimension],
    expected: list[OrderTuple] | None,
) -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[SALES], dimensions=dimensions, limit=10
    )

    received: SemanticQuery = _dispatch(mocker, query)

    assert received.order == expected
    assert received.limit == 10
    assert received.dimensions == dimensions


@pytest.mark.parametrize(
    "order",
    [
        [(SALES, OrderDirection.DESC)],
        [(REGION, OrderDirection.ASC), (ORDER_DATE, OrderDirection.DESC)],
    ],
)
def test_explicit_order_reaches_the_provider_unchanged(
    mocker: MockerFixture, order: list[OrderTuple]
) -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[SALES], dimensions=[ORDER_DATE, REGION], order=order, limit=5
    )

    assert _dispatch(mocker, query) is query


def test_default_order_leaves_the_cache_identity_unchanged(
    mocker: MockerFixture,
) -> None:
    """The cache keys and reuses on the query as mapped, not the provider's copy."""
    service: MagicMock = mocker.patch.object(
        mapper.semantic_cache, "semantic_cache_service"
    )
    service.state.effective = True
    mocker.patch.object(
        mapper,
        "build_cache_configuration",
        return_value=(mocker.Mock(), mocker.Mock()),
    )
    service.execute.side_effect = lambda meta, query, dispatch, **kwargs: (
        SemanticCacheOutcome(dispatch(query), cache_hit=False)
    )
    provider: MagicMock = mocker.Mock(return_value=EMPTY_RESULT)
    query: SemanticQuery = SemanticQuery(metrics=[SALES], dimensions=[ORDER_DATE])

    mapper._dispatch_semantic_query(mocker.Mock(), provider, query)

    assert service.execute.call_args.args[1] is query
    assert provider.call_args.args[0].order == [(ORDER_DATE, OrderDirection.ASC)]
