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

"""Host construction and operation lifetime for optional shared metadata."""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING

from flask import current_app, has_app_context, has_request_context, request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from superset_core.semantic_layers.layer import SemanticLayer as LayerABC
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshError,
    remaining_budget,
)
from superset_core.semantic_layers.view import SemanticView as ViewABC

from superset import db, is_feature_enabled
from superset.coordination.deadline_backend import DeadlineRedisBackend
from superset.semantic_layers.metadata import (
    FETCH_DEADLINE_SECONDS,
    metadata_scope,
    ScopedMetadataStore,
)
from superset.semantic_layers.registry import registry
from superset.utils import json

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticLayer, SemanticView


logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class MetadataOperation:
    """One request or worker operation; nested discovery shares its deadline."""

    deadline: float
    layers: dict[str, LayerABC[Any, ViewABC]] = field(default_factory=dict)
    views: dict[tuple[str, str, str], ViewABC] = field(default_factory=dict)
    stores: dict[str, ScopedMetadataStore] = field(default_factory=dict)
    configurations: dict[str, dict[str, Any]] = field(default_factory=dict)


_OPERATION_KEY: str = "superset.semantic_metadata.operation"
_worker_operation: ContextVar[MetadataOperation | None] = ContextVar(
    _OPERATION_KEY, default=None
)


def request_metadata_budget() -> None:
    """Register before authentication hooks; this performs no provider or cache I/O."""
    if current_app.config.get("SEMANTIC_LAYER_METADATA_REFRESH_ENABLED") is True:
        request.environ.setdefault(
            _OPERATION_KEY, MetadataOperation(time.monotonic() + FETCH_DEADLINE_SECONDS)
        )


def _current_operation() -> MetadataOperation | None:
    if has_request_context():
        return request.environ.get(_OPERATION_KEY) or _worker_operation.get()
    return _worker_operation.get()


def _operation(*, require_budget: bool = True) -> MetadataOperation:
    state: MetadataOperation | None = _current_operation()
    if state is None or not math.isfinite(state.deadline):
        raise MetadataRefreshError("configuration")
    if require_budget:
        remaining_budget(state.deadline, now=time.monotonic())
    return state


def operation_deadline() -> float:
    return _operation().deadline


@contextmanager
def metadata_operation(*, deadline: float | None = None) -> Iterator[None]:
    """Workers opt in before access checks; nested calls never replenish the budget."""
    if deadline is not None and not math.isfinite(deadline):
        raise MetadataRefreshError("configuration")
    if deadline is not None:
        remaining_budget(deadline, now=time.monotonic())
    if _current_operation() is not None:
        _operation(require_budget=False)
        yield
        return
    if has_request_context():
        # HTTP requests must enter through the registered early request hook.
        raise MetadataRefreshError("configuration")
    ceiling: float = time.monotonic() + FETCH_DEADLINE_SECONDS
    state: MetadataOperation = MetadataOperation(
        min(deadline, ceiling) if deadline is not None else ceiling
    )
    token: Token[MetadataOperation | None] = _worker_operation.set(state)
    try:
        operation_deadline()
        yield
    finally:
        _worker_operation.reset(token)


def metadata_refresh_enabled() -> bool:
    return (
        has_app_context()
        and current_app.config.get("SEMANTIC_LAYER_METADATA_REFRESH_ENABLED") is True
        and is_feature_enabled("SEMANTIC_LAYERS")
    )


def _configuration(raw: str) -> dict[str, Any]:
    """Cache parsing by stored bytes; providers receive independent mutable copies."""
    state: MetadataOperation | None = _current_operation()
    if state is not None and raw in state.configurations:
        return deepcopy(state.configurations[raw])
    parsed: Any = json.loads(raw)
    if not isinstance(parsed, dict):
        raise MetadataRefreshError("configuration")
    if state is not None:
        state.configurations[raw] = parsed
    return deepcopy(parsed)


def participates(layer: SemanticLayer) -> bool:
    """Classify stored configuration without leaking parser or registry errors."""
    if not metadata_refresh_enabled():
        return False
    try:
        configuration: dict[str, Any] = _configuration(layer.configuration)
        return registry[layer.type].supports_metadata_refresh(configuration)
    except (KeyError, TypeError, ValueError):
        raise MetadataRefreshError("configuration") from None


