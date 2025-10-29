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

from datetime import datetime

import numpy as np
import pandas as pd

from superset.common.query_object import QueryObject
from superset.common.utils.time_range_utils import get_since_until_from_query_object
from superset.semantic_layers.types import (
    AdhocExpression,
    AdhocFilter,
    DateGrain,
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticQuery,
    SemanticViewFeature,
    SemanticViewImplementation,
    TimeGrain,
)
from superset.utils.core import FilterOperator, TIME_COMPARISON
from superset.utils.date_parser import get_past_or_future


def map_query_object(query_object: QueryObject) -> list[SemanticQuery]:
    """
    Convert a `QueryObject` into a list of `SemanticQuery`.

    This function maps the `QueryObject` into query objects that are less centered on
    visualization, simplifying the process of adding new semantic layers to Superset.
    """
    semantic_view = query_object.datasource.implementation
    validate_query_object(query_object, semantic_view)

    all_metrics = {metric.name: metric for metric in semantic_view.metrics}
    all_dimensions = {
        dimension.name: dimension for dimension in semantic_view.dimensions
    }

    metrics = {all_metrics[metric] for metric in query_object.metrics}

    grain = _convert_time_grain(query_object.extras.get("time_grain_sqla"))
    dimensions = {
        dimension
        for dimension in semantic_view.dimensions
        if dimension.name in query_object.columns
        and (
            # if a grain is specified, only include the time dimension if its grain
            # matches the requested grain
            grain is None
            or dimension.name != query_object.granularity
            or dimension.grain == grain
        )
    }

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
    query_object: QueryObject,
    time_offset: str | None,
    all_dimensions: dict[str, Dimension],
) -> set[Filter | AdhocFilter]:
    """
    Extract all filters from the query object, including time range filters.

    This simplifies the complexity of from_dttm/to_dttm/inner_from_dttm/inner_to_dttm
    by converting all time constraints into filters.
    """
    filters: set[Filter | AdhocFilter] = set()

    # 1. Add fetch values predicate if present
    if (
        query_object.apply_fetch_values_predicate
        and query_object.datasource.fetch_values_predicate
    ):
        filters.add(
            AdhocFilter(
                type=PredicateType.WHERE,
                definition=query_object.datasource.fetch_values_predicate,
            )
        )

    # 2. Add time range filter based on from_dttm/to_dttm
    # For time offsets, this automatically calculates the shifted bounds
    time_filters = _get_time_filter(query_object, time_offset, all_dimensions)
    filters.update(time_filters)

    # 3. Add filters from query_object.extras (WHERE and HAVING clauses)
    extras_filters = _get_filters_from_extras(query_object.extras)
    filters.update(extras_filters)

    # 4. Add all other filters from query_object.filter
    for filter_ in query_object.filter:
        converted_filter = _convert_query_object_filter(filter_, all_dimensions)
        if converted_filter:
            filters.add(converted_filter)

    return filters


