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

"""Host mapping of catalog capabilities into separate grain operands."""

from dataclasses import replace
from datetime import datetime
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Dimension,
    DimensionSelection,
    Filter,
    Grain,
    GrainDefault,
    Grains,
    Metric,
    OrderDirection,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers import dimension_resolution as resolution
from superset.semantic_layers.mapper import (
    map_query_object,
    SemanticQueryInputError,
    ValidatedQueryObject,
)


class GrainView(SemanticView):
    """SDK-only fixture whose contextual support can differ from its catalog."""

    features: frozenset[SemanticViewFeature] = frozenset(
        {SemanticViewFeature.GROUP_LIMIT}
    )

    def __init__(self, dimension: Dimension) -> None:
        self.catalog: set[Dimension] = {dimension}
        self.contextual: set[Dimension] = self.catalog
        self.calls: int = 0

    def uid(self) -> str:
        return "grain-test"

    def get_dimensions(self) -> set[Dimension]:
        return self.catalog

    def get_metrics(self) -> set[Metric]:
        return set()

    def get_compatible_dimensions(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[DimensionSelection],
    ) -> set[Dimension]:
        self.calls += 1
        return self.contextual

    def get_compatible_metrics(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[DimensionSelection],
    ) -> set[Metric]:
        return set()

    def get_values(
        self, dimension: DimensionSelection, filters: set[Filter] | None = None
    ) -> SemanticResult:
        raise AssertionError("mapping must not execute")

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        raise AssertionError("mapping must not execute")

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        raise AssertionError("mapping must not execute")


def time_dimension() -> Dimension:
    """A single catalog field supports native, day and month operands."""
    return Dimension(
        "time-private",
        "event_time",
        pa.timestamp("us"),
        grains=frozenset({Grains.DAY, Grains.MONTH}),
    )


def datasource(view: GrainView) -> MagicMock:
    """Only the declared SDK interface is available on the implementation."""
    source: MagicMock = MagicMock()
    source.implementation = view
    source.fetch_values_predicate = None
    return source


def test_group_order_limit_and_raw_bounds_are_independent() -> None:
    dimension: Dimension = time_dimension()
    view: GrainView = GrainView(dimension)
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(view),
        columns=["event_time"],
        metrics=[],
        extras={"time_grain_sqla": "P1M"},
        from_dttm=datetime(2026, 1, 15),
        to_dttm=datetime(2026, 2, 1),
        orderby=[("event_time", True)],
        series_columns=["event_time"],
        series_limit=2,
    )
    mapped: SemanticQuery = map_query_object(query)[0]
    month: DimensionSelection = DimensionSelection(dimension, Grains.MONTH)
    assert mapped.dimensions == [month]
    assert mapped.order == [(month, OrderDirection.ASC)]
    assert mapped.group_limit is not None
    assert mapped.group_limit.dimensions == [month]
    assert {f.column for f in mapped.filters or set() if isinstance(f, Filter)} == {
        DimensionSelection(dimension)
    }
    assert {f.value for f in mapped.filters or set() if isinstance(f, Filter)} == {
        datetime(2026, 1, 15),
        datetime(2026, 2, 1),
    }
    assert view.calls == 1


def test_omitted_grouping_preserves_declared_day_and_implicit_filters() -> None:
    dimension: Dimension = replace(
        time_dimension(),
        allows_default_grain=False,
        omitted_grain=Grains.DAY,
        ungrained_filter=Grains.DAY,
    )
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(GrainView(dimension)),
        columns=["event_time"],
        metrics=[],
        filters=[{"col": "event_time", "op": "==", "val": "2026-01-20"}],
    )
    mapped: SemanticQuery = map_query_object(query)[0]
    assert mapped.dimensions == [DimensionSelection(dimension, Grains.DAY)]
    assert {f.column for f in mapped.filters or set() if isinstance(f, Filter)} == {
        DimensionSelection(dimension, Grains.DAY)
    }


