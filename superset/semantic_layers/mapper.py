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

"""
Functions for mapping `QueryObject` to semantic layers.

These functions validate and convert a `QueryObject` into one or more `SemanticQuery`,
which are then passed to semantic layer implementations for execution, returning a
single dataframe.

"""

from datetime import date, datetime, time, timedelta, tzinfo
from time import time as current_time
from typing import Any, cast, Sequence, TypeGuard
from zoneinfo import ZoneInfo

import isodate
import numpy as np
import pyarrow as pa
from superset_core.semantic_layers.types import (
    AdhocExpression,
    Dimension,
    Filter,
    FilterValues,
    Grain,
    Grains,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticViewFeature

from superset.common.db_query_status import QueryStatus
from superset.common.query_object import QueryObject
from superset.common.utils.time_range_utils import (
    get_since_until_from_query_object,
    get_since_until_from_time_range,
)
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import NO_TIME_RANGE
from superset.models.helpers import QueryResult
from superset.result_set import stringify_extension_columns
from superset.superset_typing import AdhocColumn
from superset.utils.core import (
    FilterOperator,
    QueryObjectFilterClause,
    TIME_COMPARISON,
)
from superset.utils.date_parser import get_past_or_future


class ValidatedQueryObjectFilterClause(QueryObjectFilterClause):
    """
    A validated QueryObject filter clause with a string column name.

    The `col` in a `QueryObjectFilterClause` can be either a string (column name) or an
    adhoc column, but we only support the former in semantic layers.
    """

    # overwrite to narrow type; mypy complains about more restrictive typed dicts,
    # but the alternative would be to redefine the object
    col: str  # type: ignore[misc]
    op: str  # type: ignore[misc]


class ValidatedQueryObject(QueryObject):
    """
    A query object that has a datasource defined.
    """

    datasource: BaseDatasource

    # overwrite to narrow type; mypy complains about the assignment since the base type
    # allows adhoc filters, but we only support validated filters here
    filter: list[ValidatedQueryObjectFilterClause]  # type: ignore[assignment]
    series_columns: Sequence[str]  # type: ignore[assignment]
    series_limit_metric: str | None


def get_results(query_object: QueryObject) -> QueryResult:
    """
    Run 1+ queries based on `QueryObject` and return the results.

    :param query_object: The QueryObject containing query specifications
    :return: QueryResult compatible with Superset's query interface
    """
    if not validate_query_object(query_object):
        raise ValueError("QueryObject must have a datasource defined.")

    # Track execution time
    start_time = current_time()

    semantic_view = query_object.datasource.implementation
    dispatcher = (
        semantic_view.get_row_count
        if query_object.is_rowcount
        else semantic_view.get_table
    )

    # Step 1: Convert QueryObject to list of SemanticQuery objects
    # The first query is the main query, subsequent queries are for time offsets
    queries = map_query_object(query_object)

    # Step 2: Execute the main query (first in the list)
    main_query = queries[0]
    main_result = dispatcher(main_query)
    main_result = _coerce_empty_result(main_result, main_query)

    main_df = stringify_extension_columns(main_result.results).to_pandas()

    # Collect all requests (SQL queries, HTTP requests, etc.) for troubleshooting
    all_requests = list(main_result.requests)

    # If no time offsets, return the main result as-is
    if not query_object.time_offsets or len(queries) <= 1:
        duration = timedelta(seconds=current_time() - start_time)
        return map_semantic_result_to_query_result(
            main_result,
            query_object,
            duration,
        )

    # Get metric names from the main query
    # These are the columns that will be renamed with offset suffixes
    metric_names = [metric.name for metric in main_query.metrics]

    # Join keys are all columns except metrics
    # These will be used to match rows between main and offset DataFrames
    join_keys = [col for col in main_df.columns if col not in metric_names]

    # Step 3 & 4: Execute each time offset query and join results
    for offset_query, time_offset in zip(
        queries[1:],
        query_object.time_offsets,
        strict=False,
    ):
        # Execute the offset query
        result = dispatcher(offset_query)
        result = _coerce_empty_result(result, offset_query)

        # Add this query's requests to the collection
        all_requests.extend(result.requests)

        offset_df = stringify_extension_columns(result.results).to_pandas()

        # Handle empty results - add NaN columns directly instead of merging
        # This avoids dtype mismatch issues with empty DataFrames
        if offset_df.empty:
            # Add offset metric columns with NaN values directly to main_df
            for metric in metric_names:
                offset_col_name = TIME_COMPARISON.join([metric, time_offset])
                main_df[offset_col_name] = np.nan
        elif not join_keys:
            # No dimensions to join on — this is an aggregate-only query
            # (e.g. ``metrics: ["Orders Count"]`` with empty ``columns``),
            # which produces a single-row DataFrame. ``pandas.merge`` on an
            # empty ``on=`` list crashes with ``IndexError`` deep in the
            # join-indexer code, so we lift the offset metric values from
            # the first row of ``offset_df`` straight onto ``main_df``.
            for metric in metric_names:
                offset_col_name = TIME_COMPARISON.join([metric, time_offset])
                main_df[offset_col_name] = (
                    offset_df[metric].iloc[0] if metric in offset_df else np.nan
                )
        else:
            # Rename metric columns with time offset suffix
            # Format: "{metric_name}__{time_offset}"
            # Example: "revenue" -> "revenue__1 week ago"
            offset_df = offset_df.rename(
                columns={
                    metric: TIME_COMPARISON.join([metric, time_offset])
                    for metric in metric_names
                }
            )

            # Step 5: Perform left join on dimension columns
            # This preserves all rows from main_df and adds offset metrics
            # where they match
            main_df = main_df.merge(
                offset_df,
                on=join_keys,
                how="left",
                suffixes=("", "__duplicate"),
            )

            # Clean up any duplicate columns that might have been created
            # (shouldn't happen with proper join keys, but defensive programming)
            duplicate_cols = [
                col for col in main_df.columns if col.endswith("__duplicate")
            ]
            if duplicate_cols:
                main_df = main_df.drop(columns=duplicate_cols)

    # Convert final result to QueryResult
    semantic_result = SemanticResult(
        requests=all_requests,
        results=pa.Table.from_pandas(main_df),
    )
    duration = timedelta(seconds=current_time() - start_time)
    return map_semantic_result_to_query_result(
        semantic_result,
        query_object,
        duration,
    )


def _coerce_empty_result(
    semantic_result: SemanticResult,
    query: SemanticQuery,
) -> SemanticResult:
    """
    Guard against ``SemanticResult.results is None``.

    Some semantic-layer driver implementations return ``None`` when a query
    produces zero rows (for example, ``snowflake.connector``'s
    ``fetch_arrow_all`` does this). Downstream consumers expect an Arrow table,
    so build an empty one with the columns implied by the query's dimensions
    and metrics.
    """
    if semantic_result.results is not None:
        return semantic_result

    columns = {
        **{dim.name: pa.array([], type=dim.type) for dim in query.dimensions},
        **{metric.name: pa.array([], type=metric.type) for metric in query.metrics},
    }
    return SemanticResult(
        requests=semantic_result.requests,
        results=pa.table(columns),
    )


def map_semantic_result_to_query_result(
    semantic_result: SemanticResult,
    query_object: ValidatedQueryObject,
    duration: timedelta,
) -> QueryResult:
    """
    Convert a SemanticResult to a QueryResult.

    :param semantic_result: Result from the semantic layer
    :param query_object: Original QueryObject (for passthrough attributes)
    :param duration: Time taken to execute the query
    :return: QueryResult compatible with Superset's query interface
    """
    # Get the query string from requests (typically one or more SQL queries)
    query_str = ""
    if semantic_result.requests:
        # Join all requests for display (could be multiple for time comparisons)
        query_str = "\n\n".join(
            f"-- {req.type}\n{req.definition}" for req in semantic_result.requests
        )

    return QueryResult(
        # Core data
        df=stringify_extension_columns(semantic_result.results).to_pandas(),
        query=query_str,
        duration=duration,
        # Template filters - not applicable to semantic layers
        # (semantic layers don't use Jinja templates)
        applied_template_filters=None,
        # Filter columns - not applicable to semantic layers
        # (semantic layers handle filter validation internally)
        applied_filter_columns=None,
        rejected_filter_columns=None,
        # Status - always success if we got here
        # (errors would raise exceptions before reaching this point)
        status=QueryStatus.SUCCESS,
        error_message=None,
        errors=None,
        # Time range - pass through from original query_object
        from_dttm=query_object.from_dttm,
        to_dttm=query_object.to_dttm,
    )


def _normalize_column(column: str | AdhocColumn, dimension_names: set[str]) -> str:
    """
    Normalize a column to its dimension name.

    Columns can be either:
    - A string (dimension name directly)
    - An AdhocColumn with isColumnReference=True and sqlExpression containing the
      dimension name
    """
    if isinstance(column, str):
        return column

    # Handle column references (e.g., from time-series charts)
    if column.get("isColumnReference") and (sql_expr := column.get("sqlExpression")):
        if sql_expr in dimension_names:
            return sql_expr

    raise ValueError("Adhoc dimensions are not supported in Semantic Views.")


def map_query_object(query_object: ValidatedQueryObject) -> list[SemanticQuery]:
    """
    Convert a `QueryObject` into a list of `SemanticQuery`.

    This function maps the `QueryObject` into query objects that focus less on
    visualization and more on semantics.
    """
    semantic_view = query_object.datasource.implementation

    all_metrics = {metric.name: metric for metric in semantic_view.metrics}
    all_dimensions = {
        dimension.name: dimension for dimension in semantic_view.dimensions
    }

    # Normalize columns (may be dicts with isColumnReference=True for time-series)
    dimension_names = set(all_dimensions.keys())
    normalized_columns = {
        _normalize_column(column, dimension_names) for column in query_object.columns
    }

    metrics = [all_metrics[metric] for metric in (query_object.metrics or [])]

    grain = _convert_time_grain(query_object.extras.get("time_grain_sqla"))
    time_axis_column = _get_grain_time_axis_column(query_object, all_dimensions)
    # A semantic view can expose multiple Dimension variants per name (one per
    # supported time grain). Pick exactly one variant per selected column:
    # for the time-axis column we honor the user's grain selection, falling
    # back to the raw / no-grain variant when no exact match exists and then
    # to any available variant so the axis is never silently dropped; for
    # every other selected column we prefer the raw variant and otherwise
    # take any available variant.
    dimensions: list[Dimension] = []
    seen_non_axis: dict[str, Dimension] = {}
    axis_variants: list[Dimension] = []
    axis_match: Dimension | None = None
    for dimension in semantic_view.dimensions:
        if dimension.name not in normalized_columns:
            continue
        if dimension.name == time_axis_column:
            axis_variants.append(dimension)
            if axis_match is None and dimension.grain == grain:
                axis_match = dimension
            continue
        existing = seen_non_axis.get(dimension.name)
        if existing is None or (existing.grain is not None and dimension.grain is None):
            seen_non_axis[dimension.name] = dimension

    if axis_match is not None:
        dimensions.append(axis_match)
    elif axis_variants:
        # No variant matches the requested grain. Prefer the raw (grain=None)
        # variant; otherwise pick a deterministic fallback so the axis stays
        # on the query instead of being silently dropped.
        raw_variant = next((v for v in axis_variants if v.grain is None), None)
        dimensions.append(
            raw_variant
            if raw_variant is not None
            else min(axis_variants, key=lambda v: v.grain.name if v.grain else "")
        )
    dimensions.extend(seen_non_axis.values())

    order = _get_order_from_query_object(query_object, all_metrics, all_dimensions)
    limit = query_object.row_limit
    offset = query_object.row_offset

    group_limit = _get_group_limit_from_query_object(
        query_object,
        all_metrics,
        all_dimensions,
    )

    queries = []
    for time_offset in [None] + query_object.time_offsets:
        filters = _get_filters_from_query_object(
            query_object,
            time_offset,
            all_dimensions,
        )
        queries.append(
            SemanticQuery(
                metrics=metrics,
                dimensions=dimensions,
                filters=filters,
                order=order,
                limit=limit,
                offset=offset,
                group_limit=group_limit,
            )
        )

    return queries


def _get_filters_from_query_object(
    query_object: ValidatedQueryObject,
    time_offset: str | None,
    all_dimensions: dict[str, Dimension],
) -> set[Filter]:
    """
    Extract all filters from the query object, including time range filters.

    This simplifies the complexity of from_dttm/to_dttm/inner_from_dttm/inner_to_dttm
    by converting all time constraints into filters.
    """
    filters: set[Filter] = set()

    # 1. Add fetch values predicate if present
    if (
        query_object.apply_fetch_values_predicate
        and query_object.datasource.fetch_values_predicate
    ):
        filters.add(
            Filter(
                type=PredicateType.WHERE,
                column=None,
                operator=Operator.ADHOC,
                value=query_object.datasource.fetch_values_predicate,
            )
        )

    # 2. Add time range filter based on from_dttm/to_dttm
    # For time offsets, this automatically calculates the shifted bounds
    time_filters = _get_time_filter(query_object, time_offset, all_dimensions)
    filters.update(time_filters)

    # 3. Add filters from query_object.extras (WHERE and HAVING clauses)
    extras_filters = _get_filters_from_extras(query_object.extras)
    filters.update(extras_filters)

    # 4. Add all other filters from query_object.filter.
    # ``TEMPORAL_RANGE`` filters are skipped only when ``_get_time_filter``
    # actually emitted bounds — that path takes over both the base range and
    # the ``time_offset`` shift, so pass-through would duplicate the bounds
    # (or, worse, ship the un-shifted literal bounds into the offset query).
    # When it did not emit anything (e.g. an open-ended range like
    # ``"2020-01-01 : "``, where ``_get_time_filter`` requires both
    # ``from_dttm`` and ``to_dttm``), we fall through to
    # ``_convert_query_object_filter``'s TEMPORAL_RANGE handler so the one-
    # sided predicate still lands on the query instead of silently widening
    # the scan.
    time_bounds_emitted = bool(time_filters)
    for filter_ in query_object.filter:
        if (
            filter_.get("op") == FilterOperator.TEMPORAL_RANGE.value
            and time_bounds_emitted
        ):
            continue

        if converted_filters := _convert_query_object_filter(filter_, all_dimensions):
            filters.update(converted_filters)

    return filters


def _get_filters_from_extras(extras: dict[str, Any]) -> set[Filter]:
    """
    Extract filters from the extras dict.

    The extras dict can contain various keys that affect query behavior:

    Supported keys (converted to filters):
    - "where": SQL WHERE clause expression (e.g., "customer_id > 100")
    - "having": SQL HAVING clause expression (e.g., "SUM(sales) > 1000")

    Other keys in extras (handled elsewhere in the mapper):
    - "time_grain_sqla": Time granularity (e.g., "P1D", "PT1H")
      Handled in _convert_time_grain() and used for dimension grain matching

    Note: The WHERE and HAVING clauses from extras are SQL expressions that
    are passed through as-is to the semantic layer as adhoc Filter objects.
    """
    filters: set[Filter] = set()

    # Add WHERE clause from extras
    if where_clause := extras.get("where"):
        filters.add(
            Filter(
                type=PredicateType.WHERE,
                column=None,
                operator=Operator.ADHOC,
                value=where_clause,
            )
        )

    # Add HAVING clause from extras
    if having_clause := extras.get("having"):
        filters.add(
            Filter(
                type=PredicateType.HAVING,
                column=None,
                operator=Operator.ADHOC,
                value=having_clause,
            )
        )

    return filters


def _get_time_axis_column(
    query_object: ValidatedQueryObject,
    all_dimensions: dict[str, Dimension],
) -> str | None:
    """
    Determine which selected column is the time-axis (the one a time offset
    applies to).

    Legacy time-series charts encode this as ``query_object.granularity``.
    Modern x-axis charts leave that empty and put the temporal column in
    ``query_object.columns`` instead. Aggregate-only charts that just use a
    ``TEMPORAL_RANGE`` adhoc filter (e.g. for time comparisons) carry the
    temporal column only in ``query_object.filter``; we fall back to that so
    the offset-aware filter path can still find a column to shift.
    """
    if query_object.granularity:
        return query_object.granularity

    dimension_names = set(all_dimensions.keys())

    def is_temporal(name: str) -> bool:
        dim = all_dimensions.get(name)
        return dim is not None and (
            pa.types.is_timestamp(dim.type)
            or pa.types.is_date(dim.type)
            or pa.types.is_time(dim.type)
        )

    for column in query_object.columns or []:
        try:
            name = _normalize_column(column, dimension_names)
        except ValueError:
            continue
        if is_temporal(name):
            return name

    # Last resort: a TEMPORAL_RANGE filter (the shape produced by adhoc
    # time-range filters on aggregate-only charts) carries the temporal
    # column name in its ``col`` field.
    for filter_ in query_object.filter or []:
        if filter_.get("op") != FilterOperator.TEMPORAL_RANGE.value:
            continue
        col = filter_.get("col")
        if isinstance(col, str) and is_temporal(col):
            return col

    return None


def _get_time_filter(
    query_object: ValidatedQueryObject,
    time_offset: str | None,
    all_dimensions: dict[str, Dimension],
) -> set[Filter]:
    """
    Create a time range filter from the query object.

    This handles both regular queries and time offset queries, simplifying the
    complexity of from_dttm/to_dttm/inner_from_dttm/inner_to_dttm by using the
    same time bounds for both the main query and series limit subqueries.

    The time column is resolved via ``_get_time_axis_column`` so that
    aggregate-only charts that only reference the temporal column inside a
    ``TEMPORAL_RANGE`` adhoc filter still get offset-aware bounds applied.
    """
    filters: set[Filter] = set()

    time_axis_column = _get_time_axis_column(query_object, all_dimensions)
    if not time_axis_column:
        return filters

    time_dimension = all_dimensions.get(time_axis_column)
    if not time_dimension:
        return filters

    # Get the appropriate time bounds based on whether this is a time offset query
    from_dttm, to_dttm = _get_time_bounds(query_object, time_offset)

    if not from_dttm or not to_dttm:
        return filters

    # Create a filter with >= and < operators
    return {
        Filter(
            type=PredicateType.WHERE,
            column=time_dimension,
            operator=Operator.GREATER_THAN_OR_EQUAL,
            value=from_dttm,
        ),
        Filter(
            type=PredicateType.WHERE,
            column=time_dimension,
            operator=Operator.LESS_THAN,
            value=to_dttm,
        ),
    }


def _get_time_bounds(
    query_object: ValidatedQueryObject,
    time_offset: str | None,
) -> tuple[datetime | None, datetime | None]:
    """
    Get the appropriate time bounds for the query.

    For regular queries (time_offset is None), returns from_dttm/to_dttm.
    For time offset queries, calculates the shifted bounds.

    This simplifies the inner_from_dttm/inner_to_dttm complexity by using
    the same bounds for both main queries and series limit subqueries (Option 1).
    """
    if time_offset is None:
        # Main query: use from_dttm/to_dttm directly
        return query_object.from_dttm, query_object.to_dttm

    # Time offset query: calculate shifted bounds
    # Use from_dttm/to_dttm if available, otherwise try to get from time_range
    outer_from = query_object.from_dttm
    outer_to = query_object.to_dttm

    if not outer_from or not outer_to:
        # Fall back to parsing time_range if from_dttm/to_dttm not set
        outer_from, outer_to = get_since_until_from_query_object(query_object)

    if not outer_from or not outer_to:
        return None, None

    # Apply the offset to both bounds
    offset_from = get_past_or_future(time_offset, outer_from)
    offset_to = get_past_or_future(time_offset, outer_to)

    return offset_from, offset_to


def _convert_query_object_filter(
    filter_: ValidatedQueryObjectFilterClause,
    all_dimensions: dict[str, Dimension],
) -> set[Filter] | None:
    """
    Convert a QueryObject filter dict to a semantic layer Filter.
    """
    operator_str = filter_["op"]

    # Handle simple column filters
    col = filter_.get("col")
    if col not in all_dimensions:
        return None

    dimension = all_dimensions[col]

    val_str = filter_["val"]
    value: FilterValues | frozenset[FilterValues]
    if val_str is None:
        value = None
    elif isinstance(val_str, (list, tuple)):
        value = frozenset(val_str)
    else:
        value = val_str

    # Special case for temporal range
    if operator_str == FilterOperator.TEMPORAL_RANGE.value:
        if not isinstance(value, str) or value == NO_TIME_RANGE:
            return None
        start, end = get_since_until_from_time_range(time_range=value)
        filters: set[Filter] = set()
        if start is not None:
            filters.add(
                Filter(
                    type=PredicateType.WHERE,
                    column=dimension,
                    operator=Operator.GREATER_THAN_OR_EQUAL,
                    value=_coerce_scalar_filter_value(start, dimension),
                )
            )
        if end is not None:
            filters.add(
                Filter(
                    type=PredicateType.WHERE,
                    column=dimension,
                    operator=Operator.LESS_THAN,
                    value=_coerce_scalar_filter_value(end, dimension),
                )
            )
        return filters or None

    value = _coerce_filter_value(value, dimension)

    # Map QueryObject operators to semantic layer operators. The Operator enum
    # exposes only LIKE (case-sensitive), so case-insensitive variants are
    # rejected up front rather than silently collapsed: doing so leaves the
    # actual case handling at the mercy of the semantic backend's collation
    # and silently diverges from the operator the dashboard author chose.
    if operator_str in {
        FilterOperator.ILIKE.value,
        FilterOperator.NOT_ILIKE.value,
    }:
        raise ValueError(
            f"Operator {operator_str} (case-insensitive match) is not supported "
            "by Semantic Views; use the case-sensitive LIKE/NOT_LIKE instead."
        )

    operator_mapping = {
        FilterOperator.EQUALS.value: Operator.EQUALS,
        FilterOperator.NOT_EQUALS.value: Operator.NOT_EQUALS,
        FilterOperator.GREATER_THAN.value: Operator.GREATER_THAN,
        FilterOperator.LESS_THAN.value: Operator.LESS_THAN,
        FilterOperator.GREATER_THAN_OR_EQUALS.value: Operator.GREATER_THAN_OR_EQUAL,
        FilterOperator.LESS_THAN_OR_EQUALS.value: Operator.LESS_THAN_OR_EQUAL,
        FilterOperator.IN.value: Operator.IN,
        FilterOperator.NOT_IN.value: Operator.NOT_IN,
        FilterOperator.LIKE.value: Operator.LIKE,
        FilterOperator.NOT_LIKE.value: Operator.NOT_LIKE,
        FilterOperator.IS_NULL.value: Operator.IS_NULL,
        FilterOperator.IS_NOT_NULL.value: Operator.IS_NOT_NULL,
    }

    operator = operator_mapping.get(operator_str)
    if not operator:
        # Unknown operator - raise error to prevent unauthorized access
        raise ValueError(f"Unsupported filter operator: {operator_str}")

    return {
        Filter(
            type=PredicateType.WHERE,
            column=dimension,
            operator=operator,
            value=value,
        )
    }


def _coerce_filter_value(
    value: FilterValues | frozenset[FilterValues],
    dimension: Dimension,
) -> FilterValues | frozenset[FilterValues]:
    if isinstance(value, frozenset):
        return frozenset(_coerce_scalar_filter_value(v, dimension) for v in value)
    return _coerce_scalar_filter_value(value, dimension)


def _timestamp_target_tz(dtype: pa.DataType) -> tzinfo | None:
    tz_name = getattr(dtype, "tz", None)
    return ZoneInfo(tz_name) if tz_name else None


def _align_tz(dt: datetime, target_tz: tzinfo | None) -> datetime:
    if target_tz is None:
        return dt
    if dt.tzinfo is None:
        return dt.replace(tzinfo=target_tz)
    return dt.astimezone(target_tz)


def _coerce_scalar_filter_value(  # noqa: C901 — type dispatch, complexity is inherent
    value: FilterValues, dimension: Dimension
) -> FilterValues:
    if value is None:
        return None

    dtype = dimension.type

    if pa.types.is_boolean(dtype):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)) and value in (0, 1):
            return bool(value)
        if isinstance(value, str):
            parsed = value.strip().lower()
            if parsed in {"true", "t", "1", "yes", "y", "on"}:
                return True
            if parsed in {"false", "f", "0", "no", "n", "off"}:
                return False
        raise ValueError(
            f"Invalid boolean value {value!r} for filter column {dimension.name}"
        )

    if pa.types.is_integer(dtype):
        if isinstance(value, bool):
            raise ValueError(
                f"Invalid integer value {value!r} for filter column {dimension.name}"
            )
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            try:
                return int(value.strip())
            except ValueError as ex:
                raise ValueError(
                    f"Invalid integer value {value!r} for filter column "
                    f"{dimension.name}"
                ) from ex
        raise ValueError(
            f"Invalid integer value {value!r} for filter column {dimension.name}"
        )

    if pa.types.is_floating(dtype) or pa.types.is_decimal(dtype):
        # Decimal dimensions are coerced through ``float`` because ``FilterValues``
        # does not include ``Decimal``. That is lossless for the common case
        # (≤ ~15 significant digits) and matches how downstream semantic-view
        # implementations consume numeric filters; high-precision decimals would
        # need a wider ``FilterValues`` union and propagation through the cache's
        # comparability checks.
        if isinstance(value, bool):
            raise ValueError(
                f"Invalid numeric value {value!r} for filter column {dimension.name}"
            )
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.strip())
            except ValueError as ex:
                raise ValueError(
                    f"Invalid numeric value {value!r} for filter column "
                    f"{dimension.name}"
                ) from ex
        raise ValueError(
            f"Invalid numeric value {value!r} for filter column {dimension.name}"
        )

    if pa.types.is_date(dtype):
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.strip()).date()
            except ValueError as ex:
                raise ValueError(
                    f"Invalid date value {value!r} for filter column {dimension.name}"
                ) from ex
        raise ValueError(
            f"Invalid date value {value!r} for filter column {dimension.name}"
        )

    if pa.types.is_timestamp(dtype):
        target_tz = _timestamp_target_tz(dtype)
        if isinstance(value, datetime):
            return _align_tz(value, target_tz)
        if isinstance(value, date):
            return _align_tz(datetime.combine(value, time.min), target_tz)
        if isinstance(value, str):
            normalized = value.strip().replace("Z", "+00:00")
            try:
                return _align_tz(datetime.fromisoformat(normalized), target_tz)
            except ValueError as ex:
                raise ValueError(
                    f"Invalid timestamp value {value!r} for filter column "
                    f"{dimension.name}"
                ) from ex
        raise ValueError(
            f"Invalid timestamp value {value!r} for filter column {dimension.name}"
        )

    if pa.types.is_time(dtype):
        if isinstance(value, time):
            return value
        if isinstance(value, str):
            try:
                return time.fromisoformat(value.strip())
            except ValueError as ex:
                raise ValueError(
                    f"Invalid time value {value!r} for filter column {dimension.name}"
                ) from ex
        raise ValueError(
            f"Invalid time value {value!r} for filter column {dimension.name}"
        )

    return value


