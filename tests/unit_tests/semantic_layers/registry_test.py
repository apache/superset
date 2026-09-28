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

from flask import Flask

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
