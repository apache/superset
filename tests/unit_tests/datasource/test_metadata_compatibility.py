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

"""Snapshot-qualified compatibility; empty selections must see new metrics."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any, TYPE_CHECKING
from unittest.mock import Mock, patch, PropertyMock
from uuid import uuid4

import pyarrow as pa
import pytest
from flask import Flask
from flask.testing import FlaskClient
from superset_core.semantic_layers.types import Metric
from werkzeug.test import TestResponse

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticView

LEGACY_EMPTY_COMPATIBILITY_KEY: str = (
    "compatible:3b84728b1f315a83e836a0825d7efefa0ef295a36b821b3b9b6e555b8f77749a"
)


@pytest.fixture
def compatibility_context(
    app: Flask,
) -> Iterator[tuple[SemanticView, Mock, dict[str, Any]]]:
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    layer: SemanticLayer = SemanticLayer(uuid=uuid4(), type="test", configuration="{}")
    view: SemanticView = SemanticView(
        id=7, uuid=uuid4(), name="full", semantic_layer=layer, configuration="{}"
    )
    provider: Mock = Mock(metadata_cache_token="scope:r1")  # noqa: S106 - opaque test revision
    provider.uid.return_value = "test-view"
    metric: Metric = Metric("old", "old", pa.int64(), "SUM")
    provider.get_metrics.return_value = {metric}
    provider.get_dimensions.return_value = set()
    provider.get_compatible_metrics.return_value = {metric}
    provider.get_compatible_dimensions.return_value = set()
    view.__dict__["implementation"] = provider
    values: dict[str, Any] = {}
    cache: Mock = Mock()
    cache.get.side_effect = values.get
    cache.set.side_effect = lambda key, value, timeout: values.__setitem__(key, value)
    with (
        patch.object(SemanticView, "raise_for_access"),
        patch(
            "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
        ),
        patch("superset.datasource.api.cache_manager", Mock(data_cache=cache)),
        patch(
            "superset.semantic_layers.metadata.metadata_refresh_enabled",
            return_value=True,
        ),
        patch.dict("superset.semantic_layers.models.registry", {"test": Mock()}),
    ):
        yield view, provider, values


@pytest.mark.parametrize("selection", [[], ["old"]])
def test_new_snapshot_bypasses_unexpired_compatibility_for_every_selection(
    compatibility_context: tuple[SemanticView, Mock, dict[str, Any]],
    client: FlaskClient,
    full_api_access: None,
    selection: list[str],
) -> None:
    view: SemanticView
    provider: Mock
    values: dict[str, Any]
    view, provider, values = compatibility_context
    endpoint: str = "/api/v1/datasource/semantic_view/7/compatible"
    body: dict[str, list[str]] = {
        "selected_metrics": selection,
        "selected_dimensions": [],
    }
    before: TestResponse = client.post(endpoint, json=body)
    assert before.status_code == 200
    assert before.json["result"]["compatible_metrics"] == ["old"]
    provider.metadata_cache_token = "scope:r2"  # noqa: S105 - opaque test revision
    new_metric: Metric = Metric("new", "new", pa.int64(), "SUM")
    provider.get_metrics.return_value = {new_metric}
    provider.get_compatible_metrics.return_value = {new_metric}
    after: TestResponse = client.post(endpoint, json=body)
    assert after.status_code == 200
    assert after.json["result"]["compatible_metrics"] == ["new"]
    assert len(values) == 2


def test_same_snapshot_with_changed_view_allow_list_uses_another_key(
    compatibility_context: tuple[SemanticView, Mock, dict[str, Any]],
    client: FlaskClient,
    full_api_access: None,
) -> None:
    view: SemanticView
    provider: Mock
    values: dict[str, Any]
    view, provider, values = compatibility_context
    endpoint: str = "/api/v1/datasource/semantic_view/7/compatible"
    assert client.post(endpoint, json={}).status_code == 200
    view.configuration = '{"metrics": []}'
    provider.get_compatible_metrics.return_value = set()
    response: TestResponse = client.post(endpoint, json={})
    assert response.json["result"]["compatible_metrics"] == []
    assert len(values) == 2


def test_snapshot_capture_cannot_fill_new_revision_cache(
    compatibility_context: tuple[SemanticView, Mock, dict[str, Any]],
    client: FlaskClient,
    full_api_access: None,
) -> None:
    view: SemanticView
    provider: Mock
    values: dict[str, Any]
    view, provider, values = compatibility_context
    endpoint: str = "/api/v1/datasource/semantic_view/7/compatible"
    original: set[Metric] = provider.get_compatible_metrics.return_value

    def delayed_old_fill(*args: object) -> set[Metric]:
        provider.metadata_cache_token = "scope:r2"  # noqa: S105 - opaque test revision
        return original

    provider.get_compatible_metrics.side_effect = delayed_old_fill
    assert client.post(endpoint, json={}).status_code == 200
    provider.get_compatible_metrics.side_effect = None
    provider.get_compatible_metrics.return_value = set()
    response: TestResponse = client.post(endpoint, json={})
    assert response.json["result"]["compatible_metrics"] == []
    assert len(values) == 2


@pytest.mark.parametrize("selection", [[], ["old"]])
def test_relationship_change_with_identical_member_ids_refreshes_compatibility(
    compatibility_context: tuple[SemanticView, Mock, dict[str, Any]],
    client: FlaskClient,
    full_api_access: None,
    selection: list[str],
) -> None:
    """A relationship-only revision invalidates answers without adding members."""
    view: SemanticView
    provider: Mock
    values: dict[str, Any]
    view, provider, values = compatibility_context
    endpoint: str = "/api/v1/datasource/semantic_view/7/compatible"
    body: dict[str, list[str]] = {
        "selected_metrics": selection,
        "selected_dimensions": [],
    }
    original_members: set[Metric] = provider.get_metrics.return_value
    before: TestResponse = client.post(endpoint, json=body)
    assert before.status_code == 200
    assert before.json["result"]["compatible_metrics"] == ["old"]
    provider.metadata_cache_token = "scope:relationships-v2"  # noqa: S105
    provider.get_compatible_metrics.return_value = set()
    after: TestResponse = client.post(endpoint, json=body)
    assert after.status_code == 200
    assert after.json["result"]["compatible_metrics"] == []
    assert provider.get_metrics.return_value == original_members
    assert len(values) == 2


def test_denied_access_precedes_token_discovery_and_cache_lookup(
    compatibility_context: tuple[SemanticView, Mock, dict[str, Any]],
    client: FlaskClient,
    full_api_access: None,
) -> None:
    """Even a populated compatibility cache cannot bypass datasource access."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException
    from superset.semantic_layers.models import SemanticView

    view: SemanticView
    provider: Mock
    values: dict[str, Any]
    view, provider, values = compatibility_context
    endpoint: str = "/api/v1/datasource/semantic_view/7/compatible"
    assert client.post(endpoint, json={}).status_code == 200
    provider.reset_mock()
    error: SupersetError = SupersetError(
        message="Access denied",
        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )
    cache: Mock = Mock()
    token: PropertyMock
    with (
        patch.object(
            SemanticView,
            "raise_for_access",
            side_effect=SupersetSecurityException(error),
        ),
        patch.object(
            SemanticView, "metadata_cache_token", new_callable=PropertyMock
        ) as token,
        patch("superset.datasource.api.cache_manager", Mock(data_cache=cache)),
    ):
        response: TestResponse = client.post(endpoint, json={})
    assert response.status_code == 403
    token.assert_not_called()
    assert provider.mock_calls == []
    assert cache.mock_calls == []


