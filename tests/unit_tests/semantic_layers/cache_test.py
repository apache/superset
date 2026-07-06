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

import threading
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)

from superset.semantic_layers import cache as cache_module
from superset.semantic_layers.cache import (
    _apply_post_processing,
    _implies,
    _projection_input_complete,
    CachedEntry,
    can_satisfy,
    ReuseMode,
    shape_key,
    store_result,
    try_serve_from_cache,
    value_key,
    ViewMeta,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def dim(id_: str, name: str | None = None) -> Dimension:
    return Dimension(id=id_, name=name or id_, type=pa.utf8())


def met(
    id_: str,
    name: str | None = None,
    aggregation: AggregationType | None = None,
) -> Metric:
    return Metric(
        id=id_,
        name=name or id_,
        type=pa.float64(),
        definition="x",
        aggregation=aggregation,
    )


COL_A = dim("col.a", "a")
COL_B = dim("col.b", "b")
M_X = met("met.x", "x")
M_Y = met("met.y", "y")

VIEW = ViewMeta(uuid="view-1", changed_on_iso="2026-05-01T00:00:00", cache_timeout=None)


def where(column: Dimension | Metric | None, op: Operator, value: Any) -> Filter:
    return Filter(type=PredicateType.WHERE, column=column, operator=op, value=value)


def having(column: Metric, op: Operator, value: Any) -> Filter:
    return Filter(type=PredicateType.HAVING, column=column, operator=op, value=value)


def adhoc(definition: str, type_: PredicateType = PredicateType.WHERE) -> Filter:
    return Filter(type=type_, column=None, operator=Operator.ADHOC, value=definition)


def query(
    filters: set[Filter] | None = None,
    limit: int | None = None,
    order: Any = None,
    dimensions: list[Dimension] | None = None,
    metrics: list[Metric] | None = None,
) -> SemanticQuery:
    return SemanticQuery(
        metrics=metrics if metrics is not None else [M_X],
        dimensions=dimensions if dimensions is not None else [COL_A, COL_B],
        filters=filters,
        order=order,
        limit=limit,
    )


def entry_from(q: SemanticQuery, value_key_: str = "vk") -> CachedEntry:
    from superset.semantic_layers.cache import (
        _dimension_key,
        _group_limit_key,
        _order_key,
    )

    return CachedEntry(
        filters=frozenset(q.filters or set()),
        dimension_keys=frozenset(_dimension_key(d) for d in q.dimensions),
        metric_ids=frozenset(m.id for m in q.metrics),
        limit=q.limit,
        offset=q.offset or 0,
        order_key=_order_key(q.order),
        group_limit_key=_group_limit_key(q.group_limit),
        value_key=value_key_,
    )


# ---------------------------------------------------------------------------
# _implies: scalar range pairs
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "new_op,new_val,cached_op,cached_val,expected",
    [
        # narrower lower bound
        (Operator.GREATER_THAN, 20, Operator.GREATER_THAN, 10, True),
        (Operator.GREATER_THAN, 10, Operator.GREATER_THAN, 20, False),
        (Operator.GREATER_THAN_OR_EQUAL, 11, Operator.GREATER_THAN, 10, True),
        (Operator.GREATER_THAN_OR_EQUAL, 10, Operator.GREATER_THAN, 10, False),
        (Operator.GREATER_THAN, 10, Operator.GREATER_THAN_OR_EQUAL, 10, True),
        (Operator.GREATER_THAN, 9, Operator.GREATER_THAN_OR_EQUAL, 10, False),
        # narrower upper bound
        (Operator.LESS_THAN, 5, Operator.LESS_THAN, 10, True),
        (Operator.LESS_THAN_OR_EQUAL, 9, Operator.LESS_THAN, 10, True),
        (Operator.LESS_THAN_OR_EQUAL, 10, Operator.LESS_THAN, 10, False),
        # cross-direction — never implies
        (Operator.LESS_THAN, 5, Operator.GREATER_THAN, 10, False),
        (Operator.GREATER_THAN, 5, Operator.LESS_THAN, 10, False),
        # equals fits in range
        (Operator.EQUALS, 15, Operator.GREATER_THAN, 10, True),
        (Operator.EQUALS, 10, Operator.GREATER_THAN, 10, False),
        (Operator.EQUALS, 10, Operator.GREATER_THAN_OR_EQUAL, 10, True),
    ],
)
def test_implies_range(
    new_op: Operator,
    new_val: Any,
    cached_op: Operator,
    cached_val: Any,
    expected: bool,
) -> None:
    assert (
        _implies(where(COL_A, new_op, new_val), where(COL_A, cached_op, cached_val))
        is expected
    )


def test_implies_in_subset() -> None:
    cached = where(COL_A, Operator.IN, frozenset({"a", "b", "c"}))
    assert _implies(where(COL_A, Operator.IN, frozenset({"a", "b"})), cached) is True
    assert _implies(where(COL_A, Operator.IN, frozenset({"a", "d"})), cached) is False
    # equals to a value in the cached IN set
    assert _implies(where(COL_A, Operator.EQUALS, "b"), cached) is True
    assert _implies(where(COL_A, Operator.EQUALS, "z"), cached) is False