def _get_order_from_query_object(
    query_object: ValidatedQueryObject,
    all_metrics: dict[str, Metric],
    all_dimensions: dict[str, Dimension],
) -> list[OrderTuple]:
    order: list[OrderTuple] = []
    for element, ascending in query_object.orderby:
        direction = OrderDirection.ASC if ascending else OrderDirection.DESC

        # adhoc
        if isinstance(element, dict):
            if element["sqlExpression"] is not None:
                order.append(
                    (
                        AdhocExpression(
                            id=element["label"] or element["sqlExpression"],
                            definition=element["sqlExpression"],
                        ),
                        direction,
                    )
                )
        elif element in all_dimensions:
            order.append((all_dimensions[element], direction))
        elif element in all_metrics:
            order.append((all_metrics[element], direction))

    return order


def _get_group_limit_from_query_object(
    query_object: ValidatedQueryObject,
    all_metrics: dict[str, Metric],
    all_dimensions: dict[str, Dimension],
) -> GroupLimit | None:
    # no limit
    if query_object.series_limit == 0 or not query_object.columns:
        return None

    dimensions = [all_dimensions[dim_id] for dim_id in query_object.series_columns]
    top = query_object.series_limit
    metric = (
        all_metrics[query_object.series_limit_metric]
        if query_object.series_limit_metric
        else None
    )
    direction = OrderDirection.DESC if query_object.order_desc else OrderDirection.ASC
    group_others = query_object.group_others_when_limit_reached

    # Check if we need separate filters for the group limit subquery
    # This happens when inner_from_dttm/inner_to_dttm differ from from_dttm/to_dttm
    group_limit_filters = _get_group_limit_filters(query_object, all_dimensions)

    return GroupLimit(
        dimensions=dimensions,
        top=top,
        metric=metric,
        direction=direction,
        group_others=group_others,
        filters=group_limit_filters,
    )


