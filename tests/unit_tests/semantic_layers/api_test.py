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

import uuid as uuid_lib
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerDeleteFailedError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewCreateFailedError,
    SemanticViewDeleteFailedError,
    SemanticViewForbiddenError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)

SEMANTIC_LAYERS_APP = pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}],
    indirect=True,
)


@SEMANTIC_LAYERS_APP
def test_put_semantic_view(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test successful PUT updates a semantic view."""
    changed_model = MagicMock()
    changed_model.id = 1

    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = changed_model

    payload = {"description": "Updated description", "cache_timeout": 300}
    response = client.put(
        "/api/v1/semantic_view/1",
        json=payload,
    )

    assert response.status_code == 200
    assert response.json["id"] == 1
    assert response.json["result"] == payload
    mock_command.assert_called_once_with("1", payload)


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT returns 404 when semantic view does not exist."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewNotFoundError()

    response = client.put(
        "/api/v1/semantic_view/999",
        json={"description": "Updated"},
    )

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_forbidden(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT returns 403 when user lacks ownership."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewForbiddenError()

    response = client.put(
        "/api/v1/semantic_view/1",
        json={"description": "Updated"},
    )

    assert response.status_code == 403


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_invalid(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT returns 422 when validation fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewInvalidError()

    response = client.put(
        "/api/v1/semantic_view/1",
        json={"description": "Updated"},
    )

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_update_failed(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT returns 422 when the update operation fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewUpdateFailedError()

    response = client.put(
        "/api/v1/semantic_view/1",
        json={"description": "Updated"},
    )

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_bad_request(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT returns 400 when the request payload has invalid fields."""
    # Marshmallow raises ValidationError for unknown fields
    mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )

    response = client.put(
        "/api/v1/semantic_view/1",
        json={"invalid_field": "value"},
    )

    assert response.status_code == 400


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_description_only(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT with only description field."""
    changed_model = MagicMock()
    changed_model.id = 1

    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = changed_model

    payload = {"description": "New description"}
    response = client.put(
        "/api/v1/semantic_view/1",
        json=payload,
    )

    assert response.status_code == 200
    assert response.json["result"] == payload


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_cache_timeout_only(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT with only cache_timeout field."""
    changed_model = MagicMock()
    changed_model.id = 2

    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = changed_model

    payload = {"cache_timeout": 600}
    response = client.put(
        "/api/v1/semantic_view/2",
        json=payload,
    )

    assert response.status_code == 200
    assert response.json["id"] == 2
    assert response.json["result"] == payload


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_null_values(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT with null values for both fields."""
    changed_model = MagicMock()
    changed_model.id = 1

    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = changed_model

    payload = {"description": None, "cache_timeout": None}
    response = client.put(
        "/api/v1/semantic_view/1",
        json=payload,
    )

    assert response.status_code == 200
    assert response.json["result"] == payload


@SEMANTIC_LAYERS_APP
def test_put_semantic_view_empty_payload(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT with empty payload."""
    changed_model = MagicMock()
    changed_model.id = 1

    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = changed_model

    response = client.put(
        "/api/v1/semantic_view/1",
        json={},
    )

    assert response.status_code == 200


# =============================================================================
# SemanticLayerRestApi tests
# =============================================================================


@SEMANTIC_LAYERS_APP
def test_get_types(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /types returns registered semantic layer types."""
    mock_cls = MagicMock()
    mock_cls.name = "Snowflake Semantic Layer"
    mock_cls.description = "Connect to Snowflake."

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.get("/api/v1/semantic_layer/types")

    assert response.status_code == 200
    result = response.json["result"]
    assert len(result) == 1
    assert result[0] == {
        "id": "snowflake",
        "name": "Snowflake Semantic Layer",
        "description": "Connect to Snowflake.",
    }


@SEMANTIC_LAYERS_APP
def test_get_types_empty(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /types returns empty list when no types registered."""
    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {},
        clear=True,
    )

    response = client.get("/api/v1/semantic_layer/types")

    assert response.status_code == 200
    assert response.json["result"] == []


@SEMANTIC_LAYERS_APP
def test_configuration_schema(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /schema/configuration returns schema without partial config."""
    mock_cls = MagicMock()
    mock_cls.get_configuration_schema.return_value = {"type": "object"}

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "snowflake"},
    )

    assert response.status_code == 200
    assert response.json["result"] == {"type": "object"}
    mock_cls.get_configuration_schema.assert_called_once_with(None)


@SEMANTIC_LAYERS_APP
def test_configuration_schema_with_partial_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /schema/configuration enriches schema with partial config."""
    mock_config_obj = MagicMock()

    mock_cls = MagicMock()
    mock_cls.configuration_class.model_json_schema.return_value = {
        "type": "object",
        "properties": {"account": {"type": "string"}},
    }
    mock_cls.configuration_class.model_validate.return_value = mock_config_obj
    mock_cls.get_configuration_schema.return_value = {
        "type": "object",
        "properties": {"database": {"enum": ["db1", "db2"]}},
    }

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "snowflake", "configuration": {"account": "test"}},
    )

    assert response.status_code == 200
    mock_cls.get_configuration_schema.assert_called_once_with(mock_config_obj)


@SEMANTIC_LAYERS_APP
def test_configuration_schema_with_invalid_partial_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test /schema/configuration returns schema when partial config fails."""
    from pydantic import ValidationError as PydanticValidationError

    mock_cls = MagicMock()
    mock_cls.configuration_class.model_json_schema.return_value = {
        "type": "object",
        "properties": {},
    }
    mock_cls.configuration_class.model_validate.side_effect = (
        PydanticValidationError.from_exception_data(
            title="test",
            line_errors=[],
        )
    )
    mock_cls.get_configuration_schema.return_value = {"type": "object"}

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "snowflake", "configuration": {"bad": "data"}},
    )

    assert response.status_code == 200
    mock_cls.get_configuration_schema.assert_called_once_with(None)


@SEMANTIC_LAYERS_APP
def test_configuration_schema_unknown_type(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /schema/configuration returns 400 for unknown type."""
    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {},
        clear=True,
    )

    response = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "nonexistent"},
    )

    assert response.status_code == 400