def test_implies_in_all_in_range() -> None:
    cached = where(COL_A, Operator.GREATER_THAN, 10)
    assert _implies(where(COL_A, Operator.IN, frozenset({11, 12})), cached) is True
    assert _implies(where(COL_A, Operator.IN, frozenset({10, 12})), cached) is False


def test_implies_equals_exact() -> None:
    cached = where(COL_A, Operator.EQUALS, 5)
    assert _implies(where(COL_A, Operator.EQUALS, 5), cached) is True
    assert _implies(where(COL_A, Operator.EQUALS, 6), cached) is False


def test_implies_is_not_null() -> None:
    cached = where(COL_A, Operator.IS_NOT_NULL, None)
    assert _implies(where(COL_A, Operator.GREATER_THAN, 0), cached) is True
    assert _implies(where(COL_A, Operator.IS_NOT_NULL, None), cached) is True
    assert _implies(where(COL_A, Operator.IS_NULL, None), cached) is False


def test_implies_like_exact_match_only() -> None:
    a = where(COL_A, Operator.LIKE, "foo%")
    b = where(COL_A, Operator.LIKE, "foo%")
    c = where(COL_A, Operator.LIKE, "bar%")
    assert _implies(a, b) is True
    assert _implies(c, b) is False
    assert _implies(where(COL_A, Operator.EQUALS, "fooz"), b) is False


# ---------------------------------------------------------------------------
# can_satisfy
# ---------------------------------------------------------------------------


def test_can_satisfy_empty_cached_returns_all_as_leftovers() -> None:
    cached_q = query(filters=None)
    new_q = query(filters={where(COL_A, Operator.GREATER_THAN, 5)})
    ok, leftovers, mode = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert mode == ReuseMode.EXACT
    assert leftovers == {where(COL_A, Operator.GREATER_THAN, 5)}


def test_can_satisfy_narrower_filter() -> None:
    cached_q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    new_q = query(filters={where(COL_A, Operator.GREATER_THAN, 2)})
    ok, leftovers, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert leftovers == {where(COL_A, Operator.GREATER_THAN, 2)}


def test_can_satisfy_broader_filter_fails() -> None:
    cached_q = query(filters={where(COL_A, Operator.GREATER_THAN, 2)})
    new_q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    ok, leftovers, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False
    assert leftovers == set()


def test_can_satisfy_missing_constraint_fails() -> None:
    cached_q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    new_q = query(filters=None)
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


def test_can_satisfy_new_filter_on_extra_column() -> None:
    cached_q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    new_q = query(
        filters={
            where(COL_A, Operator.GREATER_THAN, 2),
            where(COL_B, Operator.EQUALS, "x"),
        }
    )
    ok, leftovers, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert leftovers == {
        where(COL_A, Operator.GREATER_THAN, 2),
        where(COL_B, Operator.EQUALS, "x"),
    }


def test_can_satisfy_leftover_on_non_projected_column_fails() -> None:
    other = dim("col.other", "other")
    cached_q = query(filters=None)
    new_q = query(
        filters={where(other, Operator.EQUALS, "x")},
        dimensions=[COL_A, COL_B],
    )
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


def test_can_satisfy_having_requires_exact_set() -> None:
    cached_q = query(filters={having(M_X, Operator.GREATER_THAN, 100)})
    same = query(filters={having(M_X, Operator.GREATER_THAN, 100)})
    tighter = query(filters={having(M_X, Operator.GREATER_THAN, 200)})
    ok_same, _, _ = can_satisfy(entry_from(cached_q), same)
    ok_tight, _, _ = can_satisfy(entry_from(cached_q), tighter)
    assert ok_same is True
    assert ok_tight is False


def test_can_satisfy_adhoc_requires_exact_set() -> None:
    cached_q = query(filters={adhoc("col_a > 1")})
    same = query(filters={adhoc("col_a > 1")})
    different = query(filters={adhoc("col_a > 2")})
    ok_same, _, _ = can_satisfy(entry_from(cached_q), same)
    ok_diff, _, _ = can_satisfy(entry_from(cached_q), different)
    assert ok_same is True
    assert ok_diff is False


# ---------------------------------------------------------------------------
# Limit / order / offset
# ---------------------------------------------------------------------------


def test_can_satisfy_unlimited_cached_satisfies_any_limit() -> None:
    cached_q = query(filters=None, limit=None)
    new_q = query(filters=None, limit=10)
    ok, leftovers, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert leftovers == set()


def test_can_satisfy_smaller_limit_with_matching_order() -> None:
    order = [(M_X, OrderDirection.DESC)]
    cached_q = query(filters=None, limit=100, order=order)
    new_q = query(filters=None, limit=10, order=order)
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True


def test_can_satisfy_smaller_limit_different_order_fails() -> None:
    cached_q = query(filters=None, limit=100, order=[(M_X, OrderDirection.DESC)])
    new_q = query(filters=None, limit=10, order=[(M_X, OrderDirection.ASC)])
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


def test_can_satisfy_larger_limit_fails() -> None:
    cached_q = query(filters=None, limit=10)
    new_q = query(filters=None, limit=100)
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


def test_can_satisfy_no_new_limit_when_cached_has_one_fails() -> None:
    cached_q = query(filters=None, limit=100)
    new_q = query(filters=None, limit=None)
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