def _get_group_limit_filters(
    query_object: ValidatedQueryObject,
    all_dimensions: dict[str, Dimension],
) -> set[Filter] | None:
    """
    Get separate filters for the group limit subquery if needed.

    This is used when inner_from_dttm/inner_to_dttm differ from from_dttm/to_dttm,
    which happens during time comparison queries. The group limit subquery may need
    different time bounds to determine the top N groups.

    Returns None if the group limit should use the same filters as the main query.
    """
    # Check if inner time bounds are explicitly set and differ from outer bounds
    if (
        query_object.inner_from_dttm is None
        or query_object.inner_to_dttm is None
        or (
            query_object.inner_from_dttm == query_object.from_dttm
            and query_object.inner_to_dttm == query_object.to_dttm
        )
    ):
        # No separate bounds needed - use the same filters as the main query
        return None

    # Create separate filters for the group limit subquery
    filters: set[Filter] = set()
    time_bounds_emitted = False

    # Add time range filter using inner bounds. The temporal column is resolved
    # via ``_get_time_axis_column`` so aggregate-only charts that carry the
    # time column only in a ``TEMPORAL_RANGE`` adhoc filter still get the
    # group-limit subquery scoped to the inner bounds instead of falling
    # through to the outer bounds.
    time_axis_column = _get_time_axis_column(query_object, all_dimensions)
    if time_axis_column and (time_dimension := all_dimensions.get(time_axis_column)):
        filters.update(
            {
                Filter(
                    type=PredicateType.WHERE,
                    column=time_dimension,
                    operator=Operator.GREATER_THAN_OR_EQUAL,
                    value=query_object.inner_from_dttm,
                ),
                Filter(
                    type=PredicateType.WHERE,
                    column=time_dimension,
                    operator=Operator.LESS_THAN,
                    value=query_object.inner_to_dttm,
                ),
            }
        )
        time_bounds_emitted = True

    # Add fetch values predicate if present
    if (
        query_object.apply_fetch_values_predicate
        and query_object.datasource.fetch_values_predicate
    ):
        filters.add(
            Filter(
                type=PredicateType.WHERE,
                column=None,
                operator=Operator.ADHOC,
                value=query_object.datasource.fetch_values_predicate,
            )
        )

    # Add filters from query_object.extras (WHERE and HAVING clauses)
    extras_filters = _get_filters_from_extras(query_object.extras)
    filters.update(extras_filters)

    # Add all other non-temporal filters from query_object.filter. Skip
    # ``TEMPORAL_RANGE`` only when the inner-bound filters were actually
    # emitted — otherwise dropping the pass-through would silently widen the
    # group-limit subquery to the full history.
    for filter_ in query_object.filter:
        if (
            filter_.get("op") == FilterOperator.TEMPORAL_RANGE.value
            and time_bounds_emitted
        ):
            continue

        if converted_filters := _convert_query_object_filter(filter_, all_dimensions):
            filters.update(converted_filters)

    return filters if filters else None


