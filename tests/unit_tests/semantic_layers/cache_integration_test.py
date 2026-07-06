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

"""End-to-end test that exercises ``mapper.get_results`` with a live cache."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Metric,
    SemanticRequest,
    SemanticResult,
)

from superset.semantic_layers import cache as cache_module
from superset.semantic_layers.cache import ReuseMode
from superset.semantic_layers.mapper import get_results, ValidatedQueryObject


class _InMemoryCache:
    """Minimal flask-caching compatible cache used to isolate tests."""

    def __init__(self) -> None:
        self._store: dict[str, Any] = {}

    def get(self, key: str) -> Any:
        return self._store.get(key)

    def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
        self._store[key] = value
        return True

    def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None


@pytest.fixture
def fake_cache(mocker: MockerFixture) -> _InMemoryCache:
    fake = _InMemoryCache()
    mocker.patch.object(
        type(cache_module.cache_manager),
        "data_cache",
        property(lambda self: fake),
    )
    return fake


@pytest.fixture
def view_implementation() -> Any:
    """SemanticView implementation stub with one metric and one dimension."""
    dim_a = Dimension(id="t.a", name="a", type=pa.int64())
    metric_x = Metric(id="t.x", name="x", type=pa.float64(), definition="sum(x)")

    impl = MagicMock()
    impl.metrics = {metric_x}
    impl.dimensions = {dim_a}
    impl.features = frozenset()
    impl.get_metrics = MagicMock(return_value={metric_x})
    impl.get_dimensions = MagicMock(return_value={dim_a})
    return impl


@pytest.fixture
def datasource(view_implementation: Any) -> MagicMock:
    ds = MagicMock()
    ds.implementation = view_implementation
    ds.uuid = "view-uuid-stable"
    ds.changed_on = datetime(2026, 1, 1, 12, 0, 0)
    ds.cache_timeout = 60
    ds.fetch_values_predicate = None
    return ds


def _result(rows: list[tuple[int, float]]) -> SemanticResult:
    df = pd.DataFrame(rows, columns=["a", "x"])
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select a, x")],
        results=pa.Table.from_pandas(df, preserve_index=False),
    )


def _qo(
    datasource: MagicMock,
    filter_op: str | None = None,
    filter_val: Any = None,
    limit: int | None = None,
    force_query: bool = False,
) -> ValidatedQueryObject:
    qo_filters: list[dict[str, Any]] = (
        [{"col": "a", "op": filter_op, "val": filter_val}] if filter_op else []
    )
    return ValidatedQueryObject(
        datasource=datasource,
        metrics=["x"],
        columns=["a"],
        filters=qo_filters,  # type: ignore[arg-type]
        row_limit=limit,
        force_query=force_query,
    )


def test_narrower_filter_reuses_cache(
    fake_cache: _InMemoryCache,
    view_implementation: Any,
    datasource: MagicMock,
) -> None:
    # The dispatcher returns rows already filtered by `a > 1` (in production it
    # would; here we hand-feed the result). The second query (a > 2) is a subset
    # and must be served from the cached DataFrame.
    cached = _result([(2, 2.0), (3, 3.0), (5, 5.0)])
    view_implementation.get_table = MagicMock(return_value=cached)

    first = get_results(_qo(datasource, ">", 1))
    assert view_implementation.get_table.call_count == 1
    assert sorted(first.df["a"].tolist()) == [2, 3, 5]

    second = get_results(_qo(datasource, ">", 2))
    assert view_implementation.get_table.call_count == 1  # cache hit
    assert sorted(second.df["a"].tolist()) == [3, 5]


def test_narrower_filter_reuses_cache_when_values_are_strings(
    fake_cache: _InMemoryCache,
    view_implementation: Any,
    datasource: MagicMock,
) -> None:
    # Regression: QueryObject filters may provide numeric values as strings.
    # When the semantic dimension is numeric, mapper coercion should convert
    # these values so cache containment (`a >= 1984` subset of `a >= 1982`)
    # can be evaluated correctly.
    cached = _result([(1982, 2.0), (1984, 3.0), (1985, 5.0)])
    view_implementation.get_table = MagicMock(return_value=cached)

    first = get_results(_qo(datasource, ">=", "1982"))
    assert view_implementation.get_table.call_count == 1
    assert sorted(first.df["a"].tolist()) == [1982, 1984, 1985]

    second = get_results(_qo(datasource, ">=", "1984"))
    assert view_implementation.get_table.call_count == 1  # cache hit
    assert sorted(second.df["a"].tolist()) == [1984, 1985]


def test_smaller_limit_reuses_cache(
    fake_cache: _InMemoryCache,
    view_implementation: Any,
    datasource: MagicMock,
) -> None:
    # First call has no limit; second asks for 2 rows — should be served from cache.
    full = _result([(0, 1.0), (1, 2.0), (2, 3.0), (3, 4.0)])
    view_implementation.get_table = MagicMock(return_value=full)

    get_results(_qo(datasource, limit=None))
    assert view_implementation.get_table.call_count == 1

    result = get_results(_qo(datasource, limit=2))
    assert view_implementation.get_table.call_count == 1  # cache hit
    assert len(result.df) == 2


def test_broader_filter_misses_cache(
    fake_cache: _InMemoryCache,
    view_implementation: Any,
    datasource: MagicMock,
) -> None:
    view_implementation.get_table = MagicMock(
        side_effect=[
            _result([(2, 1.0), (3, 2.0)]),
            _result([(0, 1.0), (2, 2.0), (3, 3.0)]),
        ]
    )

    get_results(_qo(datasource, ">", 1))
    assert view_implementation.get_table.call_count == 1

    # Broader filter — must re-execute.
    get_results(_qo(datasource, ">", 0))
    assert view_implementation.get_table.call_count == 2


def test_changed_on_invalidates_cache(
    fake_cache: _InMemoryCache,
    view_implementation: Any,
    datasource: MagicMock,
) -> None:
    view_implementation.get_table = MagicMock(return_value=_result([(2, 1.0)]))

    get_results(_qo(datasource, ">", 1))
    assert view_implementation.get_table.call_count == 1

    # Bumping changed_on yields a different shape key — cache misses.
    datasource.changed_on = datetime(2026, 2, 1, 0, 0, 0)
    get_results(_qo(datasource, ">", 1))
    assert view_implementation.get_table.call_count == 2


def test_force_query_bypasses_semantic_cache_read_but_stores_fresh_result(
    fake_cache: _InMemoryCache,
    view_implementation: Any,
    datasource: MagicMock,
) -> None:
    """A forced query must skip the cache READ (fresh execution) but still
    STORE its result — otherwise the stale entry survives the refresh and
    other requests' containment lookups keep serving it until TTL."""
    view_implementation.get_table = MagicMock(return_value=_result([(2, 1.0)]))

    get_results(_qo(datasource, ">", 1))
    assert view_implementation.get_table.call_count == 1

    view_implementation.get_table = MagicMock(return_value=_result([(2, 99.0)]))
    get_results(_qo(datasource, ">", 1, force_query=True))
    assert view_implementation.get_table.call_count == 1  # forced: re-executed

    # The forced refresh must have REPLACED the cached entry: a subsequent
    # ordinary request is served from cache (no new execution) and sees the
    # refreshed value, not the stale one.
    result = get_results(_qo(datasource, ">", 1))
    assert view_implementation.get_table.call_count == 1
    assert result.df["x"].tolist() == [99.0]