@pytest.mark.parametrize("mode", ["flag_off", "unsupported", "no_token"])
def test_legacy_semantic_provider_uses_preexisting_compatibility_cache(
    compatibility_context: tuple[SemanticView, Mock, dict[str, Any]],
    client: FlaskClient,
    full_api_access: None,
    mode: str,
) -> None:
    """A legacy cache entry remains readable when no snapshot token participates."""
    view: SemanticView
    provider: Mock
    values: dict[str, Any]
    view, provider, values = compatibility_context
    # Fixed key from the pre-change uid/m/d cache contract, empty selections.
    legacy_key: str = LEGACY_EMPTY_COMPATIBILITY_KEY
    cached: dict[str, list[str]] = {
        "compatible_metrics": ["previously-cached"],
        "compatible_dimensions": [],
    }
    values[legacy_key] = cached
    declaration: Mock = Mock()
    declaration.supports_metadata_refresh.return_value = mode != "unsupported"
    if mode == "no_token":
        provider.metadata_cache_token = None
    with (
        patch(
            "superset.semantic_layers.metadata.metadata_refresh_enabled",
            return_value=mode != "flag_off",
        ),
        patch.dict("superset.semantic_layers.models.registry", {"test": declaration}),
    ):
        response: TestResponse = client.post(
            "/api/v1/datasource/semantic_view/7/compatible", json={}
        )
    assert response.status_code == 200
    assert response.json["result"] == cached
    provider.get_compatible_metrics.assert_not_called()
    provider.get_compatible_dimensions.assert_not_called()
    assert list(values) == [legacy_key]


def test_dataset_uses_preexisting_compatibility_cache_without_semantic_metadata(
    client: FlaskClient,
    full_api_access: None,
) -> None:
    """The dataset route retains its cache identity and avoids semantic tokens."""
    dataset: Mock = Mock(
        spec=[
            "uid",
            "cache_timeout",
            "raise_for_access",
            "get_compatible_metrics",
            "get_compatible_dimensions",
        ],
        uid="test-view",
        cache_timeout=300,
    )
    cached: dict[str, list[str]] = {
        "compatible_metrics": ["previously-cached"],
        "compatible_dimensions": [],
    }
    cache: Mock = Mock()
    cache.get.side_effect = {LEGACY_EMPTY_COMPATIBILITY_KEY: cached}.get
    with (
        patch(
            "superset.datasource.api.DatasourceDAO.get_datasource", return_value=dataset
        ),
        patch("superset.datasource.api.cache_manager", Mock(data_cache=cache)),
    ):
        response: TestResponse = client.post(
            "/api/v1/datasource/table/7/compatible", json={}
        )
    assert response.status_code == 200
    assert response.json["result"] == cached
    dataset.raise_for_access.assert_called_once_with()
    dataset.get_compatible_metrics.assert_not_called()
    dataset.get_compatible_dimensions.assert_not_called()
    cache.set.assert_not_called()
