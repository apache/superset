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

import pandas as pd
import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Filter,
    FilterValues,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)

from superset.semantic_layers import cache_policy, cache_transform
from superset.semantic_layers.cache_identity import SemanticCacheIdentityFactory
from superset.semantic_layers.cache_policy import (
    ContainmentCapabilities,
    PatternSemantics,
    ReuseDecision,
    ReuseMode,
)
from superset.semantic_layers.cache_repository import CachedEntry

COUNTRY: Dimension = Dimension("country", "Country", pa.string())
REVENUE: Dimension = Dimension("revenue", "Revenue", pa.float64())
REVENUE_METRIC: Metric = Metric(
    id="revenue",
    name="Revenue",
    type=pa.float64(),
    definition="SUM(revenue)",
    aggregation=AggregationType.SUM,
)


def where(
    dimension: Dimension,
    operator: Operator,
    value: FilterValues | tuple[FilterValues, ...] | frozenset[FilterValues],
) -> Filter:
    return Filter(PredicateType.WHERE, dimension, operator, value)


def _candidate(
    *,
    cached_filters: frozenset[Filter] = frozenset(),
    query_filters: set[Filter] | None = None,
) -> tuple[SemanticQuery, CachedEntry]:
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[COUNTRY],
        filters=query_filters,
    )
    entry: CachedEntry = CachedEntry(
        filters=cached_filters,
        dimensions=frozenset({COUNTRY}),
        metrics=frozenset({REVENUE_METRIC}),
        limit=None,
        offset=0,
        order_key="",
        group_limit_key="",
        value_key="value",
    )
    return query, entry


def test_reuse_modes_are_stable_wire_values() -> None:
    assert [mode.value for mode in ReuseMode] == ["exact", "project", "rollup"]


@pytest.mark.parametrize(
    "new_filter,cached_filter,expected",
    [
        (
            where(REVENUE, Operator.EQUALS, 20),
            where(REVENUE, Operator.EQUALS, 20),
            True,
        ),
        (
            where(REVENUE, Operator.EQUALS, 20),
            where(REVENUE, Operator.EQUALS, 21),
            False,
        ),
        (
            where(REVENUE, Operator.GREATER_THAN, 20),
            where(REVENUE, Operator.GREATER_THAN, 10),
            True,
        ),
        (
            where(REVENUE, Operator.GREATER_THAN, 10),
            where(REVENUE, Operator.GREATER_THAN, 20),
            False,
        ),
        (
            where(REVENUE, Operator.GREATER_THAN_OR_EQUAL, 11),
            where(REVENUE, Operator.GREATER_THAN, 10),
            True,
        ),
        (
            where(REVENUE, Operator.GREATER_THAN_OR_EQUAL, 10),
            where(REVENUE, Operator.GREATER_THAN, 10),
            False,
        ),
        (
            where(REVENUE, Operator.LESS_THAN, 5),
            where(REVENUE, Operator.LESS_THAN_OR_EQUAL, 5),
            True,
        ),
        (
            where(REVENUE, Operator.EQUALS, 12),
            where(REVENUE, Operator.GREATER_THAN, 10),
            True,
        ),
        (
            where(REVENUE, Operator.IN, frozenset({12, 13})),
            where(REVENUE, Operator.GREATER_THAN, 10),
            True,
        ),
        (
            where(COUNTRY, Operator.IN, frozenset({"GB", "US"})),
            where(COUNTRY, Operator.IN, frozenset({"GB", "US", "CA"})),
            True,
        ),
        (
            where(COUNTRY, Operator.IN, frozenset({"GB", "FR"})),
            where(COUNTRY, Operator.IN, frozenset({"GB", "US"})),
            False,
        ),
        (
            where(COUNTRY, Operator.EQUALS, "GB"),
            where(COUNTRY, Operator.IN, frozenset({"GB", "US"})),
            True,
        ),
        (
            where(COUNTRY, Operator.IS_NULL, None),
            where(COUNTRY, Operator.IS_NULL, None),
            True,
        ),
        (
            where(COUNTRY, Operator.IS_NOT_NULL, None),
            where(COUNTRY, Operator.IS_NULL, None),
            False,
        ),
        (
            where(COUNTRY, Operator.EQUALS, "GB"),
            where(COUNTRY, Operator.IS_NOT_NULL, None),
            True,
        ),
        (
            where(REVENUE, Operator.GREATER_THAN, "10"),
            where(REVENUE, Operator.GREATER_THAN, 9),
            False,
        ),
    ],
)
def test_filter_implication_matrix(
    new_filter: Filter,
    cached_filter: Filter,
    expected: bool,
) -> None:
    assert cache_policy.implies(new_filter, cached_filter) is expected