def test_can_satisfy_offset_never_reused() -> None:
    cached_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A], offset=5)
    new_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A], offset=5)
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def test_apply_post_processing_filters_and_limits() -> None:
    df = pd.DataFrame({"a": [1, 3, 5, 7, 9], "x": [10, 20, 30, 40, 50]})
    cached = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select ...")],
        results=pa.Table.from_pandas(df, preserve_index=False),
    )
    new_q = query(
        filters={where(COL_A, Operator.GREATER_THAN, 2)},
        limit=2,
    )
    result = _apply_post_processing(
        cached, new_q, {where(COL_A, Operator.GREATER_THAN, 2)}, ReuseMode.EXACT
    )
    result_df = result.results.to_pandas()
    assert list(result_df["a"]) == [3, 5]
    # the cache annotates the requests with a marker
    assert any(req.type == "cache" for req in result.requests)


def test_apply_post_processing_no_leftovers_no_limit_returns_original() -> None:
    df = pd.DataFrame({"a": [1, 2]})
    cached = SemanticResult(
        requests=[], results=pa.Table.from_pandas(df, preserve_index=False)
    )
    new_q = query(filters=None, limit=None)
    out = _apply_post_processing(cached, new_q, set(), ReuseMode.EXACT)
    # same object reference is OK; we explicitly return the input
    assert out is cached


# ---------------------------------------------------------------------------
# Hash stability
# ---------------------------------------------------------------------------


def test_value_key_stable_across_metric_order() -> None:
    q1 = SemanticQuery(metrics=[M_X, M_Y], dimensions=[COL_A])
    q2 = SemanticQuery(metrics=[M_Y, M_X], dimensions=[COL_A])
    assert value_key(VIEW, q1) == value_key(VIEW, q2)


def test_shape_key_stable_across_dimension_order() -> None:
    q1 = SemanticQuery(metrics=[M_X], dimensions=[COL_A, COL_B])
    q2 = SemanticQuery(metrics=[M_X], dimensions=[COL_B, COL_A])
    assert shape_key(VIEW, q1) == shape_key(VIEW, q2)


def test_shape_key_changes_with_changed_on() -> None:
    q = SemanticQuery(metrics=[M_X], dimensions=[COL_A])
    other = ViewMeta(uuid=VIEW.uuid, changed_on_iso="2099-01-01", cache_timeout=None)
    assert shape_key(VIEW, q) != shape_key(other, q)


def test_value_key_changes_with_filter_value() -> None:
    q1 = SemanticQuery(
        metrics=[M_X],
        dimensions=[COL_A],
        filters={where(COL_A, Operator.GREATER_THAN, 1)},
    )
    q2 = SemanticQuery(
        metrics=[M_X],
        dimensions=[COL_A],
        filters={where(COL_A, Operator.GREATER_THAN, 2)},
    )
    assert value_key(VIEW, q1) != value_key(VIEW, q2)


def test_value_key_with_datetime_filter() -> None:
    f = where(COL_A, Operator.GREATER_THAN_OR_EQUAL, datetime(2025, 1, 1))
    q = SemanticQuery(metrics=[M_X], dimensions=[COL_A], filters={f})
    # should not raise
    assert value_key(VIEW, q).startswith("sv:val:")


def test_shape_key_independent_of_query_shape() -> None:
    # All queries for a view+changed_on share one bucket; dim and metric sets
    # live on each ``CachedEntry`` so the projection/rollup paths can find
    # broader entries.
    q1 = SemanticQuery(metrics=[M_X], dimensions=[COL_A, COL_B])
    q2 = SemanticQuery(metrics=[M_X], dimensions=[COL_A])
    q3 = SemanticQuery(metrics=[M_X, M_Y], dimensions=[COL_A])
    assert shape_key(VIEW, q1) == shape_key(VIEW, q2) == shape_key(VIEW, q3)
    # Value keys still differ.
    assert value_key(VIEW, q1) != value_key(VIEW, q2)
    assert value_key(VIEW, q2) != value_key(VIEW, q3)


# ---------------------------------------------------------------------------
# Projection (v2)
# ---------------------------------------------------------------------------


M_SUM = met("met.sum", "sum_x", aggregation=AggregationType.SUM)
M_COUNT = met("met.count", "count_x", aggregation=AggregationType.COUNT)
M_MIN = met("met.min", "min_x", aggregation=AggregationType.MIN)
M_MAX = met("met.max", "max_x", aggregation=AggregationType.MAX)
M_AVG = met("met.avg", "avg_x", aggregation=AggregationType.AVG)
M_UNKNOWN = met("met.unknown", "unknown_x", aggregation=None)


def _projection_query(
    metrics: list[Metric],
    new_dimensions: list[Dimension],
    cached_dimensions: list[Dimension],
    cached_filters: set[Filter] | None = None,
    cached_limit: int | None = None,
    new_filters: set[Filter] | None = None,
    new_limit: int | None = None,
    new_order: Any = None,
    new_group_limit: GroupLimit | None = None,
) -> tuple[CachedEntry, SemanticQuery]:
    cached_q = SemanticQuery(
        metrics=metrics,
        dimensions=cached_dimensions,
        filters=cached_filters,
        limit=cached_limit,
    )
    new_q = SemanticQuery(
        metrics=metrics,
        dimensions=new_dimensions,
        filters=new_filters,
        limit=new_limit,
        order=new_order,
        group_limit=new_group_limit,
    )
    return entry_from(cached_q), new_q


