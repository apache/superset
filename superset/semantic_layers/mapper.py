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
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    OrderDirection,
    SemanticQuery,
)


def map_query_object(query_object: QueryObject) -> SemanticQuery:
    """
    Convert a QueryObject into a SemanticQuery.

    This function maps the `QueryObject` into a query that is less visualization-centric
    and more semantic layer-centric. This simplifies the process of adding new semantic
    layers to Superset, by providing a domain-specific representation of queries.
    """
    metrics: set[Metric] = set()
    dimensions: set[Dimension] = set()
    filters: set[Filter] = set()
    order = None

    group_limit = GroupLimit(
        dimensions=[],
        top=query_object.series_limit,
        metric=None,
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
