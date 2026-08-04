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

"""Pure policy types for semantic containment caching."""

from __future__ import annotations

import re

from superset_core.semantic_layers.types import (
    AggregationType,
    Filter,
    Operator,
    PredicateType,
    SemanticQuery,
)

from superset.semantic_layers.cache_identity import (
    semantic_dimension_key,
    SemanticCacheIdentityFactory,
)
from superset.semantic_layers.cache_types import (
    CachedEntry as CachedEntry,
    ContainmentCapabilities as ContainmentCapabilities,
    PatternSemantics as PatternSemantics,
    ReuseDecision as ReuseDecision,
    ReuseMode as ReuseMode,
    SAFE_CONTAINMENT_CAPABILITIES as SAFE_CONTAINMENT_CAPABILITIES,
)


def _comparable(left: object, right: object) -> bool:
    return type(left) is type(right) or (
        isinstance(left, (int, float))
        and not isinstance(left, bool)
        and isinstance(right, (int, float))
        and not isinstance(right, bool)
    )


def _range_contains(operator: Operator, bound: object, value: object) -> bool:
    if not _comparable(bound, value):
        return False
    if operator is Operator.GREATER_THAN:
        return bool(value > bound)  # type: ignore[operator]
    if operator is Operator.GREATER_THAN_OR_EQUAL:
        return bool(value >= bound)  # type: ignore[operator]
    if operator is Operator.LESS_THAN:
        return bool(value < bound)  # type: ignore[operator]
    if operator is Operator.LESS_THAN_OR_EQUAL:
        return bool(value <= bound)  # type: ignore[operator]
    return False


def compile_like_pattern(pattern: str, escape: str) -> re.Pattern[str]:
    """Compile a SQL LIKE pattern using the provider's escape character."""
    parts: list[str] = []
    index: int = 0
    while index < len(pattern):
        char: str = pattern[index]
        if char == escape and index + 1 < len(pattern):
            index += 1
            parts.append(re.escape(pattern[index]))
        elif char == "%":
            parts.append(".*")
        elif char == "_":
            parts.append(".")
        else:
            parts.append(re.escape(char))
        index += 1
    return re.compile("^" + "".join(parts) + "$", re.DOTALL)


_RANGE_OPERATORS: frozenset[Operator] = frozenset(
    {
        Operator.GREATER_THAN,
        Operator.GREATER_THAN_OR_EQUAL,
        Operator.LESS_THAN,
        Operator.LESS_THAN_OR_EQUAL,
    }
)
_LOWER_BOUND_OPERATORS: frozenset[Operator] = frozenset(
    {Operator.GREATER_THAN, Operator.GREATER_THAN_OR_EQUAL}
)


def _implies_membership(new_filter: Filter, cached_values: object) -> bool:
    if not isinstance(cached_values, (set, frozenset, tuple)):
        return False
    if new_filter.operator is Operator.EQUALS:
        return new_filter.value in cached_values
    if new_filter.operator is Operator.IN and isinstance(
        new_filter.value, (set, frozenset, tuple)
    ):
        return set(new_filter.value).issubset(cached_values)
    return False


def _implies_range(new_filter: Filter, cached_filter: Filter) -> bool:
    if new_filter.operator is Operator.EQUALS:
        return _range_contains(
            cached_filter.operator, cached_filter.value, new_filter.value
        )
    if new_filter.operator is Operator.IN and isinstance(
        new_filter.value, (set, frozenset, tuple)
    ):
        return all(
            _range_contains(cached_filter.operator, cached_filter.value, value)
            for value in new_filter.value
        )
    if new_filter.operator not in _RANGE_OPERATORS or not _range_contains(
        cached_filter.operator, cached_filter.value, new_filter.value
    ):
        return False
    cached_is_lower: bool = cached_filter.operator in _LOWER_BOUND_OPERATORS
    new_is_lower: bool = new_filter.operator in _LOWER_BOUND_OPERATORS
    return cached_is_lower is new_is_lower