@pytest.mark.parametrize(
    "metric,operator",
    [
        (M_SUM, "sum"),
        (M_COUNT, "sum"),
        (M_MIN, "min"),
        (M_MAX, "max"),
    ],
)
def test_can_satisfy_projection_each_additive_op(metric: Metric, operator: str) -> None:
    entry, new_q = _projection_query(
        metrics=[metric],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
    )
    ok, leftovers, mode = can_satisfy(entry, new_q)
    assert ok is True
    assert mode == ReuseMode.ROLLUP
    assert leftovers == set()


def test_projection_rolls_up_sum() -> None:
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
    )
    cached_df = pd.DataFrame(
        {"a": ["x", "x", "y", "y"], "b": [1, 2, 1, 2], "sum_x": [10, 20, 30, 40]}
    )
    cached = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select ...")],
        results=pa.Table.from_pandas(cached_df, preserve_index=False),
    )
    out = _apply_post_processing(cached, new_q, set(), ReuseMode.ROLLUP)
    out_df = out.results.to_pandas().sort_values("a").reset_index(drop=True)
    assert list(out_df["a"]) == ["x", "y"]
    assert list(out_df["sum_x"]) == [30, 70]


def test_projection_rolls_up_min_max_count() -> None:
    entry, new_q = _projection_query(
        metrics=[M_MIN, M_MAX, M_COUNT],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
    )
    cached_df = pd.DataFrame(
        {
            "a": ["x", "x", "y", "y"],
            "b": [1, 2, 1, 2],
            "min_x": [5, 2, 9, 8],
            "max_x": [50, 60, 70, 80],
            "count_x": [1, 1, 2, 3],
        }
    )
    cached = SemanticResult(
        requests=[],
        results=pa.Table.from_pandas(cached_df, preserve_index=False),
    )
    out = _apply_post_processing(cached, new_q, set(), ReuseMode.ROLLUP)
    df = out.results.to_pandas().sort_values("a").reset_index(drop=True)
    assert list(df["min_x"]) == [2, 8]
    assert list(df["max_x"]) == [60, 80]
    assert list(df["count_x"]) == [2, 5]


def test_projection_drops_multiple_dims() -> None:
    col_c = dim("col.c", "c")
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B, col_c],
    )
    cached_df = pd.DataFrame(
        {
            "a": ["x", "x", "x", "y"],
            "b": [1, 1, 2, 1],
            "c": [10, 20, 10, 10],
            "sum_x": [1, 2, 3, 4],
        }
    )
    cached = SemanticResult(
        requests=[], results=pa.Table.from_pandas(cached_df, preserve_index=False)
    )
    out = _apply_post_processing(cached, new_q, set(), ReuseMode.ROLLUP)
    df = out.results.to_pandas().sort_values("a").reset_index(drop=True)
    assert list(df["sum_x"]) == [6, 4]


def test_projection_with_leftover_filter_then_rollup() -> None:
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        new_filters={where(COL_B, Operator.GREATER_THAN, 1)},
    )
    cached_df = pd.DataFrame(
        {"a": ["x", "x", "y"], "b": [1, 2, 2], "sum_x": [10, 20, 30]}
    )
    cached = SemanticResult(
        requests=[], results=pa.Table.from_pandas(cached_df, preserve_index=False)
    )
    ok, leftovers, mode = can_satisfy(entry, new_q)
    assert ok is True
    assert mode == ReuseMode.ROLLUP
    out = _apply_post_processing(cached, new_q, leftovers, mode)
    df = out.results.to_pandas().sort_values("a").reset_index(drop=True)
    # b > 1 removes the (x,1) row; x sums to 20, y to 30
    assert list(df["sum_x"]) == [20, 30]


def test_projection_with_order_and_limit() -> None:
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        new_order=[(M_SUM, OrderDirection.DESC)],
        new_limit=1,
    )
    cached_df = pd.DataFrame(
        {"a": ["x", "x", "y"], "b": [1, 2, 1], "sum_x": [1, 2, 100]}
    )
    cached = SemanticResult(
        requests=[], results=pa.Table.from_pandas(cached_df, preserve_index=False)
    )
    out = _apply_post_processing(cached, new_q, set(), ReuseMode.ROLLUP)
    df = out.results.to_pandas()
    assert len(df) == 1
    assert df["a"].tolist() == ["y"]
    assert df["sum_x"].tolist() == [100]


def test_apply_post_processing_sorts_before_limit_for_non_projection() -> None:
    cached_df = pd.DataFrame({"a": ["x", "y", "z"], "x": [1.0, 100.0, 50.0]})
    cached = SemanticResult(
        requests=[],
        results=pa.Table.from_pandas(cached_df, preserve_index=False),
    )
    new_q = SemanticQuery(
        metrics=[M_X],
        dimensions=[COL_A],
        order=[(M_X, OrderDirection.DESC)],
        limit=2,
    )

    out = _apply_post_processing(cached, new_q, set(), ReuseMode.EXACT)
    df = out.results.to_pandas()
    assert df["x"].tolist() == [100.0, 50.0]


