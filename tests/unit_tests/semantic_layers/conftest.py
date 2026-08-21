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

"""Reusable typed builders for semantic-cache unit tests."""

from __future__ import annotations

from dataclasses import dataclass

import pyarrow as pa
from superset_core.semantic_layers.types import (
    Dimension,
    Metric,
    SemanticQuery,
    SemanticResult,
)

from superset.semantic_layers.cache_identity import (
    SemanticCacheIdentityFactory,
    SemanticCacheProviderIdentity,
    SemanticCacheScopeIdentity,
    SemanticDefinitionIdentity,
    SemanticViewIdentity,
)
from superset.semantic_layers.cache_repository import ViewMeta


@dataclass(frozen=True)
class SemanticCapabilityFixture:
    """Provider semantic capabilities used before the core contract is added."""

    comparisons: bool = False
    membership: bool = False
    nulls: bool = False
    patterns: bool = False
    pattern_escape: str | None = None


def build_semantic_query() -> SemanticQuery:
    """Build a minimal typed semantic query."""
    metric: Metric = Metric(
        id="revenue",
        name="Revenue",
        type=pa.float64(),
        definition="SUM(revenue)",
    )
    dimension: Dimension = Dimension(
        id="country",
        name="Country",
        type=pa.string(),
    )
    return SemanticQuery(metrics=[metric], dimensions=[dimension])


def build_semantic_result() -> SemanticResult:
    """Build a minimal typed semantic result."""
    table: pa.Table = pa.table({"Country": ["GB"], "Revenue": [42.0]})
    return SemanticResult(requests=[], results=table)


def build_view_meta() -> ViewMeta:
    """Build stable cache-bucket metadata."""
    definition_identity: SemanticDefinitionIdentity = (
        SemanticCacheIdentityFactory.definition({"version": 1})
    )
    provider_identity: SemanticCacheProviderIdentity = (
        SemanticCacheIdentityFactory.provider({"provider": "fixture"})
    )
    scope_identity: SemanticCacheScopeIdentity = SemanticCacheIdentityFactory.scope(
        {"user": "fixture"}
    )
    return ViewMeta(
        view_identity=SemanticViewIdentity("fixture-view"),
        definition_identity=definition_identity,
        provider_identity=provider_identity,
        scope_identity=scope_identity,
        timeout=300,
    )