def _implies_like(
    new_filter: Filter,
    cached_filter: Filter,
    pattern_semantics: PatternSemantics | None,
) -> bool:
    return (
        new_filter.operator is Operator.EQUALS
        and isinstance(new_filter.value, str)
        and isinstance(cached_filter.value, str)
        and pattern_semantics is not None
        and compile_like_pattern(
            cached_filter.value, pattern_semantics.escape
        ).fullmatch(new_filter.value)
        is not None
    )


def implies(
    new_filter: Filter,
    cached_filter: Filter,
    *,
    pattern_semantics: PatternSemantics | None = None,
) -> bool:
    """Return whether the new predicate proves the cached predicate."""
    if (
        new_filter.type is not cached_filter.type
        or new_filter.column != cached_filter.column
    ):
        return False
    new_op: Operator = new_filter.operator
    cached_op: Operator = cached_filter.operator
    new_value: object = new_filter.value
    cached_value: object = cached_filter.value
    if new_op is cached_op and new_value == cached_value:
        return True
    if cached_op is Operator.IS_NULL:
        return False
    if cached_op is Operator.IS_NOT_NULL:
        return new_op is not Operator.IS_NULL
    if cached_op is Operator.EQUALS:
        return new_op is Operator.EQUALS and new_value == cached_value
    if cached_op is Operator.IN:
        return _implies_membership(new_filter, cached_value)
    if cached_op in _RANGE_OPERATORS:
        return _implies_range(new_filter, cached_filter)
    if cached_op is Operator.LIKE:
        return _implies_like(new_filter, cached_filter, pattern_semantics)
    return False


def _supports_filter(
    filter_: Filter,
    capabilities: ContainmentCapabilities,
) -> bool:
    operator: Operator = filter_.operator
    if operator in {
        Operator.EQUALS,
        Operator.NOT_EQUALS,
        *_RANGE_OPERATORS,
    }:
        return capabilities.comparisons
    if operator in {Operator.IN, Operator.NOT_IN}:
        return capabilities.membership
    if operator in {Operator.IS_NULL, Operator.IS_NOT_NULL}:
        return capabilities.nulls
    if operator in {Operator.LIKE, Operator.NOT_LIKE}:
        return capabilities.pattern_semantics is not None
    return False


def _strict_filters(filters: frozenset[Filter]) -> frozenset[Filter]:
    return frozenset(
        filter_
        for filter_ in filters
        if filter_.type is PredicateType.HAVING or filter_.operator is Operator.ADHOC
    )


def _filter_decision(
    query: SemanticQuery,
    entry: CachedEntry,
    capabilities: ContainmentCapabilities,
) -> frozenset[Filter] | None:
    requested: frozenset[Filter] = frozenset(query.filters or set())
    cached: frozenset[Filter] = entry.filters
    requested_strict: frozenset[Filter] = _strict_filters(requested)
    cached_strict: frozenset[Filter] = _strict_filters(cached)
    if requested_strict != cached_strict:
        return None

    requested_where: frozenset[Filter] = requested - requested_strict
    cached_where: frozenset[Filter] = cached - cached_strict
    for cached_filter in cached_where:
        if cached_filter in requested_where:
            continue
        if not any(
            _supports_filter(requested_filter, capabilities)
            and _supports_filter(cached_filter, capabilities)
            and implies(
                requested_filter,
                cached_filter,
                pattern_semantics=capabilities.pattern_semantics,
            )
            for requested_filter in requested_where
        ):
            return None

    leftovers: frozenset[Filter] = requested_where - cached_where
    available_columns: frozenset[str] = entry.dimension_keys | entry.metric_ids
    if any(
        leftover.column is None
        or leftover.column.id not in available_columns
        or not _supports_filter(leftover, capabilities)
        for leftover in leftovers
    ):
        return None
    return leftovers


