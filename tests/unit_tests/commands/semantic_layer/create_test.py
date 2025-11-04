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

"""Unit tests for CreateSemanticLayerCommand."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.create import CreateSemanticLayerCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerExistsValidationError,
    SemanticLayerInvalidError,
    SemanticLayerRequiredFieldValidationError,
)


def test_create_semantic_layer_success(mocker: MockerFixture) -> None:
    """
    Test successful semantic layer creation.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.create.SemanticLayerDAO")
    dao.validate_uniqueness.return_value = True
    dao.create.return_value = mock_layer

    properties = {
        "name": "test_layer",
        "type": "cube",
        "configuration": '{"url": "http://localhost:4000"}',
    }

    command = CreateSemanticLayerCommand(properties)
    result = command.run()

    assert result == mock_layer
    dao.create.assert_called_once_with(attributes=properties)


def test_create_semantic_layer_missing_name(mocker: MockerFixture) -> None:
    """
    Test create fails when name is missing.
    """
    mocker.patch("superset.commands.semantic_layer.create.SemanticLayerDAO")

    properties = {
        "type": "cube",
        "configuration": '{"url": "http://localhost:4000"}',
    }

    command = CreateSemanticLayerCommand(properties)

    with pytest.raises(SemanticLayerInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(
        exc_info.value._exceptions[0], SemanticLayerRequiredFieldValidationError
    )


def test_create_semantic_layer_missing_type(mocker: MockerFixture) -> None:
    """
    Test create fails when type is missing.
    """
    mocker.patch("superset.commands.semantic_layer.create.SemanticLayerDAO")

    properties = {
        "name": "test_layer",
        "configuration": '{"url": "http://localhost:4000"}',
    }

    command = CreateSemanticLayerCommand(properties)

    with pytest.raises(SemanticLayerInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(
        exc_info.value._exceptions[0], SemanticLayerRequiredFieldValidationError
    )


def test_create_semantic_layer_duplicate_name(mocker: MockerFixture) -> None:
    """
    Test create fails when name already exists.
    """
    dao = mocker.patch("superset.commands.semantic_layer.create.SemanticLayerDAO")
    dao.validate_uniqueness.return_value = False

    properties = {
        "name": "existing_layer",
        "type": "cube",
        "configuration": '{"url": "http://localhost:4000"}',
    }

    command = CreateSemanticLayerCommand(properties)

    with pytest.raises(SemanticLayerInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(exc_info.value._exceptions[0], SemanticLayerExistsValidationError)


def test_create_semantic_layer_multiple_errors(mocker: MockerFixture) -> None:
    """
    Test create accumulates multiple validation errors.
    """
    mocker.patch("superset.commands.semantic_layer.create.SemanticLayerDAO")

    properties = {
        "configuration": '{"url": "http://localhost:4000"}',
    }

    command = CreateSemanticLayerCommand(properties)

    with pytest.raises(SemanticLayerInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 2


def test_create_semantic_layer_with_optional_fields(mocker: MockerFixture) -> None:
    """
    Test create with optional fields.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.create.SemanticLayerDAO")
    dao.validate_uniqueness.return_value = True
    dao.create.return_value = mock_layer

    properties = {
        "name": "test_layer",
        "type": "cube",
        "description": "Test description",
        "configuration": '{"url": "http://localhost:4000"}',
        "cache_timeout": 3600,
    }

    command = CreateSemanticLayerCommand(properties)
    result = command.run()

    assert result == mock_layer
    dao.create.assert_called_once_with(attributes=properties)