def test_projection_rejected_when_metric_aggregation_unknown() -> None:
    entry, new_q = _projection_query(
        metrics=[M_UNKNOWN],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


def test_projection_rejected_for_avg() -> None:
    entry, new_q = _projection_query(
        metrics=[M_AVG],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


def test_projection_with_cached_limit_defers_to_runtime_rowcount_check() -> None:
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        cached_limit=10,
    )
    ok, leftovers, mode = can_satisfy(entry, new_q)
    assert ok is True
    assert leftovers == set()
    assert mode == ReuseMode.ROLLUP


def test_projection_input_complete_unlimited_cached() -> None:
    entry = entry_from(
        SemanticQuery(metrics=[M_SUM], dimensions=[COL_A, COL_B], limit=None)
    )
    payload = SemanticResult(
        requests=[],
        results=pa.Table.from_pydict({"a": ["x"], "b": [1], "sum_x": [1.0]}),
    )
    assert _projection_input_complete(entry, payload) is True


def test_projection_input_complete_limited_cached_short_page() -> None:
    entry = entry_from(
        SemanticQuery(metrics=[M_SUM], dimensions=[COL_A, COL_B], limit=10)
    )
    payload = SemanticResult(
        requests=[],
        results=pa.Table.from_pydict(
            {
                "a": ["x", "y", "z"],
                "b": [1, 1, 1],
                "sum_x": [1.0, 2.0, 3.0],
            }
        ),
    )
    assert _projection_input_complete(entry, payload) is True


def test_projection_input_complete_limited_cached_full_page() -> None:
    entry = entry_from(
        SemanticQuery(metrics=[M_SUM], dimensions=[COL_A, COL_B], limit=3)
    )
    payload = SemanticResult(
        requests=[],
        results=pa.Table.from_pydict(
            {
                "a": ["x", "y", "z"],
                "b": [1, 1, 1],
                "sum_x": [1.0, 2.0, 3.0],
            }
        ),
    )
    assert _projection_input_complete(entry, payload) is False


def test_projection_rejected_when_cached_has_having() -> None:
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        cached_filters={having(M_SUM, Operator.GREATER_THAN, 10)},
        new_filters={having(M_SUM, Operator.GREATER_THAN, 10)},
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


def test_projection_rejected_when_new_query_has_group_limit() -> None:
    group_limit = GroupLimit(
        dimensions=[COL_A],
        top=2,
        metric=M_SUM,
        direction=OrderDirection.DESC,
    )
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        new_group_limit=group_limit,
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


def test_projection_rejected_when_order_references_dropped_dim() -> None:
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        new_order=[(COL_B, OrderDirection.ASC)],
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


def test_projection_rejected_when_cached_has_filter_on_dropped_dim() -> None:
    # cached restricts c; rolling up to [a] would miss rows we'd need
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A],
        cached_dimensions=[COL_A, COL_B],
        cached_filters={where(COL_B, Operator.GREATER_THAN, 5)},
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


def test_projection_rejected_when_cached_dims_subset_not_superset() -> None:
    # cached has just [a]; new wants [a, b] — finer-grained data unavailable
    entry, new_q = _projection_query(
        metrics=[M_SUM],
        new_dimensions=[COL_A, COL_B],
        cached_dimensions=[COL_A],
    )
    ok, _, _ = can_satisfy(entry, new_q)
    assert ok is False


# ---------------------------------------------------------------------------
# Metric-subset reuse
# ---------------------------------------------------------------------------


def test_can_satisfy_metric_subset_same_dims_is_project_mode() -> None:
    cached_q = SemanticQuery(metrics=[M_X, M_Y], dimensions=[COL_A])
    new_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A])
    ok, leftovers, mode = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert mode == ReuseMode.PROJECT
    assert leftovers == set()


def test_can_satisfy_metric_superset_fails() -> None:
    # cached has only M_X; new wants both — missing data
    cached_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A])
    new_q = SemanticQuery(metrics=[M_X, M_Y], dimensions=[COL_A])
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


def test_project_drops_extra_metric_column() -> None:
    new_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A])
    cached_df = pd.DataFrame({"a": ["p", "q"], "x": [1.0, 2.0], "y": [9.0, 8.0]})
    cached = SemanticResult(
        requests=[],
        results=pa.Table.from_pandas(cached_df, preserve_index=False),
    )
    out = _apply_post_processing(cached, new_q, set(), ReuseMode.PROJECT)
    df = out.results.to_pandas()
    assert list(df.columns) == ["a", "x"]
    assert df["x"].tolist() == [1.0, 2.0]
    assert any(req.type == "cache" for req in out.requests)


def test_project_does_not_require_additive_aggregation() -> None:
    # PROJECT preserves row granularity, so AVG (non-additive) is fine to keep
    # or drop — no re-aggregation happens.
    cached_q = SemanticQuery(metrics=[M_AVG, M_SUM], dimensions=[COL_A])
    new_q = SemanticQuery(metrics=[M_AVG], dimensions=[COL_A])
    ok, _, mode = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert mode == ReuseMode.PROJECT


def test_can_satisfy_metric_subset_with_rollup() -> None:
    # cached dims ⊃ new dims AND cached metrics ⊃ new metrics — still ROLLUP.
    cached_q = SemanticQuery(metrics=[M_SUM, M_MAX], dimensions=[COL_A, COL_B])
    new_q = SemanticQuery(metrics=[M_SUM], dimensions=[COL_A])
    ok, _, mode = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert mode == ReuseMode.ROLLUP


