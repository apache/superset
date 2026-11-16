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

from dataclasses import FrozenInstanceError, replace
from datetime import date

import pyarrow as pa
import pytest
from superset_core.semantic_layers import types
from superset_core.semantic_layers.errors import SemanticQueryRejectedError

pytest_plugins: list[str] = ["superset_core.semantic_layers.testing"]


def test_catalog_support_is_separate_from_selected_grain() -> None:
    """Selections share one catalog member without mutating its capabilities."""
    dimension: types.Dimension = types.Dimension(
        "private-time",
        "occurred",
        pa.timestamp("us"),
        grains=frozenset({types.Grains.DAY, types.Grains.MONTH}),
    )
    day: types.DimensionSelection = types.DimensionSelection(
        dimension, types.Grains.DAY
    )
    month: types.DimensionSelection = types.DimensionSelection(
        dimension, types.Grains.MONTH
    )
    native: types.DimensionSelection = types.DimensionSelection(dimension)
    assert day.dimension is month.dimension is native.dimension is dimension
    assert day != month != native
    assert len({day, month, native}) == 3
    assert not isinstance(day, types.Dimension)
    assert not hasattr(dimension, "grain")
    assert dimension.grains == frozenset({types.Grains.DAY, types.Grains.MONTH})
    with pytest.raises(FrozenInstanceError):
        day.grain = types.Grains.MONTH  # type: ignore[misc]  # exercise frozen runtime guard


def test_native_default_is_not_an_implicit_day_selection() -> None:
    """A grain-only catalog preserves omission without admitting native default."""
    dimension: types.Dimension = types.Dimension(
        "private-time",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.DAY}),
        allows_default_grain=False,
        omitted_grain=types.Grains.DAY,
        ungrained_filter=types.Grains.DAY,
    )
    assert dimension.omitted_grain == types.Grains.DAY
    assert dimension.ungrained_filter == types.Grains.DAY
    assert (
        types.DimensionSelection(dimension, types.Grains.DAY).grain == types.Grains.DAY
    )
    with pytest.raises(SemanticQueryRejectedError):
        types.DimensionSelection(dimension)
    with pytest.raises(SemanticQueryRejectedError):
        types.DimensionSelection(dimension, types.Grains.MONTH)


def test_filter_default_is_independent_of_grouping_default() -> None:
    """Grouping at month need not turn raw bounds into month predicates."""
    dimension: types.Dimension = types.Dimension(
        "time",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.MONTH}),
        omitted_grain=types.Grains.MONTH,
    )
    assert dimension.ungrained_filter is types.GrainDefault.NATIVE
    assert types.DimensionSelection(dimension).grain is None
    assert (
        types.DimensionSelection(dimension, types.Grains.MONTH).grain
        == types.Grains.MONTH
    )


def test_unknown_explicit_support_is_not_unlimited() -> None:
    """An ordinary dimension permits native selection, not invented bucketing."""
    dimension: types.Dimension = types.Dimension("category", "category", pa.string())
    assert types.DimensionSelection(dimension).grain is None
    with pytest.raises(SemanticQueryRejectedError):
        types.DimensionSelection(dimension, types.Grains.MONTH)


def test_omission_may_reject_without_removing_explicit_support() -> None:
    """Reject is distinct from native and from an explicit supported grain."""
    dimension: types.Dimension = types.Dimension(
        "time",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.DAY}),
        allows_default_grain=False,
        omitted_grain=types.GrainDefault.REJECT,
        ungrained_filter=types.GrainDefault.REJECT,
    )
    assert dimension.omitted_grain is types.GrainDefault.REJECT
    assert (
        types.DimensionSelection(dimension, types.Grains.DAY).grain == types.Grains.DAY
    )


def test_invalid_declared_defaults_are_not_silently_substituted() -> None:
    """Catalog construction refuses a fallback outside its declared envelope."""
    with pytest.raises(ValueError, match="default"):
        types.Dimension("time", "occurred", pa.date32(), omitted_grain=types.Grains.DAY)
    with pytest.raises(ValueError, match="default"):
        types.Dimension("time", "occurred", pa.date32(), allows_default_grain=False)


def test_contextual_support_can_narrow_without_mutating_catalog() -> None:
    """A query-specific month-only result cannot grant catalog-wide daily support."""
    catalog: types.Dimension = types.Dimension(
        "time",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.DAY, types.Grains.MONTH}),
    )
    contextual: types.Dimension = replace(
        catalog, grains=frozenset({types.Grains.MONTH})
    )
    assert catalog.grains == frozenset({types.Grains.DAY, types.Grains.MONTH})
    assert (
        types.DimensionSelection(contextual, types.Grains.MONTH).dimension.name
        == "occurred"
    )
    with pytest.raises(SemanticQueryRejectedError):
        types.DimensionSelection(contextual, types.Grains.DAY)


