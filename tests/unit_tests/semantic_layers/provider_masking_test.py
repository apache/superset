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

from pathlib import Path
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from flask.testing import FlaskClient
from jsonschema import validate
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset.constants import PASSWORD_MASK
from superset.semantic_layers.masking import unmask_configuration
from superset.utils import json


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize("detail", [False, True])
@pytest.mark.parametrize(
    "secret_fields", [["password"], ["private_key", "private_key_password"]]
)
def test_provider_nested_secrets_masked_on_read(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    detail: bool,
    secret_fields: list[str],
) -> None:
    """Use the Snowflake provider's published auth union/$defs on both read paths.

    Fixture: shell #4135 at 971cd832, SnowflakeConfiguration.model_json_schema().
    No provider installation or external warehouse connection is needed.
    """
    schema: dict[str, Any] = json.loads(
        (Path(__file__).parent / "fixtures/snowflake_configuration.json").read_text()
    )
    configuration: dict[str, Any] = {
        "account_identifier": "example",
        "role": "analyst",
        "warehouse": "testwh",
        "auth": {
            "auth_type": "user_password"
            if "password" in secret_fields
            else "private_key",
            "username": "example",
            **dict.fromkeys(secret_fields, "synthetic-secret"),
        },
    }
    validate(configuration, schema)
    layer: MagicMock = MagicMock()
    layer.uuid = uuid4()
    layer.name = "Fixture layer"
    layer.type = "snowflake"
    layer.description = None
    layer.cache_timeout = None
    layer.configuration = json.dumps(configuration)
    layer.changed_on_delta_humanized.return_value = ""
    mocker.patch.dict(
        "superset.semantic_layers.registry.registry",
        {"snowflake": MagicMock(get_configuration_schema=lambda: schema)},
        clear=True,
    )
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_all", return_value=[layer]
    )
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid", return_value=layer
    )
    endpoint: str = (
        f"/api/v1/semantic_layer/{layer.uuid}" if detail else "/api/v1/semantic_layer/"
    )
    response: TestResponse = client.get(endpoint)
    assert response.status_code == 200
    result: dict[str, Any] = (
        response.json["result"] if detail else response.json["result"][0]
    )
    assert "synthetic-secret" not in response.get_data(as_text=True)
    assert result["configuration"]["account_identifier"] == "example"
    assert result["configuration"]["role"] == "analyst"
    assert result["configuration"]["warehouse"] == "testwh"
    assert (
        result["configuration"]["auth"]["auth_type"]
        == configuration["auth"]["auth_type"]
    )
    assert result["configuration"]["auth"]["username"] == "example"
    for field in secret_fields:
        assert result["configuration"]["auth"][field] == PASSWORD_MASK
    assert unmask_configuration(configuration, result["configuration"]) == configuration
