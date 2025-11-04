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

"""Unit tests for UpdateSemanticLayerCommand."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.exceptions import (
    SemanticLayerExistsValidationError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
)
from superset.commands.semantic_layer.update import UpdateSemanticLayerCommand


def test_update_semantic_layer_success(mocker: MockerFixture) -> None:
    """
    Test successful semantic layer update.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = mock_layer

    properties = {
        "description": "Updated description",
        "cache_timeout": 7200,
    }

    command = UpdateSemanticLayerCommand("test-uuid", properties)
    result = command.run()

    assert result == mock_layer
    dao.update.assert_called_once_with(mock_layer, properties)


def test_update_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """
    Test update fails when semantic layer not found.
    """
    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_id.return_value = None

    properties = {"description": "Updated description"}

    command = UpdateSemanticLayerCommand("nonexistent-uuid", properties)

    with pytest.raises(SemanticLayerNotFoundError):
        command.run()


def test_update_semantic_layer_duplicate_name(mocker: MockerFixture) -> None:
    """
    Test update fails when new name already exists.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.validate_update_uniqueness.return_value = False

    properties = {"name": "existing_layer"}

    command = UpdateSemanticLayerCommand("test-uuid", properties)

    with pytest.raises(SemanticLayerInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(exc_info.value._exceptions[0], SemanticLayerExistsValidationError)


def test_update_semantic_layer_name_unchanged(mocker: MockerFixture) -> None:
    """
    Test update with same name doesn't trigger uniqueness validation.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.update.return_value = mock_layer

    properties = {"description": "Updated description"}

    command = UpdateSemanticLayerCommand("test-uuid", properties)
    result = command.run()

    assert result == mock_layer
    dao.validate_update_uniqueness.assert_not_called()


def test_update_semantic_layer_name_changed(mocker: MockerFixture) -> None:
    """
    Test update with new name triggers uniqueness validation.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = mock_layer

    properties = {"name": "new_layer_name"}

    command = UpdateSemanticLayerCommand("test-uuid", properties)
    result = command.run()

    assert result == mock_layer
    dao.validate_update_uniqueness.assert_called_once_with(
        "test-uuid", "new_layer_name"
    )


def test_update_semantic_layer_all_fields(mocker: MockerFixture) -> None:
    """
    Test update with all fields.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = mock_layer

    properties = {
        "name": "updated_layer",
        "description": "Updated description",
        "type": "dbt",
        "configuration": '{"token": "new-token"}',
        "cache_timeout": 7200,
    }

    command = UpdateSemanticLayerCommand("test-uuid", properties)
    result = command.run()

    assert result == mock_layer
    dao.update.assert_called_once_with(mock_layer, properties)
