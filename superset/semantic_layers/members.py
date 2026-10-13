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
"""Member identity for semantic views."""

from collections.abc import Iterable
from typing import TypeVar

from superset_core.semantic_layers.types import Dimension, Metric

SemanticMember = TypeVar("SemanticMember", Metric, Dimension)


def members_by_key(
    members: Iterable[SemanticMember],
) -> dict[str, SemanticMember]:
    """Index semantic members by the key selections are saved under.

    ``name`` is the stable selection key for both metrics and dimensions:
    saved charts, API payloads and compatibility selections all reference a
    member by name, never by the provider-private ``id`` (see
    ``superset_core.semantic_layers.types.Metric``). Resolving a selection
    therefore means looking it up in this mapping, and this helper exists so
    that the rule has one place in the host rather than being re-derived at
    each call site.

    Members are indexed in iteration order, so when several share one name the
    last one seen wins. That is deliberate here: this helper reproduces the
    existing lookup exactly and is not the place to break such a tie. Dimension
    grain variants legitimately share a name, and choosing between them is a
    separate, ordered decision -- see
    ``superset_core.semantic_layers.types.Grains``. Because ``get_metrics()``
    and ``get_dimensions()`` return unordered sets, a caller that needs a
    particular variant must select it rather than rely on this mapping.

    :param members: Metrics or dimensions from one semantic view.
    :returns: Mapping of member name to member.
    """
    return {member.name: member for member in members}