def test_membership_implication_does_not_merge_bool_and_integer_values() -> None:
    assert (
        cache_policy.implies(
            where(REVENUE, Operator.EQUALS, True),
            where(REVENUE, Operator.IN, (1, 2)),
        )
        is False
    )


def test_escaped_pattern_requires_proven_provider_semantics() -> None:
    cached_filter: Filter = where(COUNTRY, Operator.LIKE, r"GB\_%")
    new_filter: Filter = where(COUNTRY, Operator.EQUALS, "GB_value")

    assert cache_policy.implies(new_filter, cached_filter) is False
    assert (
        cache_policy.implies(
            new_filter,
            cached_filter,
            pattern_semantics=cache_policy.PatternSemantics.sql_like(escape="\\"),
        )
        is True
    )


def test_pattern_fallback_rejects_incompatible_escape_contract() -> None:
    cached_filter: Filter = where(COUNTRY, Operator.LIKE, r"GB\_%")
    new_filter: Filter = where(COUNTRY, Operator.EQUALS, "GB_value")

    assert (
        cache_policy.implies(
            new_filter,
            cached_filter,
            pattern_semantics=cache_policy.PatternSemantics.sql_like(escape="!"),
        )
        is False
    )


def test_like_compilation_collapses_redundant_wildcards() -> None:
    assert (
        cache_policy.compile_like_pattern("%%%%%%%%value", "\\").pattern == "^.*value$"
    )


def test_defensive_implication_and_capability_branches_are_conservative() -> None:
    equals: Filter = where(REVENUE, Operator.EQUALS, 20)
    different_column: Filter = where(COUNTRY, Operator.EQUALS, "GB")
    invalid_membership: Filter = where(REVENUE, Operator.IN, 20)
    unsupported_cached: Filter = where(REVENUE, Operator.NOT_LIKE, "2%")

    assert cache_policy.implies(equals, different_column) is False
    assert cache_policy._implies_membership(equals, 20) is False
    assert cache_policy._implies_membership(invalid_membership, (20,)) is False
    assert cache_policy._range_contains(Operator.GREATER_THAN_OR_EQUAL, 10, 10)
    assert cache_policy._range_contains(Operator.LESS_THAN, 10, 9)
    assert cache_policy._range_contains(Operator.LESS_THAN_OR_EQUAL, 10, 10)
    assert cache_policy._range_contains(Operator.EQUALS, 10, 10) is False
    assert cache_policy.implies(equals, unsupported_cached) is False
    full_capabilities: ContainmentCapabilities = ContainmentCapabilities(
        comparisons=True,
        membership=True,
        nulls=True,
        pattern_semantics=PatternSemantics.sql_like(escape="\\"),
    )
    assert cache_policy._supports_filter(
        where(REVENUE, Operator.IN, (20,)), full_capabilities
    )
    assert cache_policy._supports_filter(
        where(REVENUE, Operator.IS_NULL, None), full_capabilities
    )
    assert cache_policy._supports_filter(
        where(REVENUE, Operator.LIKE, "2%"), full_capabilities
    )
    assert (
        cache_policy._supports_filter(
            where(REVENUE, Operator.ADHOC, "revenue > 1"),
            full_capabilities,
        )
        is False
    )

    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate()
    missing_metric: Metric = replace(REVENUE_METRIC, id="cost", name="Cost")
    assert (
        cache_policy.select_reuse(
            replace(query, metrics=[missing_metric]),
            entry,
            full_capabilities,
        )
        is None
    )


