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

"""Stored runtime choices follow the bound catalog through the HTTP endpoint."""

from unittest.mock import Mock, PropertyMock
from uuid import uuid4

import pytest
from flask import Flask
from flask.testing import FlaskClient
from pydantic import BaseModel
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset.app import create_app
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.initialization import SupersetAppInitializer
from superset.semantic_layers.metadata_binding import (
    connection_store,
    metadata_operation,
    operation_deadline,
    request_metadata_budget,
)
from superset.semantic_layers.models import SemanticLayer
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_contract_test import OptedInLayer
from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend


class RuntimeConfiguration(BaseModel):
    """Empty configuration for the endpoint fixture."""


class RuntimeLayer(OptedInLayer):
    """Keep a working legacy schema so the test distinguishes the two paths."""

    configuration: RuntimeConfiguration = RuntimeConfiguration()


@pytest.mark.parametrize(
    "app",
    [
        {
            "FEATURE_FLAGS": {"SEMANTIC_LAYERS": True},
            "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
            "SEMANTIC_LAYER_METADATA_NAMESPACE": "runtime-test",
            "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
        }
    ],
    indirect=True,
)
@pytest.mark.parametrize(
    "outcome", ["refreshed", "denied", "invalid", "missing_adapter"]
)
def test_runtime_endpoint_returns_refreshed_bound_choices(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    outcome: str,
) -> None:
    """A fresh request sees refreshed catalog choices, not the legacy schema."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="runtime-fixture", configuration="{}"
    )
    backend: MemoryBackend = MemoryBackend()
    # The unit app fixture bypasses create_app, which registers this early hook.
    mocker.patch.dict(
        app.before_request_funcs,
        {None: [request_metadata_budget, *app.before_request_funcs.get(None, [])]},
    )
    mocker.patch.dict(registry, {"runtime-fixture": RuntimeLayer})
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid", return_value=layer
    )
    access: Mock = mocker.patch.object(SemanticLayer, "raise_for_access")
    backend_factory: Mock = mocker.patch(
        "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
        return_value=backend,
    )
    session: Mock = mocker.patch("superset.semantic_layers.metadata_binding.Session")
    session.return_value.__enter__.return_value.get.return_value = layer
    construct: Mock = mocker.spy(RuntimeLayer, "from_configuration")
    if outcome == "refreshed":
        with app.app_context(), metadata_operation():
            connection_store(layer).refresh(
                lambda deadline: '["fresh_metric"]', deadline=operation_deadline()
            )
    elif outcome == "denied":
        access.side_effect = SupersetSecurityException(
            SupersetError(
                message="denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
    elif outcome == "invalid":
        layer.configuration = "{broken"
    else:
        mocker.patch.object(
            RuntimeLayer,
            "metadata_refresh",
            new_callable=PropertyMock,
            return_value=None,
        )
    response: TestResponse = client.post(
        f"/api/v1/semantic_layer/{layer.uuid}/schema/runtime",
        json={"runtime_data": {"database": "warehouse"}},
    )
    access.assert_called_once_with()
    if outcome == "refreshed":
        assert response.status_code == 200, response.json
        assert response.json["result"] == {"enum": ["fresh_metric"]}
    elif outcome == "denied":
        assert response.status_code == 403
        backend_factory.assert_not_called()
        construct.assert_not_called()
        assert backend.entries == {}
    else:
        assert response.status_code == 422
        assert response.json["error"] == "configuration"
        assert backend.entries == {}


def test_create_app_establishes_metadata_budget_before_initializer_hooks(
    mocker: MockerFixture,
) -> None:
    """Authentication hooks observe a real request budget installed by create_app."""
    observed: list[float] = []

    def initialize(initializer: SupersetAppInitializer) -> None:
        """Model authentication's initializer-installed before-request hook."""

        def authentication_probe() -> None:
            observed.append(operation_deadline())

        initializer.superset_app.before_request(authentication_probe)

    mocker.patch.object(
        SupersetAppInitializer, "init_app", autospec=True, side_effect=initialize
    )
    created: Flask = create_app()
    created.config["SEMANTIC_LAYER_METADATA_REFRESH_ENABLED"] = True
    created.test_client().get("/budget-probe")
    assert len(observed) == 1
