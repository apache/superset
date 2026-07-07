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

from datetime import date, datetime, timedelta
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

from superset.semantic_layers.cache import (
    _apply_order,
    _apply_post_processing,
    _comparable,
    _group_limit_key,
    _implies,
    _mask_for,
    _projection_allowed,
    _projection_input_complete,
    _scalar_in_range,
    _sql_like_to_regex,
    _timeout,
    _value_to_jsonable,
    CachedEntry,
    can_satisfy,
    ReuseMode,
    shape_key,
    store_result,
    value_key,
    ViewMeta,
)
from superset.utils import json

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


# ---------------------------------------------------------------------------
# Coverage-gap closure (PR #41856): pairwise implication tables — the
# expected values encode SQL set-containment semantics, not implementation
# echoes; treat a mismatch as a containment bug
# ---------------------------------------------------------------------------

_D = dim("t.c")


def _w(op: Operator, value: Any) -> Filter:
    return where(_D, op, value)


@pytest.mark.parametrize(
    "new,cached,expected",
    [
        # cached IS_NULL (values differ so the equality early-return is dodged)
        (_w(Operator.IS_NULL, 0), _w(Operator.IS_NULL, None), True),
        (_w(Operator.EQUALS, None), _w(Operator.IS_NULL, None), True),
        (_w(Operator.EQUALS, 5), _w(Operator.IS_NULL, None), False),
        (_w(Operator.GREATER_THAN, 5), _w(Operator.IS_NULL, None), False),
        # cached IS_NOT_NULL
        (_w(Operator.IS_NOT_NULL, 0), _w(Operator.IS_NOT_NULL, None), True),
        (_w(Operator.EQUALS, 5), _w(Operator.IS_NOT_NULL, None), True),
        (_w(Operator.EQUALS, None), _w(Operator.IS_NOT_NULL, None), False),
        (_w(Operator.GREATER_THAN, 5), _w(Operator.IS_NOT_NULL, None), True),
        (
            _w(Operator.IN, frozenset({1, 2})),
            _w(Operator.IS_NOT_NULL, None),
            True,
        ),
        (
            _w(Operator.IN, frozenset({1, None})),
            _w(Operator.IS_NOT_NULL, None),
            False,
        ),
        (_w(Operator.LIKE, "a%"), _w(Operator.IS_NOT_NULL, None), False),
        # cached EQUALS
        (_w(Operator.IN, frozenset({5})), _w(Operator.EQUALS, 5), True),
        (_w(Operator.IN, frozenset({5, 6})), _w(Operator.EQUALS, 5), False),
        (_w(Operator.LIKE, "a%"), _w(Operator.EQUALS, 5), False),
        # cached NOT_EQUALS
        (_w(Operator.NOT_EQUALS, 6), _w(Operator.NOT_EQUALS, 5), False),
        (_w(Operator.EQUALS, 6), _w(Operator.NOT_EQUALS, 5), True),
        (_w(Operator.EQUALS, 5), _w(Operator.NOT_EQUALS, 5), False),
        (_w(Operator.IN, frozenset({6, 7})), _w(Operator.NOT_EQUALS, 5), True),
        (_w(Operator.IN, frozenset({5, 6})), _w(Operator.NOT_EQUALS, 5), False),
        (_w(Operator.GREATER_THAN, 1), _w(Operator.NOT_EQUALS, 5), False),
        # cached IN — non-set new op falls through
        (_w(Operator.LIKE, "a%"), _w(Operator.IN, frozenset({1, 2})), False),
        # cached NOT_IN
        (
            _w(Operator.NOT_IN, frozenset({1, 2, 3})),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            True,
        ),
        (
            _w(Operator.NOT_IN, frozenset({1})),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            False,
        ),
        (
            _w(Operator.NOT_EQUALS, 1),
            _w(Operator.NOT_IN, frozenset({1})),
            True,
        ),
        (
            _w(Operator.NOT_EQUALS, 1),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            False,
        ),
        (_w(Operator.EQUALS, 3), _w(Operator.NOT_IN, frozenset({1, 2})), True),
        (_w(Operator.EQUALS, 1), _w(Operator.NOT_IN, frozenset({1, 2})), False),
        (
            _w(Operator.IN, frozenset({3, 4})),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            True,
        ),
        (
            _w(Operator.IN, frozenset({2, 3})),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            False,
        ),
        (
            _w(Operator.GREATER_THAN, 0),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            False,
        ),
        # cached range: non-range/non-set/non-equals new ops fall through
        (_w(Operator.IS_NULL, None), _w(Operator.GREATER_THAN, 1), False),
        # incomparable values
        (_w(Operator.GREATER_THAN, "abc"), _w(Operator.GREATER_THAN, 5), False),
        # upper-bound combinations (cached LESS_THAN_OR_EQUAL)
        (
            _w(Operator.LESS_THAN, 5),
            _w(Operator.LESS_THAN_OR_EQUAL, 5),
            True,
        ),
        (
            _w(Operator.LESS_THAN_OR_EQUAL, 4),
            _w(Operator.LESS_THAN_OR_EQUAL, 5),
            True,
        ),
        (
            _w(Operator.LESS_THAN_OR_EQUAL, 6),
            _w(Operator.LESS_THAN_OR_EQUAL, 5),
            False,
        ),
        # looser new bounds must NOT be contained (a mutant returning True
        # here would serve silently truncated results)
        (_w(Operator.LESS_THAN, 15), _w(Operator.LESS_THAN, 10), False),
        (_w(Operator.LESS_THAN, 7), _w(Operator.LESS_THAN_OR_EQUAL, 5), False),
        # NULL-matching new predicates are never contained by negative
        # cached predicates (their SQL result sets contain no NULL rows)
        (_w(Operator.EQUALS, None), _w(Operator.NOT_EQUALS, 5), False),
        (
            _w(Operator.IN, frozenset({None, 3})),
            _w(Operator.NOT_EQUALS, 5),
            False,
        ),
        (_w(Operator.EQUALS, None), _w(Operator.NOT_IN, frozenset({1, 2})), False),
        (
            _w(Operator.IN, frozenset({3, None})),
            _w(Operator.NOT_IN, frozenset({1, 2})),
            False,
        ),
        # EQUALS vs range delegates to _scalar_in_range
        (_w(Operator.EQUALS, 3), _w(Operator.LESS_THAN, 5), True),
        (_w(Operator.EQUALS, 5), _w(Operator.LESS_THAN, 5), False),
        (_w(Operator.EQUALS, 5), _w(Operator.LESS_THAN_OR_EQUAL, 5), True),
        (_w(Operator.EQUALS, "x"), _w(Operator.GREATER_THAN, 1), False),
    ],
)
def test_implies_operator_matrix(new: Filter, cached: Filter, expected: bool) -> None:
    assert _implies(new, cached) is expected


