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
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    OrderDirection,
    SemanticQuery,
    SemanticViewFeature,
)


def map_query_object(query_object: QueryObject) -> SemanticQuery:
    """
    Convert a QueryObject into a SemanticQuery.

    This function maps the `QueryObject` into a query that is less visualization-centric
    and more semantic layer-centric. This simplifies the process of adding new semantic
    layers to Superset, by providing a domain-specific representation of queries.
    """
    semantic_view = query_object.datasource.implementation
    validate_query_object(query_object, semantic_view)

    all_dimensions = {dimension.id: dimension for dimension in semantic_view.dimensions}
    all_metrics = {metric.id: metric for metric in semantic_view.metrics}

    metrics: set[Metric] = {
        all_metrics[metric_id] for metric_id in query_object.metrics
    }
    dimensions: set[Dimension] = {
        all_dimensions[dim_id] for dim_id in query_object.columns
    }

    filters: set[Filter] = set()

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

    group_limit = GroupLimit(
        dimensions=[
            all_dimensions[dim_id]
            for dim_id in query_object.columns
            if dim_id in all_dimensions
        ],
        top=query_object.series_limit,
        metric=all_metrics.get(query_object.series_limit_metric),
        direction=(
            OrderDirection.DESC if query_object.order_desc else OrderDirection.ASC
        ),
        group_others=query_object.group_others_when_limit_reached,
    )

    return SemanticQuery(
        metrics=metrics,
        dimensions=dimensions,
        filters=filters,
        order=order,
        limit=query_object.row_limit,
        offset=query_object.row_offset,
        group_limit=group_limit,
    )


def validate_query_object(
    query_object: QueryObject,
    semantic_view: SemanticViewProtocol,
) -> None:
    """
    Validate that the `QueryObject` is compatible with the `SemanticView`.

    If some semantic view implementation supports these features we should add an
    attribute to the `SemanticViewProtocol` to indicate support for them.
    """
    metric_ids = {metric.id for metric in semantic_view.metrics}
    dimension_ids = {dimension.id for dimension in semantic_view.dimensions}

    # Validate adhoc metrics and non-adhoc metrics
    if any(not isinstance(metric, str) for metric in query_object.metrics):
        raise ValueError("Adhoc metrics are not supported in Semantic Views.")

    if not set(query_object.metrics) <= metric_ids:
        raise ValueError("All metrics must be defined in the Semantic View.")

    # Validate adhoc dimensions and non-adhoc dimensions
    if any(not isinstance(column, str) for column in query_object.columns):
        raise ValueError("Adhoc dimensions are not supported in Semantic Views.")

    if not set(query_object.columns) <= dimension_ids:
        raise ValueError("All dimensions must be defined in the Semantic View.")

    # Validate group limit features
    if (
        query_object.columns
        and SemanticViewFeature.GROUP_LIMIT not in semantic_view.features
    ):
        raise ValueError("Group limit is not supported in this Semantic View.")

    if (
        query_object.group_others_when_limit_reached
        and SemanticViewFeature.GROUP_OTHERS not in semantic_view.features
    ):
        raise ValueError(
            "Grouping others when limit is reached is not supported in this Semantic "
            "View."
        )

    # Validate order by
    if (
        any(not isinstance(element, str) for element, _ in query_object.orderby)
        and SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY
        not in semantic_view.features
    ):
        raise ValueError(
            "Adhoc expressions in order by are not supported in this Semantic View."
        )

    elements = {
        element.id for element, _ in query_object.orderby if isinstance(element, str)
    }
    if not elements <= metric_ids | dimension_ids:
        raise ValueError("All order by elements must be defined in the Semantic View.")
