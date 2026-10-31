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

"""Public provider readiness and fault contracts."""

from enum import Enum
from inspect import Parameter, signature

import pytest
from superset_core.semantic_layers import (
    SemanticBackendError,
    SemanticCredentialReadiness,
)
from superset_core.semantic_layers.layer import SemanticLayer


def test_readiness_is_not_a_string_or_boolean() -> None:
    """Readiness cannot compare equal to an untrusted scalar."""
    assert issubclass(SemanticCredentialReadiness, Enum)
    assert not issubclass(SemanticCredentialReadiness, str)
    assert SemanticCredentialReadiness.RESOLVED != "resolved"
    assert SemanticCredentialReadiness.RESOLVED != True  # noqa: E712
    assert (
        SemanticCredentialReadiness.RESOLVED
        is not SemanticCredentialReadiness.UNRESOLVED
    )


@pytest.mark.parametrize("method", ["get_configuration_schema", "get_runtime_schema"])
def test_schema_readiness_and_transport_are_required_keywords(method: str) -> None:
    """Both discovery capabilities must be supplied explicitly."""
    parameters: dict[str, Parameter] = dict(
        signature(getattr(SemanticLayer, method)).parameters
    )
    name: str
    for name in ("readiness", "transport"):
        assert parameters[name].kind is Parameter.KEYWORD_ONLY
        assert parameters[name].default is Parameter.empty
    with pytest.raises(TypeError, match="readiness"):
        getattr(SemanticLayer, method)({}, transport=object())


def test_backend_error_has_no_diagnostic_message_argument() -> None:
    """Backend faults expose only fixed text and reject diagnostic input."""
    error: SemanticBackendError = SemanticBackendError()
    assert str(error) == "Semantic provider execution failed."
    with pytest.raises(TypeError):
        SemanticBackendError("private diagnostics")  # type: ignore[call-arg]