@pytest.mark.parametrize(
    "operator,value,expected",
    [
        (Operator.EQUALS, 1, [True, False, False]),
        (Operator.NOT_EQUALS, 1, [False, True, False]),
        (Operator.IN, frozenset({1, None}), [True, False, False]),
        (Operator.NOT_IN, frozenset({1}), [False, True, False]),
    ],
)
def test_sql_null_semantics_for_scalar_and_membership_masks(
    operator: Operator,
    value: FilterValues | frozenset[FilterValues],
    expected: list[bool],
) -> None:
    series: pd.Series = pd.Series([1, 2, None])

    assert cache_transform.mask_for(series, operator, value).tolist() == expected


@pytest.mark.parametrize(
    "operator,expected",
    [
        (Operator.LIKE, [True, False, False]),
        (Operator.NOT_LIKE, [False, True, False]),
    ],
)
def test_sql_null_semantics_for_pattern_masks(
    operator: Operator,
    expected: list[bool],
) -> None:
    series: pd.Series = pd.Series(["alpha", "beta", None])
    semantics: cache_policy.PatternSemantics = cache_policy.PatternSemantics.sql_like(
        escape="\\"
    )
    assert (
        cache_transform.mask_for(
            series, operator, "a%", pattern_semantics=semantics
        ).tolist()
        == expected
    )


def test_mask_defensive_and_null_branches() -> None:
    series: pd.Series = pd.Series([1, None])

    assert cache_transform.mask_for(series, Operator.IS_NULL, None).tolist() == [
        False,
        True,
    ]
    assert cache_transform.mask_for(series, Operator.IS_NOT_NULL, None).tolist() == [
        True,
        False,
    ]
    assert cache_transform.mask_for(series, Operator.NOT_IN, (1, None)).tolist() == [
        False,
        False,
    ]
    assert cache_transform.mask_for(series, Operator.NOT_EQUALS, None).tolist() == [
        False,
        False,
    ]
    with pytest.raises(ValueError, match="Unsupported cached filter"):
        cache_transform.mask_for(series, Operator.ADHOC, "x")


def test_candidate_requires_capability_for_stronger_filter_proof() -> None:
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        cached_filters=frozenset({where(COUNTRY, Operator.IN, ("GB", "US"))}),
        query_filters={where(COUNTRY, Operator.EQUALS, "GB")},
    )

    assert cache_policy.select_reuse(query, entry, ContainmentCapabilities()) is None
    decision: cache_policy.ReuseDecision | None = cache_policy.select_reuse(
        query,
        entry,
        ContainmentCapabilities(comparisons=True, membership=True),
    )

    assert decision is not None
    assert decision.mode is ReuseMode.EXACT
    assert decision.leftover_filters == frozenset(query.filters or set())


def test_exact_filter_set_needs_no_postprocessing_capability() -> None:
    predicate: Filter = where(COUNTRY, Operator.EQUALS, "GB")
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        cached_filters=frozenset({predicate}),
        query_filters={predicate},
    )

    decision: cache_policy.ReuseDecision | None = cache_policy.select_reuse(
        query,
        entry,
        ContainmentCapabilities(),
    )

    assert decision is not None
    assert decision.leftover_filters == frozenset()


def test_leftover_filter_requires_cached_projection_and_capability() -> None:
    leftover: Filter = where(COUNTRY, Operator.EQUALS, "GB")
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(query_filters={leftover})

    assert cache_policy.select_reuse(query, entry, ContainmentCapabilities()) is None
    decision: cache_policy.ReuseDecision | None = cache_policy.select_reuse(
        query,
        entry,
        ContainmentCapabilities(comparisons=True),
    )
    unavailable_query: SemanticQuery
    unavailable_entry: CachedEntry
    unavailable_query, unavailable_entry = _candidate(
        query_filters={
            where(
                Dimension("cost", "Cost", pa.float64()),
                Operator.EQUALS,
                1,
            )
        }
    )

    assert decision is not None
    assert decision.leftover_filters == frozenset({leftover})
    assert (
        cache_policy.select_reuse(
            unavailable_query,
            unavailable_entry,
            ContainmentCapabilities(comparisons=True),
        )
        is None
    )


