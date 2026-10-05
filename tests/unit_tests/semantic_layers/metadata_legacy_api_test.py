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

"""Legacy datasource HTTP boundaries preserve typed discovery failures."""

from unittest.mock import Mock
from uuid import uuid4

import pytest
from flask import Flask
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    MetadataRefreshErrorCategory,
)
from werkzeug.test import TestResponse

from superset import security_manager
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.semantic_layers.metadata_binding import request_metadata_budget
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_contract_test import OptedInLayer


@pytest.mark.parametrize(
    "app",
    [
        {
            "FEATURE_FLAGS": {"SEMANTIC_LAYERS": True},
            "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
            "SEMANTIC_LAYER_METADATA_NAMESPACE": "legacy-http",
        }
    ],
    indirect=True,
)
@pytest.mark.parametrize(
    "route",
    [
        "/fetch_datasource_metadata?datasourceKey=11__semantic_view",
        "/datasource/get/semantic_view/11/",
    ],
)
@pytest.mark.parametrize("category,status", [("unavailable", 503), ("deadline", 504)])
@pytest.mark.parametrize("authorized", [True, False])
def test_legacy_metadata_discovery_failure(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    route: str,
    category: MetadataRefreshErrorCategory,
    status: int,
    authorized: bool,
) -> None:
    """Read a real semantic view after access checks, failing at provider discovery."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="legacy-http", configuration="{}"
    )
    view: SemanticView = SemanticView(
        id=11, uuid=uuid4(), name="orders", semantic_layer=layer, configuration="{}"
    )
    mocker.patch.dict(registry, {"legacy-http": OptedInLayer})
    mocker.patch.dict(
        app.before_request_funcs,
        {
            None: [request_metadata_budget, *app.before_request_funcs.get(None, [])],
        },
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    access: Mock = (
        mocker.patch.object(view, "raise_for_access")
        if "fetch_datasource_metadata" in route
        else mocker.patch.object(security_manager, "raise_for_access")
    )
    provider: Mock = mocker.Mock()
    provider.get_semantic_view.side_effect = MetadataRefreshError(category)
    factory: Mock = mocker.patch(
        "superset.semantic_layers.metadata_binding.layer_implementation",
        return_value=provider,
    )
    if not authorized:
        access.side_effect = SupersetSecurityException(
            SupersetError(
                message="Access denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
    response: TestResponse = client.get(route)
    if authorized:
        assert factory.called, response.data
        assert response.status_code == status
        assert response.json is not None
        assert response.json["error"] == category
        provider.get_semantic_view.assert_called_once_with("orders", {})
    else:
        assert access.called, response.data
        assert response.status_code == 403
        factory.assert_not_called()
    if "fetch_datasource_metadata" in route:
        access.assert_called_once_with()
    else:
        access.assert_called_once_with(datasource=view)
