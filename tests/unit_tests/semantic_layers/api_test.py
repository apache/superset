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

from pytest_mock import MockerFixture

from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerDeleteFailedError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewForbiddenError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)


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


def test_configuration_schema_with_partial_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /schema/configuration enriches schema with partial config."""
    mock_instance = MagicMock()
    mock_instance.configuration = {"account": "test"}

    mock_cls = MagicMock()
    mock_cls.from_configuration.return_value = mock_instance
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
    mock_cls.get_configuration_schema.assert_called_once_with({"account": "test"})


def test_configuration_schema_with_invalid_partial_config(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Test POST /schema/configuration still returns schema when partial config fails."""
    mock_cls = MagicMock()
    mock_cls.from_configuration.side_effect = ValueError("bad config")
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

    layer2 = MagicMock()
    layer2.uuid = uuid_lib.uuid4()
    layer2.name = "Layer 2"
    layer2.description = None
    layer2.type = "snowflake"
    layer2.cache_timeout = 300

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_all.return_value = [layer1, layer2]

    response = client.get("/api/v1/semantic_layer/")

    assert response.status_code == 200
    result = response.json["result"]
    assert len(result) == 2
    assert result[0]["name"] == "Layer 1"
    assert result[1]["name"] == "Layer 2"
    assert result[1]["cache_timeout"] == 300


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

    mock_dao = mocker.patch("superset.semantic_layers.api.SemanticLayerDAO")
    mock_dao.find_by_uuid.return_value = layer

    response = client.get(f"/api/v1/semantic_layer/{test_uuid}")

    assert response.status_code == 200
    result = response.json["result"]
    assert result["uuid"] == str(test_uuid)
    assert result["name"] == "My Layer"
    assert result["type"] == "snowflake"
    assert result["cache_timeout"] == 600


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