@SEMANTIC_LAYERS_APP
def test_runtime_schema(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/schema/runtime returns runtime schema."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.type = "snowflake"
    mock_layer.implementation.configuration = {"account": "test"}

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    mock_cls = MagicMock()
    mock_cls.get_runtime_schema.return_value = {"type": "object"}

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/schema/runtime",
        json={"runtime_data": {"database": "mydb"}},
    )

    assert response.status_code == 200
    assert response.json["result"] == {"type": "object"}
    mock_cls.get_runtime_schema.assert_called_once_with(
        {"account": "test"}, {"database": "mydb"}
    )


@SEMANTIC_LAYERS_APP
def test_runtime_schema_no_body(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/schema/runtime works without a request body."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.type = "snowflake"
    mock_layer.implementation.configuration = {"account": "test"}

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    mock_cls = MagicMock()
    mock_cls.get_runtime_schema.return_value = {"type": "object"}

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/schema/runtime",
    )

    assert response.status_code == 200
    mock_cls.get_runtime_schema.assert_called_once_with({"account": "test"}, None)


@SEMANTIC_LAYERS_APP
def test_runtime_schema_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/schema/runtime returns 404 when layer not found."""
    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = None

    response = client.post(
        f"/api/v1/semantic_layer/{uuid_lib.uuid4()}/schema/runtime",
    )

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_runtime_schema_unknown_type(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/schema/runtime returns 400 for unknown type."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.type = "unknown_type"

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {},
        clear=True,
    )

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/schema/runtime",
    )

    assert response.status_code == 400
    assert "Unknown type" in response.json["message"]


@SEMANTIC_LAYERS_APP
def test_runtime_schema_exception(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/schema/runtime returns 400 when schema raises."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.type = "snowflake"
    mock_layer.implementation.configuration = {"account": "test"}

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    mock_cls = MagicMock()
    mock_cls.get_runtime_schema.side_effect = ValueError("Bad config")

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/schema/runtime",
    )

    assert response.status_code == 400
    assert "Bad config" in response.json["message"]


@SEMANTIC_LAYERS_APP
def test_post_semantic_layer(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / creates a semantic layer."""
    test_uuid = uuid_lib.uuid4()
    new_model = MagicMock()
    new_model.uuid = test_uuid

    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticLayerCommand",
    )
    mock_command.return_value.run.return_value = new_model

    payload = {
        "name": "My Layer",
        "type": "snowflake",
        "configuration": {"account": "test"},
    }
    response = client.post("/api/v1/semantic_layer/", json=payload)

    assert response.status_code == 201
    assert response.json["result"]["uuid"] == str(test_uuid)
    mock_command.assert_called_once_with(payload)


