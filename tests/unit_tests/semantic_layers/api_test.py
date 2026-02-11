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

from typing import Any
from unittest.mock import MagicMock

from pytest_mock import MockerFixture

from superset.commands.semantic_layer.exceptions import (
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
