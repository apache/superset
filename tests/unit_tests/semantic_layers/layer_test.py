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

from unittest.mock import MagicMock

from superset_core.semantic_layers.layer import (
    SemanticCacheCapabilities,
    SemanticCacheExecutionContext,
    SemanticCacheIdentityMaterial,
    SemanticCacheResponsibility,
    SemanticCacheScope,
    SemanticLayer,
)


class _ContextAwareProvider:
    semantic_cache_responsibility: SemanticCacheResponsibility = (
        SemanticCacheResponsibility.SUPERSET
    )
    semantic_cache_scope: SemanticCacheScope = SemanticCacheScope.EXECUTION_CONTEXT
    semantic_cache_capabilities: SemanticCacheCapabilities = SemanticCacheCapabilities(
        pattern_escape="\\"
    )

    def get_semantic_cache_context_identity(
        self,
        context: SemanticCacheExecutionContext,
    ) -> SemanticCacheIdentityMaterial:
        return SemanticCacheIdentityMaterial({"host_identity": context.host_identity})


def test_semantic_cache_provider_defaults_are_safe() -> None:
    provider: MagicMock = MagicMock()
    context: SemanticCacheExecutionContext = SemanticCacheExecutionContext(
        principal_id="principal",
        role_ids=("role",),
        host_identity="request-security-fingerprint",
    )

    assert (
        SemanticLayer.semantic_cache_responsibility
        is SemanticCacheResponsibility.PROVIDER
    )
    assert SemanticLayer.semantic_cache_scope is SemanticCacheScope.EXECUTION_CONTEXT
    assert SemanticLayer.semantic_cache_capabilities == SemanticCacheCapabilities()
    assert SemanticLayer.get_semantic_cache_provider_identity(provider) is None
    assert SemanticLayer.get_semantic_cache_context_identity(provider, context) is None


def test_provider_can_explicitly_declare_superset_cache_contract() -> None:
    provider: _ContextAwareProvider = _ContextAwareProvider()

    assert (
        provider.semantic_cache_responsibility is SemanticCacheResponsibility.SUPERSET
    )
    assert provider.semantic_cache_scope is SemanticCacheScope.EXECUTION_CONTEXT
    assert provider.semantic_cache_capabilities.pattern_escape == "\\"


def test_one_provider_instance_keeps_interleaved_context_identities_separate() -> None:
    provider: _ContextAwareProvider = _ContextAwareProvider()
    first: SemanticCacheExecutionContext = SemanticCacheExecutionContext(
        "one", ("gamma",), "first-host"
    )
    second: SemanticCacheExecutionContext = SemanticCacheExecutionContext(
        "two", ("alpha",), "second-host"
    )

    assert provider.get_semantic_cache_context_identity(first).values == {
        "host_identity": "first-host"
    }
    assert provider.get_semantic_cache_context_identity(second).values == {
        "host_identity": "second-host"
    }
    assert provider.get_semantic_cache_context_identity(first).values == {
        "host_identity": "first-host"
    }
