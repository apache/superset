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

"""Default selection and ambiguity contracts for semantic dimensions."""

from itertools import permutations

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import Dimension, Grain, Grains

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.dimension_resolution import resolve_dimension_defaults


@pytest.mark.parametrize(
    "grains, expected_index",
    [
        ((None, Grains.DAY, Grains.MONTH, Grains.YEAR), 0),
        ((Grains.MONTH, Grains.HOUR, Grains.DAY), 1),
        ((Grain("Custom", "P2D"), Grains.YEAR), 1),
        ((Grain("A", "P5D"), Grain("Z", "P2D")), 1),
        ((None,), 0),
        ((Grains.MONTH,), 0),
    ],
)
def test_defaults_preserve_preferred_provider_object(
    grains: tuple[Grain | None, ...], expected_index: int
) -> None:
    """Known grains beat custom ones; display names are not a ranking key."""
    dimensions: tuple[Dimension, ...] = tuple(
        Dimension(str(index), "event_time", pa.timestamp("us"), grain=grain)
        for index, grain in enumerate(grains)
    )
    for ordering in permutations(dimensions):
        assert (
            resolve_dimension_defaults(ordering)["event_time"]
            is dimensions[expected_index]
        )


def test_empty_catalog_and_distinct_names() -> None:
    """An empty catalog stays empty; grain collisions across names are valid."""
    first: Dimension = Dimension("a", "first", pa.timestamp("us"), grain=Grains.DAY)
    second: Dimension = Dimension("b", "second", pa.timestamp("us"), grain=Grains.DAY)
    assert resolve_dimension_defaults(()) == {}
    assert resolve_dimension_defaults((first, second)) == {
        "first": first,
        "second": second,
    }
    assert resolve_dimension_defaults((first, first))["first"] is first


@pytest.mark.parametrize("grain", [None, Grains.MONTH, Grain("Custom", "P2D")])
def test_same_grain_different_ids_always_rejected(grain: Grain | None) -> None:
    """Ambiguity is checked even when a raw variant would win the default."""
    first: Dimension = Dimension("a", "event_time", pa.timestamp("us"), grain=grain)
    second: Dimension = Dimension("b", "event_time", pa.timestamp("us"), grain=grain)
    raw: Dimension = Dimension("raw", "event_time", pa.timestamp("us"))
    for ordering in permutations((first, second, raw)):
        with pytest.raises(QueryObjectValidationError, match="ambiguous"):
            resolve_dimension_defaults(ordering)


def test_grain_identity_uses_representation_not_display_name() -> None:
    """Two grain labels cannot hide conflicting IDs for the same representation."""
    first: Dimension = Dimension(
        "a", "event_time", pa.timestamp("us"), grain=Grain("A", "P1D")
    )
    second: Dimension = Dimension(
        "b", "event_time", pa.timestamp("us"), grain=Grain("B", "P1D")
    )
    with pytest.raises(QueryObjectValidationError, match="ambiguous"):
        resolve_dimension_defaults((first, second))
