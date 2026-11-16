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

"""Declared defaults and unique catalog identities are order independent."""

from dataclasses import replace
from itertools import permutations

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Dimension,
    DimensionSelection,
    GrainDefault,
    Grains,
)

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.dimension_resolution import (
    dimensions_by_name,
    DimensionUsage,
    resolve_dimensions,
)


@pytest.mark.parametrize("usage", list(DimensionUsage))
def test_declared_default_and_explicit_selection(usage: DimensionUsage) -> None:
    dimension: Dimension = Dimension(
        "private",
        "time",
        pa.timestamp("us"),
        grains=frozenset({Grains.DAY, Grains.MONTH}),
        omitted_grain=Grains.MONTH,
        ungrained_filter=Grains.DAY,
    )
    expected: DimensionSelection = DimensionSelection(
        dimension, Grains.DAY if usage is DimensionUsage.FILTER else Grains.MONTH
    )
    assert resolve_dimensions([dimension], usage=usage) == {"time": expected}
    explicit: DimensionSelection = DimensionSelection(
        dimension, Grains.DAY if usage is DimensionUsage.FILTER else None
    )
    assert resolve_dimensions(
        [dimension], usage=usage, grouping_grains={"time": None}
    ) == {"time": explicit}


@pytest.mark.parametrize("usage", list(DimensionUsage))
@pytest.mark.parametrize(
    "field",
    [
        "id",
        "type",
        "definition",
        "description",
        "grains",
        "omitted_grain",
        "ungrained_filter",
        "allows_default_grain",
    ],
)
def test_conflicting_catalog_definitions_reject_for_every_usage(
    usage: DimensionUsage, field: str
) -> None:
    first: Dimension = Dimension(
        "a",
        "time",
        pa.timestamp("us"),
        grains=frozenset({Grains.DAY, Grains.MONTH}),
        omitted_grain=Grains.DAY,
        ungrained_filter=Grains.DAY,
    )
    changed: dict[str, object] = {
        "id": "b",
        "type": pa.date32(),
        "definition": "other",
        "description": "other",
        "grains": frozenset({Grains.DAY}),
        "omitted_grain": Grains.MONTH,
        "ungrained_filter": Grains.MONTH,
        "allows_default_grain": False,
    }
    second: Dimension = replace(first, **{field: changed[field]})
    for ordering in permutations([first, second]):
        with pytest.raises(QueryObjectValidationError, match="ambiguous"):
            resolve_dimensions(ordering, usage=usage, names=[])


def test_metadata_retains_original_object_without_resolving_default() -> None:
    dimension: Dimension = Dimension(
        "a",
        "time",
        pa.timestamp("us"),
        omitted_grain=GrainDefault.REJECT,
        ungrained_filter=GrainDefault.REJECT,
    )
    assert dimensions_by_name([dimension, dimension])["time"] is dimension
    assert dimensions_by_name([]) == {}
    assert resolve_dimensions([dimension], usage=DimensionUsage.GROUP, names=[]) == {}
    with pytest.raises(QueryObjectValidationError, match="explicit time grain"):
        resolve_dimensions([dimension], usage=DimensionUsage.GROUP)


def test_missing_field_and_unsupported_grain_are_not_silently_dropped() -> None:
    dimension: Dimension = Dimension("a", "category", pa.string())
    with pytest.raises(QueryObjectValidationError, match="not supported"):
        resolve_dimensions([dimension], usage=DimensionUsage.GROUP, names=["missing"])
    with pytest.raises(QueryObjectValidationError, match="time grain"):
        resolve_dimensions(
            [dimension],
            usage=DimensionUsage.GROUP,
            grouping_grains={"category": Grains.DAY},
        )