# ---------------------------------------------------------------------------
# Projection (v2) — dropping a dimension and re-aggregating
# ---------------------------------------------------------------------------


def _make_view(metric_aggregation: AggregationType | None) -> tuple[Any, MagicMock]:
    dim_b = Dimension(id="t.b", name="b", type=pa.utf8())
    dim_c = Dimension(id="t.c", name="c", type=pa.utf8())
    metric_x = Metric(
        id="t.x",
        name="x",
        type=pa.float64(),
        definition="sum(x)",
        aggregation=metric_aggregation,
    )
    impl = MagicMock()
    impl.metrics = {metric_x}
    impl.dimensions = {dim_b, dim_c}
    impl.features = frozenset()
    impl.get_metrics = MagicMock(return_value={metric_x})
    impl.get_dimensions = MagicMock(return_value={dim_b, dim_c})

    ds = MagicMock()
    ds.implementation = impl
    ds.uuid = "proj-view"
    ds.changed_on = datetime(2026, 3, 1, 0, 0, 0)
    ds.cache_timeout = 60
    ds.fetch_values_predicate = None
    return impl, ds


def _qo_dims(ds: MagicMock, columns: list[str]) -> ValidatedQueryObject:
    return ValidatedQueryObject(
        datasource=ds,
        metrics=["x"],
        columns=columns,  # type: ignore[arg-type]
        filters=[],
    )


def _result_bc(rows: list[tuple[str, str, float]]) -> SemanticResult:
    df = pd.DataFrame(rows, columns=["b", "c", "x"])
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select b,c,sum(x)")],
        results=pa.Table.from_pandas(df, preserve_index=False),
    )


def _result_b(rows: list[tuple[str, float]]) -> SemanticResult:
    df = pd.DataFrame(rows, columns=["b", "x"])
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select b,sum(x)")],
        results=pa.Table.from_pandas(df, preserve_index=False),
    )