def test_bucket_filter_is_independent_of_grouping() -> None:
    dimension: Dimension = time_dimension()
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(GrainView(dimension)),
        columns=["event_time"],
        metrics=[],
        extras={"time_grain_sqla": "P1D"},
        filters=[
            {"col": "event_time", "op": "==", "val": "2026-01-01", "grain": "P1M"}
        ],
    )
    mapped: SemanticQuery = map_query_object(query)[0]
    assert mapped.dimensions == [DimensionSelection(dimension, Grains.DAY)]
    assert {f.column for f in mapped.filters or set() if isinstance(f, Filter)} == {
        DimensionSelection(dimension, Grains.MONTH)
    }


def test_contextual_support_rejects_catalog_only_grain() -> None:
    dimension: Dimension = time_dimension()
    view: GrainView = GrainView(dimension)
    view.contextual = {replace(dimension, grains=frozenset({Grains.MONTH}))}
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(view),
        columns=["event_time"],
        metrics=[],
        extras={"time_grain_sqla": "P1D"},
    )
    with pytest.raises(QueryObjectValidationError, match="grain"):
        map_query_object(query)


def test_unused_rejected_default_does_not_block_categorical_query() -> None:
    categorical: Dimension = Dimension("category", "category", pa.string())
    rejected: Dimension = replace(
        time_dimension(),
        omitted_grain=GrainDefault.REJECT,
        ungrained_filter=GrainDefault.REJECT,
    )
    view: GrainView = GrainView(categorical)
    view.catalog = view.contextual = {categorical, rejected}
    mapped: SemanticQuery = map_query_object(
        ValidatedQueryObject(
            datasource=datasource(view),
            columns=["category"],
            metrics=[],
        )
    )[0]
    assert mapped.dimensions == [DimensionSelection(categorical)]


def test_metadata_does_not_resolve_omission_and_conflicts_always_reject() -> None:
    dimension: Dimension = replace(time_dimension(), omitted_grain=GrainDefault.REJECT)
    assert resolution.dimensions_by_name([dimension]) == {"event_time": dimension}
    conflict: Dimension = replace(dimension, id="other")
    with pytest.raises(QueryObjectValidationError, match="ambiguous"):
        resolution.dimensions_by_name([dimension, conflict])


def test_cache_identity_keeps_filter_grain_separate() -> None:
    from superset_core.semantic_layers.types import Operator, PredicateType

    from superset.semantic_layers.cache_identity import _canonical_filter

    dimension: Dimension = time_dimension()
    raw: Filter = Filter(
        PredicateType.WHERE,
        DimensionSelection(dimension),
        Operator.GREATER_THAN_OR_EQUAL,
        datetime(2026, 1, 15),
    )
    bucket: Filter = replace(raw, column=DimensionSelection(dimension, Grains.MONTH))
    assert _canonical_filter(raw) != _canonical_filter(bucket)


def test_dormant_table_grain_does_not_change_categorical_grouping() -> None:
    dimension: Dimension = Dimension("category-private", "category", pa.string())
    view: GrainView = GrainView(dimension)
    view.catalog = view.contextual = {dimension, time_dimension()}
    mapped: SemanticQuery = map_query_object(
        ValidatedQueryObject(
            datasource=datasource(view),
            columns=["category"],
            metrics=[],
            granularity="event_time",
            extras={"time_grain_sqla": "P1M"},
            from_dttm=datetime(2026, 1, 15),
            to_dttm=datetime(2026, 2, 1),
        )
    )[0]
    assert mapped.dimensions == [DimensionSelection(dimension)]
    assert all(
        isinstance(item, Filter)
        and isinstance(item.column, DimensionSelection)
        and item.column.grain is None
        for item in mapped.filters or set()
    )