@pytest.mark.parametrize("predicate_type", [PredicateType.HAVING])
def test_having_filters_must_match_exactly(predicate_type: PredicateType) -> None:
    cached: Filter = Filter(
        predicate_type,
        REVENUE_METRIC,
        Operator.GREATER_THAN,
        10,
    )
    requested: Filter = Filter(
        predicate_type,
        REVENUE_METRIC,
        Operator.GREATER_THAN,
        20,
    )
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        cached_filters=frozenset({cached}),
        query_filters={requested},
    )

    assert (
        cache_policy.select_reuse(
            query,
            entry,
            ContainmentCapabilities(comparisons=True),
        )
        is None
    )


def test_rollup_rejects_matching_having_evaluated_at_cached_grain() -> None:
    city: Dimension = Dimension("city", "City", pa.string())
    having: Filter = Filter(
        PredicateType.HAVING,
        REVENUE_METRIC,
        Operator.GREATER_THAN,
        100,
    )
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        cached_filters=frozenset({having}),
        query_filters={having},
    )
    entry = replace(
        entry,
        dimensions=frozenset({COUNTRY, city}),
    )

    assert (
        cache_policy.select_reuse(
            query,
            entry,
            ContainmentCapabilities(comparisons=True),
        )
        is None
    )


def test_leftover_dimension_cannot_be_proved_by_colliding_metric_id() -> None:
    raw_revenue: Dimension = Dimension("revenue", "Raw revenue", pa.float64())
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        query_filters={where(raw_revenue, Operator.GREATER_THAN, 10)},
    )

    assert (
        cache_policy.select_reuse(
            query,
            entry,
            ContainmentCapabilities(comparisons=True),
        )
        is None
    )


def test_adhoc_filters_must_match_exactly() -> None:
    cached: Filter = Filter(PredicateType.WHERE, None, Operator.ADHOC, "x > 10")
    requested: Filter = Filter(PredicateType.WHERE, None, Operator.ADHOC, "x > 20")
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        cached_filters=frozenset({cached}),
        query_filters={requested},
    )

    assert cache_policy.select_reuse(query, entry, ContainmentCapabilities()) is None


def test_candidate_pattern_proof_requires_matching_escape_semantics() -> None:
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        cached_filters=frozenset({where(COUNTRY, Operator.LIKE, r"GB\_%")}),
        query_filters={where(COUNTRY, Operator.EQUALS, "GB_value")},
    )

    assert (
        cache_policy.select_reuse(
            query,
            entry,
            ContainmentCapabilities(
                comparisons=True,
                pattern_semantics=PatternSemantics.sql_like(escape="!"),
            ),
        )
        is None
    )
    assert (
        cache_policy.select_reuse(
            query,
            entry,
            ContainmentCapabilities(
                comparisons=True,
                pattern_semantics=PatternSemantics.sql_like(escape="\\"),
            ),
        )
        is not None
    )


def test_limited_candidate_cannot_supply_leftover_filtering() -> None:
    leftover: Filter = where(COUNTRY, Operator.EQUALS, "GB")
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(query_filters={leftover})
    limited_query: SemanticQuery = replace(query, limit=5)
    limited_entry: CachedEntry = replace(entry, limit=10)

    assert (
        cache_policy.select_reuse(
            limited_query,
            limited_entry,
            ContainmentCapabilities(comparisons=True),
        )
        is None
    )


