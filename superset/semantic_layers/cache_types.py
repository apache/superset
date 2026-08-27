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

"""Dependency-neutral values shared by semantic cache policy and storage."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from time import time

from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Filter,
    Metric,
    SemanticResult,
)


class ReuseMode(str, enum.Enum):
    """Transformation needed to answer a query from a cached result."""

    EXACT = "exact"
    PROJECT = "project"
    ROLLUP = "rollup"


@dataclass(frozen=True)
class PatternSemantics:
    """Provider guarantee for SQL LIKE wildcard and escape behavior."""

    escape: str

    @classmethod
    def sql_like(cls, *, escape: str) -> PatternSemantics:
        return cls(escape=escape)


@dataclass(frozen=True)
class ContainmentCapabilities:
    """Provider semantics proven equivalent for cached post-processing."""

    comparisons: bool = False
    membership: bool = False
    nulls: bool = False
    pattern_semantics: PatternSemantics | None = None


SAFE_CONTAINMENT_CAPABILITIES: ContainmentCapabilities = ContainmentCapabilities()
ROLLUP_COMPATIBLE_AGGREGATIONS: frozenset[AggregationType] = frozenset(
    {
        AggregationType.SUM,
        AggregationType.COUNT,
        AggregationType.MIN,
        AggregationType.MAX,
    }
)


@dataclass(frozen=True)
class ReuseDecision:
    """Eligible transformation and predicates still applied to cached rows."""

    mode: ReuseMode
    leftover_filters: frozenset[Filter]


@dataclass(frozen=True)
class CachedEntry:
    """Bounded descriptor pointing to an expiring semantic result.

    Instances are pickled into the data cache and outlive the code that wrote
    them. A pickled dataclass restores its stored attributes without applying
    defaults for fields added later, so any change to this shape must bump
    ``cache_identity.IDENTITY_FORMAT_VERSION`` so that no bucket written by the
    previous shape is ever unpickled by the new one.
    """

    filters: frozenset[Filter]
    dimensions: frozenset[Dimension]
    metrics: frozenset[Metric]
    limit: int | None
    offset: int
    order_key: str
    group_limit_key: str
    value_key: str
    timestamp: float = field(default_factory=time)
    # TTL the value was stored with, so the bucket that indexes it can be kept
    # alive at least as long; None means the backend default.
    timeout: int | None = None


@dataclass(frozen=True)
class CachedResultCandidate:
    """Loaded cached value paired with its proven transformation."""

    entry: CachedEntry
    result: SemanticResult
    decision: ReuseDecision


@dataclass(frozen=True)
class SemanticCacheLookupResult:
    """Pure lookup output with deferred maintenance identities."""

    candidates: tuple[CachedResultCandidate, ...]
    missing_value_keys: frozenset[str]