def test_scalar_in_range_non_range_operator_returns_false() -> None:
    # Callers only pass range operators; the fallthrough guards direct misuse.
    assert _scalar_in_range(1, Operator.EQUALS, 1) is False


@pytest.mark.parametrize(
    "a,b,expected",
    [
        (None, 1, False),
        (1, None, False),
        (True, 1, False),
        (1, True, False),
        (True, False, True),
        (1, 2.5, True),
        ("a", "b", True),
        ("a", 1, False),
        (datetime(2026, 1, 1), datetime(2026, 1, 2), True),
        (date(2026, 1, 1), date(2026, 1, 2), True),
        (timedelta(days=1), timedelta(days=2), True),
        ((1, 2), (3, 4), True),  # same-type fallback
        ((1, 2), [3, 4], False),
    ],
)
def test_comparable_matrix(a: Any, b: Any, expected: bool) -> None:
    assert _comparable(a, b) is expected


# ---------------------------------------------------------------------------
# Coverage-gap closure: can_satisfy edges, keys, store trim, post-processing
# ---------------------------------------------------------------------------


def test_can_satisfy_column_less_where_filter_rejects() -> None:
    """A new WHERE predicate with no column (not ADHOC-typed) cannot become a
    leftover — it would be unapplicable to the cached DataFrame."""
    q_cached = query(filters=None)
    entry = entry_from(q_cached)
    columnless = Filter(
        type=PredicateType.WHERE,
        column=None,
        operator=Operator.EQUALS,
        value=1,
    )
    q_new = query(filters={columnless})
    ok, _, _ = can_satisfy(entry, q_new)
    assert ok is False