def test_project_with_smaller_limit_and_matching_order() -> None:
    order: list[OrderTuple] = [(M_X, OrderDirection.DESC)]
    cached_q = SemanticQuery(
        metrics=[M_X, M_Y], dimensions=[COL_A], limit=100, order=order
    )
    new_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A], limit=10, order=order)
    ok, _, mode = can_satisfy(entry_from(cached_q), new_q)
    assert ok is True
    assert mode == ReuseMode.PROJECT


def test_project_rejected_when_order_references_dropped_metric() -> None:
    # cached order is by M_Y; new query has no M_Y. order_key mismatch fails it.
    cached_q = SemanticQuery(
        metrics=[M_X, M_Y],
        dimensions=[COL_A],
        limit=100,
        order=[(M_Y, OrderDirection.DESC)],
    )
    new_q = SemanticQuery(metrics=[M_X], dimensions=[COL_A], limit=10)
    ok, _, _ = can_satisfy(entry_from(cached_q), new_q)
    assert ok is False


class _RacingCache:
    """In-memory cache that parks a designated thread inside its index read.

    Coordination harness for the concurrency regression tests below:
    ``parked`` is set (and the caller blocked on ``release``) the first time
    the designated ``park_thread`` reads an index-bucket key. In the
    store-vs-store test the parked thread is ALREADY HOLDING the index lock
    when it parks — which is why the other thread's failed ``add`` (see that
    method) is proof the fix is engaged rather than an inference from
    timing. Harness-level failures are recorded in ``harness_errors``
    (raising here would be swallowed by production code's defensive
    ``except Exception``).
    """

    def __init__(self, parked: threading.Event, release: threading.Event) -> None:
        self._store: dict[str, Any] = {}
        self._mutex = threading.Lock()
        self._parked_once = False
        self._parked = parked
        self._release = release
        self.park_thread: threading.Thread | None = None
        self.harness_errors: list[str] = []

    def _should_park(self, key: str) -> bool:
        return (
            key.startswith(cache_module.INDEX_KEY_PREFIX)
            and not key.endswith(":lock")
            and not self._parked_once
            and threading.current_thread() is self.park_thread
        )

    def get(self, key: str) -> Any:
        with self._mutex:
            should_park = self._should_park(key)
            if should_park:
                self._parked_once = True
            value = self._store.get(key)
        if should_park:
            self._parked.set()
            if not self._release.wait(timeout=10):
                self.harness_errors.append("parked thread was never released")
        return value

    def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
        with self._mutex:
            self._store[key] = value
        return True

    def add(self, key: str, value: Any, timeout: int | None = None) -> bool:
        with self._mutex:
            if key in self._store:
                taken = True
            else:
                self._store[key] = value
                taken = False
        if taken:
            # The caller is blocked on the index lock: the fix is engaged,
            # so it is safe to let the parked thread finish and release.
            self._release.set()
        return not taken

    def delete(self, key: str) -> bool:
        with self._mutex:
            return self._store.pop(key, None) is not None


def test_concurrent_store_results_do_not_clobber_index(
    app: Any,
    app_context: None,
    mocker: Any,
) -> None:
    """Deterministic regression for the index read-modify-write race.

    ``store_result`` reads the index bucket, appends its entry, and writes the
    bucket back. Unprotected, two concurrent writers for one view interleave
    as: A reads, B reads+writes, A writes A's STALE list — silently dropping
    B's entry (lost cache benefit on every subsequent narrower query).

    This test choreographs that exact interleaving with events (no timing
    dependence): thread A is parked inside its index read while thread B runs
    a full ``store_result`` for the same view, then A resumes. With the index
    lock, B blocks on the lock instead (the instrumented ``add`` releases A on
    B's first failed acquisition), A completes and releases, B appends — and
    BOTH entries survive. Without the lock this fails with only A's entry
    present.
    """
    # Generous retry budget so a starved CI runner can't push thread B past
    # its lock wait while A wakes up (attempts are resolved at call time).
    mocker.patch.object(cache_module, "_INDEX_LOCK_ATTEMPTS", 1000)

    a_parked = threading.Event()
    release_a = threading.Event()
    fake = _RacingCache(a_parked, release_a)
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )

    q_a = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    q_b = query(filters={where(COL_A, Operator.GREATER_THAN, 2)})
    errors: list[Exception] = []

    def worker_a() -> None:
        try:
            with app.app_context():
                store_result(VIEW, q_a, MagicMock())
        except Exception as ex:  # pragma: no cover - defensive
            errors.append(ex)
        finally:
            a_parked.set()  # never leave B waiting if A failed pre-park

    def worker_b() -> None:
        try:
            assert a_parked.wait(timeout=10), "thread A never parked"
            with app.app_context():
                store_result(VIEW, q_b, MagicMock())
        except Exception as ex:  # pragma: no cover - defensive
            errors.append(ex)
        finally:
            # Pre-fix path: B completes without ever touching the lock, so
            # release A here; post-fix this is a no-op (already released).
            release_a.set()

    t_a = threading.Thread(target=worker_a)
    t_b = threading.Thread(target=worker_b)
    fake.park_thread = t_a
    t_a.start()
    t_b.start()
    t_a.join(timeout=30)
    t_b.join(timeout=30)
    assert not t_a.is_alive(), "thread A deadlocked"
    assert not t_b.is_alive(), "thread B deadlocked"
    assert not errors, f"workers raised: {errors!r}"
    assert not fake.harness_errors, f"harness: {fake.harness_errors!r}"

    idx_key = shape_key(VIEW, q_a)
    final_entries = fake._store.get(idx_key) or []
    stored_value_keys = {e.value_key for e in final_entries}
    assert value_key(VIEW, q_a) in stored_value_keys, "A's entry lost"
    assert value_key(VIEW, q_b) in stored_value_keys, (
        "B's entry was clobbered by A's stale index write"
    )


