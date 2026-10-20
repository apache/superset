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

"""Host-owned execution policy and session-local provider bindings."""

from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass, field
from typing import Any, cast, NoReturn, TYPE_CHECKING, TypeAlias
from uuid import uuid4

from flask import current_app, g, has_request_context
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import object_session, Session
from sqlalchemy.sql import Select
from superset_core.semantic_layers.context import (
    ExecutionMethod,
    ExecutionOrigin,
    SemanticExecutionContext,
)
from superset_core.semantic_layers.layer import SemanticLayer as ProviderLayer
from superset_core.semantic_layers.view import SemanticView as ProviderView

from superset import db, security_manager
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import (
    JsonKeyValueCodec,
    KeyValueResource,
    SEMANTIC_INSTALL_ID_KEY,
)
from superset.semantic_layers.registry import registry
from superset.semantic_layers.transport import build_provider_transport
from superset.utils import json

if TYPE_CHECKING:
    from superset.semantic_layers.models import SemanticLayer

logger: logging.Logger = logging.getLogger(__name__)


def configured_namespace() -> str:
    """Return SEMANTIC_LAYER_CACHE_NAMESPACE as a string, nonblank if set."""
    configured: Any = current_app.config.get("SEMANTIC_LAYER_CACHE_NAMESPACE", "")
    configured = configured() if callable(configured) else configured
    if not isinstance(configured, str) or (configured and not configured.strip()):
        raise TypeError(
            "SEMANTIC_LAYER_CACHE_NAMESPACE must resolve to a string, nonblank if set"
        )
    return configured


def bootstrap_semantic_namespace() -> None:
    """Load durable deployment identity at startup or after a deferred upgrade."""
    configured: Any = current_app.config.get("SEMANTIC_LAYER_CACHE_NAMESPACE", "")
    if isinstance(configured, str) and configured:
        return
    if "semantic_execution_namespace" not in current_app.extensions:
        current_app.extensions["semantic_execution_namespace"] = _install_namespace(
            db.session.get_bind(mapper=KeyValueEntry).engine
        )


def semantic_namespace() -> str:
    """Resolve identity, retrying initialization after a deferred database upgrade."""
    namespace: str | None = configured_namespace() or current_app.extensions.get(
        "semantic_execution_namespace"
    )
    if namespace is None:
        # Helm can start web workers before its post-install migration creates
        # key_value. Retry once per access until initialization succeeds; never
        # publish a process-local fallback or commit the caller's transaction.
        bootstrap_semantic_namespace()
        namespace = current_app.extensions["semantic_execution_namespace"]
    return namespace


def _install_namespace(engine: Engine) -> str:
    """Create a durable UUID independently, including startup races."""
    codec: JsonKeyValueCodec = JsonKeyValueCodec()
    with Session(engine) as session:
        statement: Select = select(KeyValueEntry.value).where(
            KeyValueEntry.uuid == SEMANTIC_INSTALL_ID_KEY,
            KeyValueEntry.resource == KeyValueResource.SEMANTIC_EXECUTION.value,
        )
        value: bytes | None = session.scalar(statement)
        if value is None:
            session.add(
                KeyValueEntry(
                    uuid=SEMANTIC_INSTALL_ID_KEY,
                    # Keep JSON identity out of historic app-resource pickle migrations.
                    resource=KeyValueResource.SEMANTIC_EXECUTION.value,
                    value=codec.encode({"namespace": str(uuid4())}),
                )
            )
            # @transaction owns db.session; this startup session must commit
            # independently and recover a competing worker's insert locally.
            try:
                session.commit()  # pylint: disable=consider-using-transaction
            except IntegrityError:
                session.rollback()  # pylint: disable=consider-using-transaction
            value = session.scalar(statement)
        namespace: Any = (
            codec.decode(value).get("namespace") if value is not None else None
        )
        if not isinstance(namespace, str) or not namespace.strip():
            raise ValueError("Semantic execution namespace is unavailable")
        return namespace


def effective_role_ids(user: Any) -> tuple[str, ...]:
    """Canonicalize direct and group roles for both host execution contexts."""
    return (
        tuple(sorted({str(role.id) for role in security_manager.get_user_roles(user)}))
        if user is not None
        else ()
    )