def _get_grain_time_axis_column(
    query_object: ValidatedQueryObject,
    all_dimensions: dict[str, Dimension],
) -> str | None:
    """
    Determine which selected column is the time-axis (the one a time grain
    applies to).

    Legacy time-series charts encode this as ``query_object.granularity``;
    modern x-axis charts leave that empty and put the temporal column in
    ``query_object.columns`` instead, with the grain on
    ``extras["time_grain_sqla"]``. In that case we only claim an axis when
    the selected columns include exactly one temporal dimension — otherwise
    which one is the x-axis is ambiguous from the ``QueryObject`` alone
    (form_data's ``x_axis`` is not available here). Returning ``None`` on
    ambiguity lets the grain-application code fall back to raw variants for
    every column rather than silently applying the grain to whichever
    temporal column happens to be iterated first.
    """
    if query_object.granularity:
        return query_object.granularity

    dimension_names = set(all_dimensions.keys())
    temporal_columns: list[str] = []
    for column in query_object.columns or []:
        try:
            name = _normalize_column(column, dimension_names)
        except ValueError:
            continue
        dim = all_dimensions.get(name)
        if dim is None:
            continue
        if (
            pa.types.is_timestamp(dim.type)
            or pa.types.is_date(dim.type)
            or pa.types.is_time(dim.type)
        ):
            temporal_columns.append(name)

    if len(temporal_columns) == 1:
        return temporal_columns[0]
    return None


