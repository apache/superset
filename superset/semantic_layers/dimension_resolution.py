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

"""Default preference for immutable semantic dimension variants."""

from collections.abc import Iterable

from flask_babel import gettext as _
from superset_core.semantic_layers.types import Dimension, Grain

from superset.exceptions import QueryObjectValidationError

# Known grains rank finest to coarsest, ahead of unknown representations.
_GRAIN_FINENESS: dict[str, int] = {
    "PT1S": 0,
    "PT1M": 1,
    "PT1H": 2,
    "P1D": 3,
    "P1W": 4,
    "P1M": 5,
    "P3M": 6,
    "P1Y": 7,
}


def grain_preference(dimension: Dimension) -> tuple[int, int, str]:
    """Prefer raw, then finest known grain, then lexical representation."""
    grain: Grain | None = dimension.grain
    if grain is None:
        return (0, 0, "")
    representation: str = grain.representation
    return (
        1,
        _GRAIN_FINENESS.get(representation, len(_GRAIN_FINENESS)),
        representation,
    )


def resolve_dimension_defaults(
    dimensions: Iterable[Dimension],
) -> dict[str, Dimension]:
    """Resolve names without hiding conflicting identities for any grain.

    Return the original provider objects. Even non-preferred grains must be
    unambiguous: explicit grouping can select them independently of defaults.
    """
    defaults: dict[str, Dimension] = {}
    identities: dict[tuple[str, Grain | None], str] = {}
    for dimension in dimensions:
        key: tuple[str, Grain | None] = (dimension.name, dimension.grain)
        previous_id: str | None = identities.get(key)
        if previous_id is not None and previous_id != dimension.id:
            raise QueryObjectValidationError(
                _(
                    "Semantic dimension '%(name)s' has ambiguous variants for "
                    "grain '%(grain)s'. Use one ID per name and grain.",
                    name=dimension.name,
                    grain=dimension.grain.representation if dimension.grain else "raw",
                )
            )
        identities[key] = dimension.id
        preferred: Dimension | None = defaults.get(dimension.name)
        if preferred is None or grain_preference(dimension) < grain_preference(
            preferred
        ):
            defaults[dimension.name] = dimension
    return defaults
