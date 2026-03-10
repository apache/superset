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

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def test_semantic_layer_stub_raises() -> None:
    """The stub decorator raises NotImplementedError before initialization."""
    import importlib

    import superset_core.semantic_layers.decorators as mod

    # Reload to get the original stub (injection may have replaced it)
    importlib.reload(mod)

    with pytest.raises(NotImplementedError):
        mod.semantic_layer(id="test", name="Test")


def test_inject_semantic_layer_host_context() -> None:
    """The injected decorator registers a class in host context."""
    from superset.semantic_layers.registry import registry

    # Clear registry for test isolation
    registry.clear()

    with patch(
        "superset.core.api.core_api_injection.get_current_extension_context",
        return_value=None,
    ):
        from superset.core.api.core_api_injection import (
            inject_semantic_layer_implementations,
        )

        inject_semantic_layer_implementations()

    import superset_core.semantic_layers.decorators as mod

    @mod.semantic_layer(id="test_layer", name="Test Layer", description="A test")
    class FakeLayer:
        pass

    assert "test_layer" in registry
    assert registry["test_layer"] is FakeLayer
    assert FakeLayer.name == "Test Layer"  # type: ignore[attr-defined]
    assert FakeLayer.description == "A test"  # type: ignore[attr-defined]

    # Cleanup
    registry.pop("test_layer", None)


def test_inject_semantic_layer_extension_context() -> None:
    """The injected decorator prefixes ID in extension context."""
    from superset.semantic_layers.registry import registry

    registry.clear()

    mock_context = MagicMock()
    mock_context.manifest.publisher = "acme"
    mock_context.manifest.name = "analytics"

    with patch(
        "superset.core.api.core_api_injection.get_current_extension_context",
        return_value=None,
    ):
        from superset.core.api.core_api_injection import (
            inject_semantic_layer_implementations,
        )

        inject_semantic_layer_implementations()

    import superset_core.semantic_layers.decorators as mod

    # Now simulate extension context for the decorator call
    with patch(
        "superset.core.api.core_api_injection.get_current_extension_context",
        return_value=mock_context,
    ):
        # Re-inject so the closure captures the mock context
        inject_semantic_layer_implementations()

    @mod.semantic_layer(id="ext_layer", name="Extension Layer")
    class ExtLayer:
        pass

    expected_id = "extensions.acme.analytics.ext_layer"
    assert expected_id in registry
    assert registry[expected_id] is ExtLayer

    # Cleanup
    registry.pop(expected_id, None)
