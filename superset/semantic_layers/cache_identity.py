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

"""Immutable identity values for semantic containment caching."""

from __future__ import annotations

import hashlib
from collections.abc import Mapping as MappingABC
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Mapping

from superset_core.semantic_layers.types import (
    AdhocExpression,
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    OrderTuple,
    SemanticQuery,
)

from superset.utils import json

IDENTITY_FORMAT_VERSION: str = "v2"
_SENSITIVE_KEY_PARTS: tuple[str, ...] = (
    "credential",
    "password",
    "secret",
    "token",
)


class SensitiveIdentityMaterialError(ValueError):
    """Raised when raw secret-like material is offered for cache identity."""


def _find_sensitive_paths(value: object, prefix: str = "") -> list[str]:
    sensitive_paths: list[str] = []
    if isinstance(value, MappingABC):
        for key, nested_value in value.items():
            key_text: str = str(key)
            path: str = f"{prefix}.{key_text}" if prefix else key_text
            if any(part in key_text.casefold() for part in _SENSITIVE_KEY_PARTS):
                sensitive_paths.append(path)
            sensitive_paths.extend(_find_sensitive_paths(nested_value, path))
    elif isinstance(value, (list, tuple)):
        for index, nested_value in enumerate(value):
            path = f"{prefix}[{index}]"
            sensitive_paths.extend(_find_sensitive_paths(nested_value, path))
    return sensitive_paths


@dataclass(frozen=True)
class SemanticViewIdentity:
    """Stable identity of a semantic view."""

    value: str


@dataclass(frozen=True)
class SemanticDefinitionIdentity:
    """Versioned digest of result-affecting semantic-view definition fields."""

    digest: str


@dataclass(frozen=True)
class SemanticCacheProviderIdentity:
    """Versioned digest of result-affecting provider configuration."""

    digest: str


@dataclass(frozen=True)
class SemanticCacheScopeIdentity:
    """Digest separating global or execution-context cache scopes."""

    digest: str