def current_host_execution_context() -> SemanticExecutionContext:
    """Build identity only from server-authenticated users and effective roles."""
    user: Any = getattr(g, "user", None)
    origin: ExecutionOrigin = (
        ExecutionOrigin.REQUEST if has_request_context() else ExecutionOrigin.BACKGROUND
    )
    principal: str | None = (
        str(user.id)
        if user is not None
        and not user.is_anonymous
        and getattr(user, "id", None) is not None
        else None
    )
    roles: tuple[str, ...] = effective_role_ids(user)
    guest: bool = bool(user is not None and getattr(user, "is_guest_user", False))
    namespace: str = semantic_namespace()
    payload: bytes = json.dumps(
        [1, namespace, principal, roles, guest], separators=(",", ":")
    ).encode()
    secret: str | bytes = current_app.config["SECRET_KEY"]
    digest: str = hmac.new(
        secret.encode() if isinstance(secret, str) else secret, payload, hashlib.sha256
    ).hexdigest()
    return SemanticExecutionContext(
        principal_id=principal,
        role_ids=roles,
        origin=origin,
        is_guest=guest,
        namespace=namespace,
        identity_digest=digest,
    )


@dataclass(frozen=True)
class Refused:
    """An explicit policy refusal; never a request for credential fallback."""

    reason: str


MethodResolution: TypeAlias = ExecutionMethod | Refused


def resolve_method(
    layer: SemanticLayer, context: SemanticExecutionContext
) -> MethodResolution:
    """Connection credentials are the sole enabled policy in this delivery."""
    return ExecutionMethod.CONNECTION


def refuse(
    layer: SemanticLayer,
    context: SemanticExecutionContext,
    reason: str,
    method: ExecutionMethod | None,
    declared: tuple[str, ...],
) -> NoReturn:
    """Expose a generic error and log only non-secret operational identifiers."""
    logger.warning(
        "Semantic execution refused: connection=%s provider=%s "
        "origin=%s reason=%s identity=%s method=%s declared=%s",
        layer.uuid,
        layer.type,
        context.origin.value,
        reason,
        context.identity_digest[:8],
        method.value if method is not None else "unresolved",
        declared,
    )
    raise SupersetSecurityException(
        SupersetError(
            message="This data source can't be queried in the current context.",
            error_type=SupersetErrorType.SEMANTIC_EXECUTION_REFUSED_ERROR,
            level=ErrorLevel.ERROR,
            extra={"reason": reason},
        )
    )


def check_execution_allowed(
    layer: SemanticLayer, context: SemanticExecutionContext
) -> ExecutionMethod:
    """Refuse unsupported policy before constructing or reusing a provider."""
    resolution: MethodResolution = resolve_method(layer, context)
    supported: frozenset[ExecutionMethod] = registry[
        layer.type
    ].supported_execution_methods
    declared: tuple[str, ...] = tuple(sorted(method.value for method in supported))
    if isinstance(resolution, Refused):
        refuse(layer, context, resolution.reason, None, declared)
    method: ExecutionMethod = resolution
    if method not in supported:
        refuse(layer, context, "method_not_supported", method, declared)
    return method


def _binding_owner(layer: SemanticLayer) -> object:
    """Identify persisted and transient layers consistently within the memo."""
    return layer.uuid or id(layer)


@dataclass
class SemanticBindingMemo:
    """One session's identity-bound layers and their views, cleared with the session."""

    bindings: dict[
        tuple[object, SemanticExecutionContext, ExecutionMethod],
        tuple[ProviderLayer[Any, Any], dict[tuple[str, str], ProviderView]],
    ] = field(default_factory=dict)

    @classmethod
    def for_layer(cls, layer: SemanticLayer) -> SemanticBindingMemo:
        """Keep binding state on the model's owning session."""
        session: Session = object_session(layer) or db.session
        key: str = "semantic_execution"
        if key not in session.info:
            session.info[key] = cls()
        return cast(SemanticBindingMemo, session.info[key])

    def forget(self, layer: SemanticLayer) -> None:
        """Invalidate every identity-bound instance for this connection."""
        key: tuple[object, SemanticExecutionContext, ExecutionMethod]
        for key in list(self.bindings):
            if key[0] == _binding_owner(layer):
                del self.bindings[key]

    def bind(
        self, layer: SemanticLayer
    ) -> tuple[ProviderLayer[Any, Any], dict[tuple[str, str], ProviderView]]:
        """Construct once after policy validation, including on a warm memo hit."""
        context: SemanticExecutionContext = current_host_execution_context()
        method: ExecutionMethod = check_execution_allowed(layer, context)
        key: tuple[object, SemanticExecutionContext, ExecutionMethod] = (
            _binding_owner(layer),
            context,
            method,
        )
        if key not in self.bindings:
            self.bindings[key] = (
                registry[layer.type].from_configuration(
                    json.loads(layer.configuration),
                    cache_token=layer.metadata_generation,
                    context=context,
                    credentials=None,
                    transport=build_provider_transport(),
                ),
                {},
            )
        return self.bindings[key]