def test_store_result_skips_index_write_when_lock_stays_busy(
    app_context: None,
    mocker: Any,
) -> None:
    """Pin the timeout-skip half of the locking invariant.

    When the lock cannot be acquired within the attempts budget, the index
    write must be SKIPPED — falling through to an unlocked write would
    reintroduce the clobber precisely under the contention that triggers
    the timeout. The lock here is held by "someone else" with a fresh
    (non-stale) token, so the stale-lock breaker must not fire either.
    """
    mocker.patch.object(cache_module, "_INDEX_LOCK_ATTEMPTS", 1)

    class BusyLockCache:
        """Cache whose index lock is permanently held by another owner."""

        def __init__(self) -> None:
            self._store: dict[str, Any] = {}
            self.foreign_token = f"someoneelse:{cache_module._time.time()}"
            self.deleted_keys: list[str] = []
            self.lock_add_timeouts: list[int | None] = []

        def get(self, key: str) -> Any:
            if key.endswith(":lock"):
                return self.foreign_token  # fresh: must not be broken as stale
            return self._store.get(key)

        def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
            self._store[key] = value
            return True

        def add(self, key: str, value: Any, timeout: int | None = None) -> bool:
            if key.endswith(":lock"):
                self.lock_add_timeouts.append(timeout)
            return False  # lock always busy

        def delete(self, key: str) -> bool:
            self.deleted_keys.append(key)
            return self._store.pop(key, None) is not None

    fake = BusyLockCache()
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )

    q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    store_result(VIEW, q, MagicMock())

    idx_key = shape_key(VIEW, q)
    assert idx_key not in fake._store, (
        "index was written without holding the lock (timeout must skip)"
    )
    # The value blob itself IS written (before the index registration) —
    # the documented orphan-until-TTL trade-off.
    assert value_key(VIEW, q) in fake._store
    # The foreign lock is FRESH, so the stale-lock breaker must not fire:
    # a breaker regression here would turn contention into a clobber vector.
    assert f"{idx_key}:lock" not in fake.deleted_keys, (
        "stale-lock breaker fired against a fresh foreign lock"
    )
    # Every lock acquisition attempt must carry the TTL — an add without
    # a timeout would make ordinary abandonment depend entirely on the
    # stale-breaker.
    assert fake.lock_add_timeouts, "no lock acquisition was attempted"
    assert all(t == cache_module._INDEX_LOCK_TIMEOUT for t in fake.lock_add_timeouts), (
        f"lock add() missing/wrong TTL: {fake.lock_add_timeouts!r}"
    )


def test_abandoned_ttlless_lock_is_broken(
    app_context: None,
    mocker: Any,
) -> None:
    """A lock left behind by a holder that died before its TTL applied
    (cachelib RedisCache.add is SETNX + separate EXPIRE) must be broken by
    the next writer instead of freezing the bucket's index updates forever.
    """

    class OrphanedLockCache:
        """The bucket's lock key pre-exists with a stale, TTL-less token."""

        def __init__(self, orphan_key: str) -> None:
            stale_age = (
                cache_module._INDEX_LOCK_TIMEOUT * cache_module._INDEX_LOCK_STALE_FACTOR
                + 1
            )
            self._store: dict[str, Any] = {
                orphan_key: f"deadowner:{cache_module._time.time() - stale_age}"
            }

        def get(self, key: str) -> Any:
            return self._store.get(key)

        def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
            self._store[key] = value
            return True

        def add(self, key: str, value: Any, timeout: int | None = None) -> bool:
            if key in self._store:
                return False
            self._store[key] = value
            return True

        def delete(self, key: str) -> bool:
            return self._store.pop(key, None) is not None

    q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    idx_key = shape_key(VIEW, q)
    fake = OrphanedLockCache(f"{idx_key}:lock")
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )

    store_result(VIEW, q, MagicMock())

    assert idx_key in fake._store, (
        "abandoned TTL-less lock was not broken; bucket index frozen"
    )


