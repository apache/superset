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

"""Trusted readiness and safe failure handling at real host entry points."""

import logging
from typing import cast
from unittest.mock import MagicMock

import pytest
from flask.testing import FlaskClient
from pydantic import BaseModel
from pytest_mock import MockerFixture
from superset_core.semantic_layers import (
    SemanticBackendError,
    SemanticCredentialReadiness,
)
from superset_core.semantic_layers.errors import SemanticQueryRejectedError
from superset_core.semantic_layers.transport import (
    ProviderRequestError,
    ProviderRequestFailure,
)
from werkzeug.test import TestResponse

from superset.constants import PASSWORD_MASK
from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.exceptions import (
    execute_semantic_query,
    SemanticLayerExecutionError,
    SemanticLayerQueryRejectedError,
)
from superset.semantic_layers.masking import credential_readiness, mask_configuration
from superset.utils import json


class PreviewConfiguration(BaseModel):
    """Deliberately discard unknown fields like a real partial provider model."""

    account: str | None = None
    password: str | None = None


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("writer", [False, True])
@pytest.mark.parametrize("masked", [False, True])
def test_preview_readiness_uses_raw_input_not_client_assertion(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    writer: bool,
    masked: bool,
) -> None:
    """Normalize before dropped fields, without looking up saved credentials."""
    provider: MagicMock = MagicMock()
    provider.configuration_class = PreviewConfiguration
    provider.get_configuration_schema.return_value = {"type": "object"}
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    mocker.patch(
        "superset.semantic_layers.api.security_manager.can_access",
        side_effect=lambda permission, view: permission != "can_write" or writer,
    )
    lookup: MagicMock = mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid"
    )
    response: TestResponse = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={
            "type": "test",
            "readiness": "resolved",
            "configuration": {
                "account": "fixture",
                "password": "fixture-password",
                # Pydantic drops this unknown subtree; readiness must be computed first.
                "nested": [{"password": PASSWORD_MASK if masked else "fixture"}],
                "readiness": "resolved",
            },
        },
    )
    assert response.status_code == 200
    assert provider.get_configuration_schema.call_args.kwargs["readiness"] is (
        SemanticCredentialReadiness.RESOLVED
        if writer and not masked
        else SemanticCredentialReadiness.UNRESOLVED
    )
    lookup.assert_not_called()
    if not writer:
        assert provider.get_configuration_schema.call_args.args == (None,)


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
def test_configuration_fallback_is_explicitly_unresolved(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """A failed enrichment retries only a static unresolved schema."""
    provider: MagicMock = MagicMock()
    provider.configuration_class = PreviewConfiguration
    provider.get_configuration_schema.side_effect = [
        ValueError("fixture error"),
        {"type": "object"},
    ]
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    response: TestResponse = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={
            "type": "test",
            "configuration": {"account": "fixture"},
        },
    )
    assert response.status_code == 200
    assert provider.get_configuration_schema.call_args.args == (None,)
    assert (
        provider.get_configuration_schema.call_args.kwargs["readiness"]
        is SemanticCredentialReadiness.UNRESOLVED
    )


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("masked", [False, True])
def test_runtime_readiness_uses_saved_raw_configuration(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    masked: bool,
) -> None:
    """Client runtime data cannot override readiness of the saved connection."""
    layer: MagicMock = MagicMock(type="test")
    layer.configuration = json.dumps(
        {"password": PASSWORD_MASK if masked else "fixture"}
    )
    layer.implementation.configuration = PreviewConfiguration(account="fixture")
    provider: MagicMock = MagicMock()
    provider.get_runtime_schema.return_value = {"type": "object"}
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid", return_value=layer
    )
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    response: TestResponse = client.post(
        "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001/schema/runtime",
        json={"readiness": "resolved", "runtime_data": {"readiness": "resolved"}},
    )
    assert response.status_code == 200
    layer.raise_for_access.assert_called_once()
    assert provider.get_runtime_schema.call_args.kwargs["readiness"] is (
        SemanticCredentialReadiness.UNRESOLVED
        if masked
        else SemanticCredentialReadiness.RESOLVED
    )


def test_masking_schema_is_explicitly_unresolved(mocker: MockerFixture) -> None:
    """Masking asks for a static schema with unresolved readiness."""
    provider: MagicMock = MagicMock()
    provider.get_configuration_schema.return_value = {
        "properties": {"password": {"writeOnly": True}}
    }
    mocker.patch.dict("superset.semantic_layers.masking.registry", {"test": provider})
    assert mask_configuration("test", {"password": "fixture"}) == {
        "password": PASSWORD_MASK
    }
    assert (
        provider.get_configuration_schema.call_args.kwargs["readiness"]
        is SemanticCredentialReadiness.UNRESOLVED
    )


