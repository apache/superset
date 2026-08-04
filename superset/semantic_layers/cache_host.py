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
from superset.semantic_layers.cache_identity import (
    SemanticCacheIdentityFactory,
    SemanticViewIdentity,
)
from superset.semantic_layers.cache_policy import (
    ContainmentCapabilities,
    PatternSemantics,
)
from superset.semantic_layers.cache_repository import ViewMeta
from superset.utils import json


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
) -> tuple[ViewMeta, ContainmentCapabilities] | None:
    """Build safe host metadata when the provider explicitly opts in."""
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
    scope: object = getattr(layer, "semantic_cache_scope", None)
    scope_material: Mapping[str, object]
    if scope is SemanticCacheScope.GLOBAL:
        scope_material = {"scope": "global"}
    elif scope is SemanticCacheScope.EXECUTION_CONTEXT:
        context: SemanticCacheExecutionContext | None = _execution_context(datasource)
        if context is None:
            return None
        context_material: object = layer.get_semantic_cache_context_identity(context)
        if not isinstance(context_material, SemanticCacheIdentityMaterial):
            return None
        scope_material = {
            "host_identity": context.host_identity,
            "provider_identity": context_material.values,
        }
    else:
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
    meta: ViewMeta = ViewMeta(
        view_identity=SemanticViewIdentity(str(datasource.uuid)),
        definition_identity=SemanticCacheIdentityFactory.definition(
            definition_material
        ),
        provider_identity=SemanticCacheIdentityFactory.provider(
            provider_material.values
        ),
        scope_identity=SemanticCacheIdentityFactory.scope(scope_material),
        timeout=datasource.cache_timeout,
    )
    return meta, capabilities
