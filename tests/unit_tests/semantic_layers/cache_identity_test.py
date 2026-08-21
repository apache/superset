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

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, time, timedelta

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    AdhocExpression,
    AggregationType,
    Dimension,
    Filter,
    FilterValues,
    Grain,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
)

from superset.semantic_layers.cache_identity import (
    semantic_dimension_key,
    SemanticCacheIdentityFactory,
    SemanticCacheProviderIdentity,
    SemanticCacheScopeIdentity,
    SemanticDefinitionIdentity,
    SemanticViewIdentity,
    SensitiveIdentityMaterialError,
)


def test_identity_is_stable_across_mapping_order() -> None:
    first: str = SemanticCacheIdentityFactory.definition(
        {"name": "orders", "version": 2}
    ).digest
    second: str = SemanticCacheIdentityFactory.definition(
        {"version": 2, "name": "orders"}
    ).digest

    assert first == second
    assert first.startswith("v2:")


def test_identity_changes_with_result_affecting_material() -> None:
    first: str = SemanticCacheIdentityFactory.provider(
        {"provider": "dbt", "version": 1}
    ).digest
    second: str = SemanticCacheIdentityFactory.provider(
        {"provider": "dbt", "version": 2}
    ).digest

    assert first != second


def test_identity_rejects_secret_material() -> None:
    with pytest.raises(SensitiveIdentityMaterialError):
        SemanticCacheIdentityFactory.provider(
            {"provider": "dbt", "api_token": "do-not-hash-raw-secrets"}
        )


def test_identity_rejects_nested_secret_material() -> None:
    with pytest.raises(SensitiveIdentityMaterialError):
        SemanticCacheIdentityFactory.provider(
            {
                "provider": "dbt",
                "authentication": {"api_token": "do-not-hash-nested-raw-secrets"},
            }
        )


def _query() -> SemanticQuery:
    country: Dimension = Dimension(
        id="orders.country",
        name="Country",
        type=pa.string(),
        grain=Grain(name="day", representation="P1D"),
    )
    revenue: Metric = Metric(
        id="orders.revenue",
        name="Revenue",
        type=pa.float64(),
        definition="SUM(revenue)",
        aggregation=AggregationType.SUM,
    )
    predicate: Filter = Filter(
        type=PredicateType.WHERE,
        column=country,
        operator=Operator.IN,
        value=frozenset({"US", "GB"}),
    )
    return SemanticQuery(
        metrics=[revenue],
        dimensions=[country],
        filters={predicate},
        order=[(revenue, OrderDirection.DESC)],
        limit=10,
        offset=2,
        group_limit=GroupLimit(
            dimensions=[country],
            top=3,
            metric=revenue,
        ),
    )


def test_query_identity_is_deterministic_for_unordered_values() -> None:
    query: SemanticQuery = _query()
    equivalent_filter: Filter = replace(
        next(iter(query.filters or set())),
        value=frozenset({"GB", "US"}),
    )
    equivalent: SemanticQuery = replace(query, filters={equivalent_filter})

    assert SemanticCacheIdentityFactory.query(query) == (
        SemanticCacheIdentityFactory.query(equivalent)
    )


@pytest.mark.parametrize(
    "changed_query",
    [
        replace(_query(), limit=11),
        replace(_query(), offset=3),
        replace(
            _query(),
            metrics=[replace(_query().metrics[0], aggregation=AggregationType.MAX)],
        ),
        replace(
            _query(),
            dimensions=[
                replace(
                    _query().dimensions[0],
                    grain=Grain(name="month", representation="P1M"),
                )
            ],
        ),
        replace(_query(), order=None),
        replace(_query(), group_limit=None),
    ],
)
def test_query_identity_changes_with_result_affecting_fields(
    changed_query: SemanticQuery,
) -> None:
    assert SemanticCacheIdentityFactory.query(_query()) != (
        SemanticCacheIdentityFactory.query(changed_query)
    )