def _convert_time_grain(time_grain: str | None) -> Grain | None:
    """
    Convert a time grain string (ISO 8601 duration) to a Grain instance.

    Returns None when ``time_grain`` is None or empty (no grain selected).
    """
    if not time_grain:
        return None
    try:
        return Grains.get(time_grain)
    except (TypeError, ValueError, isodate.ISO8601Error):
        return None


def validate_query_object(
    query_object: QueryObject,
) -> TypeGuard[ValidatedQueryObject]:
    """
    Validate that the `QueryObject` is compatible with the `SemanticView`.

    If some semantic view implementation supports these features we should add an
    attribute to the `SemanticViewImplementation` to indicate support for them.
    """
    if not query_object.datasource:
        return False

    query_object = cast(ValidatedQueryObject, query_object)

    _validate_metrics(query_object)
    _validate_dimensions(query_object)
    _validate_filters(query_object)
    _validate_granularity(query_object)
    _validate_group_limit(query_object)
    _validate_orderby(query_object)

    return True


def _validate_metrics(query_object: ValidatedQueryObject) -> None:
    """
    Make sure metrics are defined in the semantic view.
    """
    semantic_view = query_object.datasource.implementation

    if any(not isinstance(metric, str) for metric in (query_object.metrics or [])):
        raise ValueError("Adhoc metrics are not supported in Semantic Views.")

    metric_names = {metric.name for metric in semantic_view.metrics}
    if not set(query_object.metrics or []) <= metric_names:
        raise ValueError("All metrics must be defined in the Semantic View.")


