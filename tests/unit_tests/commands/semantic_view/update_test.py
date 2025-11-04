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

"""Unit tests for UpdateSemanticViewCommand."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_view.exceptions import (
    SemanticViewExistsValidationError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
)
from superset.commands.semantic_view.update import UpdateSemanticViewCommand


def test_update_semantic_view_success(mocker: MockerFixture) -> None:
    """
    Test successful semantic view update.
    """
    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"
    mock_view.semantic_layer_uuid = "layer-uuid"

    dao = mocker.patch("superset.commands.semantic_view.update.SemanticViewDAO")
    dao.find_by_id.return_value = mock_view
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = mock_view

    properties = {
        "configuration": '{"columns": ["id", "name", "email"]}',
        "cache_timeout": 3600,
    }

    command = UpdateSemanticViewCommand("view-uuid", properties)
    result = command.run()

    assert result == mock_view
    dao.update.assert_called_once_with(mock_view, properties)


def test_update_semantic_view_not_found(mocker: MockerFixture) -> None:
    """
    Test update fails when semantic view not found.
    """
    dao = mocker.patch("superset.commands.semantic_view.update.SemanticViewDAO")
    dao.find_by_id.return_value = None

    properties = {"configuration": '{"columns": ["id"]}'}

    command = UpdateSemanticViewCommand("nonexistent-uuid", properties)

    with pytest.raises(SemanticViewNotFoundError):
        command.run()


def test_update_semantic_view_duplicate_name(mocker: MockerFixture) -> None:
    """
    Test update fails when new name already exists in layer.
    """
    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"
    mock_view.semantic_layer_uuid = "layer-uuid"

    dao = mocker.patch("superset.commands.semantic_view.update.SemanticViewDAO")
    dao.find_by_id.return_value = mock_view
    dao.validate_update_uniqueness.return_value = False

    properties = {"name": "existing_view"}

    command = UpdateSemanticViewCommand("view-uuid", properties)

    with pytest.raises(SemanticViewInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(exc_info.value._exceptions[0], SemanticViewExistsValidationError)


def test_update_semantic_view_name_unchanged(mocker: MockerFixture) -> None:
    """
    Test update with same name doesn't trigger uniqueness validation.
    """
    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"
    mock_view.semantic_layer_uuid = "layer-uuid"

    dao = mocker.patch("superset.commands.semantic_view.update.SemanticViewDAO")
    dao.find_by_id.return_value = mock_view
    dao.update.return_value = mock_view

    properties = {"configuration": '{"columns": ["id", "name"]}'}

    command = UpdateSemanticViewCommand("view-uuid", properties)
    result = command.run()

    assert result == mock_view
    dao.validate_update_uniqueness.assert_not_called()


def test_update_semantic_view_name_changed(mocker: MockerFixture) -> None:
    """
    Test update with new name triggers uniqueness validation.
    """
    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"
    mock_view.semantic_layer_uuid = "layer-uuid"

    dao = mocker.patch("superset.commands.semantic_view.update.SemanticViewDAO")
    dao.find_by_id.return_value = mock_view
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = mock_view

    properties = {"name": "new_view_name"}

    command = UpdateSemanticViewCommand("view-uuid", properties)
    result = command.run()

    assert result == mock_view
    dao.validate_update_uniqueness.assert_called_once_with(
        "view-uuid", "new_view_name", "layer-uuid"
    )


def test_update_semantic_view_all_fields(mocker: MockerFixture) -> None:
    """
    Test update with all fields.
    """
    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"
    mock_view.semantic_layer_uuid = "layer-uuid"

    dao = mocker.patch("superset.commands.semantic_view.update.SemanticViewDAO")
    dao.find_by_id.return_value = mock_view
    dao.validate_update_uniqueness.return_value = True
    dao.update.return_value = mock_view

    properties = {
        "name": "updated_view",
        "configuration": '{"columns": ["id", "name", "email"]}',
        "cache_timeout": 3600,
    }

    command = UpdateSemanticViewCommand("view-uuid", properties)
    result = command.run()

    assert result == mock_view
    dao.update.assert_called_once_with(mock_view, properties)