def test_typed_filter_values_do_not_collide() -> None:
    query: SemanticQuery = _query()
    predicate: Filter = next(iter(query.filters or set()))
    numeric: SemanticQuery = replace(
        query,
        filters={replace(predicate, operator=Operator.EQUALS, value=1)},
    )
    boolean: SemanticQuery = replace(
        query,
        filters={replace(predicate, operator=Operator.EQUALS, value=True)},
    )

    assert SemanticCacheIdentityFactory.query(numeric) != (
        SemanticCacheIdentityFactory.query(boolean)
    )


@pytest.mark.parametrize(
    "value",
    [
        ("GB", "US"),
        datetime(2026, 1, 2, 3, 4, 5),
        date(2026, 1, 2),
        time(3, 4, 5),
        timedelta(days=2),
    ],
)
def test_query_identity_supports_typed_scalar_values(
    value: FilterValues | tuple[FilterValues, ...] | frozenset[FilterValues],
) -> None:
    query: SemanticQuery = _query()
    predicate: Filter = next(iter(query.filters or set()))
    changed: SemanticQuery = replace(
        query,
        filters={replace(predicate, operator=Operator.EQUALS, value=value)},
    )

    assert SemanticCacheIdentityFactory.query(changed)


def test_dimension_and_order_identity_cover_all_variants() -> None:
    raw_dimension: Dimension = replace(_query().dimensions[0], grain=None)
    grain_dimension: Dimension = _query().dimensions[0]
    adhoc: AdhocExpression = AdhocExpression("rank", "SUM(revenue)")

    assert semantic_dimension_key(raw_dimension) == raw_dimension.id
    assert semantic_dimension_key(grain_dimension).endswith("@P1D")
    assert SemanticCacheIdentityFactory.order(
        [
            (grain_dimension, OrderDirection.ASC),
            (adhoc, OrderDirection.DESC),
        ]
    )
    assert SemanticCacheIdentityFactory.group_limit(None) == ""
    assert SemanticCacheIdentityFactory.group_limit(_query().group_limit)


def test_bucket_identity_includes_all_host_boundaries() -> None:
    view: SemanticViewIdentity = SemanticViewIdentity("orders")
    definition: SemanticDefinitionIdentity = SemanticCacheIdentityFactory.definition(
        {"revision": 1}
    )
    provider: SemanticCacheProviderIdentity = SemanticCacheIdentityFactory.provider(
        {"type": "fixture", "catalog": "one"}
    )
    scope: SemanticCacheScopeIdentity = SemanticCacheIdentityFactory.scope(
        {"tenant": "one"}
    )
    baseline: str = SemanticCacheIdentityFactory.bucket(
        view,
        definition,
        provider,
        scope,
    )

    alternatives: list[str] = [
        SemanticCacheIdentityFactory.bucket(
            SemanticViewIdentity("other"), definition, provider, scope
        ),
        SemanticCacheIdentityFactory.bucket(
            view,
            SemanticCacheIdentityFactory.definition({"revision": 2}),
            provider,
            scope,
        ),
        SemanticCacheIdentityFactory.bucket(
            view,
            definition,
            SemanticCacheIdentityFactory.provider(
                {"type": "fixture", "catalog": "two"}
            ),
            scope,
        ),
        SemanticCacheIdentityFactory.bucket(
            view,
            definition,
            provider,
            SemanticCacheIdentityFactory.scope({"tenant": "two"}),
        ),
    ]

    assert all(alternative != baseline for alternative in alternatives)


def test_value_identity_combines_bucket_and_query() -> None:
    bucket: str = "semantic-cache:bucket:v2:fixture"

    first: str = SemanticCacheIdentityFactory.value(bucket, _query())
    second: str = SemanticCacheIdentityFactory.value(bucket, _query())

    assert first == second
    assert first.startswith("semantic-cache:value:v2:")