@pytest.mark.parametrize("status", [401, 403, 502])
def test_transport_keeps_safe_text_and_suppresses_chain(
    app_context: None, status: int
) -> None:
    """Typed transport diagnostics survive without exporting an exception chain."""
    error: ProviderRequestError = ProviderRequestError(
        ProviderRequestFailure.HTTP_STATUS, status=status, provider="MetricFlow"
    )
    error.__cause__ = ValueError("private-cause")
    dispatcher: MagicMock = MagicMock(side_effect=error)
    captured: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError) as captured:
        execute_semantic_query(dispatcher)
    assert str(captured.value) == str(error)
    assert captured.value.__cause__ is None
    assert captured.value.__suppress_context__


@pytest.mark.parametrize("kind", ["backend", "unexpected", "refusal"])
def test_execution_does_not_log_sensitive_cause_or_context(
    app_context: None,
    caplog: pytest.LogCaptureFixture,
    kind: str,
) -> None:
    """Typed and unknown provider failures never export diagnostic chains."""
    error: Exception = {
        "backend": SemanticBackendError(),
        "unexpected": RuntimeError("private-error"),
        "refusal": SemanticQueryRejectedError("INVALID_QUERY"),
    }[kind]
    error.__cause__ = ValueError("private-cause")
    error.__context__ = ValueError("private-context")
    dispatcher: MagicMock = MagicMock(side_effect=error)
    captured: pytest.ExceptionInfo[
        SemanticLayerExecutionError | SemanticLayerQueryRejectedError
    ]
    with (
        caplog.at_level(logging.ERROR),
        pytest.raises(
            (SemanticLayerExecutionError, SemanticLayerQueryRejectedError)
        ) as captured,
    ):
        execute_semantic_query(dispatcher)
    assert captured.value.status == (400 if kind == "refusal" else 500)
    assert captured.value.__cause__ is None
    assert captured.value.__suppress_context__
    assert "private" not in caplog.text
    assert "private" not in str(captured.value.to_dict())
    assert all(record.exc_info is None for record in caplog.records)


@pytest.mark.parametrize("configuration", [None, {}, [], "resolved", True])
def test_absent_or_non_object_configuration_is_unresolved(
    configuration: object,
) -> None:
    """Invalid raw configuration never attests resolved secrets."""
    assert credential_readiness(configuration) is SemanticCredentialReadiness.UNRESOLVED


class OverriddenTransportError(ProviderRequestError):
    """Represent an extension overriding the exception's public formatter."""

    def __str__(self) -> str:
        return "private-subclass-text"


def _untrusted_transport_error(case: str) -> ProviderRequestError:
    """Construct malformed or modified SDK errors without bypassing the host."""
    error: ProviderRequestError = ProviderRequestError(
        ProviderRequestFailure.HTTP_STATUS, status=403, provider="MetricFlow"
    )
    if case == "status_text":
        error.status = cast(int, "private-response-body")
    elif case == "status_bool":
        error.status = True
    elif case == "status_range":
        error.status = 600
    elif case == "status_missing":
        error.status = None
    elif case == "failure":
        error.failure = cast(ProviderRequestFailure, "private-failure")
    elif case == "failure_string":
        error.failure = cast(ProviderRequestFailure, "http_status")
    elif case == "status_on_timeout":
        error.failure = ProviderRequestFailure.TIMEOUT
    elif case == "provider":
        error.provider = "https://private-endpoint/token"
    elif case == "subclass":
        error = OverriddenTransportError(
            ProviderRequestFailure.HTTP_STATUS, status=403, provider="MetricFlow"
        )
    error.__cause__ = ValueError("private-cause")
    return error


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("endpoint", ["query", "structure", "runtime"])
@pytest.mark.parametrize(
    "case",
    [
        "status_text",
        "status_bool",
        "status_range",
        "status_missing",
        "failure",
        "failure_string",
        "status_on_timeout",
        "provider",
        "subclass",
    ],
)
def test_transport_errors_rebuilt_at_every_public_boundary(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    endpoint: str,
    case: str,
) -> None:
    """Neither mutable SDK fields nor a subclass formatter confer safe text."""
    error: ProviderRequestError = _untrusted_transport_error(case)
    valid: bool = case in {"provider", "subclass"}
    message: str
    with caplog.at_level(logging.DEBUG, logger="superset.semantic_layers"):
        if endpoint == "query":
            captured: pytest.ExceptionInfo[
                QueryObjectValidationError | SemanticLayerExecutionError
            ]
            with pytest.raises(
                (QueryObjectValidationError, SemanticLayerExecutionError)
            ) as captured:
                execute_semantic_query(MagicMock(side_effect=error))
            assert isinstance(captured.value, QueryObjectValidationError) == valid
            assert captured.value.__cause__ is None
            assert captured.value.__suppress_context__
            message = str(captured.value)
        else:
            provider: MagicMock = MagicMock()
            layer: MagicMock = MagicMock(
                type="test", configuration='{"account":"fixture"}'
            )
            if endpoint == "structure":
                layer.implementation.get_dimensions.side_effect = error
                session: MagicMock = mocker.patch(
                    "superset.semantic_layers.api.db.session"
                )
                session.query.return_value.filter_by.return_value.first.return_value = (
                    layer
                )
                response: TestResponse = client.get("/api/v1/semantic_view/1/structure")
            else:
                provider.get_runtime_schema.side_effect = error
                mocker.patch.dict(
                    "superset.semantic_layers.api.registry", {"test": provider}
                )
                mocker.patch(
                    "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid",
                    return_value=layer,
                )
                response = client.post(
                    "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001/schema/runtime"
                )
            assert response.status_code == (
                (422 if endpoint == "structure" else 400) if valid else 500
            )
            message = response.get_data(as_text=True)
    assert "private" not in message
    assert "private" not in caplog.text
    if valid:
        assert (
            "Provider" if case == "provider" else "MetricFlow"
        ) + " request failed with HTTP 403." in message


