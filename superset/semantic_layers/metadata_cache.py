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

"""Captured catalog identity for derived caches and read-only inspection."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import TYPE_CHECKING
from uuid import uuid4

from superset_core.semantic_layers.metadata import CatalogSnapshot, MetadataRefreshError

from superset.semantic_layers import metadata_binding
from superset.semantic_layers.metadata import ScopedMetadataStore
from superset.semantic_layers.metadata_binding import connection_store
from superset.utils import json

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticView


@dataclass(frozen=True)
class CompatibilityIdentity:
    key: str = field(repr=False)
    source_observed_at: str | None


def view_cache_token(view: SemanticView, token: str) -> str:
    """Include host view configuration without revealing it in cache keys."""
    identity: str = json.dumps(
        [token, str(view.uuid), view.name, json.loads(view.configuration)],
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return hashlib.sha256(identity.encode()).hexdigest()


def annotation_cache_token(view: SemanticView) -> str | None:
    """Key a host chart without discovering its annotation source's metadata."""
    if not metadata_binding.participates(view.semantic_layer):
        return None
    try:
        token: str | None = metadata_binding.peek_view_metadata_token(view)
        if token:
            return view_cache_token(view, token)
    except MetadataRefreshError:
        pass
    # Missing/expired/unreadable metadata cannot establish that cached annotation
    # data is current. A unique key forces a miss, including across failed reads.
    return "uncaptured:" + uuid4().hex


def compatibility_identity(
    view: SemanticView,
    metrics: list[str],
    dimensions: list[str],
    *,
    inspection: bool = False,
) -> CompatibilityIdentity | None:
    """Capture identity before lookup; inspection never discovers or initializes."""
    store: ScopedMetadataStore = connection_store(view.semantic_layer)
    token: str
    generation: str | None
    observed: str | None
    if inspection:
        snapshot: CatalogSnapshot | None = store.peek()
        generation = store.peek_compatibility_generation()
        if snapshot is None or generation is None:
            return None
        token, observed = snapshot.cache_token, snapshot.observed_at
    else:
        generation = store.compatibility_generation()
        captured: str | None = view.implementation.metadata_cache_token
        if not captured:
            raise MetadataRefreshError("configuration")
        token = captured
        observed = store.observed_at(token)
    key: str = (
        "compatible:"
        + hashlib.sha256(
            json.dumps(
                {
                    "metadata": view_cache_token(view, token),
                    "generation": generation,
                    "m": sorted(metrics),
                    "d": sorted(dimensions),
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
    )
    return CompatibilityIdentity(key, observed)