def test_can_satisfy_multiple_implied_filters_same_column() -> None:
    """Two new predicates on one column, both implied by the cached one —
    exercises the containment loop's continue edge."""
    cached_f = where(COL_A, Operator.GREATER_THAN, 5)
    tighter = where(COL_A, Operator.GREATER_THAN, 10)  # implies cached_f
    redundant = where(COL_A, Operator.GREATER_THAN, 3)  # implied BY cached_f
    q_cached = query(filters={cached_f})
    entry = entry_from(q_cached)
    q_new = query(filters={tighter, redundant})
    ok, leftovers, mode = can_satisfy(entry, q_new)
    assert ok is True
    assert mode == ReuseMode.EXACT
    # ``redundant`` is already guaranteed by the cached predicate, so only
    # the tighter filter needs local re-application.
    assert leftovers == {tighter}


def test_can_satisfy_rollup_order_on_dropped_dimension_rejects() -> None:
    """ROLLUP re-orders after aggregation; ordering by a dimension that does
    not survive the projection must reject the candidate."""
    dropped = dim("t.dropped")
    kept = dim("t.kept")
    m_sum = met("t.sum", aggregation=AggregationType.SUM)
    q_cached = query(dimensions=[kept, dropped], metrics=[m_sum])
    entry = entry_from(q_cached)
    q_new = query(
        dimensions=[kept],
        metrics=[m_sum],
        order=[(dropped, OrderDirection.ASC)],
    )
    ok, _, _ = can_satisfy(entry, q_new)
    assert ok is False


def test_projection_rejected_when_cached_entry_has_group_limit() -> None:
    import dataclasses

    m_sum = met("t.sum", aggregation=AggregationType.SUM)
    q_cached = query(dimensions=[COL_A, COL_B], metrics=[m_sum])
    entry = dataclasses.replace(entry_from(q_cached), group_limit_key="gl")
    q_new = query(dimensions=[COL_A], metrics=[m_sum])
    assert _projection_allowed(entry, q_new) is False


def test_store_result_trims_bucket_to_max_entries(mocker: Any) -> None:
    """The per-view bucket caps at MAX_ENTRIES_PER_VIEW, dropping the OLDEST
    entries first."""
    import dataclasses

    from superset.semantic_layers import cache as cache_module

    class PlainCache:
        def __init__(self) -> None:
            self._store: dict[str, Any] = {}

        def get(self, key: str) -> Any:
            return self._store.get(key)

        def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
            self._store[key] = value
            return True

        def delete(self, key: str) -> bool:
            return self._store.pop(key, None) is not None

    fake = PlainCache()
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )
    view = ViewMeta(uuid="trim", changed_on_iso="2026-01-01", cache_timeout=60)
    q = query(filters={_w(Operator.GREATER_THAN, -1)})
    idx_key = shape_key(view, q)
    now = cache_module._time.time()
    seeded = [
        dataclasses.replace(
            entry_from(query(filters={_w(Operator.GREATER_THAN, i)}), f"vk-{i}"),
            timestamp=now - 1000 + i,  # vk-0 is the oldest
        )
        for i in range(cache_module.MAX_ENTRIES_PER_VIEW)
    ]
    fake._store[idx_key] = list(seeded)

    store_result(view, q, MagicMock())

    entries = fake._store[idx_key]
    assert len(entries) == cache_module.MAX_ENTRIES_PER_VIEW
    keys = {e.value_key for e in entries}
    assert "vk-0" not in keys, "oldest entry should be trimmed first"
    assert value_key(view, q) in keys, "the new entry must survive the trim"


def test_value_to_jsonable_edges() -> None:
    assert _value_to_jsonable(frozenset({3, 1, 2})) == [1, 2, 3]
    assert _value_to_jsonable(datetime(2026, 1, 2, 3, 4)) == "2026-01-02T03:04:00"
    assert _value_to_jsonable(timedelta(minutes=2)) == 120.0
    assert _value_to_jsonable("plain") == "plain"