def _validate_dimensions(query_object: ValidatedQueryObject) -> None:
    """
    Make sure all dimensions are defined in the semantic view.
    """
    semantic_view = query_object.datasource.implementation
    dimension_names = {dimension.name for dimension in semantic_view.dimensions}

    # Normalize all columns to dimension names
    normalized_columns = [
        _normalize_column(column, dimension_names) for column in query_object.columns
    ]

    if not set(normalized_columns) <= dimension_names:
        raise ValueError("All dimensions must be defined in the Semantic View.")


def _validate_filters(query_object: ValidatedQueryObject) -> None:
    """
    Make sure all filters are valid.
    """
    for filter_ in query_object.filter:
        if isinstance(filter_["col"], dict):
            raise ValueError(
                "Adhoc columns are not supported in Semantic View filters."
            )
        if not filter_.get("op"):
            raise ValueError("All filters must have an operator defined.")


def _validate_granularity(query_object: ValidatedQueryObject) -> None:
    """
    Make sure time column and time grain are valid.
    """
    semantic_view = query_object.datasource.implementation
    all_dimensions = {
        dimension.name: dimension for dimension in semantic_view.dimensions
    }
    dimension_names = set(all_dimensions.keys())

    if (legacy_time_column := query_object.granularity) and (
        legacy_time_column not in dimension_names
    ):
        raise ValueError(
            "The time column must be defined in the Semantic View dimensions."
        )

    if time_grain := query_object.extras.get("time_grain_sqla"):
        time_column = _get_grain_time_axis_column(query_object, all_dimensions)
        if not time_column:
            raise ValueError(
                "A time column must be specified when a time grain is provided."
            )

        supported_time_grains = {
            dimension.grain
            for dimension in semantic_view.dimensions
            if dimension.name == time_column and dimension.grain
        }
        if _convert_time_grain(time_grain) not in supported_time_grains:
            raise ValueError(
                "The time grain is not supported for the time column in the "
                "Semantic View."
            )


