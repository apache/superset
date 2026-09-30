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

"""Rollout gating and scope injection happen before provider discovery."""

from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from flask import Flask
from superset_core.semantic_layers.metadata import MetadataRefreshError

from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError
from superset.semantic_layers.metadata import (
    bind_metadata_store,
    connection_metadata_scope,
    ScopedMetadataStore,
)
from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend


def test_disabled_rollout_does_not_touch_adapter_or_backend() -> None:
    app: Flask = Flask(__name__)
    layer: Mock = Mock()
    implementation: Mock = Mock()
    with (
        app.app_context(),
        patch(
            "superset.semantic_layers.metadata.is_feature_enabled", return_value=True
        ),
    ):
        bind_metadata_store(layer, implementation)
    implementation.metadata_refresh.bind.assert_not_called()


def test_enabled_rollout_binds_scoped_shared_store() -> None:
    app: Flask = Flask(__name__)
    app.config.update(
        SEMANTIC_LAYER_METADATA_REFRESH_ENABLED=True,
        SEMANTIC_LAYER_METADATA_NAMESPACE="tenant-a",
        SECRET_KEY="test-secret",  # noqa: S106 - synthetic configuration only
    )
    layer: Mock = Mock(uuid="connection", configuration='{"token":"test"}', type="test")
    implementation: Mock = Mock()
    with (
        app.app_context(),
        patch(
            "superset.semantic_layers.metadata.is_feature_enabled", return_value=True
        ),
        patch(
            "superset.semantic_layers.metadata.CoordinationService.get_backend",
            return_value=Mock(),
        ),
    ):
        bind_metadata_store(layer, implementation)
    implementation.metadata_refresh.bind.assert_called_once()


def test_enabled_provider_cannot_fall_back_without_shared_backend() -> None:
    app: Flask = Flask(__name__)
    app.config.update(
        SEMANTIC_LAYER_METADATA_REFRESH_ENABLED=True,
        SEMANTIC_LAYER_METADATA_NAMESPACE="tenant-a",
        SECRET_KEY="test-secret",  # noqa: S106 - synthetic configuration only
    )
    implementation: Mock = Mock()
    with (
        app.app_context(),
        patch(
            "superset.semantic_layers.metadata.is_feature_enabled", return_value=True
        ),
        patch(
            "superset.semantic_layers.metadata.CoordinationService.get_backend",
            return_value=None,
        ),
    ):
        with pytest.raises(MetadataRefreshError, match="unavailable"):
            bind_metadata_store(Mock(), implementation)
    implementation.metadata_refresh.bind.assert_not_called()


def test_unsupported_provider_remains_on_legacy_path() -> None:
    app: Flask = Flask(__name__)
    app.config.update(SEMANTIC_LAYER_METADATA_REFRESH_ENABLED=True)
    implementation: Mock = Mock(metadata_refresh=None)
    backend: Mock
    with (
        app.app_context(),
        patch(
            "superset.semantic_layers.metadata.is_feature_enabled", return_value=True
        ),
        patch(
            "superset.semantic_layers.metadata.CoordinationService.get_backend"
        ) as backend,
    ):
        bind_metadata_store(Mock(), implementation)
    backend.assert_not_called()


@pytest.mark.parametrize("disabled", ["rollout", "semantic_layers"])
def test_disable_during_fetch_prevents_publication(disabled: str) -> None:
    from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend

    app: Flask = Flask(__name__)
    app.config.update(
        SEMANTIC_LAYER_METADATA_REFRESH_ENABLED=True,
        SEMANTIC_LAYER_METADATA_NAMESPACE="tenant-a",
        SECRET_KEY="test-secret",  # noqa: S106 - synthetic configuration only
    )
    layer: Mock = Mock(uuid="connection", configuration="{}", type="test")
    implementation: Mock = Mock()
    backend: Mock = Mock(wraps=MemoryBackend())
    feature: Mock
    session: Mock
    with (
        app.app_context(),
        patch(
            "superset.semantic_layers.metadata.is_feature_enabled", return_value=True
        ) as feature,
        patch(
            "superset.semantic_layers.metadata.CoordinationService.get_backend",
            return_value=backend,
        ),
        patch("superset.semantic_layers.metadata.Session") as session,
    ):
        bind_metadata_store(layer, implementation)
        store: ScopedMetadataStore = (
            implementation.metadata_refresh.bind.call_args.args[0]
        )

        def fetch() -> str:
            if disabled == "rollout":
                app.config["SEMANTIC_LAYER_METADATA_REFRESH_ENABLED"] = False
            else:
                feature.return_value = False
            return '{"metrics": []}'

        with pytest.raises(MetadataRefreshError, match="^configuration_changed$"):
            store.refresh(fetch)
    backend.compare_and_publish.assert_not_called()
    session.assert_not_called()