def test_group_limit_key_serializes_all_fields() -> None:
    from superset_core.semantic_layers.types import GroupLimit

    gl = GroupLimit(
        dimensions=[COL_B, COL_A],
        top=5,
        metric=M_X,
        direction=OrderDirection.DESC,
        group_others=True,
        filters={_w(Operator.GREATER_THAN, 1)},
    )
    key = json.loads(_group_limit_key(gl))
    assert key["top"] == 5
    assert key["metric"] == M_X.id
    assert key["dims"] == sorted([COL_A.id, COL_B.id])
    assert key["group_others"] is True
    assert len(key["filters"]) == 1
    # None metric branch
    gl_none = GroupLimit(dimensions=[COL_A], top=1, metric=None)
    assert json.loads(_group_limit_key(gl_none))["metric"] is None


def test_timeout_falls_back_to_data_cache_config(
    app_context: None, mocker: Any
) -> None:
    mocker.patch.dict(
        "superset.semantic_layers.cache.current_app.config",
        {"DATA_CACHE_CONFIG": {"CACHE_DEFAULT_TIMEOUT": 1234}},
    )
    assert _timeout(ViewMeta(uuid="v", changed_on_iso="", cache_timeout=None)) == 1234
    assert _timeout(ViewMeta(uuid="v", changed_on_iso="", cache_timeout=7)) == 7


# ---------------------------------------------------------------------------
# Coverage-gap closure: leftover masks, LIKE→regex, ordering, rollup edges
# ---------------------------------------------------------------------------


def _mask_df() -> pd.DataFrame:
    # Row 3 is NULL in both columns so every operator's NULL behaviour is
    # observable (SQL three-valued logic: NULLs never satisfy predicates,
    # positive or negative — only IS_NULL).
    return pd.DataFrame(
        {"a": [1.0, 2.0, None, 3.0], "s": ["alpha", "beta", "a.c", None]}
    )


@pytest.mark.parametrize(
    "op,val,column,expected_index",
    [
        (Operator.EQUALS, 1.0, "a", [0]),
        (Operator.EQUALS, None, "a", [2]),
        # SQL three-valued logic: NULLs are excluded from negative predicates
        (Operator.NOT_EQUALS, 1.0, "a", [1, 3]),
        (Operator.NOT_EQUALS, None, "a", [0, 1, 3]),
        (Operator.GREATER_THAN, 1.0, "a", [1, 3]),
        (Operator.GREATER_THAN_OR_EQUAL, 1.0, "a", [0, 1, 3]),
        (Operator.LESS_THAN, 2.0, "a", [0]),
        (Operator.LESS_THAN_OR_EQUAL, 2.0, "a", [0, 1]),
        (Operator.IN, frozenset({1.0, 2.0}), "a", [0, 1]),
        (Operator.IN, 1.0, "a", [0]),  # scalar IN
        # an IN list containing NULL still never matches NULL rows in SQL
        (Operator.IN, frozenset({"alpha", None}), "s", [0]),
        (Operator.NOT_IN, frozenset({1.0}), "a", [1, 3]),
        (Operator.IS_NULL, None, "a", [2]),
        (Operator.IS_NOT_NULL, None, "a", [0, 1, 3]),
        # NULLs never satisfy LIKE / NOT_LIKE (astype(str) would otherwise
        # stringify them into matchable "nan"/"None" sentinels)
        (Operator.LIKE, "a%", "s", [0, 2]),
        (Operator.LIKE, "a_c", "s", [2]),
        (Operator.LIKE, "N%", "s", []),
        (Operator.NOT_LIKE, "a%", "s", [1]),
        (Operator.ADHOC, "x", "a", [0, 1, 2, 3]),  # unknown op: no filtering
    ],
)
def test_mask_for_operator_matrix(
    op: Operator, val: Any, column: str, expected_index: list[int]
) -> None:
    col = Dimension(id=f"t.{column}", name=column, type=pa.utf8())
    f = Filter(type=PredicateType.WHERE, column=col, operator=op, value=val)
    df = _mask_df()
    mask = _mask_for(df, f)
    assert list(df[mask].index) == expected_index