def test_limited_candidate_cannot_supply_rollup() -> None:
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate()
    city: Dimension = Dimension("city", "City", pa.string())
    limited_query: SemanticQuery = replace(query, limit=5)
    limited_entry: CachedEntry = replace(
        entry,
        dimensions=frozenset({COUNTRY, city}),
        limit=10,
    )

    assert (
        cache_policy.select_reuse(
            limited_query,
            limited_entry,
            ContainmentCapabilities(),
        )
        is None
    )


def test_group_limit_candidate_rejects_leftover_main_query_filter() -> None:
    group_limit: GroupLimit = GroupLimit(
        dimensions=[COUNTRY],
        top=10,
        metric=REVENUE_METRIC,
    )
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate(
        query_filters={where(COUNTRY, Operator.EQUALS, "GB")},
    )
    query = replace(query, group_limit=group_limit)
    entry = replace(
        entry,
        group_limit_key=SemanticCacheIdentityFactory.group_limit(group_limit),
    )

    assert (
        cache_policy.select_reuse(
            query,
            entry,
            ContainmentCapabilities(comparisons=True),
        )
        is None
    )


def test_ordered_candidate_cannot_supply_rollup() -> None:
    query: SemanticQuery
    entry: CachedEntry
    query, entry = _candidate()
    city: Dimension = Dimension("city", "City", pa.string())
    ordered_query: SemanticQuery = replace(
        query,
        order=[(REVENUE_METRIC, OrderDirection.DESC)],
    )
    ordered_entry: CachedEntry = replace(
        entry,
        dimensions=frozenset({COUNTRY, city}),
        order_key=SemanticCacheIdentityFactory.order(ordered_query.order),
    )

    assert (
        cache_policy.select_reuse(
            ordered_query,
            ordered_entry,
            ContainmentCapabilities(),
        )
        is None
    )


def _semantic_result(frame: pd.DataFrame) -> SemanticResult:
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="provider query")],
        results=pa.Table.from_pandas(frame, preserve_index=False),
    )


def test_exact_transformation_applies_leftovers_order_offset_and_limit() -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[COUNTRY],
        order=[(REVENUE_METRIC, OrderDirection.DESC)],
        limit=1,
        offset=1,
    )
    leftover: Filter = where(REVENUE, Operator.GREATER_THAN, 10)
    result: SemanticResult = _semantic_result(
        pd.DataFrame({"Country": ["CA", "US", "GB"], "Revenue": [30.0, None, 20.0]})
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.EXACT, frozenset({leftover})),
        ContainmentCapabilities(comparisons=True),
    )

    assert transformed.results.to_pydict() == {
        "Country": ["GB"],
        "Revenue": [20.0],
    }
    assert transformed.requests == result.requests


def test_exact_transformation_preserves_provider_collation_order() -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[COUNTRY],
        order=[(COUNTRY, OrderDirection.ASC)],
    )
    result: SemanticResult = _semantic_result(
        pd.DataFrame({"Country": ["a", "B"], "Revenue": [1.0, 2.0]})
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.EXACT, frozenset()),
        ContainmentCapabilities(),
    )

    assert transformed.results.to_pydict()["Country"] == ["a", "B"]


def test_exact_transformation_preserves_arrow_types() -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[replace(REVENUE_METRIC, type=pa.int64())],
        dimensions=[COUNTRY],
    )
    result: SemanticResult = SemanticResult(
        requests=[],
        results=pa.table(
            {
                "Country": pa.array(["GB", "US"]),
                "Revenue": pa.array([12345, None], type=pa.int64()),
            }
        ),
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.EXACT, frozenset()),
        ContainmentCapabilities(),
    )

    assert transformed.results.schema == result.results.schema


def test_project_transformation_drops_unrequested_metrics() -> None:
    cost: Metric = Metric(
        id="cost",
        name="Cost",
        type=pa.float64(),
        definition="SUM(cost)",
        aggregation=AggregationType.SUM,
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[COUNTRY],
    )
    result: SemanticResult = _semantic_result(
        pd.DataFrame({"Country": ["GB"], "Revenue": [20.0], "Cost": [5.0]})
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.PROJECT, frozenset()),
        ContainmentCapabilities(),
    )

    assert cost.name not in transformed.results.column_names
    assert transformed.results.to_pydict() == {
        "Country": ["GB"],
        "Revenue": [20.0],
    }