def test_projection_reuses_cached_for_dropped_dim(
    fake_cache: _InMemoryCache,
) -> None:
    impl, ds = _make_view(AggregationType.SUM)
    impl.get_table = MagicMock(
        return_value=_result_bc(
            [("b1", "c1", 5.0), ("b1", "c2", 3.0), ("b2", "c1", 4.0)]
        )
    )

    first = get_results(_qo_dims(ds, ["b", "c"]))
    assert impl.get_table.call_count == 1
    assert len(first.df) == 3

    second = get_results(_qo_dims(ds, ["b"]))
    assert impl.get_table.call_count == 1  # served via projection
    df = second.df.sort_values("b").reset_index(drop=True)
    assert df["b"].tolist() == ["b1", "b2"]
    assert df["x"].tolist() == [8.0, 4.0]


def test_projection_skipped_when_aggregation_unknown(
    fake_cache: _InMemoryCache,
) -> None:
    impl, ds = _make_view(None)  # metric has no aggregation declared
    impl.get_table = MagicMock(
        side_effect=[
            _result_bc([("b1", "c1", 5.0), ("b1", "c2", 3.0)]),
            _result_bc([("b1", "c1", 5.0)]),  # what the SV would compute for [b]
        ]
    )

    get_results(_qo_dims(ds, ["b", "c"]))
    assert impl.get_table.call_count == 1

    get_results(_qo_dims(ds, ["b"]))
    assert impl.get_table.call_count == 2  # cannot project, re-executed


def test_projection_skipped_for_avg(
    fake_cache: _InMemoryCache,
) -> None:
    impl, ds = _make_view(AggregationType.AVG)
    impl.get_table = MagicMock(
        side_effect=[
            _result_bc([("b1", "c1", 5.0), ("b1", "c2", 3.0)]),
            _result_bc([("b1", "c1", 4.0)]),
        ]
    )

    get_results(_qo_dims(ds, ["b", "c"]))
    get_results(_qo_dims(ds, ["b"]))
    assert impl.get_table.call_count == 2


def test_projection_reuses_when_cached_limit_not_reached(
    fake_cache: _InMemoryCache,
) -> None:
    impl, ds = _make_view(AggregationType.SUM)
    impl.get_table = MagicMock(
        return_value=_result_bc(
            [("b1", "c1", 5.0), ("b1", "c2", 3.0), ("b2", "c1", 4.0)]
        )
    )

    first = get_results(_qo_dims(ds, ["b", "c"]))
    assert impl.get_table.call_count == 1
    assert len(first.df) == 3

    second = get_results(_qo_dims(ds, ["b"]))
    assert impl.get_table.call_count == 1  # served via projection
    df = second.df.sort_values("b").reset_index(drop=True)
    assert df["b"].tolist() == ["b1", "b2"]
    assert df["x"].tolist() == [8.0, 4.0]


def test_projection_skips_when_cached_limit_reached(
    fake_cache: _InMemoryCache,
) -> None:
    impl, ds = _make_view(AggregationType.SUM)

    first_q = _qo_dims(ds, ["b", "c"])
    first_q.row_limit = 3
    second_q = _qo_dims(ds, ["b"])

    impl.get_table = MagicMock(
        side_effect=[
            _result_bc([("b1", "c1", 5.0), ("b1", "c2", 3.0), ("b2", "c1", 4.0)]),
            _result_bc([("b1", "c1", 8.0), ("b2", "c1", 4.0)]),
        ]
    )

    get_results(first_q)
    assert impl.get_table.call_count == 1

    get_results(second_q)
    assert impl.get_table.call_count == 2  # projection skipped; re-executed


# ---------------------------------------------------------------------------
# Metric-subset reuse
# ---------------------------------------------------------------------------


def _make_view_two_metrics() -> tuple[Any, MagicMock]:
    dim_a = Dimension(id="t.a", name="a", type=pa.utf8())
    metric_x = Metric(
        id="t.x",
        name="x",
        type=pa.float64(),
        definition="sum(x)",
        aggregation=AggregationType.SUM,
    )
    metric_y = Metric(
        id="t.y",
        name="y",
        type=pa.float64(),
        definition="sum(y)",
        aggregation=AggregationType.SUM,
    )
    impl = MagicMock()
    impl.metrics = {metric_x, metric_y}
    impl.dimensions = {dim_a}
    impl.features = frozenset()
    impl.get_metrics = MagicMock(return_value={metric_x, metric_y})
    impl.get_dimensions = MagicMock(return_value={dim_a})

    ds = MagicMock()
    ds.implementation = impl
    ds.uuid = "two-metric-view"
    ds.changed_on = datetime(2026, 4, 1, 0, 0, 0)
    ds.cache_timeout = 60
    ds.fetch_values_predicate = None
    return impl, ds