def test_mask_for_column_less_filter_is_all_true() -> None:
    f = Filter(type=PredicateType.WHERE, column=None, operator=Operator.EQUALS, value=1)
    df = _mask_df()
    assert _mask_for(df, f).all()


@pytest.mark.parametrize(
    "pattern,matches,rejects",
    [
        ("100%", ["100", "100x", "100.55"], ["99", "x100"]),
        ("a_c", ["abc", "a.c"], ["ac", "abbc"]),
        ("a.c", ["a.c"], ["abc"]),  # regex metachars are literal
        ("50%*", ["50x*"], ["50x"]),  # '*' is literal, '%' wildcards
        ("a_c", ["a.c"], ["a.cd"]),  # end-anchored: no trailing extras
        ("100", ["100"], ["1000"]),
        # no escape support: backslash is a literal character, the % still
        # wildcards (see the divergence note in the docstring)
        ("50\\%", ["50\\anything"], ["50x"]),
    ],
)
def test_sql_like_to_regex(
    pattern: str, matches: list[str], rejects: list[str]
) -> None:
    """Pins the implemented translation: % → .*, _ → ., all else literal.

    Note: there is NO escape-character support — ``\\%`` is a literal
    backslash followed by a wildcard, which diverges from warehouses (e.g.
    PostgreSQL) that treat backslash as the default LIKE escape. Tracked as
    a finding on the parent PR; if escape support is added, extend this
    table rather than weakening it.
    """
    import re as _re

    rx = _re.compile(_sql_like_to_regex(pattern))
    for good in matches:
        assert rx.match(good), f"{pattern!r} should match {good!r}"
    for bad in rejects:
        assert not rx.match(bad), f"{pattern!r} should not match {bad!r}"


def test_apply_order_skips_unknown_columns_and_sorts_known() -> None:
    df = pd.DataFrame({"a": [2, 1, 3]})
    missing = dim("t.zz", "zz")
    present = dim("t.a", "a")
    # Only unknown columns: returned untouched.
    same = _apply_order(df, [(missing, OrderDirection.ASC)])
    assert list(same["a"]) == [2, 1, 3]
    # Unknown + known: unknown skipped, known sorts.
    ordered = _apply_order(
        df, [(missing, OrderDirection.ASC), (present, OrderDirection.ASC)]
    )
    assert list(ordered["a"]) == [1, 2, 3]


def test_rollup_skips_aggregation_less_metrics() -> None:
    """Direct post-processing call: a metric without an aggregation cannot be
    re-aggregated and is skipped rather than crashing the rollup."""
    table = pa.table({"a": ["x", "x", "y"], "m1": [1.0, 2.0, 3.0]})
    cached = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select ...")],
        results=table,
    )
    agg_metric = Metric(
        id="t.m1",
        name="m1",
        type=pa.float64(),
        definition="m1",
        aggregation=AggregationType.SUM,
    )
    agg_less = Metric(
        id="t.m2", name="m2", type=pa.float64(), definition="m2", aggregation=None
    )
    q = query(dimensions=[dim("t.a", "a")], metrics=[agg_metric, agg_less])
    result = _apply_post_processing(cached, q, set(), ReuseMode.ROLLUP)
    df = result.results.to_pandas()
    assert set(df.columns) >= {"a", "m1"}
    assert sorted(df["m1"].tolist()) == [3.0, 3.0]


def test_can_satisfy_group_limit_mismatch_rejects() -> None:
    """EXACT/PROJECT reuse requires the cached and new group-limit shapes to
    agree — a cached plain result cannot serve a group-limited query."""
    from superset_core.semantic_layers.types import GroupLimit

    q_cached = query(filters=None)
    entry = entry_from(q_cached)
    q_new = query(filters=None)
    q_new = SemanticQuery(
        metrics=q_new.metrics,
        dimensions=q_new.dimensions,
        group_limit=GroupLimit(dimensions=[COL_A], top=3, metric=None),
    )
    ok, _, _ = can_satisfy(entry, q_new)
    assert ok is False