def _reuse_mode(query: SemanticQuery, entry: CachedEntry) -> ReuseMode | None:
    requested_dimensions: frozenset[str] = frozenset(
        semantic_dimension_key(dimension) for dimension in query.dimensions
    )
    requested_metrics: frozenset[str] = frozenset(metric.id for metric in query.metrics)
    if not requested_metrics.issubset(entry.metric_ids):
        return None
    if requested_dimensions == entry.dimension_keys:
        return (
            ReuseMode.EXACT
            if requested_metrics == entry.metric_ids
            else ReuseMode.PROJECT
        )
    if not requested_dimensions < entry.dimension_keys:
        return None
    rollup_aggregations: frozenset[AggregationType] = frozenset(
        {
            AggregationType.SUM,
            AggregationType.COUNT,
            AggregationType.MIN,
            AggregationType.MAX,
        }
    )
    return (
        ReuseMode.ROLLUP
        if all(metric.aggregation in rollup_aggregations for metric in query.metrics)
        else None
    )


def select_reuse(
    query: SemanticQuery,
    entry: CachedEntry,
    capabilities: ContainmentCapabilities,
) -> ReuseDecision | None:
    """Prove whether and how a cached descriptor can satisfy a query."""
    query_order_key: str = SemanticCacheIdentityFactory.order(query.order)
    query_offset: int = query.offset or 0
    pagination_compatible: bool = (
        query_offset == 0
        and entry.offset == 0
        and query_order_key == entry.order_key
        and (
            entry.limit is None
            or (query.limit is not None and query.limit <= entry.limit)
        )
    )
    group_limit_compatible: bool = (
        SemanticCacheIdentityFactory.group_limit(query.group_limit)
        == entry.group_limit_key
    )
    if not pagination_compatible or not group_limit_compatible:
        return None
    leftovers: frozenset[Filter] | None = _filter_decision(query, entry, capabilities)
    mode: ReuseMode | None = _reuse_mode(query, entry)
    if leftovers is None or mode is None:
        return None
    if mode is ReuseMode.ROLLUP and query.order:
        return None
    if entry.limit is not None and (leftovers or mode is ReuseMode.ROLLUP):
        return None
    return ReuseDecision(mode=mode, leftover_filters=leftovers)


def eligible_reuse_mode(
    query: SemanticQuery,
    entry: CachedEntry,
    capabilities: ContainmentCapabilities = SAFE_CONTAINMENT_CAPABILITIES,
) -> ReuseMode | None:
    """Return only the transformation mode for an eligible candidate."""
    decision: ReuseDecision | None = select_reuse(query, entry, capabilities)
    return decision.mode if decision else None


def rank_reuse_decisions(
    query: SemanticQuery,
    entries: list[CachedEntry],
    capabilities: ContainmentCapabilities = SAFE_CONTAINMENT_CAPABILITIES,
) -> list[tuple[ReuseDecision, CachedEntry]]:
    """Rank entries with the reuse proof already calculated for each one."""
    priorities: dict[ReuseMode, int] = {
        ReuseMode.EXACT: 0,
        ReuseMode.PROJECT: 1,
        ReuseMode.ROLLUP: 2,
    }
    candidates: list[tuple[ReuseDecision, CachedEntry]] = []
    for entry in entries:
        decision: ReuseDecision | None = select_reuse(query, entry, capabilities)
        if decision is not None:
            candidates.append((decision, entry))
    return sorted(
        candidates,
        key=lambda candidate: (
            priorities[candidate[0].mode],
            -candidate[1].timestamp,
        ),
    )


def rank_eligible_entries(
    query: SemanticQuery,
    entries: list[CachedEntry],
    capabilities: ContainmentCapabilities = SAFE_CONTAINMENT_CAPABILITIES,
) -> list[tuple[ReuseMode, CachedEntry]]:
    """Rank eligible candidates by transformation cost and freshness."""
    return [
        (decision.mode, entry)
        for decision, entry in rank_reuse_decisions(query, entries, capabilities)
    ]