def connection_metadata_scope(layer: SemanticLayer) -> str:
    namespace: Any = current_app.config.get("SEMANTIC_LAYER_METADATA_NAMESPACE")
    if callable(namespace):
        namespace = namespace()
    secret: Any = current_app.config.get("SECRET_KEY")
    if isinstance(secret, bytes):
        secret = secret.decode()
    if (
        not isinstance(namespace, str)
        or not isinstance(secret, str)
        or layer.uuid is None
    ):
        raise MetadataRefreshError("configuration")
    configuration: str = json.dumps(
        {"provider": layer.type, "configuration": _configuration(layer.configuration)},
        sort_keys=True,
    )
    return metadata_scope(secret, namespace, str(layer.uuid), configuration)


def connection_store(layer: SemanticLayer) -> ScopedMetadataStore:
    """Resolve only stored, server-owned scope and recheck it before publication."""
    state: MetadataOperation = _operation(require_budget=False)
    scope: str = connection_metadata_scope(layer)
    if scope in state.stores:
        return state.stores[scope]
    operation_deadline()
    config: Any = current_app.config.get("DISTRIBUTED_COORDINATION_CONFIG")
    if not isinstance(config, dict):
        raise MetadataRefreshError("unavailable")
    try:
        backend: DeadlineRedisBackend = DeadlineRedisBackend(
            config, deadline=state.deadline
        )
    except ValueError:
        raise MetadataRefreshError("configuration") from None

    def revalidate() -> None:
        # Avoid app-init regression: binding loads before encrypted model fields.
        from superset.semantic_layers.models import SemanticLayer

        if not participates(layer):
            raise MetadataRefreshError("configuration_changed")
        session: Session
        try:
            with Session(
                bind=db.session.get_bind(mapper=SemanticLayer), autoflush=False
            ) as session:
                fresh: SemanticLayer | None = session.get(SemanticLayer, layer.uuid)
                if fresh is None or connection_metadata_scope(fresh) != scope:
                    raise MetadataRefreshError("configuration_changed")
        except SQLAlchemyError:
            logger.warning("Metadata layer revalidation failed", exc_info=True)
            raise MetadataRefreshError("unavailable") from None

    store: ScopedMetadataStore = ScopedMetadataStore(
        backend,
        scope,
        deadline=state.deadline,
        snapshot_ttl_seconds=current_app.config[
            "SEMANTIC_LAYER_METADATA_SNAPSHOT_TTL_SECONDS"
        ],
        before_publish=revalidate,
    )
    state.stores[scope] = store
    return store


def layer_implementation(layer: SemanticLayer) -> LayerABC[Any, ViewABC]:
    """Construct once per operation, binding the store before any discovery."""
    state: MetadataOperation = _operation(require_budget=False)
    scope: str = connection_metadata_scope(layer)
    if scope not in state.layers:
        operation_deadline()
        store: ScopedMetadataStore = connection_store(layer)
        implementation: LayerABC[Any, ViewABC] = registry[
            layer.type
        ].from_configuration(_configuration(layer.configuration))
        if implementation.metadata_refresh is None:
            raise MetadataRefreshError("configuration")
        implementation.metadata_refresh.bind(store, deadline=state.deadline)
        state.layers[scope] = implementation
    return state.layers[scope]


def _view_key(view: SemanticView) -> tuple[str, str, str]:
    """Identify a configured view within one metadata operation."""
    return (
        connection_metadata_scope(view.semantic_layer),
        str(view.uuid),
        json.dumps([view.name, _configuration(view.configuration)], sort_keys=True),
    )


def peek_view_metadata_token(view: SemanticView) -> str | None:
    """Use a captured view or stored snapshot without constructing a provider."""
    state: MetadataOperation = _operation(require_budget=False)
    captured: ViewABC | None = state.views.get(_view_key(view))
    if captured is not None:
        # An in-flight annotation query must retain its own observation even if
        # another request publishes a newer catalog before its host key is built.
        return view_implementation(view).metadata_cache_token
    snapshot: CatalogSnapshot | None = connection_store(view.semantic_layer).peek()
    return snapshot.cache_token if snapshot is not None else None


def view_implementation(view: SemanticView) -> ViewABC:
    """A view captures one observation for this operation, never across requests."""
    state: MetadataOperation = _operation(require_budget=False)
    key: tuple[str, str, str] = _view_key(view)
    implementation: ViewABC | None = state.views.get(key)
    if implementation is None:
        operation_deadline()
        implementation = layer_implementation(view.semantic_layer).get_semantic_view(
            view.name, _configuration(view.configuration)
        )
    token: str | None = implementation.metadata_cache_token
    if (
        not isinstance(token, str)
        or not token
        or connection_store(view.semantic_layer).observed_at(token) is None
    ):
        raise MetadataRefreshError("configuration")
    state.views[key] = implementation
    return implementation