def _validate_group_limit(query_object: ValidatedQueryObject) -> None:
    """
    Validate group limit related features in the query object.
    """
    semantic_view = query_object.datasource.implementation

    # no limit
    if query_object.series_limit == 0:
        return

    if (
        query_object.series_columns
        and SemanticViewFeature.GROUP_LIMIT not in semantic_view.features
    ):
        raise ValueError("Group limit is not supported in this Semantic View.")

    if any(not isinstance(col, str) for col in query_object.series_columns):
        raise ValueError("Adhoc dimensions are not supported in series columns.")

    metric_names = {metric.name for metric in semantic_view.metrics}
    if query_object.series_limit_metric and (
        not isinstance(query_object.series_limit_metric, str)
        or query_object.series_limit_metric not in metric_names
    ):
        raise ValueError(
            "The series limit metric must be defined in the Semantic View."
        )

    dimension_names = {dimension.name for dimension in semantic_view.dimensions}
    if not set(query_object.series_columns) <= dimension_names:
        raise ValueError("All series columns must be defined in the Semantic View.")

    if (
        query_object.group_others_when_limit_reached
        and SemanticViewFeature.GROUP_OTHERS not in semantic_view.features
    ):
        raise ValueError(
            "Grouping others when limit is reached is not supported in this Semantic "
            "View."
        )


def _validate_orderby(query_object: ValidatedQueryObject) -> None:
    """
    Validate order by elements in the query object.
    """
    semantic_view = query_object.datasource.implementation

    if (
        any(not isinstance(element, str) for element, _ in query_object.orderby)
        and SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY
        not in semantic_view.features
    ):
        raise ValueError(
            "Adhoc expressions in order by are not supported in this Semantic View."
        )

    elements = {orderby[0] for orderby in query_object.orderby}
    metric_names = {metric.name for metric in semantic_view.metrics}
    dimension_names = {dimension.name for dimension in semantic_view.dimensions}
    if not elements <= metric_names | dimension_names:
        raise ValueError("All order by elements must be defined in the Semantic View.")
