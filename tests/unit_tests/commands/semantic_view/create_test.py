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

"""Unit tests for CreateSemanticViewCommand."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.exceptions import SemanticLayerNotFoundError
from superset.commands.semantic_view.create import CreateSemanticViewCommand
from superset.commands.semantic_view.exceptions import (
    SemanticViewExistsValidationError,
    SemanticViewInvalidError,
    SemanticViewRequiredFieldValidationError,
)


def test_create_semantic_view_success(mocker: MockerFixture) -> None:
    """
    Test successful semantic view creation.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "layer-uuid"

    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"

    layer_dao = mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    layer_dao.find_by_id.return_value = mock_layer

    view_dao = mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")
    view_dao.validate_uniqueness.return_value = True
    view_dao.create.return_value = mock_view

    properties = {
        "name": "test_view",
        "semantic_layer_uuid": "layer-uuid",
        "configuration": '{"columns": ["id", "name"]}',
    }

    command = CreateSemanticViewCommand(properties)
    result = command.run()

    assert result == mock_view
    view_dao.create.assert_called_once_with(attributes=properties)


def test_create_semantic_view_missing_name(mocker: MockerFixture) -> None:
    """
    Test create fails when name is missing.
    """
    mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")

    properties = {
        "semantic_layer_uuid": "layer-uuid",
        "configuration": '{"columns": ["id"]}',
    }

    command = CreateSemanticViewCommand(properties)

    with pytest.raises(SemanticViewInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(
        exc_info.value._exceptions[0], SemanticViewRequiredFieldValidationError
    )


def test_create_semantic_view_missing_semantic_layer_uuid(
    mocker: MockerFixture,
) -> None:
    """
    Test create fails when semantic_layer_uuid is missing.
    """
    mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")

    properties = {
        "name": "test_view",
        "configuration": '{"columns": ["id"]}',
    }

    command = CreateSemanticViewCommand(properties)

    with pytest.raises(SemanticViewInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(
        exc_info.value._exceptions[0], SemanticViewRequiredFieldValidationError
    )


def test_create_semantic_view_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """
    Test create fails when semantic layer not found.
    """
    layer_dao = mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    layer_dao.find_by_id.return_value = None

    mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")

    properties = {
        "name": "test_view",
        "semantic_layer_uuid": "nonexistent-uuid",
        "configuration": '{"columns": ["id"]}',
    }

    command = CreateSemanticViewCommand(properties)

    with pytest.raises(SemanticLayerNotFoundError):
        command.run()


def test_create_semantic_view_duplicate_name(mocker: MockerFixture) -> None:
    """
    Test create fails when name already exists in layer.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "layer-uuid"

    layer_dao = mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    layer_dao.find_by_id.return_value = mock_layer

    view_dao = mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")
    view_dao.validate_uniqueness.return_value = False

    properties = {
        "name": "existing_view",
        "semantic_layer_uuid": "layer-uuid",
        "configuration": '{"columns": ["id"]}',
    }

    command = CreateSemanticViewCommand(properties)

    with pytest.raises(SemanticViewInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(exc_info.value._exceptions[0], SemanticViewExistsValidationError)


def test_create_semantic_view_multiple_errors(mocker: MockerFixture) -> None:
    """
    Test create accumulates multiple validation errors.
    """
    mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")

    properties = {
        "configuration": '{"columns": ["id"]}',
    }

    command = CreateSemanticViewCommand(properties)

    with pytest.raises(SemanticViewInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 2


def test_create_semantic_view_with_optional_fields(mocker: MockerFixture) -> None:
    """
    Test create with optional fields.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "layer-uuid"

    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"

    layer_dao = mocker.patch("superset.commands.semantic_view.create.SemanticLayerDAO")
    layer_dao.find_by_id.return_value = mock_layer

    view_dao = mocker.patch("superset.commands.semantic_view.create.SemanticViewDAO")
    view_dao.validate_uniqueness.return_value = True
    view_dao.create.return_value = mock_view

    properties = {
        "name": "test_view",
        "semantic_layer_uuid": "layer-uuid",
        "configuration": '{"columns": ["id", "name"]}',
        "cache_timeout": 1800,
    }

    command = CreateSemanticViewCommand(properties)
    result = command.run()

    assert result == mock_view
    view_dao.create.assert_called_once_with(attributes=properties)
