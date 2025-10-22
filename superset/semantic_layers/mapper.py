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

from superset.common.query_object import QueryObject
from superset.semantic_layers.types import (
    AdhocExpression,
    AdhocFilter,
    DateGrain,
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticQuery,
    SemanticViewFeature,
    SemanticViewImplementation,
    TimeGrain,
)


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
    for offset in [None] + query_object.time_offsets:
        filters = _get_filters_from_query_object(query_object, offset)

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
    all_metrics: dict[str, Metric],
    all_dimensions: dict[str, Dimension],
) -> set[Filter | AdhocFilter]:
    filters: set[Filter | AdhocFilter] = set()

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

    for filter_ in query_object.filter:
        pass

    return filters


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

    return GroupLimit(
        dimensions=dimensions,
        top=top,
        metric=metric,
        direction=direction,
        group_others=group_others,
    )


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
