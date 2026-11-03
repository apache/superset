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

"""Grouped predicates remain distinct, exact-match-only cache constraints."""

from dataclasses import replace
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Filter,
    FilterExpression,
    FilterValues,
    GroupLimit,
    Operator,
    OrFilter,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers.cache import (
    SemanticCacheOutcome,
    SemanticCacheService,
    SemanticCacheState,
)
from superset.semantic_layers.cache_identity import SemanticCacheIdentityFactory
from superset.semantic_layers.cache_policy import ContainmentCapabilities
from superset.semantic_layers.cache_repository import SemanticCacheRepository
from tests.unit_tests.semantic_layers.cache_repository_test import (
    _Backend,
    _Coordinator,
)
from tests.unit_tests.semantic_layers.conftest import (
    build_semantic_query,
    build_view_meta,
)


def _group(query: SemanticQuery, value: FilterValues = "GB") -> OrFilter:
    """Build the mapper's mixed positive NULL selection using real SDK types."""
    return OrFilter(
        frozenset(
            {
                Filter(
                    PredicateType.WHERE,
                    query.dimensions[0],
                    Operator.IN,
                    frozenset({value}),
                ),
                Filter(
                    PredicateType.WHERE, query.dimensions[0], Operator.IS_NULL, None
                ),
            }
        )
    )


def test_group_identity_is_order_independent_and_not_flattened() -> None:
    query: SemanticQuery = build_semantic_query()
    group: OrFilter = _group(query)
    reverse: OrFilter = OrFilter(frozenset(reversed(tuple(group.filters))))
    flattened: Filter = Filter(
        PredicateType.WHERE, query.dimensions[0], Operator.IN, frozenset({"GB", None})
    )
    identity: str = SemanticCacheIdentityFactory.query(replace(query, filters={group}))
    assert identity == SemanticCacheIdentityFactory.query(
        replace(query, filters={reverse})
    )
    assert identity != SemanticCacheIdentityFactory.query(
        replace(query, filters={flattened})
    )
    assert ":v5:" in identity


@pytest.mark.parametrize("location", ["query", "group_limit", "both"])
def test_grouped_query_is_stored_and_served_without_cache_failures(
    location: str,
) -> None:
    query: SemanticQuery = build_semantic_query()
    group: OrFilter = _group(query)
    query = replace(
        query,
        filters={group} if location != "group_limit" else None,
        group_limit=GroupLimit(query.dimensions, 2, query.metrics[0], filters={group})
        if location != "query"
        else None,
    )
    backend: _Backend = _Backend()
    repository: SemanticCacheRepository = SemanticCacheRepository(
        backend, _Coordinator()
    )
    metrics: MagicMock = MagicMock()
    service: SemanticCacheService = SemanticCacheService(
        SemanticCacheState.enabled(), repository, metrics
    )
    result: SemanticResult = SemanticResult(
        requests=[], results=pa.table({"Country": ["GB", None], "Revenue": [42.0, 7.0]})
    )
    provider: MagicMock = MagicMock(return_value=result)
    assert not service.execute(
        build_view_meta(), query, provider, capabilities=ContainmentCapabilities()
    ).cache_hit
    cached: SemanticCacheOutcome = service.execute(
        build_view_meta(), query, provider, capabilities=ContainmentCapabilities()
    )
    assert cached.cache_hit
    assert repository.lookup(
        build_view_meta(), query, ContainmentCapabilities()
    ).candidates
    assert cached.result.results is not None
    assert cached.result.results.to_pylist() == [
        {"Country": "GB", "Revenue": 42.0},
        {"Country": None, "Revenue": 7.0},
    ]
    provider.assert_called_once_with(query)
    assert all("failure" not in call.args[0] for call in metrics.incr.call_args_list)


def test_changed_group_limit_group_is_not_reused() -> None:
    query: SemanticQuery = build_semantic_query()
    query = replace(
        query,
        group_limit=GroupLimit(
            query.dimensions, 2, query.metrics[0], filters={_group(query)}
        ),
    )
    repository: SemanticCacheRepository = SemanticCacheRepository(
        _Backend(), _Coordinator()
    )
    result: SemanticResult = SemanticResult(
        requests=[], results=pa.table({"Country": ["GB"], "Revenue": [42.0]})
    )
    assert repository.store(build_view_meta(), query, result)
    assert query.group_limit is not None
    other: SemanticQuery = replace(
        query, group_limit=replace(query.group_limit, filters={_group(query, "US")})
    )
    assert not repository.lookup(
        build_view_meta(), other, ContainmentCapabilities()
    ).candidates


@pytest.mark.parametrize(
    "variant", ["narrower", "broader", "absent", "flattened", "typed", "column"]
)
def test_reuse_requires_identical_canonical_group_set(variant: str) -> None:
    query: SemanticQuery = build_semantic_query()
    value: FilterValues = True if variant == "typed" else "GB"
    group: OrFilter = _group(query, value)
    cached_query: SemanticQuery = replace(query, filters={group})
    filters: set[FilterExpression]
    if variant == "narrower":
        filters = {next(leaf for leaf in group.filters if leaf.operator is Operator.IN)}
    elif variant == "broader":
        filters = {
            OrFilter(
                group.filters
                | {
                    Filter(
                        PredicateType.WHERE, query.dimensions[0], Operator.EQUALS, "US"
                    )
                }
            )
        }
    elif variant == "absent":
        filters = set()
    elif variant == "typed":
        # Python equality conflates True and 1, but canonical SQL operands must not.
        filters = {_group(query, 1)}
        assert filters == cached_query.filters
    elif variant == "column":
        # Filter identity encodes the column ID, not its complete definition.
        filters = {
            _group(
                replace(
                    query, dimensions=[replace(query.dimensions[0], definition="other")]
                )
            )
        }
    else:
        filters = {
            Filter(
                PredicateType.WHERE,
                query.dimensions[0],
                Operator.IN,
                frozenset({"GB", None}),
            )
        }
    requested: SemanticQuery = replace(query, filters=filters)
    result: SemanticResult = SemanticResult(
        requests=[], results=pa.table({"Country": ["GB"], "Revenue": [42.0]})
    )
    stored: SemanticQuery
    lookup: SemanticQuery
    for stored, lookup in ((cached_query, requested), (requested, cached_query)):
        repository: SemanticCacheRepository = SemanticCacheRepository(
            _Backend(), _Coordinator()
        )
        assert repository.store(build_view_meta(), stored, result)
        assert not repository.lookup(
            build_view_meta(),
            lookup,
            ContainmentCapabilities(comparisons=True, membership=True, nulls=True),
        ).candidates