@pytest.mark.parametrize("secret", ["test-secret", b"test-secret"])
def test_request_namespace_is_resolved_for_each_scope(secret: str | bytes) -> None:
    """A callable namespace follows the trusted request, with bytes-key parity."""
    app: Flask = Flask(__name__)
    namespace: Mock = Mock(side_effect=["tenant-a", "tenant-b", "tenant-a"])
    app.config.update(SEMANTIC_LAYER_METADATA_NAMESPACE=namespace, SECRET_KEY=secret)
    layer: Mock = Mock(uuid="connection", configuration="{}", type="test")
    with app.app_context():
        first: str = connection_metadata_scope(layer)
        second: str = connection_metadata_scope(layer)
        assert connection_metadata_scope(layer) == first
    assert first != second
    assert namespace.call_count == 3


@pytest.mark.parametrize("secret", [None, 42])
def test_non_string_signing_key_cannot_select_scope(secret: object) -> None:
    app: Flask = Flask(__name__)
    app.config.update(SEMANTIC_LAYER_METADATA_NAMESPACE="tenant", SECRET_KEY=secret)
    with app.app_context():
        with pytest.raises(MetadataRefreshError, match="^configuration$"):
            connection_metadata_scope(Mock())


@pytest.mark.parametrize(
    "outcome", ["allowed", "without_callback", "deleted", "changed", "denied"]
)
def test_bound_store_rechecks_persisted_connection_before_publication(
    outcome: str,
) -> None:
    """Only unchanged stored configuration and accepted authority may publish."""
    app: Flask = Flask(__name__)
    app.config.update(
        SEMANTIC_LAYER_METADATA_REFRESH_ENABLED=True,
        SEMANTIC_LAYER_METADATA_NAMESPACE="tenant",
        SECRET_KEY="test-secret",  # noqa: S106 - synthetic fixture
    )
    layer: Mock = Mock(uuid="connection", configuration="{}", type="test")
    fresh: Mock = Mock(uuid="connection", configuration="{}", type="test")
    if outcome == "changed":
        fresh.configuration = '{"environment_id": 999}'
    implementation: Mock = Mock()
    backend: Mock = Mock(wraps=MemoryBackend())
    guard: Mock | None = None if outcome == "without_callback" else Mock()
    if outcome == "denied":
        assert guard is not None
        guard.side_effect = SemanticLayerForbiddenError()
    session: Mock = Mock()
    session.get.return_value = None if outcome == "deleted" else fresh
    factory: Mock
    with (
        app.app_context(),
        patch(
            "superset.semantic_layers.metadata.is_feature_enabled", return_value=True
        ),
        patch(
            "superset.semantic_layers.metadata.CoordinationService.get_backend",
            return_value=backend,
        ),
        patch("superset.semantic_layers.metadata.db"),
        patch("superset.semantic_layers.metadata.Session") as factory,
    ):
        factory.return_value.__enter__.return_value = session
        bind_metadata_store(layer, implementation, before_publish=guard)
        store: ScopedMetadataStore = (
            implementation.metadata_refresh.bind.call_args.args[0]
        )
        if outcome in {"deleted", "changed"}:
            with pytest.raises(MetadataRefreshError, match="^configuration_changed$"):
                store.refresh(lambda: '{"metrics": []}')
        elif outcome == "denied":
            with pytest.raises(SemanticLayerForbiddenError):
                store.refresh(lambda: '{"metrics": []}')
        else:
            assert store.refresh(lambda: '{"metrics": []}').status == "changed"
    session.get.assert_called_once()
    factory.return_value.__exit__.assert_called_once()
    session.commit.assert_not_called()
    session.flush.assert_not_called()
    if outcome in {"allowed", "without_callback"}:
        backend.compare_and_publish.assert_called_once()
    else:
        backend.compare_and_publish.assert_not_called()
    if guard is not None:
        if outcome in {"allowed", "denied"}:
            guard.assert_called_once_with(session)
        else:
            guard.assert_not_called()