def _get_filters_from_extras(extras: dict) -> set[AdhocFilter]:
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
    are passed through as-is to the semantic layer as AdhocFilter objects.
    """
    filters: set[AdhocFilter] = set()

    # Add WHERE clause from extras
    if where_clause := extras.get("where"):
        filters.add(
            AdhocFilter(
                type=PredicateType.WHERE,
                definition=where_clause,
            )
        )

    # Add HAVING clause from extras
    if having_clause := extras.get("having"):
        filters.add(
            AdhocFilter(
                type=PredicateType.HAVING,
                definition=having_clause,
            )
        )

    return filters


def _get_time_filter(
    query_object: QueryObject,
    time_offset: str | None,
    all_dimensions: dict[str, Dimension],
) -> set[Filter]:
    """
    Create a time range filter from the query object.

    This handles both regular queries and time offset queries, simplifying the
    complexity of from_dttm/to_dttm/inner_from_dttm/inner_to_dttm by using the
    same time bounds for both the main query and series limit subqueries.
    """
    filters: set[Filter] = set()

    if not query_object.granularity:
        return filters

    time_dimension = all_dimensions.get(query_object.granularity)
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
    query_object: QueryObject,
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
    filter_: dict,
    all_dimensions: dict[str, Dimension],
) -> Filter | AdhocFilter | None:
    """
    Convert a QueryObject filter dict to a semantic layer Filter or AdhocFilter.
    """
    # Handle adhoc filters (SQL expressions)
    if filter_.get("expressionType") == "SQL":
        return AdhocFilter(
            type=PredicateType.WHERE,
            definition=filter_.get("sqlExpression", ""),
        )

    # Handle TEMPORAL_RANGE filters (these are already handled by _get_time_filter)
    if filter_.get("op") == FilterOperator.TEMPORAL_RANGE.value:
        # Skip - already handled in _get_time_filter
        return None

    # Handle simple column filters
    col = filter_.get("col")
    if not col or col not in all_dimensions:
        return None

    dimension = all_dimensions[col]
    operator_str = filter_.get("op")
    value = filter_.get("val")

    # Map QueryObject operators to semantic layer operators
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
        # Unknown operator - create adhoc filter
        return None

    return Filter(
        type=PredicateType.WHERE,
        column=dimension,
        operator=operator,
        value=value,
    )


def _get_order_from_query_object(
    query_object: QueryObject,
    all_metrics: dict[str, Metric],
    all_dimensions: dict[str, Dimension],
) -> list[OrderTuple]:
    order = []
    for element, ascending in query_object.orderby:
        direction = OrderDirection.ASC if ascending else OrderDirection.DESC

        if isinstance(element, dict):
            order.append(
                (
                    AdhocExpression(
                        id=element["label"],
                        definition=element["sqlExpression"],
                    ),
                    direction,
                )
            )
        elif element in all_dimensions:
            order.append((all_dimensions.get(element), direction))
        elif element in all_metrics:
            order.append((all_metrics.get(element), direction))

    return order


def _get_group_limit_from_query_object(
    query_object: QueryObject,
    all_metrics: dict[str, Metric],
    all_dimensions: dict[str, Dimension],
) -> GroupLimit | None:
    if not query_object.columns:
        return None

    dimensions = [all_dimensions[dim_id] for dim_id in query_object.series_columns]
    top = query_object.series_limit
    metric = all_metrics.get(query_object.series_limit_metric)
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
    query_object: QueryObject,
    all_dimensions: dict[str, Dimension],
) -> set[Filter | AdhocFilter] | None:
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
    filters: set[Filter | AdhocFilter] = set()

    # Add time range filter using inner bounds
    if query_object.granularity:
        time_dimension = all_dimensions.get(query_object.granularity)
        if (
            time_dimension
            and query_object.inner_from_dttm
            and query_object.inner_to_dttm
        ):
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

    # Add fetch values predicate if present
    if (
        query_object.apply_fetch_values_predicate
        and query_object.datasource.fetch_values_predicate
    ):
        filters.add(
            AdhocFilter(
                type=PredicateType.WHERE,
                definition=query_object.datasource.fetch_values_predicate,
            )
        )

    # Add filters from query_object.extras (WHERE and HAVING clauses)
    extras_filters = _get_filters_from_extras(query_object.extras)
    filters.update(extras_filters)

    # Add all other non-temporal filters from query_object.filter
    for filter_ in query_object.filter:
        # Skip temporal range filters - we're using inner bounds instead
        if filter_.get("op") == FilterOperator.TEMPORAL_RANGE.value:
            continue

        converted_filter = _convert_query_object_filter(filter_, all_dimensions)
        if converted_filter:
            filters.add(converted_filter)

    return filters if filters else None


def _convert_time_grain(time_grain: str) -> TimeGrain | DateGrain | None:
    """
    Convert a time grain string from the query object to a TimeGrain or DateGrain enum.
    """
    if time_grain in TimeGrain.__members__:
        return TimeGrain[time_grain]

    if time_grain in DateGrain.__members__:
        return DateGrain[time_grain]

    return None


def validate_query_object(
    query_object: QueryObject,
    semantic_view: SemanticViewImplementation,
) -> None:
    """
    Validate that the `QueryObject` is compatible with the `SemanticView`.

    If some semantic view implementation supports these features we should add an
    attribute to the `SemanticViewImplementation` to indicate support for them.
    """
    _validate_metrics(query_object, semantic_view)
    _validate_dimensions(query_object, semantic_view)
    _validate_granularity(query_object, semantic_view)
    _validate_group_limit(query_object, semantic_view)
    _validate_orderby(query_object, semantic_view)


def _validate_metrics(
    query_object: QueryObject,
    semantic_view: SemanticViewImplementation,
) -> None:
    """
    Make sure metrics are defined in the semantic view.
    """
    if any(not isinstance(metric, str) for metric in query_object.metrics):
        raise ValueError("Adhoc metrics are not supported in Semantic Views.")

    metric_names = {metric.name for metric in semantic_view.metrics}
    if not set(query_object.metrics) <= metric_names:
        raise ValueError("All metrics must be defined in the Semantic View.")


def _validate_dimensions(
    query_object: QueryObject,
    semantic_view: SemanticViewImplementation,
) -> None:
    """
    Make sure all dimensions are defined in the semantic view.
    """
    if any(not isinstance(column, str) for column in query_object.columns):
        raise ValueError("Adhoc dimensions are not supported in Semantic Views.")

    dimension_names = {dimension.name for dimension in semantic_view.dimensions}
    if not set(query_object.columns) <= dimension_names:
        raise ValueError("All dimensions must be defined in the Semantic View.")


def _validate_granularity(
    query_object: QueryObject,
    semantic_view: SemanticViewImplementation,
) -> None:
    """
    Make sure time column and time grain are valid.
    """
    dimension_names = {dimension.name for dimension in semantic_view.dimensions}

    if time_column := query_object.granularity:
        if time_column not in dimension_names:
            raise ValueError(
                "The time column must be defined in the Semantic View dimensions."
            )

    if time_grain := query_object.extras.get("time_grain_sqla"):
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


def _validate_group_limit(
    query_object: QueryObject,
    semantic_view: SemanticViewImplementation,
) -> None:
    """
    Validate group limit related features in the query object.
    """
    if (
        query_object.series_columns
        and SemanticViewFeature.GROUP_LIMIT not in semantic_view.features
    ):
        raise ValueError("Group limit is not supported in this Semantic View.")

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


def _validate_orderby(
    query_object: QueryObject,
    semantic_view: SemanticViewImplementation,
) -> None:
    """
    Validate order by elements in the query object.
    """
    if (
        any(not isinstance(element, str) for element, _ in query_object.orderby)
        and SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY
        not in semantic_view.features
    ):
        raise ValueError(
            "Adhoc expressions in order by are not supported in this Semantic View."
        )

    elements = {
        element.name for element, _ in query_object.orderby if isinstance(element, str)
    }
    metric_names = {metric.name for metric in semantic_view.metrics}
    dimension_names = {dimension.name for dimension in semantic_view.dimensions}
    if not elements <= metric_names | dimension_names:
        raise ValueError("All order by elements must be defined in the Semantic View.")


def get_results(query_object: QueryObject) -> pd.DataFrame:
    """
    Run a query based on the `QueryObject` and return the results as a Pandas DataFrame.
    """
    semantic_view = query_object.datasource.implementation

    # Step 1: Convert QueryObject to list of SemanticQuery objects
    # The first query is the main query, subsequent queries are for time offsets
    queries = map_query_object(query_object)

    # Step 2: Execute the main query (first in the list)
    main_query = queries[0]
    main_result = semantic_view.get_dataframe(
        metrics=main_query.metrics,
        dimensions=main_query.dimensions,
        filters=main_query.filters,
        order=main_query.order,
        limit=main_query.limit,
        offset=main_query.offset,
        group_limit=main_query.group_limit,
    )

    main_df = main_result.results

    # If no time offsets, return the main DataFrame as-is
    if not query_object.time_offsets or len(queries) <= 1:
        return main_df

    # Get metric names from the main query
    # These are the columns that will be renamed with offset suffixes
    metric_names = [metric.name for metric in main_query.metrics]

    # Join keys are all columns except metrics
    # These will be used to match rows between main and offset DataFrames
    join_keys = [col for col in main_df.columns if col not in metric_names]

    # Step 3 & 4: Execute each time offset query and join results
    for offset_query, time_offset in zip(
        queries[1:], query_object.time_offsets, strict=False
    ):
        # Execute the offset query
        result = semantic_view.get_dataframe(
            metrics=offset_query.metrics,
            dimensions=offset_query.dimensions,
            filters=offset_query.filters,
            order=offset_query.order,
            limit=offset_query.limit,
            offset=offset_query.offset,
            group_limit=offset_query.group_limit,
        )

        offset_df = result.results

        # Handle empty results - create a DataFrame with NaN values
        # This ensures the join doesn't fail and produces NULL values for missing data
        if offset_df.empty:
            offset_df = pd.DataFrame(
                {
                    **{col: [np.nan] for col in join_keys},
                    **{
                        TIME_COMPARISON.join([metric, time_offset]): [np.nan]
                        for metric in metric_names
                    },
                }
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
        # This preserves all rows from main_df and adds offset metrics where they match
        main_df = main_df.merge(
            offset_df,
            on=join_keys,
            how="left",
            suffixes=("", "__duplicate"),
        )

        # Clean up any duplicate columns that might have been created
        # (shouldn't happen with proper join keys, but defensive programming)
        duplicate_cols = [col for col in main_df.columns if col.endswith("__duplicate")]
        if duplicate_cols:
            main_df = main_df.drop(columns=duplicate_cols)

    return main_df
