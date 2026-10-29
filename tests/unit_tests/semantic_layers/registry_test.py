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

"""Tests for contextual semantic layer extension execution."""

from __future__ import annotations

from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pytest
from flask import Flask
from superset_core.semantic_layers.layer import SemanticLayerAuthenticationRequiredError

from superset.exceptions import OAuth2RedirectError
from superset.extensions.context import get_context
from superset.semantic_layers.registry import (
    contextualize_semantic_layer,
    register_semantic_layer,
    semantic_layer_context,
    unregister_semantic_layer,
)
from tests.unit_tests.extensions.storage.conftest import create_manifest


def test_semantic_layer_context_restores_extension_and_user(app: Flask) -> None:
    """Registered extension providers receive their manifest and principal."""
    manifest = create_manifest("acme", "semantic")
    implementation_class = MagicMock()
    semantic_layer_id = "extensions.acme.semantic.test"
    register_semantic_layer(semantic_layer_id, implementation_class, manifest)

    try:
        with app.app_context():
            with semantic_layer_context(semantic_layer_id):
                assert get_context().extension is manifest
    finally:
        unregister_semantic_layer(semantic_layer_id)


def test_contextual_layer_wraps_returned_view(app: Flask) -> None:
    """Calls on views returned by an extension retain extension context."""
    manifest = create_manifest("acme", "semantic")
    semantic_layer_id = "extensions.acme.semantic.test"
    implementation_class = MagicMock()
    register_semantic_layer(semantic_layer_id, implementation_class, manifest)

    view = MagicMock()
    view.uid.side_effect = lambda: get_context().extension.id
    layer = MagicMock()
    layer.get_semantic_view.return_value = view

    try:
        contextual_layer = contextualize_semantic_layer(semantic_layer_id, layer)
        with app.app_context():
            contextual_view = contextual_layer.get_semantic_view("orders", {})
            assert contextual_view.uid() == "acme.semantic"
    finally:
        unregister_semantic_layer(semantic_layer_id)


@pytest.mark.parametrize(
    "method,args",
    [
        ("get_dimensions", ()),
        ("get_metrics", ()),
        ("get_values", (None,)),
        ("get_table", (None,)),
        ("get_row_count", (None,)),
        ("get_compatible_metrics", (set(), set())),
        ("get_compatible_dimensions", (set(), set())),
    ],
)
@pytest.mark.parametrize("in_request", [True, False])
def test_view_authentication_uses_shared_oauth_error(
    app: Flask, method: str, args: tuple[object, ...], in_request: bool
) -> None:
    """Provider failures retain the originating view and shared UI contract."""
    app.add_url_rule(
        "/api/v1/semantic_layer/<uuid>/oauth2/<action_id>",
        endpoint="SemanticLayerRestApi.oauth2_start",
    )
    app.add_url_rule(
        "/api/v1/semantic_layer/oauth2/complete/<tab_id>",
        endpoint="SemanticLayerRestApi.oauth2_complete",
    )
    layer = MagicMock()
    view = MagicMock()
    getattr(view, method).side_effect = SemanticLayerAuthenticationRequiredError(
        "connect", "Provider details must stay on the server"
    )
    layer.get_semantic_view.return_value = view
    contextual_layer = contextualize_semantic_layer(
        "provider", layer, "layer-uuid", "view-uuid"
    )
    context = app.test_request_context() if in_request else app.app_context()
    with context:
        contextual_view = contextual_layer.get_semantic_view("orders", {})
        with pytest.raises(OAuth2RedirectError) as raised:
            getattr(contextual_view, method)(*args)
    error = raised.value.error
    assert error.error_type.value == "OAUTH2_REDIRECT"
    assert "Provider details" not in error.message
    url = urlparse(error.extra["url"])
    assert url.path == "/api/v1/semantic_layer/layer-uuid/oauth2/connect"
    query = parse_qs(url.query)
    assert query["view_uuid"] == ["view-uuid"]
    assert query["tab_id"] == [error.extra["tab_id"]]
    assert error.extra["redirect_uri"].endswith(error.extra["tab_id"])