def test_models_publish_one_catalog_field_and_use_implicit_value_default() -> None:
    from unittest.mock import patch
    from uuid import uuid4

    from superset.semantic_layers.models import SemanticView as HostView

    dimension: Dimension = replace(
        time_dimension(), omitted_grain=Grains.MONTH, ungrained_filter=Grains.DAY
    )
    view: GrainView = GrainView(dimension)
    host: HostView = HostView(uuid=uuid4())
    with patch.object(HostView, "_provider_dimensions", return_value={dimension}):
        assert host.column_names == ["event_time"]
        assert {grain["duration"] for grain in host.get_time_grains()} == {"P1D", "P1M"}
        assert host.columns[0].column_name == "event_time"
        with (
            patch.object(HostView, "implementation", view),
            patch.object(
                view,
                "get_values",
                return_value=SemanticResult(
                    requests=[],
                    results=pa.table({"event_time": [datetime(2026, 1, 1)]}),
                ),
            ) as values,
        ):
            host.values_for_column("event_time", 10)
        assert values.call_args.args[0] == DimensionSelection(dimension, Grains.DAY)


def test_context_cannot_silently_drop_raw_time_bounds() -> None:
    category: Dimension = Dimension("category", "category", pa.string())
    view: GrainView = GrainView(time_dimension())
    view.catalog = {category, time_dimension()}
    view.contextual = {category}
    with pytest.raises(QueryObjectValidationError, match="time column"):
        map_query_object(
            ValidatedQueryObject(
                datasource=datasource(view),
                columns=["category"],
                metrics=[],
                granularity="event_time",
                from_dttm=datetime(2026, 1, 15),
                to_dttm=datetime(2026, 2, 1),
            )
        )


def test_explicit_raw_filter_bypasses_legacy_implicit_bucket() -> None:
    dimension: Dimension = replace(time_dimension(), ungrained_filter=Grains.DAY)
    view: GrainView = GrainView(dimension)
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(view),
        columns=["event_time"],
        metrics=[],
        filters=[{"col": "event_time", "op": ">=", "val": "2026-01-15", "grain": None}],
    )
    mapped: SemanticQuery = map_query_object(query)[0]
    assert {
        leaf.column for leaf in mapped.filters or set() if isinstance(leaf, Filter)
    } == {DimensionSelection(dimension)}


def test_context_narrowing_never_silently_drops_a_dashboard_filter() -> None:
    category: Dimension = Dimension("category", "category", pa.string())
    region: Dimension = Dimension("region", "region", pa.string())
    view: GrainView = GrainView(category)
    view.catalog = {category, region}
    view.contextual = {category}
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(view),
        columns=["category"],
        metrics=[],
        filters=[{"col": "region", "op": "IN", "val": ["EMEA"], "isExtra": True}],
    )
    with pytest.raises(SemanticQueryInputError, match="not supported"):
        map_query_object(query)


@pytest.mark.parametrize("grain", ["1969-12-28T00:00:00Z/P1W", "", "nonsense"])
def test_unparseable_filter_grain_never_falls_back_to_native(grain: str) -> None:
    view: GrainView = GrainView(time_dimension())
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(view),
        columns=["event_time"],
        metrics=[],
        filters=[
            {"col": "event_time", "op": "==", "val": "2026-01-01", "grain": grain}
        ],
    )
    with pytest.raises(QueryObjectValidationError, match="grain"):
        map_query_object(query)


def test_aggregate_only_query_does_not_call_remote_compatibility() -> None:
    view: GrainView = GrainView(time_dimension())
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource(view),
        columns=[],
        metrics=[],
    )
    map_query_object(query)
    assert view.calls == 0


def test_query_selection_uses_provider_catalog_grain_instance() -> None:
    catalog_grain: Grain = Grain("Provider calendar month", "P1M")
    dimension: Dimension = replace(time_dimension(), grains=frozenset({catalog_grain}))
    selected: DimensionSelection = resolution.select_dimension(dimension, Grains.MONTH)
    assert selected.grain is catalog_grain
