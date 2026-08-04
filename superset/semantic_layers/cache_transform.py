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

"""In-memory transformations for proven-compatible semantic cache results."""

from collections.abc import Callable

import pandas as pd
import pyarrow as pa
from superset_core.semantic_layers.types import (
    AggregationType,
    Filter,
    Operator,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers.cache_policy import compile_like_pattern
from superset.semantic_layers.cache_types import (
    ContainmentCapabilities,
    PatternSemantics,
    ReuseDecision,
    ReuseMode,
    ROLLUP_COMPATIBLE_AGGREGATIONS,
)


def _sql_sum(series: pd.Series) -> object:
    return series.sum(min_count=1)


_ROLLUP_AGGREGATIONS: dict[AggregationType, str | Callable[[pd.Series], object]] = {
    AggregationType.SUM: _sql_sum,
    AggregationType.COUNT: "sum",
    AggregationType.MIN: "min",
    AggregationType.MAX: "max",
}
assert frozenset(_ROLLUP_AGGREGATIONS) == ROLLUP_COMPATIBLE_AGGREGATIONS


class SemanticCacheTransformationError(RuntimeError):
    """Cached data cannot safely satisfy an otherwise eligible query."""


def _comparison_mask(
    series: pd.Series, operator: Operator, value: object
) -> pd.Series | None:
    if value is None:
        return pd.Series(False, index=series.index, dtype=bool)
    not_null: pd.Series = series.notna()
    comparisons: dict[Operator, Callable[[object], pd.Series]] = {
        Operator.EQUALS: series.eq,
        Operator.NOT_EQUALS: series.ne,
        Operator.GREATER_THAN: series.gt,
        Operator.GREATER_THAN_OR_EQUAL: series.ge,
        Operator.LESS_THAN: series.lt,
        Operator.LESS_THAN_OR_EQUAL: series.le,
    }
    comparison: Callable[[object], pd.Series] | None = comparisons.get(operator)
    return not_null & comparison(value) if comparison else None


def _membership_mask(
    series: pd.Series,
    operator: Operator,
    values: set[object] | frozenset[object] | tuple[object, ...],
) -> pd.Series:
    not_null: pd.Series = series.notna()
    non_null_values: list[object] = [item for item in values if item is not None]
    membership: pd.Series = not_null & series.isin(non_null_values)
    if operator is Operator.IN:
        return membership
    if None in values:
        return pd.Series(False, index=series.index, dtype=bool)
    return not_null & ~membership


def _pattern_mask(
    series: pd.Series,
    operator: Operator,
    pattern: str,
    semantics: PatternSemantics,
) -> pd.Series:
    not_null: pd.Series = series.notna()
    matches: pd.Series = not_null & series.astype("string").str.fullmatch(
        compile_like_pattern(pattern, semantics.escape), na=False
    )
    return matches if operator is Operator.LIKE else not_null & ~matches


def mask_for(
    series: pd.Series,
    operator: Operator,
    value: object,
    *,
    pattern_semantics: PatternSemantics | None = None,
) -> pd.Series:
    """Return a SQL-WHERE-compatible boolean mask for a pandas series."""
    if operator is Operator.IS_NULL:
        return series.isna()
    if operator is Operator.IS_NOT_NULL:
        return series.notna()
    comparison: pd.Series | None = _comparison_mask(series, operator, value)
    if comparison is not None:
        return comparison
    if operator in {Operator.IN, Operator.NOT_IN} and isinstance(
        value, (set, frozenset, tuple)
    ):
        return _membership_mask(series, operator, value)
    if (
        operator in {Operator.LIKE, Operator.NOT_LIKE}
        and isinstance(value, str)
        and pattern_semantics is not None
    ):
        return _pattern_mask(series, operator, value, pattern_semantics)
    raise ValueError(f"Unsupported cached filter operation: {operator.value}")


def _apply_leftovers(
    frame: pd.DataFrame,
    leftovers: frozenset[Filter],
    capabilities: ContainmentCapabilities,
) -> pd.DataFrame:
    transformed: pd.DataFrame = frame
    for filter_ in sorted(
        leftovers,
        key=lambda item: (
            item.column.id if item.column else "",
            item.operator.value,
        ),
    ):
        if filter_.column is None:
            raise ValueError("Cached post-processing requires a filter column")
        column_name: str = filter_.column.name
        transformed = transformed.loc[
            mask_for(
                transformed[column_name],
                filter_.operator,
                filter_.value,
                pattern_semantics=capabilities.pattern_semantics,
            )
        ]
    return transformed


def _rollup(frame: pd.DataFrame, query: SemanticQuery) -> pd.DataFrame:
    dimension_names: list[str] = [dimension.name for dimension in query.dimensions]
    aggregations: dict[str, str | Callable[[pd.Series], object]] = {}
    for metric in query.metrics:
        if metric.aggregation not in _ROLLUP_AGGREGATIONS:
            raise ValueError(f"Metric {metric.id} is not safely roll-up compatible")
        aggregations[metric.name] = _ROLLUP_AGGREGATIONS[metric.aggregation]
    if dimension_names:
        return frame.groupby(dimension_names, as_index=False, dropna=False).agg(
            aggregations
        )
    return frame.agg(aggregations).to_frame().T


def _project(frame: pd.DataFrame, query: SemanticQuery) -> pd.DataFrame:
    columns: list[str] = [
        *(dimension.name for dimension in query.dimensions),
        *(metric.name for metric in query.metrics),
    ]
    return frame.loc[:, columns]


def _slice(frame: pd.DataFrame, query: SemanticQuery) -> pd.DataFrame:
    offset: int = query.offset or 0
    stop: int | None = offset + query.limit if query.limit is not None else None
    return frame.iloc[offset:stop].reset_index(drop=True)


def transform_result(
    result: SemanticResult,
    query: SemanticQuery,
    decision: ReuseDecision,
    capabilities: ContainmentCapabilities,
) -> SemanticResult:
    """Transform a proven-compatible cached result to the requested result."""
    try:
        columns: list[str] = [
            *(dimension.name for dimension in query.dimensions),
            *(metric.name for metric in query.metrics),
        ]
        if decision.mode is not ReuseMode.ROLLUP and not decision.leftover_filters:
            offset: int = query.offset or 0
            length: int | None = query.limit
            table: pa.Table = result.results.select(columns).slice(offset, length)
            return SemanticResult(requests=result.requests, results=table)

        frame: pd.DataFrame = result.results.to_pandas()
        frame = _apply_leftovers(frame, decision.leftover_filters, capabilities)
        if decision.mode is ReuseMode.ROLLUP:
            frame = _rollup(frame, query)
        frame = _project(frame, query)
        frame = _slice(frame, query)
        return SemanticResult(
            requests=result.requests,
            results=pa.Table.from_pandas(frame, preserve_index=False),
        )
    except (KeyError, TypeError, ValueError, pa.ArrowException) as ex:
        raise SemanticCacheTransformationError(
            "Cached semantic result is incompatible with the requested transformation"
        ) from ex
