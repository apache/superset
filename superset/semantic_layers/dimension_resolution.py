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

"""Resolve catalog capabilities into explicit query operands."""

from collections.abc import Iterable, Mapping
from enum import Enum

from superset_core.semantic_layers.types import (
    Dimension,
    DimensionSelection,
    Grain,
    GrainDefault,
    SemanticQueryRejectedError,
)

from superset.exceptions import QueryObjectValidationError


class DimensionUsage(Enum):
    """Distinguish implicit filter defaults from grouping defaults."""

    COMPATIBILITY = "compatibility"
    FILTER = "filter"
    GROUP = "group"
    ORDER = "order"
    SERIES_LIMIT = "series_limit"


class AmbiguousDimensionError(QueryObjectValidationError):
    """A catalog contains conflicting definitions of the same public name."""


def dimensions_by_name(dimensions: Iterable[Dimension]) -> dict[str, Dimension]:
    """Validate unique names without resolving an unused field's default."""
    result: dict[str, Dimension] = {}
    for dimension in dimensions:
        previous: Dimension | None = result.get(dimension.name)
        if previous is not None and previous != dimension:
            raise AmbiguousDimensionError(
                f"Semantic dimension '{dimension.name}' has ambiguous definitions."
            )
        result[dimension.name] = dimension
    return result


def select_dimension(
    dimension: Dimension, grain: Grain | GrainDefault | None
) -> DimensionSelection:
    """Resolve a declared default or validate an explicit grain, including raw."""
    if grain is GrainDefault.REJECT:
        raise QueryObjectValidationError(
            f"An explicit time grain is required for '{dimension.name}'."
        )
    try:
        return DimensionSelection(
            dimension, None if grain is GrainDefault.NATIVE else grain
        )
    except SemanticQueryRejectedError as ex:
        raise QueryObjectValidationError(
            f"The time grain is not supported for '{dimension.name}'."
        ) from ex


def resolve_dimensions(
    dimensions: Iterable[Dimension],
    *,
    usage: DimensionUsage,
    grouping_grains: Mapping[str, Grain | None] | None = None,
    names: Iterable[str] | None = None,
) -> dict[str, DimensionSelection]:
    """Select only used fields, keeping omitted and explicitly raw distinct."""
    catalog: dict[str, Dimension] = dimensions_by_name(dimensions)
    selected: dict[str, DimensionSelection] = {}
    for name in catalog if names is None else names:
        if name not in catalog:
            raise QueryObjectValidationError(
                f"Semantic dimension '{name}' is not supported in this query."
            )
        dimension: Dimension = catalog[name]
        grain: Grain | GrainDefault | None = (
            dimension.ungrained_filter
            if usage is DimensionUsage.FILTER
            else dimension.omitted_grain
        )
        if (
            usage is not DimensionUsage.FILTER
            and grouping_grains
            and name in grouping_grains
        ):
            grain = grouping_grains[name]
        selected[name] = select_dimension(dimension, grain)
    return selected