def test_projection_uses_requested_column_order() -> None:
    city: Dimension = Dimension("city", "City", pa.string())
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[city, COUNTRY],
    )
    result: SemanticResult = _semantic_result(
        pd.DataFrame(
            {
                "Country": ["GB"],
                "City": ["London"],
                "Revenue": [20.0],
            }
        )
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.PROJECT, frozenset()),
        ContainmentCapabilities(),
    )

    assert transformed.results.column_names == ["City", "Country", "Revenue"]


@pytest.mark.parametrize(
    "aggregation,values,expected",
    [
        (AggregationType.SUM, [2.0, 3.0], 5.0),
        (AggregationType.COUNT, [2.0, 3.0], 5.0),
        (AggregationType.MIN, [2.0, 3.0], 2.0),
        (AggregationType.MAX, [2.0, 3.0], 3.0),
    ],
)
def test_rollup_transformation_uses_declared_aggregation(
    aggregation: AggregationType,
    values: list[float],
    expected: float,
) -> None:
    metric: Metric = replace(REVENUE_METRIC, aggregation=aggregation)
    query: SemanticQuery = SemanticQuery(metrics=[metric], dimensions=[COUNTRY])
    result: SemanticResult = _semantic_result(
        pd.DataFrame(
            {
                "Country": ["GB", "GB"],
                "City": ["London", "Leeds"],
                "Revenue": values,
            }
        )
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.ROLLUP, frozenset()),
        ContainmentCapabilities(),
    )

    assert transformed.results.to_pydict() == {
        "Country": ["GB"],
        "Revenue": [expected],
    }


def test_sum_rollup_preserves_all_null_group() -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[COUNTRY],
    )
    result: SemanticResult = _semantic_result(
        pd.DataFrame(
            {
                "Country": ["GB", "GB"],
                "City": ["London", "Leeds"],
                "Revenue": [None, None],
            }
        )
    )

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.ROLLUP, frozenset()),
        ContainmentCapabilities(),
    )

    assert transformed.results.to_pydict() == {
        "Country": ["GB"],
        "Revenue": [None],
    }


def test_dimensionless_rollup_aggregates_all_rows() -> None:
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[],
    )
    result: SemanticResult = _semantic_result(pd.DataFrame({"Revenue": [2.0, 3.0]}))

    transformed: SemanticResult = cache_transform.transform_result(
        result,
        query,
        ReuseDecision(ReuseMode.ROLLUP, frozenset()),
        ContainmentCapabilities(),
    )

    assert transformed.results.to_pydict() == {"Revenue": [5.0]}


def test_transform_rejects_unproven_leftover_and_rollup() -> None:
    result: SemanticResult = _semantic_result(pd.DataFrame({"Revenue": [2.0]}))
    adhoc: Filter = Filter(
        PredicateType.WHERE,
        None,
        Operator.ADHOC,
        "revenue > 1",
    )
    query: SemanticQuery = SemanticQuery(
        metrics=[REVENUE_METRIC],
        dimensions=[],
    )

    with pytest.raises(
        cache_transform.SemanticCacheTransformationError,
        match="incompatible",
    ):
        cache_transform.transform_result(
            result,
            query,
            ReuseDecision(ReuseMode.EXACT, frozenset({adhoc})),
            ContainmentCapabilities(),
        )

    unsafe_metric: Metric = replace(
        REVENUE_METRIC,
        aggregation=AggregationType.AVG,
    )
    with pytest.raises(
        cache_transform.SemanticCacheTransformationError,
        match="incompatible",
    ):
        cache_transform.transform_result(
            result,
            replace(query, metrics=[unsafe_metric]),
            ReuseDecision(ReuseMode.ROLLUP, frozenset()),
            ContainmentCapabilities(),
        )