def _qo_metrics(ds: MagicMock, metrics: list[str]) -> ValidatedQueryObject:
    return ValidatedQueryObject(
        datasource=ds,
        metrics=metrics,  # type: ignore[arg-type]
        columns=["a"],
        filters=[],
    )


def _result_a_xy(rows: list[tuple[str, float, float]]) -> SemanticResult:
    df = pd.DataFrame(rows, columns=["a", "x", "y"])
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="select a, x, y")],
        results=pa.Table.from_pandas(df, preserve_index=False),
    )


def test_metric_subset_reuses_cached(
    fake_cache: _InMemoryCache,
) -> None:
    # First query asks for both metrics; second asks for one — served via
    # PROJECT (drop the extra metric column).
    impl, ds = _make_view_two_metrics()
    impl.get_table = MagicMock(
        return_value=_result_a_xy([("p", 1.0, 10.0), ("q", 2.0, 20.0)])
    )

    first = get_results(_qo_metrics(ds, ["x", "y"]))
    assert impl.get_table.call_count == 1
    assert sorted(first.df.columns.tolist()) == ["a", "x", "y"]

    second = get_results(_qo_metrics(ds, ["x"]))
    assert impl.get_table.call_count == 1  # cache hit via PROJECT
    df = second.df.sort_values("a").reset_index(drop=True)
    assert df["a"].tolist() == ["p", "q"]
    assert df["x"].tolist() == [1.0, 2.0]
    assert "y" not in df.columns


def test_metric_superset_misses_cache(
    fake_cache: _InMemoryCache,
) -> None:
    # First query is narrower; second needs a metric we never fetched — miss.
    impl, ds = _make_view_two_metrics()
    impl.get_table = MagicMock(
        side_effect=[
            _result_a_xy([("p", 1.0, 0.0), ("q", 2.0, 0.0)]),
            _result_a_xy([("p", 1.0, 10.0), ("q", 2.0, 20.0)]),
        ]
    )

    get_results(_qo_metrics(ds, ["x"]))
    assert impl.get_table.call_count == 1

    get_results(_qo_metrics(ds, ["x", "y"]))
    assert impl.get_table.call_count == 2  # cached entry lacked "y"


# ---------------------------------------------------------------------------
# Candidate preference: EXACT > PROJECT > ROLLUP
# ---------------------------------------------------------------------------


def test_serve_prefers_exact_over_rollup(
    fake_cache: _InMemoryCache,
    mocker: MockerFixture,
) -> None:
    # Seed the bucket with two cache misses: querying [b] first, then [b, c]
    # — neither satisfies the other, so both are stored. A subsequent [b] call
    # can be served by both, but must pick the EXACT entry.
    impl, ds = _make_view(AggregationType.SUM)
    impl.get_table = MagicMock(
        side_effect=[
            _result_b([("b1", 8.0), ("b2", 4.0)]),
            _result_bc([("b1", "c1", 5.0), ("b1", "c2", 3.0), ("b2", "c1", 4.0)]),
        ]
    )

    get_results(_qo_dims(ds, ["b"]))
    get_results(_qo_dims(ds, ["b", "c"]))
    assert impl.get_table.call_count == 2

    spy = mocker.spy(cache_module, "_apply_post_processing")
    get_results(_qo_dims(ds, ["b"]))
    assert impl.get_table.call_count == 2  # cache hit
    assert spy.call_count == 1
    assert spy.call_args.args[3] == ReuseMode.EXACT


def test_serve_falls_back_to_rollup_when_exact_value_evicted(
    fake_cache: _InMemoryCache,
    mocker: MockerFixture,
) -> None:
    impl, ds = _make_view(AggregationType.SUM)
    impl.get_table = MagicMock(
        side_effect=[
            _result_b([("b1", 8.0), ("b2", 4.0)]),
            _result_bc([("b1", "c1", 5.0), ("b1", "c2", 3.0), ("b2", "c1", 4.0)]),
        ]
    )

    get_results(_qo_dims(ds, ["b"]))
    get_results(_qo_dims(ds, ["b", "c"]))

    # Evict the [b] value (stored first); the [b, c] rollup candidate remains.
    val_keys = [k for k in fake_cache._store if k.startswith("sv:val:")]
    del fake_cache._store[val_keys[0]]

    spy = mocker.spy(cache_module, "_apply_post_processing")
    get_results(_qo_dims(ds, ["b"]))
    assert impl.get_table.call_count == 2  # cache hit via fallback
    assert spy.call_count == 1
    assert spy.call_args.args[3] == ReuseMode.ROLLUP
