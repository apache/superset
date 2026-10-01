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

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from flask import current_app, g, has_request_context, Request, request
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session
from superset_core.semantic_layers.layer import SemanticLayer as SemanticLayerABC
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    MetadataRefreshResult,
)
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC

from superset import cache_manager, security_manager
from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerForbiddenError,
    SemanticLayerNotFoundError,
    SemanticViewNotFoundError,
)
from superset.commands.utils import current_user_can_modify_object
from superset.coordination.deadline_backend import DeadlineRedisBackend
from superset.daos.semantic_layer import SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.semantic_layers.cache_inspection import CacheEntryInfo, inspect_data_cache
from superset.semantic_layers.metadata import ScopedMetadataStore
from superset.semantic_layers.metadata_binding import (
    connection_metadata_scope,
    metadata_refresh_enabled,
    operation_deadline,
    participates,
)
from superset.semantic_layers.metadata_cache import (
    compatibility_identity,
    CompatibilityIdentity,
)
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from superset.utils import json


def authorize_metadata_refresh(view: SemanticView) -> None:
    """Share one server policy between the affordance and direct mutation."""
    if not metadata_refresh_enabled():
        raise SemanticViewNotFoundError()
    user: User | None = getattr(g, "user", None)
    if (
        user is None
        or user.is_anonymous
        or getattr(user, "is_guest_user", False)
        or not user.is_active
    ):
        raise SemanticLayerForbiddenError()
    if not all(
        security_manager.can_access(action, resource)
        for action, resource in (
            ("can_read", "SemanticView"),
            ("can_read", "SemanticLayer"),
            ("can_write", "SemanticLayer"),
        )
    ):
        raise SemanticLayerForbiddenError()
    layer: SemanticLayer | None = view.semantic_layer
    if layer is None:
        raise SemanticLayerNotFoundError()
    try:
        view.raise_for_access()
        layer.raise_for_access()
    except SupersetSecurityException:
        raise SemanticLayerForbiddenError() from None
    if not current_user_can_modify_object(layer):
        raise SemanticLayerForbiddenError()
    if layer.type not in registry:
        raise MetadataRefreshError("unsupported")
    if not participates(layer):
        raise MetadataRefreshError("unsupported")
    connection_metadata_scope(layer)


def can_refresh_metadata(view: SemanticView) -> bool:
    """Project policy without constructing a provider or consulting its catalog."""
    try:
        authorize_metadata_refresh(view)
    except (
        SemanticViewNotFoundError,
        SemanticLayerNotFoundError,
        SemanticLayerForbiddenError,
        MetadataRefreshError,
    ):
        return False
    return True


def view_binding(view: SemanticView) -> tuple[str, str, str]:
    """Capture immutable provider selection, independent of Details drafts."""
    return (
        str(view.semantic_layer_uuid),
        view.name,
        json.dumps(json.loads(view.configuration), sort_keys=True),
    )


@contextmanager
def fresh_refresh_authority(session: Session) -> Iterator[None]:
    """Run existing policy against persisted authority without ending request work.

    Security-manager and subject helpers use the request-scoped session and
    principal. Rebind those only for this guard so they cannot reuse an earlier
    repeatable-read snapshot or cached role membership. The supplied session
    owns no writes; the caller closes it. Always restore the request's objects.
    """
    original_user: User = g.user
    original_session: Session = db.session()
    had_login_user: bool = hasattr(g, "_login_user")
    original_login_user: Any = getattr(g, "_login_user", None)
    if original_user.is_anonymous or getattr(original_user, "is_guest_user", False):
        raise SemanticLayerForbiddenError()
    user: User | None = session.get(security_manager.user_model, original_user.id)
    if user is None or not user.is_active:
        raise SemanticLayerForbiddenError()
    current_request: Request | None = (
        request._get_current_object() if has_request_context() else None
    )
    had_subject_cache: bool = current_request is not None and hasattr(
        current_request, "_user_subject_ids"
    )
    original_subject_cache: dict[int, list[int]] | None = getattr(
        current_request, "_user_subject_ids", None
    )
    try:
        if current_request is not None:
            current_request._user_subject_ids = {}
        db.session.registry.set(session)
        g.user = user
        g._login_user = user
        with session.no_autoflush:
            yield
    finally:
        if current_request is not None:
            if had_subject_cache:
                current_request._user_subject_ids = original_subject_cache
            else:
                current_request.__dict__.pop("_user_subject_ids", None)
        g.user = original_user
        if had_login_user:
            g._login_user = original_login_user
        else:
            g.pop("_login_user", None)
        db.session.registry.set(original_session)


def guarded_store(
    view: SemanticView, *, before_publish: Callable[[], None]
) -> ScopedMetadataStore:
    """Bind command-specific fresh authority to the unchanged host store contract."""
    deadline: float = operation_deadline()
    config: Any = current_app.config.get("DISTRIBUTED_COORDINATION_CONFIG")
    if not isinstance(config, dict):
        raise MetadataRefreshError("unavailable")
    try:
        backend: DeadlineRedisBackend = DeadlineRedisBackend(config, deadline=deadline)
    except ValueError:
        raise MetadataRefreshError("configuration") from None
    return ScopedMetadataStore(
        backend,
        connection_metadata_scope(view.semantic_layer),
        deadline=deadline,
        before_publish=before_publish,
    )