def test_selection_presentation_does_not_change_identity() -> None:
    """Display labels do not partition identical grain selections."""
    first: types.Dimension = types.Dimension("id", "field", pa.date32())
    second: types.Dimension = replace(first, verbose_name="Translated label")
    assert types.DimensionSelection(first) == types.DimensionSelection(second)
    assert hash(types.DimensionSelection(first)) == hash(
        types.DimensionSelection(second)
    )


def test_catalog_rejects_duplicate_names_with_distinct_support(
    semantic_layer_registration: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A split capability set must not reintroduce catalog variants."""
    from example_provider import ExampleView
    from superset_core.semantic_layers.testing import SemanticProviderConformance

    view: ExampleView = ExampleView()
    day: types.Dimension = types.Dimension(
        "day-id",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.DAY}),
    )
    month: types.Dimension = types.Dimension(
        "month-id",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.MONTH}),
    )
    monkeypatch.setattr(view, "get_dimensions", lambda: {day, month})
    with pytest.raises(AssertionError, match="duplicate dimension selection names"):
        SemanticProviderConformance().test_catalog_identity(view, view)


@pytest.mark.parametrize("change", ["grains", "native", "grouping", "filter"])
def test_catalog_reload_detects_changed_grain_contract(
    semantic_layer_registration: None,
    monkeypatch: pytest.MonkeyPatch,
    change: str,
) -> None:
    """Stable names alone must not hide lost support or changed omission meaning."""
    from example_provider import ExampleView
    from superset_core.semantic_layers.testing import SemanticProviderConformance

    before: ExampleView = ExampleView()
    after: ExampleView = ExampleView()
    dimension: types.Dimension = types.Dimension(
        "id",
        "occurred",
        pa.date32(),
        grains=frozenset({types.Grains.DAY, types.Grains.MONTH}),
    )
    changed: types.Dimension
    if change == "grains":
        changed = replace(dimension, grains=frozenset({types.Grains.DAY}))
    elif change == "native":
        changed = replace(
            dimension,
            allows_default_grain=False,
            omitted_grain=types.GrainDefault.REJECT,
            ungrained_filter=types.GrainDefault.REJECT,
        )
    elif change == "grouping":
        changed = replace(dimension, omitted_grain=types.Grains.DAY)
    else:
        changed = replace(dimension, ungrained_filter=types.Grains.DAY)
    monkeypatch.setattr(before, "get_dimensions", lambda: {dimension})
    monkeypatch.setattr(after, "get_dimensions", lambda: {changed})
    with pytest.raises(AssertionError):
        SemanticProviderConformance().test_catalog_identity(before, after)


def test_selected_month_reaches_aggregation_with_independent_raw_bound(
    semantic_layer_registration: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unequal month sizes distinguish native aggregation from averaging buckets."""
    from conformance_provider import Backend, QueryView

    view: QueryView = QueryView(Backend())
    average: types.Metric = types.Metric(
        "avg",
        "average",
        pa.float64(),
        "AVG(amount)",
        aggregation=types.AggregationType.AVG,
    )
    monkeypatch.setattr(view, "get_metrics", lambda: {average})
    occurred: types.Dimension = next(
        d for d in view.get_dimensions() if d.name == "occurred"
    )
    month: types.DimensionSelection = types.DimensionSelection(
        occurred, types.Grains.MONTH
    )
    grouped: types.SemanticResult = view.get_table(
        types.SemanticQuery(
            [average],
            [month],
            order=[(month, types.OrderDirection.ASC)],
        )
    )
    assert grouped.results.to_pydict() == {
        "occurred": [date(2026, 1, 1), date(2026, 2, 1)],
        "average": [2.5, 5.0],
    }
    ungrouped: types.SemanticResult = view.get_table(types.SemanticQuery([average], []))
    assert ungrouped.results.column("average").to_pylist() == [25 / 6]
    assert 25 / 6 != (2.5 + 5) / 2
    bound: types.Filter = types.Filter(
        types.PredicateType.WHERE,
        types.DimensionSelection(occurred),
        types.Operator.GREATER_THAN_OR_EQUAL,
        date(2026, 2, 5),
    )
    filtered: types.SemanticResult = view.get_table(
        types.SemanticQuery([average], [month], filters={bound})
    )
    assert filtered.results.to_pydict() == {
        "occurred": [date(2026, 2, 1)],
        "average": [4.0],
    }


def test_example_refuses_bucket_filter_it_cannot_render(
    semantic_layer_registration: None,
) -> None:
    """An explicit bucket predicate must never run as a raw bound."""
    from conformance_provider import Backend, QueryView

    view: QueryView = QueryView(Backend())
    occurred: types.Dimension = next(
        d for d in view.get_dimensions() if d.name == "occurred"
    )
    month: types.DimensionSelection = types.DimensionSelection(
        occurred, types.Grains.MONTH
    )
    bound: types.Filter = types.Filter(
        types.PredicateType.WHERE,
        month,
        types.Operator.GREATER_THAN_OR_EQUAL,
        date(2026, 2, 5),
    )
    with pytest.raises(SemanticQueryRejectedError):
        view.get_table(types.SemanticQuery([], [month], filters={bound}))
