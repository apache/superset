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

from dataclasses import FrozenInstanceError
from inspect import Parameter, signature

import pytest


def test_execution_context_is_immutable_and_secret_free() -> None:
    """The SDK boundary carries identity values, not host state or credentials."""
    from superset_core.semantic_layers.context import (
        ExecutionOrigin,
        SemanticExecutionContext,
    )

    context: SemanticExecutionContext = SemanticExecutionContext(
        principal_id="7",
        role_ids=("3",),
        origin=ExecutionOrigin.REQUEST,
        is_guest=False,
        namespace="workspace",
        identity_digest="digest",
    )
    assert hash(context) == hash(context)
    assert set(vars(context)) == {
        "principal_id",
        "role_ids",
        "origin",
        "is_guest",
        "namespace",
        "identity_digest",
    }
    with pytest.raises(FrozenInstanceError):
        setattr(context, "principal_id", "8")  # noqa: B010


def test_factory_requires_context_and_reserves_credentials() -> None:
    """Provider factories have one explicit keyword-only execution contract."""
    from superset_core.semantic_layers.context import ExecutionMethod
    from superset_core.semantic_layers.layer import SemanticLayer

    parameters: dict[str, Parameter] = dict(
        signature(SemanticLayer.from_configuration).parameters
    )
    name: str
    for name in ("cache_token", "context"):
        assert parameters[name].kind is Parameter.KEYWORD_ONLY
        assert parameters[name].default is Parameter.empty
    assert parameters["credentials"].kind is Parameter.KEYWORD_ONLY
    assert parameters["credentials"].default is None
    assert SemanticLayer.supported_execution_methods == frozenset(
        {ExecutionMethod.CONNECTION}
    )
    assert not hasattr(SemanticLayer, "from_configuration_with_cache_token")
    assert hasattr(SemanticLayer, "semantic_cache_scope")
    assert hasattr(SemanticLayer, "get_semantic_cache_context_identity")