class MetadataCommand(BaseCommand):
    """Resolve stored scope and connection-management authority in fresh reads."""

    def __init__(self, view_uuid: UUID) -> None:
        if not isinstance(view_uuid, UUID):
            raise SemanticViewNotFoundError()
        self._view_uuid: UUID = view_uuid
        self._view: SemanticView | None = None
        self._binding: tuple[str, str, str] | None = None
        self._scope: str | None = None

    def validate(self) -> None:
        """Reject unavailable targets and authority before provider/cache work."""
        if not metadata_refresh_enabled():
            raise SemanticViewNotFoundError()
        operation_deadline()
        session: Session
        with (
            Session(
                bind=db.session.get_bind(mapper=SemanticLayer), autoflush=False
            ) as session,
            fresh_refresh_authority(session),
        ):
            self._view = SemanticViewDAO.find_by_uuid(str(self._view_uuid))
            if self._view is None:
                raise SemanticViewNotFoundError()
            authorize_metadata_refresh(self._view)
            self._binding = view_binding(self._view)
            self._scope = connection_metadata_scope(self._view.semantic_layer)

    def _revalidate(self) -> None:
        """Observe committed binding, configuration and authority before mutation."""
        operation_deadline()
        session: Session
        with (
            Session(
                bind=db.session.get_bind(mapper=SemanticLayer), autoflush=False
            ) as session,
            fresh_refresh_authority(session),
        ):
            fresh: SemanticView | None = SemanticViewDAO.find_by_uuid(
                str(self._view_uuid)
            )
            if (
                fresh is None
                or view_binding(fresh) != self._binding
                or fresh.semantic_layer is None
                or connection_metadata_scope(fresh.semantic_layer) != self._scope
            ):
                raise MetadataRefreshError("configuration_changed")
            authorize_metadata_refresh(fresh)


class RefreshMetadataCommand(MetadataCommand):
    """Refresh the authorized view's stored connection without ORM mutations."""

    def run(self) -> MetadataRefreshResult:
        self.validate()
        assert self._view is not None
        layer: SemanticLayer = self._view.semantic_layer
        try:
            implementation: SemanticLayerABC[Any, SemanticViewABC] = registry[
                layer.type
            ].from_configuration(json.loads(layer.configuration))
        except (ValueError, TypeError):
            raise MetadataRefreshError("configuration") from None
        if implementation.metadata_refresh is None:
            raise MetadataRefreshError("unsupported")
        store: ScopedMetadataStore = guarded_store(
            self._view, before_publish=self._revalidate
        )
        deadline: float = operation_deadline()
        implementation.metadata_refresh.bind(store, deadline=deadline)
        return implementation.metadata_refresh.refresh(deadline=deadline)


class InvalidateCatalogCommand(MetadataCommand):
    """Retire the connection catalog and any older writer without acquiring it."""

    def run(self) -> None:
        self.validate()
        assert self._view is not None
        self._revalidate()
        guarded_store(self._view, before_publish=self._revalidate).invalidate_catalog()


class InvalidateCompatibilityCommand(MetadataCommand):
    """Retire compatibility alone, preserving catalog and result identities."""

    def run(self) -> None:
        self.validate()
        assert self._view is not None
        self._revalidate()
        guarded_store(
            self._view, before_publish=self._revalidate
        ).invalidate_compatibility()


class InspectCatalogCommand(MetadataCommand):
    """Read one connection's entry timing without acquiring or renewing metadata."""

    def run(self) -> CacheEntryInfo:
        self.validate()
        assert self._view is not None
        return guarded_store(
            self._view, before_publish=self._revalidate
        ).inspect_catalog()


def inspect_derived_entry(
    key: str, kind: Literal["compatibility", "query_result"]
) -> CacheEntryInfo:
    """Use the configured data cache, declining unsupported transport overrides."""
    config: Any = current_app.config.get("DATA_CACHE_CONFIG")
    backend: DeadlineRedisBackend | None = None
    if (
        isinstance(config, dict)
        and not config.get("CACHE_REDIS_URL")
        and not config.get("CACHE_OPTIONS")
    ):
        try:
            backend = DeadlineRedisBackend(config, deadline=operation_deadline())
        except ValueError:
            pass
    return inspect_data_cache(cache_manager.data_cache, key, kind, backend=backend)


class InspectCompatibilityCommand(MetadataCommand):
    """Inspect one normalized selection with connection-management authority."""

    def __init__(
        self, view_uuid: UUID, metrics: list[str], dimensions: list[str]
    ) -> None:
        super().__init__(view_uuid)
        self._metrics: list[str] = metrics
        self._dimensions: list[str] = dimensions

    def run(self) -> CacheEntryInfo:
        self.validate()
        assert self._view is not None
        identity: CompatibilityIdentity | None = compatibility_identity(
            self._view, self._metrics, self._dimensions, inspection=True
        )
        if identity is None:
            return CacheEntryInfo(
                "compatibility", "missing", datetime.now(timezone.utc)
            )
        return inspect_derived_entry(identity.key, "compatibility")
