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

"""The default order of an unordered semantic query."""

from dataclasses import replace

import pyarrow as pa
from superset_core.semantic_layers.types import (
    Dimension,
    NullPlacement,
    OrderDirection,
    OrderTerm,
    SemanticQuery,
)


def default_order_dimension(query: SemanticQuery) -> Dimension | None:
    """Return the dimension an unordered query sorts by, or ``None``.

    This is the default stated on ``SemanticQuery``: the first selected date,
    timestamp or time dimension, used only when the query has no ``order``.
    """
    if query.order:
        return None
    return next(
        (
            dimension
            for dimension in query.dimensions
            if pa.types.is_date(dimension.type)
            or pa.types.is_timestamp(dimension.type)
            or pa.types.is_time(dimension.type)
        ),
        None,
    )


def with_default_order(query: SemanticQuery) -> SemanticQuery:
    """Return *query* with its default chronological order filled in.

    The default sorts NULL values last. The term carries that placement, which
    also tells it apart from an explicit ascending order on the same dimension,
    whose NULL placement is the provider's. The provider receives this order on
    dispatch, and the semantic cache uses it to decide which cached rows a query
    may reuse.
    """
    dimension: Dimension | None = default_order_dimension(query)
    if dimension is None:
        return query
    return replace(
        query,
        order=[OrderTerm(dimension, OrderDirection.ASC, NullPlacement.LAST)],
    )
