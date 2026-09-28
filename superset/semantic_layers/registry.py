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

from contextlib import contextmanager, nullcontext
from typing import Any, Iterator

from superset_core.extensions.types import Manifest
from superset_core.semantic_layers.layer import SemanticLayer

from superset.extensions.context import (
    extension_context,
    get_current_extension_context,
)
from superset.utils.core import get_user_id

registry: dict[str, type[SemanticLayer[Any, Any]]] = {}
_extension_manifests: dict[str, Manifest] = {}


def register_semantic_layer(
    semantic_layer_id: str,
    implementation: type[SemanticLayer[Any, Any]],
    manifest: Manifest | None = None,
) -> None:
    """Register a provider and retain the extension that owns it."""
    registry[semantic_layer_id] = implementation
    if manifest is None:
        _extension_manifests.pop(semantic_layer_id, None)
    else:
        _extension_manifests[semantic_layer_id] = manifest


def unregister_semantic_layer(semantic_layer_id: str) -> None:
    """Remove a provider and any retained extension metadata."""
    registry.pop(semantic_layer_id, None)
    _extension_manifests.pop(semantic_layer_id, None)


@contextmanager
def semantic_layer_context(semantic_layer_id: str) -> Iterator[None]:
    """Run provider code in its owning extension and principal context."""
    manifest = _extension_manifests.get(semantic_layer_id)
    current_context = get_current_extension_context()
    user_id = (
        current_context.user_id
        if current_context is not None and current_context.user_id is not None
        else get_user_id()
    )
    context = (
        extension_context(manifest, user_id=user_id)
        if manifest is not None
        else nullcontext()
    )
    with context:
        yield


class ContextualSemanticView:
    """Forward semantic view operations inside their extension context."""

    def __init__(self, semantic_layer_id: str, implementation: Any):
        self._semantic_layer_id = semantic_layer_id
        self._implementation = implementation

    def __getattr__(self, name: str) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return getattr(self._implementation, name)

    def uid(self) -> str:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.uid()

    def get_dimensions(self) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_dimensions()

    def get_metrics(self) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_metrics()

    def get_values(self, dimension: Any, filters: Any = None) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_values(dimension, filters)

    def get_table(self, query: Any) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_table(query)

    def get_row_count(self, query: Any) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_row_count(query)

    def get_compatible_metrics(
        self,
        selected_metrics: Any,
        selected_dimensions: Any,
    ) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_compatible_metrics(
                selected_metrics,
                selected_dimensions,
            )

    def get_compatible_dimensions(
        self,
        selected_metrics: Any,
        selected_dimensions: Any,
    ) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return self._implementation.get_compatible_dimensions(
                selected_metrics,
                selected_dimensions,
            )


class ContextualSemanticLayer:
    """Forward semantic layer operations inside their extension context."""

    def __init__(self, semantic_layer_id: str, implementation: Any):
        self._semantic_layer_id = semantic_layer_id
        self._implementation = implementation

    def __getattr__(self, name: str) -> Any:
        with semantic_layer_context(self._semantic_layer_id):
            return getattr(self._implementation, name)

    def get_semantic_views(self, runtime_configuration: dict[str, Any]) -> set[Any]:
        with semantic_layer_context(self._semantic_layer_id):
            views = self._implementation.get_semantic_views(runtime_configuration)
        return {ContextualSemanticView(self._semantic_layer_id, view) for view in views}

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> ContextualSemanticView:
        with semantic_layer_context(self._semantic_layer_id):
            view = self._implementation.get_semantic_view(
                name,
                additional_configuration,
            )
        return ContextualSemanticView(self._semantic_layer_id, view)


def contextualize_semantic_layer(
    semantic_layer_id: str,
    implementation: Any,
) -> Any:
    """Wrap extension providers while leaving host providers unchanged."""
    if semantic_layer_id not in _extension_manifests:
        return implementation
    return ContextualSemanticLayer(semantic_layer_id, implementation)
