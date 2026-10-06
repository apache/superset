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

"""Compatibility invalidation is independent and never relabels an old fill."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from flask import Flask
from superset_core.semantic_layers.metadata import CatalogSnapshot, MetadataRefreshError

from superset.semantic_layers.metadata import ScopedMetadataStore
from superset.semantic_layers.metadata_cache import (
    compatibility_identity,
    CompatibilityIdentity,
)
from superset.semantic_layers.models import SemanticView
from tests.unit_tests.semantic_layers.metadata_identity_test import ResultView, view_for
from tests.unit_tests.semantic_layers.metadata_store_test import catalog, MemoryBackend


def test_compatibility_clear_retires_old_fill_without_catalog_work(app: Flask) -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    snapshot: CatalogSnapshot = store.read(catalog, deadline=store_deadline)
    view: SemanticView = view_for(ResultView(snapshot.cache_token, 17))
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_cache.connection_store",
            return_value=store,
        ),
        patch.object(
            type(view),
            "implementation",
            new=property(lambda self: self.__dict__["_fixture_implementation"]),
        ),
    ):
        old: CompatibilityIdentity | None = compatibility_identity(view, ["orders"], [])
        assert old is not None
        store.invalidate_compatibility()
        new: CompatibilityIdentity | None = compatibility_identity(view, ["orders"], [])
        assert new is not None
        assert old.key != new.key
        assert store.read(catalog, deadline=store_deadline) == snapshot
        assert old.source_observed_at == snapshot.observed_at
        # A late fill keeps the key captured before clear; it cannot change new.key.
        repeated: CompatibilityIdentity | None = compatibility_identity(
            view, ["orders"], []
        )
        assert repeated is not None
        assert repeated.key == new.key


def test_inspection_of_missing_catalog_does_not_fill_or_create_generation(
    app: Flask,
) -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    view: SemanticView = view_for(ResultView("unused", 17))
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_cache.connection_store",
            return_value=store,
        ),
        patch.object(
            type(view),
            "implementation",
            new=property(
                lambda self: (_ for _ in ()).throw(AssertionError("discovery"))
            ),
        ),
    ):
        assert compatibility_identity(view, [], [], inspection=True) is None
    assert backend.entries == {}


def test_inspection_reuses_current_identity_without_creating_a_generation(
    app: Flask,
) -> None:
    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    snapshot: CatalogSnapshot = store.read(catalog, deadline=store_deadline)
    view: SemanticView = view_for(ResultView(snapshot.cache_token, 17))
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_cache.connection_store",
            return_value=store,
        ),
        patch.object(
            type(view),
            "implementation",
            new=property(lambda self: self.__dict__["_fixture_implementation"]),
        ),
    ):
        assert compatibility_identity(view, [], [], inspection=True) is None
        current: CompatibilityIdentity | None = compatibility_identity(view, [], [])
        original: dict[str, tuple[bytes, float | None]] = dict(backend.entries)
        assert compatibility_identity(view, [], [], inspection=True) == current
        assert backend.entries == original
        view.__dict__["_fixture_implementation"].token = ""
        with pytest.raises(MetadataRefreshError, match="configuration"):
            compatibility_identity(view, [], [])


def test_actual_compatible_endpoint_uses_snapshot_and_generation_identity(
    app: Flask,
) -> None:
    import inspect
    from types import SimpleNamespace

    from flask_caching import Cache

    from superset.datasource.api import DatasourceRestApi
    from superset.semantic_layers.registry import registry
    from tests.unit_tests.semantic_layers.metadata_identity_test import RefreshLayer

    backend: MemoryBackend = MemoryBackend()
    store_deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=store_deadline
    )
    snapshot: CatalogSnapshot = store.read(catalog, deadline=store_deadline)
    provider: ResultView = ResultView(snapshot.cache_token, 17)
    view: SemanticView = view_for(provider)
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    api: DatasourceRestApi = DatasourceRestApi()
    expected: list[str] = ["old"]
    with (
        app.test_request_context(
            json={"selected_metrics": [], "selected_dimensions": []}
        ),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch.dict(registry, {"cache-test": RefreshLayer}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_cache.connection_store",
            return_value=store,
        ),
        patch.object(
            SemanticView, "implementation", new=property(lambda self: provider)
        ),
        patch.object(SemanticView, "raise_for_access"),
        patch.object(
            SemanticView,
            "get_compatible_metrics",
            side_effect=lambda *args: list(expected),
        ),
        patch.object(SemanticView, "get_compatible_dimensions", return_value=[]),
        patch(
            "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
        ),
        patch(
            "superset.datasource.api.cache_manager", SimpleNamespace(data_cache=cache)
        ),
        patch.object(
            api, "response", side_effect=lambda status, **kwargs: (status, kwargs)
        ),
    ):
        endpoint: Callable[..., Any] = inspect.unwrap(DatasourceRestApi.compatible)
        assert endpoint(api, "semantic_view", 11)[1]["result"][
            "compatible_metrics"
        ] == ["old"]
        expected[:] = ["new"]
        # Warm hit before invalidation still returns the old answer.
        assert endpoint(api, "semantic_view", 11)[1]["result"][
            "compatible_metrics"
        ] == ["old"]
        store.invalidate_compatibility()
        result: dict[str, Any] = endpoint(api, "semantic_view", 11)[1]["result"]
        assert result == {"compatible_metrics": ["new"], "compatible_dimensions": []}
        assert endpoint(api, "semantic_view", 11)[1]["result"] == result
        expected[:] = ["newer"]
        provider.token = store.refresh(
            catalog, deadline=store_deadline
        ).snapshot.cache_token
        assert endpoint(api, "semantic_view", 11)[1]["result"][
            "compatible_metrics"
        ] == ["newer"]


def test_clear_during_provider_resolution_does_not_relabel_old_observation(
    app: Flask,
) -> None:
    """Capture the generation before provider code can yield to a clear."""
    backend: MemoryBackend = MemoryBackend()
    deadline: float = time.monotonic() + 5
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=deadline
    )
    snapshot: CatalogSnapshot = store.read(catalog, deadline=deadline)
    provider: ResultView = ResultView(snapshot.cache_token, 17)
    view: SemanticView = view_for(provider)
    with patch(
        "superset.semantic_layers.metadata_cache.connection_store", return_value=store
    ):
        with patch.object(
            SemanticView, "implementation", new=property(lambda self: provider)
        ):
            old: CompatibilityIdentity | None = compatibility_identity(
                view, ["orders"], []
            )

        def capture_before_clear(model: SemanticView) -> ResultView:
            """The provider observation precedes invalidation; returning it follows."""
            store.invalidate_compatibility()
            return provider

        with patch.object(
            SemanticView, "implementation", new=property(capture_before_clear)
        ):
            captured: CompatibilityIdentity | None = compatibility_identity(
                view, ["orders"], []
            )
        with patch.object(
            SemanticView, "implementation", new=property(lambda self: provider)
        ):
            current: CompatibilityIdentity | None = compatibility_identity(
                view, ["orders"], []
            )
    assert old is not None
    assert captured is not None
    assert current is not None
    assert captured.key == old.key
    assert captured.key != current.key


@pytest.mark.parametrize("retire", ["unknown", "expired"])
def test_compatibility_rejects_token_without_a_current_observation(
    app: Flask, retire: str
) -> None:
    """A nonempty provider token cannot authorize a key without store provenance."""
    clock: list[float] = [100.0]
    backend: MemoryBackend = MemoryBackend(clock=lambda: clock[0])
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend,
        "scope",
        deadline=200.0,
        snapshot_ttl_seconds=10,
        clock=lambda: clock[0],
    )
    snapshot: CatalogSnapshot = store.read(catalog, deadline=200.0)
    provider: ResultView = ResultView(snapshot.cache_token, 17)
    view: SemanticView = view_for(provider)
    if retire == "unknown":
        provider.token = uuid4().hex
    else:
        clock[0] += 11.0
        assert store.peek() is None
    # A new operation has not captured the provider's claimed observation.
    store = ScopedMetadataStore(
        backend, "scope", deadline=200.0, clock=lambda: clock[0]
    )
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_cache.connection_store",
            return_value=store,
        ),
        patch.object(
            SemanticView, "implementation", new=property(lambda self: provider)
        ),
        pytest.raises(MetadataRefreshError, match="configuration"),
    ):
        compatibility_identity(view, ["orders"], [])
