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

from datetime import datetime, timezone
from decimal import Decimal

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Filter,
    Metric,
    Operator,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers.cache_identity import SemanticCacheIdentityFactory
from superset.semantic_layers.cache_policy import select_reuse
from superset.semantic_layers.cache_transform import (
    SemanticCacheTransformationError,
    transform_result,
)
from superset.semantic_layers.cache_types import (
    CachedEntry,
    ContainmentCapabilities,
    ReuseDecision,
)

COUNTRY: Dimension = Dimension("country", "Country", pa.string())
CITY: Dimension = Dimension("city", "City", pa.string())


def _reuse(
    query: SemanticQuery, source: pa.Table, dimensions: list[Dimension]
) -> pa.Table:
    """Transform only after the real policy proves the cached shape eligible."""
    capabilities: ContainmentCapabilities = ContainmentCapabilities(comparisons=True)
    entry: CachedEntry = CachedEntry(
        filters=frozenset(),
        dimensions=frozenset(dimensions),
        metrics=frozenset(query.metrics),
        limit=None,
        offset=0,
        order_key=SemanticCacheIdentityFactory.order(query.order),
        group_limit_key=SemanticCacheIdentityFactory.group_limit(query.group_limit),
        value_key="precision-regression",
    )
    decision: ReuseDecision | None = select_reuse(query, entry, capabilities)
    assert decision is not None
    result: SemanticResult = transform_result(
        SemanticResult(requests=[], results=source), query, decision, capabilities
    )
    return result.results


@pytest.mark.parametrize(
    "arrow_type,value",
    [
        (pa.int64(), 2**53 + 1),
        (pa.uint64(), 2**63 + 1),
        (pa.decimal128(30, 4), Decimal("9007199254740993.0001")),
        (
            pa.timestamp("us", tz="UTC"),
            datetime(2026, 1, 1, 1, 2, 3, 456789, tzinfo=timezone.utc),
        ),
    ],
)
def test_filtered_containment_matches_provider_types_and_values(
    arrow_type: pa.DataType, value: object
) -> None:
    """Filtering another dimension cannot coerce a nullable provider value."""
    identifier: Dimension = Dimension("identifier", "Identifier", arrow_type)
    metric: Metric = Metric(
        "count", "Count", pa.int64(), "SUM(count)", aggregation=AggregationType.SUM
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[metric],
        dimensions=[COUNTRY, identifier],
        filters={Filter(PredicateType.WHERE, COUNTRY, Operator.EQUALS, "US")},
    )
    source: pa.Table = pa.table(
        {
            "Country": ["US", "CA"],
            "Identifier": pa.array([value, None], type=arrow_type),
            "Count": pa.array([1, 2], type=pa.int64()),
        }
    )
    expected: pa.Table = source.filter(pa.array([True, False]))
    actual: pa.Table = _reuse(query, source, [COUNTRY, identifier])
    assert actual.equals(expected)


@pytest.mark.parametrize("grouped", [False, True])
@pytest.mark.parametrize(
    "aggregation",
    [
        AggregationType.SUM,
        AggregationType.COUNT,
        AggregationType.MIN,
        AggregationType.MAX,
    ],
)
@pytest.mark.parametrize(
    "arrow_type,value",
    [
        (pa.int64(), 2**53 + 1),
        (pa.decimal128(30, 4), Decimal("9007199254740993.0001")),
    ],
)
def test_rollup_keeps_nullable_metric_precision(
    grouped: bool, aggregation: AggregationType, arrow_type: pa.DataType, value: object
) -> None:
    """Grouped and scalar rollups do not mix integer/decimal and float dtypes."""
    metric: Metric = Metric(
        "value", "Value", arrow_type, "value", aggregation=aggregation
    )
    other: Metric = Metric(
        "other", "Other", pa.float64(), "other", aggregation=AggregationType.SUM
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[metric, other], dimensions=[COUNTRY] if grouped else []
    )
    source: pa.Table = pa.table(
        {
            "Country": ["US", "US"],
            "City": ["A", "B"],
            "Value": pa.array([value, None], type=arrow_type),
            "Other": pa.array([0.25, 0.5], type=pa.float64()),
        }
    )
    expected: pa.Table = pa.table(
        {
            **({"Country": ["US"]} if grouped else {}),
            "Value": pa.array([value], type=arrow_type),
            "Other": [0.75],
        }
    )
    assert _reuse(query, source, [COUNTRY, CITY]).equals(expected)


@pytest.mark.parametrize("grouped", [False, True])
def test_overflowing_integer_rollup_is_refused(grouped: bool) -> None:
    """Overflow must cause a provider fallback, never an integer wraparound."""
    metric: Metric = Metric(
        "value", "Value", pa.int64(), "value", aggregation=AggregationType.SUM
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[metric], dimensions=[COUNTRY] if grouped else []
    )
    source: pa.Table = pa.table(
        {
            "Country": ["US", "US"],
            "City": ["A", "B"],
            "Value": pa.array([2**63 - 1, 1], type=pa.int64()),
        }
    )
    with pytest.raises(SemanticCacheTransformationError):
        _reuse(query, source, [COUNTRY, CITY])


@pytest.mark.parametrize("grouped", [False, True])
@pytest.mark.parametrize("aggregation", [AggregationType.MIN, AggregationType.MAX])
def test_timestamp_rollup_keeps_timezone_and_resolution(
    grouped: bool,
    aggregation: AggregationType,
) -> None:
    """Temporal extrema retain the provider's timestamp schema."""
    arrow_type: pa.DataType = pa.timestamp("us", tz="UTC")
    value: datetime = datetime(2026, 1, 1, 1, 2, 3, 456789, tzinfo=timezone.utc)
    metric: Metric = Metric("time", "Time", arrow_type, "time", aggregation=aggregation)
    query: SemanticQuery = SemanticQuery(
        metrics=[metric], dimensions=[COUNTRY] if grouped else []
    )
    source: pa.Table = pa.table(
        {
            "Country": ["US", "US"],
            "City": ["A", "B"],
            "Time": pa.array([value, None], type=arrow_type),
        }
    )
    expected: pa.Table = pa.table(
        {
            **({"Country": ["US"]} if grouped else {}),
            "Time": pa.array([value], type=arrow_type),
        }
    )
    assert _reuse(query, source, [COUNTRY, CITY]).equals(expected)


@pytest.mark.parametrize("grouped", [False, True])
def test_empty_count_rollup_stays_zero(grouped: bool) -> None:
    """Combining only null counts retains the existing zero-count behavior."""
    metric: Metric = Metric(
        "value", "Value", pa.int64(), "value", aggregation=AggregationType.COUNT
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[metric], dimensions=[COUNTRY] if grouped else []
    )
    source: pa.Table = pa.table(
        {
            "Country": ["US", "US"],
            "City": ["A", "B"],
            "Value": pa.array([None, None], type=pa.int64()),
        }
    )
    assert _reuse(query, source, [COUNTRY, CITY]).column("Value").to_pylist() == [0]