class SemanticCacheIdentityFactory:
    """Create deterministic, versioned identities from secret-safe material."""

    @classmethod
    def definition(
        cls,
        material: Mapping[str, object],
    ) -> SemanticDefinitionIdentity:
        """Create a semantic-definition identity."""
        return SemanticDefinitionIdentity(cls._digest(material))

    @classmethod
    def provider(
        cls,
        material: Mapping[str, object],
    ) -> SemanticCacheProviderIdentity:
        """Create a provider-configuration identity."""
        return SemanticCacheProviderIdentity(cls._digest(material))

    @classmethod
    def scope(
        cls,
        material: Mapping[str, object],
    ) -> SemanticCacheScopeIdentity:
        """Create an execution-scope identity."""
        return SemanticCacheScopeIdentity(cls._digest(material))

    @classmethod
    def query(cls, query: SemanticQuery) -> str:
        """Create a logical identity from every result-affecting query field."""
        digest: str = cls._digest(_canonical_query(query))
        return f"semantic-cache:query:{digest}"

    @classmethod
    def bucket(
        cls,
        view: SemanticViewIdentity,
        definition: SemanticDefinitionIdentity,
        provider: SemanticCacheProviderIdentity,
        scope: SemanticCacheScopeIdentity,
    ) -> str:
        """Create a descriptor-bucket identity from all host boundaries."""
        digest: str = cls._digest(
            {
                "view": view.value,
                "definition": definition.digest,
                "provider": provider.digest,
                "scope": scope.digest,
            }
        )
        return f"semantic-cache:bucket:{digest}"

    @classmethod
    def value(cls, bucket: str, query: SemanticQuery) -> str:
        """Create a result-value identity within a host boundary bucket."""
        digest: str = cls._digest({"bucket": bucket, "query": cls.query(query)})
        return f"semantic-cache:value:{digest}"

    @staticmethod
    def order(order: list[OrderTuple] | None) -> str:
        """Serialize ordering for descriptor compatibility checks."""
        if not order:
            return ""
        return _canonical_json(
            [
                {
                    "element": _canonical_orderable(element),
                    "direction": direction.value,
                }
                for element, direction in order
            ]
        )

    @staticmethod
    def group_limit(group_limit: GroupLimit | None) -> str:
        """Serialize group-limit behavior for descriptor compatibility checks."""
        if group_limit is None:
            return ""
        return _canonical_json(_canonical_group_limit(group_limit))

    @staticmethod
    def _digest(material: Mapping[str, object]) -> str:
        sensitive_paths: list[str] = _find_sensitive_paths(material)
        if sensitive_paths:
            joined_keys: str = ", ".join(sorted(sensitive_paths))
            raise SensitiveIdentityMaterialError(
                f"Secret-like identity fields are not allowed: {joined_keys}"
            )

        canonical: str = json.dumps(
            material,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        payload: bytes = f"{IDENTITY_FORMAT_VERSION}:{canonical}".encode()
        return f"{IDENTITY_FORMAT_VERSION}:{hashlib.sha256(payload).hexdigest()}"


def _canonical_query(query: SemanticQuery) -> Mapping[str, object]:
    return {
        "metrics": [_canonical_metric(metric) for metric in query.metrics],
        "dimensions": [
            _canonical_dimension(dimension) for dimension in query.dimensions
        ],
        "filters": _canonical_filters(query.filters),
        "order": [
            {
                "element": _canonical_orderable(element),
                "direction": direction.value,
            }
            for element, direction in query.order or []
        ],
        "limit": query.limit,
        "offset": query.offset or 0,
        "group_limit": _canonical_group_limit(query.group_limit),
    }


def _canonical_metric(metric: Metric) -> Mapping[str, object]:
    return {
        "id": metric.id,
        "name": metric.name,
        "type": str(metric.type),
        "definition": metric.definition,
        "aggregation": metric.aggregation.value if metric.aggregation else None,
    }


def _canonical_dimension(dimension: Dimension) -> Mapping[str, object]:
    return {
        "id": dimension.id,
        "name": dimension.name,
        "type": str(dimension.type),
        "definition": dimension.definition,
        "grain": (
            {
                "name": dimension.grain.name,
                "representation": dimension.grain.representation,
            }
            if dimension.grain
            else None
        ),
    }


def semantic_dimension_key(dimension: Dimension) -> str:
    """Return a dimension identity that distinguishes requested grains."""
    if dimension.grain is None:
        return dimension.id
    return f"{dimension.id}@{dimension.grain.representation}"


def _canonical_filter(filter_: Filter) -> Mapping[str, object]:
    return {
        "type": filter_.type.value,
        "column": filter_.column.id if filter_.column else None,
        "operator": filter_.operator.value,
        "value": _canonical_value(filter_.value),
    }


def _canonical_filters(filters: set[Filter] | None) -> list[Mapping[str, object]]:
    canonical: list[Mapping[str, object]] = [
        _canonical_filter(filter_) for filter_ in filters or set()
    ]
    return sorted(canonical, key=_canonical_json)


def _canonical_value(value: object) -> Mapping[str, object]:
    if isinstance(value, frozenset):
        items: list[Mapping[str, object]] = [_canonical_value(item) for item in value]
        return {"type": "frozenset", "value": sorted(items, key=_canonical_json)}
    if isinstance(value, tuple):
        return {"type": "tuple", "value": [_canonical_value(item) for item in value]}
    if isinstance(value, datetime):
        return {"type": "datetime", "value": value.isoformat()}
    if isinstance(value, date):
        return {"type": "date", "value": value.isoformat()}
    if isinstance(value, time):
        return {"type": "time", "value": value.isoformat()}
    if isinstance(value, timedelta):
        return {"type": "timedelta", "value": value.total_seconds()}
    return {"type": type(value).__name__, "value": value}


def _canonical_orderable(
    element: Metric | Dimension | AdhocExpression,
) -> Mapping[str, object]:
    if isinstance(element, Metric):
        return {"kind": "metric", **_canonical_metric(element)}
    if isinstance(element, Dimension):
        return {"kind": "dimension", **_canonical_dimension(element)}
    return {"kind": "adhoc", "id": element.id, "definition": element.definition}


def _canonical_group_limit(group_limit: GroupLimit | None) -> object:
    if group_limit is None:
        return None
    return {
        "dimensions": [
            _canonical_dimension(dimension) for dimension in group_limit.dimensions
        ],
        "top": group_limit.top,
        "metric": (
            _canonical_metric(group_limit.metric) if group_limit.metric else None
        ),
        "direction": group_limit.direction.value,
        "group_others": group_limit.group_others,
        "filters": _canonical_filters(group_limit.filters),
    }


def _canonical_json(value: object) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