def test_concurrent_prune_does_not_clobber_store(
    app: Any,
    app_context: None,
    mocker: Any,
) -> None:
    """Deterministic regression for the prune half of the race.

    A reader that observed an evicted value prunes the index; unprotected
    (or if the prune filtered its PRE-LOCK snapshot instead of re-reading),
    a ``store_result`` landing between the reader's first index read and
    its prune write would be silently dropped. Choreography: reader R parks
    inside its FIRST (unlocked) index read; writer W then runs a full
    ``store_result`` for the same bucket; R resumes, observes the evicted
    entry, and prunes. The prune must re-read under the lock and keep W's
    entry while dropping only the dead one.
    """
    mocker.patch.object(cache_module, "_INDEX_LOCK_ATTEMPTS", 1000)

    r_parked = threading.Event()
    release_r = threading.Event()
    fake = _RacingCache(r_parked, release_r)
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )

    # Seed the bucket with one entry whose value is already evicted (its
    # value key is never stored), satisfiable by the reader's query.
    q_dead = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    dead_entry = entry_from(q_dead, value_key_="sv:val:evicted")
    idx_key = shape_key(VIEW, q_dead)
    fake._store[idx_key] = [dead_entry]

    q_new = query(filters={where(COL_A, Operator.GREATER_THAN, 2)})
    errors: list[Exception] = []

    def reader() -> None:
        try:
            with app.app_context():
                try_serve_from_cache(VIEW, q_dead)
        except Exception as ex:  # pragma: no cover - defensive
            errors.append(ex)
        finally:
            r_parked.set()

    def writer() -> None:
        try:
            assert r_parked.wait(timeout=10), "reader never parked"
            with app.app_context():
                store_result(VIEW, q_new, MagicMock())
        except Exception as ex:  # pragma: no cover - defensive
            errors.append(ex)
        finally:
            release_r.set()

    t_r = threading.Thread(target=reader)
    t_w = threading.Thread(target=writer)
    fake.park_thread = t_r
    t_r.start()
    t_w.start()
    t_r.join(timeout=30)
    t_w.join(timeout=30)
    assert not t_r.is_alive(), "reader deadlocked"
    assert not t_w.is_alive(), "writer deadlocked"
    assert not errors, f"workers raised: {errors!r}"
    assert not fake.harness_errors, f"harness: {fake.harness_errors!r}"

    final_keys = {e.value_key for e in fake._store.get(idx_key) or []}
    assert "sv:val:evicted" not in final_keys, "dead entry was not pruned"
    assert value_key(VIEW, q_new) in final_keys, (
        "prune clobbered the concurrently stored entry"
    )


def test_release_lock_declines_foreign_token() -> None:
    """Pin the release fence: a holder whose lock was broken and re-acquired
    by a successor must NOT delete the successor's fresh lock — the fencing
    is what stops a TTL-outliving holder from cascading the race."""

    class RecordingCache:
        def __init__(self) -> None:
            self._store: dict[str, Any] = {"bucket:lock": "successor:123.0"}
            self.deleted_keys: list[str] = []

        def get(self, key: str) -> Any:
            return self._store.get(key)

        def delete(self, key: str) -> bool:
            self.deleted_keys.append(key)
            return self._store.pop(key, None) is not None

    fake = RecordingCache()
    cache_module._release_index_lock(fake, "bucket:lock", "mine:456.0")
    assert fake.deleted_keys == [], "release deleted a lock it does not own"
    assert fake._store["bucket:lock"] == "successor:123.0"

    # Control: the owner's own release does delete.
    cache_module._release_index_lock(fake, "bucket:lock", "successor:123.0")
    assert fake.deleted_keys == ["bucket:lock"]


def test_clean_hit_reads_take_no_lock(
    app_context: None,
    mocker: Any,
) -> None:
    """Pin the lock-free clean-hit property: serving a cached result whose
    value is present must perform ZERO lock operations — the eviction gate
    exists precisely so the hottest path pays no synchronization tax."""

    class CountingCache:
        def __init__(self) -> None:
            self._store: dict[str, Any] = {}
            self.lock_ops = 0

        def get(self, key: str) -> Any:
            return self._store.get(key)

        def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
            self._store[key] = value
            return True

        def add(self, key: str, value: Any, timeout: int | None = None) -> bool:
            self.lock_ops += 1
            self._store.setdefault(key, value)
            return True

        def delete(self, key: str) -> bool:
            self.lock_ops += 1
            return self._store.pop(key, None) is not None

    fake = CountingCache()
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )

    q = query(filters={where(COL_A, Operator.GREATER_THAN, 1)})
    entry = entry_from(q, value_key_=value_key(VIEW, q))
    fake._store[shape_key(VIEW, q)] = [entry]
    fake._store[value_key(VIEW, q)] = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select 1")],
        results=pa.table({"a": [1]}),
    )

    result = try_serve_from_cache(VIEW, q)
    assert result is not None, "expected a clean cache hit"
    assert fake.lock_ops == 0, (
        f"clean hit performed {fake.lock_ops} lock operations; must be 0"
    )


@pytest.mark.parametrize(
    "raw,stale",
    [
        (f"abc123:{0.0}", True),  # ancient epoch
        ("abc123:nan", True),  # nan compares False vs any threshold: wedge
        ("abc123:inf", True),  # age = -inf would never exceed the threshold
        ("abc123:-inf", True),
        ("not-a-token", True),  # no parsable timestamp
        (b"bytes-value", True),  # non-string round-trip
        (None, True),
        ("abc123:not-a-float", True),
    ],
)
def test_lock_is_stale_edges(raw: Any, stale: bool) -> None:
    assert cache_module._lock_is_stale(raw) is stale


def test_lock_is_stale_boundary() -> None:
    """Fresh and exactly-at-threshold locks are NOT stale (strict >); one
    second past the threshold is."""
    now = cache_module._time.time()
    threshold = cache_module._INDEX_LOCK_TIMEOUT * cache_module._INDEX_LOCK_STALE_FACTOR
    assert cache_module._lock_is_stale(f"tok:{now}") is False
    assert cache_module._lock_is_stale(f"tok:{now - threshold + 1}") is False
    assert cache_module._lock_is_stale(f"tok:{now - threshold - 1}") is True
