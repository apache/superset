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

"""Host adaptation for semantic cache identity and provider contracts."""

import hashlib
import logging
from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import cast, Protocol

from flask import g, has_request_context
from superset_core.semantic_layers.layer import (
    SemanticCacheCapabilities,
    SemanticCacheExecutionContext,
    SemanticCacheIdentityMaterial,
    SemanticCacheResponsibility,
    SemanticCacheScope,
)

from superset import security_manager
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import CACHE_DISABLED_TIMEOUT
from superset.semantic_layers.cache_identity import (
    SemanticCacheIdentityFactory,
    SemanticViewIdentity,
    SensitiveIdentityMaterialError,
)
from superset.semantic_layers.cache_policy import (
    ContainmentCapabilities,
    PatternSemantics,
)
from superset.semantic_layers.cache_repository import ViewMeta
from superset.utils import json

logger: logging.Logger = logging.getLogger(__name__)


class _SemanticCacheProvider(Protocol):
    semantic_cache_responsibility: SemanticCacheResponsibility
    semantic_cache_scope: SemanticCacheScope
    semantic_cache_capabilities: SemanticCacheCapabilities

    def get_semantic_cache_provider_identity(
        self,
    ) -> SemanticCacheIdentityMaterial | None: ...  # pragma: no cover

    def get_semantic_cache_context_identity(
        self,
        context: SemanticCacheExecutionContext,
    ) -> SemanticCacheIdentityMaterial | None: ...  # pragma: no cover


def _execution_context(
    datasource: BaseDatasource,
) -> SemanticCacheExecutionContext | None:
    if not has_request_context() or not getattr(g, "user", None):
        return None
    user: object = g.user
    principal: object = getattr(user, "id", None) or getattr(user, "username", None)
    if principal is None:
        return None
    roles_value: object = getattr(user, "roles", ())
    roles: Iterable[object] = (
        roles_value
        if isinstance(roles_value, Iterable) and not isinstance(roles_value, str)
        else ()
    )
    role_ids: tuple[str, ...] = tuple(
        sorted(
            str(getattr(role, "id", None) or getattr(role, "name", ""))
            for role in roles
        )
    )
    guest_token: object = getattr(user, "guest_token", None)
    rls_cache_key: list[str] = security_manager.get_rls_cache_key(datasource)
    identity_payload: str = json.dumps(
        {
            "guest_token": guest_token,
            "principal": str(principal),
            "rls": rls_cache_key,
            "roles": role_ids,
        },
        default=str,
        separators=(",", ":"),
        sort_keys=True,
    )
    host_identity: str = hashlib.sha256(identity_payload.encode()).hexdigest()
    return SemanticCacheExecutionContext(str(principal), role_ids, host_identity)


def build_cache_configuration(
    datasource: BaseDatasource,
    *,
    cache_timeout: int | None = None,
) -> tuple[ViewMeta, ContainmentCapabilities] | None:
    """Build safe host metadata when the provider explicitly opts in.

    :param cache_timeout: the timeout the query context resolved for this
        request (custom, then chart, then datasource). Containment must
        follow the same decision as the ordinary result cache, so it takes
        precedence over ``datasource.cache_timeout`` whenever it is known.
    """
    timeout: int | None = (
        datasource.cache_timeout if cache_timeout is None else cache_timeout
    )
    if timeout == CACHE_DISABLED_TIMEOUT:
        # Caching is explicitly disabled for this request. Passing the
        # sentinel to a cache backend would invert it (Redis reads a negative
        # TTL as "no expiry"), so containment caching is bypassed entirely
        # instead: nothing is read and nothing is stored.
        return None
    layer: _SemanticCacheProvider = cast(
        _SemanticCacheProvider,
        datasource.semantic_layer.implementation,
    )
    if (
        getattr(layer, "semantic_cache_responsibility", None)
        is not SemanticCacheResponsibility.SUPERSET
    ):
        return None
    provider_material: object = layer.get_semantic_cache_provider_identity()
    if not isinstance(provider_material, SemanticCacheIdentityMaterial):
        return None
    scope_material: Mapping[str, object] | None = _scope_material(datasource, layer)
    if scope_material is None:
        return None
    provider_capabilities: object = getattr(layer, "semantic_cache_capabilities", None)
    if not isinstance(provider_capabilities, SemanticCacheCapabilities):
        return None
    pattern_semantics: PatternSemantics | None = (
        PatternSemantics.sql_like(escape=provider_capabilities.pattern_escape)
        if provider_capabilities.pattern_escape is not None
        else None
    )
    capabilities: ContainmentCapabilities = ContainmentCapabilities(
        comparisons=provider_capabilities.comparisons,
        membership=provider_capabilities.membership,
        nulls=provider_capabilities.nulls,
        pattern_semantics=pattern_semantics,
    )
    changed_on: object = getattr(datasource, "changed_on", None)
    definition_material: dict[str, object] = {
        "changed_on": changed_on.isoformat()
        if isinstance(changed_on, datetime)
        else str(changed_on),
    }
    meta: ViewMeta | None = _view_meta(
        datasource, definition_material, provider_material, scope_material, timeout
    )
    if meta is None:
        return None
    return meta, capabilities


def _scope_material(
    datasource: BaseDatasource,
    layer: _SemanticCacheProvider,
) -> Mapping[str, object] | None:
    """Resolve the reuse scope's identity material, or None to bypass."""
    scope: object = getattr(layer, "semantic_cache_scope", None)
    if scope is SemanticCacheScope.GLOBAL:
        if security_manager.get_rls_cache_key(datasource):
            # Global reuse rests on the provider's guarantee that results do
            # not vary by principal; Superset-side row-level security is a
            # per-principal variation the provider cannot see, so it wins.
            return None
        return {"scope": "global"}
    if scope is SemanticCacheScope.EXECUTION_CONTEXT:
        context: SemanticCacheExecutionContext | None = _execution_context(datasource)
        if context is None:
            return None
        context_material: object = layer.get_semantic_cache_context_identity(context)
        if not isinstance(context_material, SemanticCacheIdentityMaterial):
            return None
        return {
            "host_identity": context.host_identity,
            "provider_identity": context_material.values,
        }
    return None


def _view_meta(
    datasource: BaseDatasource,
    definition_material: Mapping[str, object],
    provider_material: SemanticCacheIdentityMaterial,
    scope_material: Mapping[str, object],
    timeout: int | None,
) -> ViewMeta | None:
    """Digest the identity material, or bypass when a provider offers secrets."""
    try:
        return ViewMeta(
            view_identity=SemanticViewIdentity(str(datasource.uuid)),
            definition_identity=SemanticCacheIdentityFactory.definition(
                definition_material
            ),
            provider_identity=SemanticCacheIdentityFactory.provider(
                provider_material.values
            ),
            scope_identity=SemanticCacheIdentityFactory.scope(scope_material),
            timeout=timeout,
        )
    except SensitiveIdentityMaterialError:
        # Identity material is the provider's contract to get right; a
        # secret-like key must never turn into a failed chart. Bypass
        # containment for the view and say why, without echoing the material.
        logger.warning(
            "Semantic containment caching bypassed for view %s: the provider "
            "offered secret-like identity material",
            datasource.uuid,
        )
        return None