@SEMANTIC_LAYERS_APP
def test_post_semantic_layer_invalid(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / returns 422 when validation fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerInvalidError(
        "Unknown type: bad"
    )

    payload = {
        "name": "My Layer",
        "type": "bad",
        "configuration": {},
    }
    response = client.post("/api/v1/semantic_layer/", json=payload)

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_post_semantic_layer_create_failed(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / returns 422 when creation fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerCreateFailedError()

    payload = {
        "name": "My Layer",
        "type": "snowflake",
        "configuration": {"account": "test"},
    }
    response = client.post("/api/v1/semantic_layer/", json=payload)

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_post_semantic_layer_missing_required_fields(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / returns 400 when required fields are missing."""
    mocker.patch(
        "superset.semantic_layers.api.CreateSemanticLayerCommand",
    )

    response = client.post(
        "/api/v1/semantic_layer/",
        json={"name": "Only name"},
    )

    assert response.status_code == 400


@SEMANTIC_LAYERS_APP
def test_put_semantic_layer(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT /<uuid> updates a semantic layer."""
    test_uuid = uuid_lib.uuid4()
    changed_model = MagicMock()
    changed_model.uuid = test_uuid

    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticLayerCommand",
    )
    mock_command.return_value.run.return_value = changed_model

    payload = {"name": "Updated Name"}
    response = client.put(
        f"/api/v1/semantic_layer/{test_uuid}",
        json=payload,
    )

    assert response.status_code == 200
    assert response.json["result"]["uuid"] == str(test_uuid)
    mock_command.assert_called_once_with(str(test_uuid), payload)


@SEMANTIC_LAYERS_APP
def test_put_semantic_layer_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT /<uuid> returns 404 when layer not found."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerNotFoundError()

    response = client.put(
        f"/api/v1/semantic_layer/{uuid_lib.uuid4()}",
        json={"name": "New"},
    )

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_put_semantic_layer_invalid(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT /<uuid> returns 422 when validation fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerInvalidError(
        "Name already exists"
    )

    response = client.put(
        f"/api/v1/semantic_layer/{uuid_lib.uuid4()}",
        json={"name": "Duplicate"},
    )

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_put_semantic_layer_update_failed(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test PUT /<uuid> returns 422 when update fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.UpdateSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerUpdateFailedError()

    response = client.put(
        f"/api/v1/semantic_layer/{uuid_lib.uuid4()}",
        json={"name": "Test"},
    )

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_put_semantic_layer_validation_error(
    client: Any,
    full_api_access: None,
) -> None:
    """Test PUT /<uuid> returns 400 when payload fails schema validation."""
    response = client.put(
        f"/api/v1/semantic_layer/{uuid_lib.uuid4()}",
        json={"cache_timeout": "not_a_number"},
    )

    assert response.status_code == 400


@SEMANTIC_LAYERS_APP
def test_delete_semantic_layer(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test DELETE /<uuid> deletes a semantic layer."""
    test_uuid = str(uuid_lib.uuid4())
    mock_command = mocker.patch(
        "superset.semantic_layers.api.DeleteSemanticLayerCommand",
    )
    mock_command.return_value.run.return_value = None

    response = client.delete(f"/api/v1/semantic_layer/{test_uuid}")

    assert response.status_code == 200
    mock_command.assert_called_once_with(test_uuid)


@SEMANTIC_LAYERS_APP
def test_delete_semantic_layer_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test DELETE /<uuid> returns 404 when layer not found."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.DeleteSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerNotFoundError()

    response = client.delete(f"/api/v1/semantic_layer/{uuid_lib.uuid4()}")

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_delete_semantic_layer_failed(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test DELETE /<uuid> returns 422 when deletion fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.DeleteSemanticLayerCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerDeleteFailedError()

    response = client.delete(f"/api/v1/semantic_layer/{uuid_lib.uuid4()}")

    assert response.status_code == 422


@SEMANTIC_LAYERS_APP
def test_get_list_semantic_layers(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET / returns list of semantic layers."""
    layer1 = MagicMock()
    layer1.uuid = uuid_lib.uuid4()
    layer1.name = "Layer 1"
    layer1.description = "First"
    layer1.type = "snowflake"
    layer1.cache_timeout = None
    layer1.configuration = "{}"
    layer1.changed_on_delta_humanized.return_value = "1 day ago"

    layer2 = MagicMock()
    layer2.uuid = uuid_lib.uuid4()
    layer2.name = "Layer 2"
    layer2.description = None
    layer2.type = "snowflake"
    layer2.cache_timeout = 300
    layer2.configuration = '{"account": "test"}'
    layer2.changed_on_delta_humanized.return_value = "2 hours ago"

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_all.return_value = [layer1, layer2]

    response = client.get("/api/v1/semantic_layer/")

    assert response.status_code == 200
    result = response.json["result"]
    assert len(result) == 2
    assert result[0]["name"] == "Layer 1"
    assert result[1]["name"] == "Layer 2"
    assert result[1]["cache_timeout"] == 300
    assert result[1]["configuration"] == {"account": "test"}


@SEMANTIC_LAYERS_APP
def test_get_list_semantic_layers_empty(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET / returns empty list when no layers exist."""
    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_all.return_value = []

    response = client.get("/api/v1/semantic_layer/")

    assert response.status_code == 200
    assert response.json["result"] == []


@SEMANTIC_LAYERS_APP
def test_get_semantic_layer(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /<uuid> returns a single semantic layer."""
    test_uuid = uuid_lib.uuid4()
    layer = MagicMock()
    layer.uuid = test_uuid
    layer.name = "My Layer"
    layer.description = "A layer"
    layer.type = "snowflake"
    layer.cache_timeout = 600
    layer.configuration = '{"account": "test"}'
    layer.changed_on_delta_humanized.return_value = "1 day ago"

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = layer

    response = client.get(f"/api/v1/semantic_layer/{test_uuid}")

    assert response.status_code == 200
    result = response.json["result"]
    assert result["uuid"] == str(test_uuid)
    assert result["name"] == "My Layer"
    assert result["type"] == "snowflake"
    assert result["cache_timeout"] == 600
    assert result["configuration"] == {"account": "test"}


@SEMANTIC_LAYERS_APP
def test_get_semantic_layer_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /<uuid> returns 404 when layer not found."""
    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = None

    response = client.get(f"/api/v1/semantic_layer/{uuid_lib.uuid4()}")

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_serialize_layer_string_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test _serialize_layer handles string configuration (JSON)."""
    layer = MagicMock()
    layer.uuid = uuid_lib.uuid4()
    layer.name = "Layer"
    layer.description = None
    layer.type = "snowflake"
    layer.cache_timeout = None
    layer.configuration = '{"account": "test"}'
    layer.changed_on_delta_humanized.return_value = "1 day ago"

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = layer

    response = client.get(f"/api/v1/semantic_layer/{layer.uuid}")

    assert response.status_code == 200
    assert response.json["result"]["configuration"] == {"account": "test"}


@SEMANTIC_LAYERS_APP
def test_serialize_layer_dict_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test _serialize_layer handles dict configuration."""
    layer = MagicMock()
    layer.uuid = uuid_lib.uuid4()
    layer.name = "Layer"
    layer.description = None
    layer.type = "snowflake"
    layer.cache_timeout = None
    layer.configuration = {"account": "test"}
    layer.changed_on_delta_humanized.return_value = "1 day ago"

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = layer

    response = client.get(f"/api/v1/semantic_layer/{layer.uuid}")

    assert response.status_code == 200
    assert response.json["result"]["configuration"] == {"account": "test"}


@SEMANTIC_LAYERS_APP
def test_serialize_layer_none_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test _serialize_layer handles None configuration."""
    layer = MagicMock()
    layer.uuid = uuid_lib.uuid4()
    layer.name = "Layer"
    layer.description = None
    layer.type = "snowflake"
    layer.cache_timeout = None
    layer.configuration = None
    layer.changed_on_delta_humanized.return_value = "1 day ago"

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = layer

    response = client.get(f"/api/v1/semantic_layer/{layer.uuid}")

    assert response.status_code == 200
    assert response.json["result"]["configuration"] == {}


def test_infer_discriminators_injects_discriminator() -> None:
    """Test _infer_discriminators injects discriminator values."""
    from superset.semantic_layers.api import _infer_discriminators

    schema = {
        "$defs": {
            "VariantA": {"required": ["disc", "field_a"]},
        },
        "properties": {
            "auth": {
                "discriminator": {
                    "propertyName": "disc",
                    "mapping": {"a": "#/$defs/VariantA"},
                },
            },
        },
    }
    data = {"auth": {"field_a": "value"}}
    result = _infer_discriminators(schema, data)
    assert result["auth"]["disc"] == "a"


def test_infer_discriminators_no_match() -> None:
    """Test _infer_discriminators returns data unchanged when no match."""
    from superset.semantic_layers.api import _infer_discriminators

    schema = {
        "$defs": {
            "VariantA": {"required": ["disc", "field_a"]},
        },
        "properties": {
            "auth": {
                "discriminator": {
                    "propertyName": "disc",
                    "mapping": {"a": "#/$defs/VariantA"},
                },
            },
        },
    }
    data = {"auth": {"other": "value"}}
    result = _infer_discriminators(schema, data)
    assert "disc" not in result["auth"]


def test_infer_discriminators_skips_non_dict() -> None:
    """Test _infer_discriminators skips non-dict values."""
    from superset.semantic_layers.api import _infer_discriminators

    schema = {
        "$defs": {},
        "properties": {"auth": {"discriminator": {"propertyName": "disc"}}},
    }
    data = {"auth": "a string"}
    result = _infer_discriminators(schema, data)
    assert result == data


def test_infer_discriminators_skips_if_discriminator_present() -> None:
    """Test _infer_discriminators skips when discriminator already set."""
    from superset.semantic_layers.api import _infer_discriminators

    schema = {
        "$defs": {},
        "properties": {
            "auth": {
                "discriminator": {
                    "propertyName": "disc",
                    "mapping": {"a": "#/$defs/VariantA"},
                },
            },
        },
    }
    data = {"auth": {"disc": "a", "field_a": "value"}}
    result = _infer_discriminators(schema, data)
    assert result["auth"]["disc"] == "a"


def test_infer_discriminators_no_discriminator() -> None:
    """Test _infer_discriminators skips properties without discriminator."""
    from superset.semantic_layers.api import _infer_discriminators

    schema = {
        "$defs": {},
        "properties": {"auth": {"type": "object"}},
    }
    data = {"auth": {"key": "val"}}
    result = _infer_discriminators(schema, data)
    assert result == data


def test_parse_partial_config_strict_success() -> None:
    """Test _parse_partial_config returns config on strict validation."""
    from superset.semantic_layers.api import _parse_partial_config

    mock_cls = MagicMock()
    mock_cls.configuration_class.model_json_schema.return_value = {
        "properties": {},
    }
    validated = MagicMock()
    mock_cls.configuration_class.model_validate.return_value = validated

    result = _parse_partial_config(mock_cls, {"key": "val"})
    assert result == validated


def test_parse_partial_config_falls_back_to_partial() -> None:
    """Test _parse_partial_config falls back to partial validation."""
    from pydantic import ValidationError as PydanticValidationError

    from superset.semantic_layers.api import _parse_partial_config

    mock_cls = MagicMock()
    mock_cls.configuration_class.model_json_schema.return_value = {
        "properties": {},
    }
    partial_result = MagicMock()
    mock_cls.configuration_class.model_validate.side_effect = [
        PydanticValidationError.from_exception_data(title="test", line_errors=[]),
        partial_result,
    ]

    result = _parse_partial_config(mock_cls, {"key": "val"})
    assert result == partial_result


def test_parse_partial_config_returns_none_on_failure() -> None:
    """Test _parse_partial_config returns None when all validation fails."""
    from pydantic import ValidationError as PydanticValidationError

    from superset.semantic_layers.api import _parse_partial_config

    mock_cls = MagicMock()
    mock_cls.configuration_class.model_json_schema.return_value = {
        "properties": {},
    }
    err = PydanticValidationError.from_exception_data(title="test", line_errors=[])
    mock_cls.configuration_class.model_validate.side_effect = err

    result = _parse_partial_config(mock_cls, {"key": "val"})
    assert result is None


@SEMANTIC_LAYERS_APP
def test_configuration_schema_enrichment_error_fallback(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test configuration_schema falls back when enrichment raises."""
    mock_cls = MagicMock()
    mock_cls.configuration_class.model_json_schema.return_value = {
        "properties": {},
    }
    mock_cls.configuration_class.model_validate.return_value = MagicMock()
    mock_cls.get_configuration_schema.side_effect = [
        RuntimeError("connection failed"),
        {"type": "object"},
    ]

    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    response = client.post(
        "/api/v1/semantic_layer/schema/configuration",
        json={"type": "snowflake", "configuration": {"account": "test"}},
    )

    assert response.status_code == 200
    assert response.json["result"] == {"type": "object"}
    assert response.json["warning"] == "connection failed"
    assert mock_cls.get_configuration_schema.call_count == 2


@SEMANTIC_LAYERS_APP
def test_connections_list(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /connections/ returns combined database and layer list."""
    from datetime import datetime

    mock_db = MagicMock()
    mock_db.id = 1
    mock_db.uuid = uuid_lib.uuid4()
    mock_db.database_name = "PostgreSQL"
    mock_db.backend = "postgresql"
    mock_db.allow_run_async = False
    mock_db.allow_dml = False
    mock_db.allow_file_upload = False
    mock_db.expose_in_sqllab = True
    mock_db.changed_on = datetime(2026, 1, 1)
    mock_db.changed_on_delta_humanized.return_value = "1 month ago"
    mock_db.changed_by = None

    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()
    mock_layer.name = "My Layer"
    mock_layer.type = "snowflake"
    mock_layer.description = "A layer"
    mock_layer.cache_timeout = None
    mock_layer.changed_on = datetime(2026, 2, 1)
    mock_layer.changed_on_delta_humanized.return_value = "1 day ago"
    mock_layer.changed_by = None

    mock_db_session = mocker.patch("superset.semantic_layers.api.db.session")
    db_query = MagicMock()
    db_query.options.return_value = db_query
    db_query.all.return_value = [mock_db]
    db_query.filter.return_value = db_query
    sl_query = MagicMock()
    sl_query.options.return_value = sl_query
    sl_query.all.return_value = [mock_layer]
    sl_query.filter.return_value = sl_query
    mock_db_session.query.side_effect = [db_query, sl_query]

    mock_cls = MagicMock()
    mock_cls.name = "Snowflake"
    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    mocker.patch(
        "superset.semantic_layers.api.is_feature_enabled",
        return_value=True,
    )

    response = client.get("/api/v1/semantic_layer/connections/")

    assert response.status_code == 200
    assert response.json["count"] == 2
    result = response.json["result"]
    assert len(result) == 2


@SEMANTIC_LAYERS_APP
def test_connections_database_only(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /connections/ returns 404 when feature flag is disabled."""

    mocker.patch(
        "superset.semantic_layers.api.is_feature_enabled",
        return_value=False,
    )

    response = client.get("/api/v1/semantic_layer/connections/")

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_connections_name_filter(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /connections/ with name filter."""
    mock_db_session = mocker.patch("superset.semantic_layers.api.db.session")
    db_query = MagicMock()
    db_query.options.return_value = db_query
    db_query.all.return_value = []
    db_query.filter.return_value = db_query
    sl_query = MagicMock()
    sl_query.options.return_value = sl_query
    sl_query.all.return_value = []
    sl_query.filter.return_value = sl_query
    mock_db_session.query.side_effect = [db_query, sl_query]

    mocker.patch(
        "superset.semantic_layers.api.is_feature_enabled",
        return_value=True,
    )

    import prison as rison_lib

    q = rison_lib.dumps(
        {"filters": [{"col": "database_name", "opr": "ct", "value": "post"}]}
    )
    response = client.get(f"/api/v1/semantic_layer/connections/?q={q}")

    assert response.status_code == 200
    assert response.json["count"] == 0
    # Verify filter was applied to both queries
    db_query.filter.assert_called_once()
    sl_query.filter.assert_called_once()


@SEMANTIC_LAYERS_APP
def test_connections_sort_by_name(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /connections/ sorts by database_name."""
    from datetime import datetime

    mock_db = MagicMock()
    mock_db.id = 1
    mock_db.uuid = uuid_lib.uuid4()
    mock_db.database_name = "Zebra DB"
    mock_db.backend = "postgresql"
    mock_db.allow_run_async = False
    mock_db.allow_dml = False
    mock_db.allow_file_upload = False
    mock_db.expose_in_sqllab = True
    mock_db.changed_on = datetime(2026, 1, 1)
    mock_db.changed_on_delta_humanized.return_value = "1 month ago"
    mock_db.changed_by = None

    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()
    mock_layer.name = "Alpha Layer"
    mock_layer.type = "snowflake"
    mock_layer.description = None
    mock_layer.cache_timeout = None
    mock_layer.changed_on = datetime(2026, 2, 1)
    mock_layer.changed_on_delta_humanized.return_value = "1 day ago"
    mock_layer.changed_by = None

    mock_db_session = mocker.patch("superset.semantic_layers.api.db.session")
    db_query = MagicMock()
    db_query.options.return_value = db_query
    db_query.all.return_value = [mock_db]
    sl_query = MagicMock()
    sl_query.options.return_value = sl_query
    sl_query.all.return_value = [mock_layer]
    mock_db_session.query.side_effect = [db_query, sl_query]

    mock_cls = MagicMock()
    mock_cls.name = "Snowflake"
    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    mocker.patch(
        "superset.semantic_layers.api.is_feature_enabled",
        return_value=True,
    )

    import prison as rison_lib

    q = rison_lib.dumps({"order_column": "database_name", "order_direction": "asc"})
    response = client.get(f"/api/v1/semantic_layer/connections/?q={q}")

    assert response.status_code == 200
    result = response.json["result"]
    assert result[0]["database_name"] == "Alpha Layer"
    assert result[1]["database_name"] == "Zebra DB"


@SEMANTIC_LAYERS_APP
def test_connections_source_type_filter(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /connections/ with source_type filter."""
    from datetime import datetime

    mock_db = MagicMock()
    mock_db.id = 1
    mock_db.uuid = uuid_lib.uuid4()
    mock_db.database_name = "PostgreSQL"
    mock_db.backend = "postgresql"
    mock_db.allow_run_async = False
    mock_db.allow_dml = False
    mock_db.allow_file_upload = False
    mock_db.expose_in_sqllab = True
    mock_db.changed_on = datetime(2026, 1, 1)
    mock_db.changed_on_delta_humanized.return_value = "1 month ago"
    mock_db.changed_by = None

    mock_db_session = mocker.patch("superset.semantic_layers.api.db.session")
    db_query = MagicMock()
    db_query.options.return_value = db_query
    db_query.all.return_value = [mock_db]
    mock_db_session.query.return_value = db_query

    mocker.patch(
        "superset.semantic_layers.api.is_feature_enabled",
        return_value=True,
    )

    import prison as rison_lib

    q = rison_lib.dumps(
        {"filters": [{"col": "source_type", "opr": "eq", "value": "database"}]}
    )
    response = client.get(f"/api/v1/semantic_layer/connections/?q={q}")

    assert response.status_code == 200
    assert response.json["count"] == 1
    # Only one query call (for Database), not two
    mock_db_session.query.assert_called_once()


@SEMANTIC_LAYERS_APP
def test_connections_source_type_semantic_layer_only(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test GET /connections/ with source_type=semantic_layer filter."""
    from datetime import datetime

    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()
    mock_layer.name = "My Layer"
    mock_layer.type = "snowflake"
    mock_layer.description = None
    mock_layer.cache_timeout = None
    mock_layer.changed_on = datetime(2026, 1, 1)
    mock_layer.changed_on_delta_humanized.return_value = "1 day ago"
    mock_layer.changed_by = None

    mock_db_session = mocker.patch("superset.semantic_layers.api.db.session")
    sl_query = MagicMock()
    sl_query.options.return_value = sl_query
    sl_query.all.return_value = [mock_layer]
    mock_db_session.query.return_value = sl_query

    mock_cls = MagicMock()
    mock_cls.name = "Snowflake"
    mocker.patch.dict(
        "superset.semantic_layers.api.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    mocker.patch(
        "superset.semantic_layers.api.is_feature_enabled",
        return_value=True,
    )

    import prison as rison_lib

    q = rison_lib.dumps(
        {
            "filters": [
                {"col": "source_type", "opr": "eq", "value": "semantic_layer"},
                {"col": "other_col", "opr": "eq", "value": "ignored"},
            ]
        }
    )
    response = client.get(f"/api/v1/semantic_layer/connections/?q={q}")

    assert response.status_code == 200
    assert response.json["count"] == 1
    result = response.json["result"][0]
    assert result["source_type"] == "semantic_layer"
    # Only one query (SemanticLayer), no Database query
    mock_db_session.query.assert_called_once()


# =============================================================================
# SemanticViewRestApi.post (bulk create) tests
# =============================================================================


@SEMANTIC_LAYERS_APP
def test_post_semantic_view_bulk_create(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / bulk creates semantic views."""
    new_model = MagicMock()
    new_model.uuid = uuid_lib.uuid4()
    new_model.name = "View 1"

    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = new_model

    payload = {
        "views": [
            {
                "name": "View 1",
                "semantic_layer_uuid": str(uuid_lib.uuid4()),
                "configuration": {"database": "db1"},
            },
        ],
    }
    response = client.post("/api/v1/semantic_view/", json=payload)

    assert response.status_code == 201
    result = response.json["result"]
    assert len(result["created"]) == 1
    assert result["created"][0]["name"] == "View 1"


@SEMANTIC_LAYERS_APP
def test_post_semantic_view_empty_views(
    client: Any,
    full_api_access: None,
) -> None:
    """Test POST / returns 400 when no views provided."""
    response = client.post("/api/v1/semantic_view/", json={"views": []})

    assert response.status_code == 400


@SEMANTIC_LAYERS_APP
def test_post_semantic_view_validation_error(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / collects validation errors for individual views."""
    # Missing required field "semantic_layer_uuid"
    payload = {
        "views": [
            {"name": "Bad View"},
        ],
    }
    response = client.post("/api/v1/semantic_view/", json=payload)

    assert response.status_code == 422
    result = response.json["result"]
    assert len(result["errors"]) == 1
    assert result["errors"][0]["name"] == "Bad View"


@SEMANTIC_LAYERS_APP
def test_post_semantic_view_layer_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / collects layer-not-found errors."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticLayerNotFoundError()

    payload = {
        "views": [
            {
                "name": "View 1",
                "semantic_layer_uuid": str(uuid_lib.uuid4()),
                "configuration": {},
            },
        ],
    }
    response = client.post("/api/v1/semantic_view/", json=payload)

    assert response.status_code == 422
    result = response.json["result"]
    assert len(result["errors"]) == 1
    assert result["errors"][0]["error"] == "Semantic layer not found"


@SEMANTIC_LAYERS_APP
def test_post_semantic_view_create_failed(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / collects create-failed errors."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewCreateFailedError()

    payload = {
        "views": [
            {
                "name": "View 1",
                "semantic_layer_uuid": str(uuid_lib.uuid4()),
                "configuration": {},
            },
        ],
    }
    response = client.post("/api/v1/semantic_view/", json=payload)

    assert response.status_code == 422
    result = response.json["result"]
    assert len(result["errors"]) == 1


@SEMANTIC_LAYERS_APP
def test_post_semantic_view_partial_success(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST / returns 201 with partial success (some created, some errors)."""
    new_model = MagicMock()
    new_model.uuid = uuid_lib.uuid4()
    new_model.name = "Good View"

    mock_command = mocker.patch(
        "superset.semantic_layers.api.CreateSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = [
        new_model,
        SemanticLayerNotFoundError(),
    ]

    layer_uuid = str(uuid_lib.uuid4())
    payload = {
        "views": [
            {
                "name": "Good View",
                "semantic_layer_uuid": layer_uuid,
                "configuration": {},
            },
            {
                "name": "Bad View",
                "semantic_layer_uuid": layer_uuid,
                "configuration": {},
            },
        ],
    }
    response = client.post("/api/v1/semantic_view/", json=payload)

    assert response.status_code == 201
    result = response.json["result"]
    assert len(result["created"]) == 1
    assert len(result["errors"]) == 1


# =============================================================================
# SemanticViewRestApi.delete tests
# =============================================================================


@SEMANTIC_LAYERS_APP
def test_delete_semantic_view(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test DELETE /<pk> deletes a semantic view."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.DeleteSemanticViewCommand",
    )
    mock_command.return_value.run.return_value = None

    response = client.delete("/api/v1/semantic_view/1")

    assert response.status_code == 200
    mock_command.assert_called_once_with("1")


@SEMANTIC_LAYERS_APP
def test_delete_semantic_view_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test DELETE /<pk> returns 404 when view not found."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.DeleteSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewNotFoundError()

    response = client.delete("/api/v1/semantic_view/999")

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_delete_semantic_view_failed(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test DELETE /<pk> returns 422 when deletion fails."""
    mock_command = mocker.patch(
        "superset.semantic_layers.api.DeleteSemanticViewCommand",
    )
    mock_command.return_value.run.side_effect = SemanticViewDeleteFailedError()

    response = client.delete("/api/v1/semantic_view/1")

    assert response.status_code == 422


# =============================================================================
# SemanticLayerRestApi.views tests
# =============================================================================


@SEMANTIC_LAYERS_APP
def test_get_views(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/views returns available views."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()

    mock_view1 = MagicMock()
    mock_view1.name = "View A"
    mock_view2 = MagicMock()
    mock_view2.name = "View B"
    mock_layer.implementation.get_semantic_views.return_value = [
        mock_view1,
        mock_view2,
    ]

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    mock_sv_dao = mocker.patch("superset.semantic_layers.api.SemanticViewDAO")
    mock_sv_dao.find_by_semantic_layer.return_value = []

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/views",
        json={"runtime_data": {"database": "mydb"}},
    )

    assert response.status_code == 200
    result = response.json["result"]
    assert len(result) == 2
    assert result[0]["name"] == "View A"
    assert result[0]["already_added"] is False
    assert result[1]["name"] == "View B"


@SEMANTIC_LAYERS_APP
def test_get_views_with_existing(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/views marks already-added views."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()

    mock_view = MagicMock()
    mock_view.name = "Existing View"
    mock_layer.implementation.get_semantic_views.return_value = [mock_view]

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    existing_view = MagicMock()
    existing_view.name = "Existing View"
    existing_view.configuration = '{"database": "mydb"}'

    mock_sv_dao = mocker.patch("superset.semantic_layers.api.SemanticViewDAO")
    mock_sv_dao.find_by_semantic_layer.return_value = [existing_view]

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/views",
        json={"runtime_data": {"database": "mydb"}},
    )

    assert response.status_code == 200
    result = response.json["result"]
    assert len(result) == 1
    assert result[0]["name"] == "Existing View"
    assert result[0]["already_added"] is True


@SEMANTIC_LAYERS_APP
def test_get_views_not_found(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/views returns 404 when layer not found."""
    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = None

    response = client.post(
        f"/api/v1/semantic_layer/{uuid_lib.uuid4()}/views",
        json={},
    )

    assert response.status_code == 404


@SEMANTIC_LAYERS_APP
def test_get_views_exception(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/views returns 400 when implementation raises."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()
    mock_layer.implementation.get_semantic_views.side_effect = ValueError(
        "Connection failed"
    )

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/views",
        json={"runtime_data": {}},
    )

    assert response.status_code == 400
    assert "Connection failed" in response.json["message"]


@SEMANTIC_LAYERS_APP
def test_get_views_existing_dict_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /<uuid>/views handles dict configuration on existing views."""
    test_uuid = str(uuid_lib.uuid4())
    mock_layer = MagicMock()
    mock_layer.uuid = uuid_lib.uuid4()

    mock_view = MagicMock()
    mock_view.name = "View X"
    mock_layer.implementation.get_semantic_views.return_value = [mock_view]

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = mock_layer

    existing_view = MagicMock()
    existing_view.name = "View X"
    existing_view.configuration = {"key": "val"}  # dict, not string

    mock_sv_dao = mocker.patch("superset.semantic_layers.api.SemanticViewDAO")
    mock_sv_dao.find_by_semantic_layer.return_value = [existing_view]

    response = client.post(
        f"/api/v1/semantic_layer/{test_uuid}/views",
        json={"runtime_data": {"key": "val"}},
    )

    assert response.status_code == 200
    result = response.json["result"]
    assert result[0]["already_added"] is True
