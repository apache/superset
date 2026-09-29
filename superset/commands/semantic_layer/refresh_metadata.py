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

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from flask import g
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session
from superset_core.semantic_layers.layer import SemanticLayer as SemanticLayerABC
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    MetadataRefreshResult,
)
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerForbiddenError,
    SemanticLayerNotFoundError,
    SemanticViewNotFoundError,
)
from superset.commands.utils import current_user_can_modify_object
from superset.daos.semantic_layer import SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.semantic_layers.metadata import (
    bind_metadata_store,
    connection_metadata_scope,
    metadata_refresh_enabled,
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
    provider: type[SemanticLayerABC[Any, SemanticViewABC]] | None = registry.get(
        layer.type
    )
    if provider is None:
        raise MetadataRefreshError("unsupported")
    try:
        configuration: dict[str, Any] = json.loads(layer.configuration)
        supported: bool = provider.supports_metadata_refresh(configuration)
    except (ValueError, TypeError):
        raise MetadataRefreshError("configuration") from None
    if not supported:
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
    try:
        db.session.registry.set(session)
        g.user = user
        g._login_user = user
        with session.no_autoflush:
            yield
    finally:
        g.user = original_user
        if had_login_user:
            g._login_user = original_login_user
        else:
            g.pop("_login_user", None)
        db.session.registry.set(original_session)


class RefreshMetadataCommand(BaseCommand):
    """Refresh the authorized view's stored connection without ORM mutations."""

    def __init__(self, view_uuid: UUID) -> None:
        self._view_uuid: UUID = view_uuid
        self._view: SemanticView | None = None

    def validate(self) -> None:
        """Reject unavailable targets and authority before provider construction."""
        if not metadata_refresh_enabled():
            raise SemanticViewNotFoundError()
        # Read stored inputs in a short transaction. Pending request edits and
        # an earlier repeatable-read snapshot must not select provider inputs.
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

    def run(self) -> MetadataRefreshResult:
        """Acquire once; the store revalidates in its fresh publication transaction."""
        self.validate()
        assert self._view is not None
        layer: SemanticLayer = self._view.semantic_layer
        binding: tuple[str, str, str] = view_binding(self._view)

        def revalidate(session: Session) -> None:
            """A separate session observes committed deletion or reassignment."""
            fresh: SemanticView | None = (
                session.query(SemanticView)
                .filter_by(uuid=self._view_uuid)
                .one_or_none()
            )
            if fresh is None or view_binding(fresh) != binding:
                raise MetadataRefreshError("configuration_changed")
            with fresh_refresh_authority(session):
                authorize_metadata_refresh(fresh)

        try:
            implementation: SemanticLayerABC[Any, SemanticViewABC] = registry[
                layer.type
            ].from_configuration(json.loads(layer.configuration))
        except (ValueError, TypeError):
            raise MetadataRefreshError("configuration") from None
        if implementation.metadata_refresh is None:
            raise MetadataRefreshError("unsupported")
        bind_metadata_store(layer, implementation, before_publish=revalidate)
        return implementation.metadata_refresh.refresh()