def test_unknown_fault_keeps_debug_traceback_and_chain_server_side(
    app_context: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Unknown faults remain diagnosable without changing their public response."""
    error: AttributeError = AttributeError("private-unknown-message")
    error.__cause__ = ValueError("private-original-cause")
    captured: pytest.ExceptionInfo[SemanticLayerExecutionError]
    with caplog.at_level(logging.DEBUG, logger="superset.semantic_layers.exceptions"):
        with pytest.raises(SemanticLayerExecutionError) as captured:
            execute_semantic_query(MagicMock(side_effect=error))
    records: list[logging.LogRecord] = [
        r for r in caplog.records if r.name == "superset.semantic_layers.exceptions"
    ]
    assert any(
        r.levelno == logging.ERROR
        and "builtins.AttributeError" in r.getMessage()
        and r.exc_info is None
        for r in records
    )
    assert any(
        r.levelno == logging.DEBUG
        and r.exc_info
        and r.exc_info[1] is error
        and r.exc_info[2] is not None
        for r in records
    )
    assert "private-original-cause" in caplog.text
    assert "private-unknown-message" in caplog.text
    assert "private" not in str(captured.value.to_dict())
    assert captured.value.status == 500


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("configuration", [{"account": 123}, ["fixture"], "fixture"])
def test_failed_partial_preview_downgrades_readiness(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    configuration: object,
) -> None:
    """Non-masked input that cannot form a partial config remains unresolved."""
    provider: MagicMock = MagicMock()
    provider.configuration_class = PreviewConfiguration
    provider.get_configuration_schema.return_value = {"type": "object"}
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    response: TestResponse = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "test", "configuration": configuration},
    )
    assert response.status_code == 200
    assert provider.get_configuration_schema.call_args.args == (None,)
    assert (
        provider.get_configuration_schema.call_args.kwargs["readiness"]
        is SemanticCredentialReadiness.UNRESOLVED
    )


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("transport", [False, True])
def test_preview_typed_failure_does_not_log_chain(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    transport: bool,
) -> None:
    """Metadata fallback never logs typed diagnostics, even with DEBUG enabled."""
    error: Exception = (
        ProviderRequestError(ProviderRequestFailure.TIMEOUT)
        if transport
        else SemanticBackendError()
    )
    error.__cause__ = ValueError("private-provider-cause")
    provider: MagicMock = MagicMock()
    provider.configuration_class = PreviewConfiguration
    provider.get_configuration_schema.side_effect = [error, {"type": "object"}]
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": provider})
    with caplog.at_level(logging.DEBUG, logger="superset.semantic_layers"):
        response: TestResponse = client.post(
            "/api/v1/semantic_layer/schema/configuration",
            json={"type": "test", "configuration": {"account": "fixture"}},
        )
    assert response.status_code == 200
    assert "private" not in response.get_data(as_text=True)
    assert "private" not in caplog.text
    assert provider.get_configuration_schema.call_count == 2
