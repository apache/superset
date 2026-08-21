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

import pytest
from flask import Flask, g
from pytest_mock import MockerFixture
from superset_core.semantic_layers.layer import (
    SemanticCacheCapabilities,
    SemanticCacheExecutionContext,
    SemanticCacheIdentityMaterial,
    SemanticCacheResponsibility,
    SemanticCacheScope,
)

from superset.constants import CACHE_DISABLED_TIMEOUT
from superset.semantic_layers.cache_host import (
    _execution_context,
    build_cache_configuration,
)


def _context(
    app: Flask,
    datasource: MagicMock,
    user: MagicMock,
) -> SemanticCacheExecutionContext:
    with app.test_request_context():
        g.user = user
        context: SemanticCacheExecutionContext | None = _execution_context(datasource)
    assert context is not None
    return context


def test_execution_context_fingerprints_all_host_security_inputs(
    mocker: MockerFixture,
) -> None:
    app: Flask = Flask(__name__)
    datasource: MagicMock = MagicMock()
    role: MagicMock = MagicMock(id=7, name="Gamma")
    first_user: MagicMock = MagicMock(
        id=1,
        username="first",
        roles=[role],
        guest_token={"rls": [{"clause": "tenant = 1"}]},
    )
    second_user: MagicMock = MagicMock(
        id=2,
        username="second",
        roles=[role],
        guest_token={"rls": [{"clause": "tenant = 1"}]},
    )
    rls_key: MagicMock = mocker.patch(
        "superset.semantic_layers.cache_host.security_manager.get_rls_cache_key",
        return_value=["region = 'GB'-group"],
    )

    baseline: SemanticCacheExecutionContext = _context(app, datasource, first_user)
    rls_key.return_value = ["region = 'US'-group"]
    changed_rls: SemanticCacheExecutionContext = _context(app, datasource, first_user)
    rls_key.return_value = ["region = 'GB'-group"]
    changed_principal: SemanticCacheExecutionContext = _context(
        app, datasource, second_user
    )
    first_user.guest_token = {"rls": [{"clause": "tenant = 2"}]}
    changed_guest_rls: SemanticCacheExecutionContext = _context(
        app, datasource, first_user
    )

    assert (
        len(
            {
                baseline.host_identity,
                changed_rls.host_identity,
                changed_principal.host_identity,
                changed_guest_rls.host_identity,
            }
        )
        == 4
    )
    assert "tenant" not in baseline.host_identity
    assert baseline.principal_id == "1"
    assert baseline.role_ids == ("7",)


def test_execution_context_requires_request_and_principal() -> None:
    app: Flask = Flask(__name__)
    datasource: MagicMock = MagicMock()

    assert _execution_context(datasource) is None
    with app.test_request_context():
        g.user = MagicMock(id=None, username=None)
        assert _execution_context(datasource) is None


def _datasource() -> MagicMock:
    layer: MagicMock = MagicMock()
    layer.semantic_cache_responsibility = SemanticCacheResponsibility.SUPERSET
    layer.semantic_cache_scope = SemanticCacheScope.GLOBAL
    layer.semantic_cache_capabilities = SemanticCacheCapabilities()
    layer.get_semantic_cache_provider_identity.return_value = (
        SemanticCacheIdentityMaterial({"provider": "fixture"})
    )
    datasource: MagicMock = MagicMock()
    datasource.semantic_layer.implementation = layer
    datasource.uuid = "orders"
    datasource.changed_on = None
    datasource.cache_timeout = 60
    return datasource


@pytest.mark.parametrize(
    "mutation",
    [
        "provider_responsibility",
        "provider_identity",
        "invalid_scope",
        "invalid_capabilities",
    ],
)
def test_cache_configuration_bypasses_invalid_provider_contract(
    mutation: str,
) -> None:
    datasource: MagicMock = _datasource()
    layer: MagicMock = datasource.semantic_layer.implementation
    if mutation == "provider_responsibility":
        layer.semantic_cache_responsibility = SemanticCacheResponsibility.PROVIDER
    elif mutation == "provider_identity":
        layer.get_semantic_cache_provider_identity.return_value = None
    elif mutation == "invalid_scope":
        layer.semantic_cache_scope = "unknown"
    else:
        layer.semantic_cache_capabilities = object()

    assert build_cache_configuration(datasource) is None


def test_context_scope_requires_host_and_provider_identity(
    mocker: MockerFixture,
) -> None:
    datasource: MagicMock = _datasource()
    layer: MagicMock = datasource.semantic_layer.implementation
    layer.semantic_cache_scope = SemanticCacheScope.EXECUTION_CONTEXT
    execution_context: MagicMock = mocker.patch(
        "superset.semantic_layers.cache_host._execution_context",
        return_value=None,
    )

    assert build_cache_configuration(datasource) is None

    execution_context.return_value = SemanticCacheExecutionContext(
        "principal", ("role",), "host"
    )
    layer.get_semantic_cache_context_identity.return_value = None

    assert build_cache_configuration(datasource) is None


def test_cache_configuration_bypasses_disabled_caching() -> None:
    """``cache_timeout == -1`` means no caching; a backend would read the raw
    sentinel as "never expire", so containment must be bypassed entirely."""
    datasource: MagicMock = _datasource()
    datasource.cache_timeout = CACHE_DISABLED_TIMEOUT

    assert build_cache_configuration(datasource) is None
