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

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.create import CreateSemanticLayerCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerInvalidError,
)


def test_create_semantic_layer_success(mocker: MockerFixture) -> None:
    """Test successful creation of a semantic layer."""
    new_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao.validate_uniqueness.return_value = True
    dao.create.return_value = new_model

    mock_cls = MagicMock()
    mocker.patch.dict(
        "superset.commands.semantic_layer.create.registry",
        {"snowflake": mock_cls},
    )

    data = {
        "name": "My Layer",
        "type": "snowflake",
        "configuration": {"account": "test"},
    }
    result = CreateSemanticLayerCommand(data).run()

    assert result == new_model
    dao.create.assert_called_once_with(attributes=data)
    mock_cls.from_configuration.assert_called_once_with({"account": "test"})


def test_create_semantic_layer_unknown_type(mocker: MockerFixture) -> None:
    """Test that SemanticLayerInvalidError is raised for unknown type."""
    mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    mocker.patch.dict(
        "superset.commands.semantic_layer.create.registry",
        {},
        clear=True,
    )

    data = {
        "name": "My Layer",
        "type": "nonexistent",
        "configuration": {},
    }
    with pytest.raises(SemanticLayerInvalidError):
        CreateSemanticLayerCommand(data).run()


def test_create_semantic_layer_duplicate_name(mocker: MockerFixture) -> None:
    """Test that SemanticLayerInvalidError is raised for duplicate names."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao.validate_uniqueness.return_value = False

    mocker.patch.dict(
        "superset.commands.semantic_layer.create.registry",
        {"snowflake": MagicMock()},
    )

    data = {
        "name": "Duplicate",
        "type": "snowflake",
        "configuration": {},
    }
    with pytest.raises(SemanticLayerInvalidError):
        CreateSemanticLayerCommand(data).run()


def test_create_semantic_layer_invalid_configuration(
    mocker: MockerFixture,
) -> None:
    """Test that invalid configuration is caught by the @transaction decorator."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao.validate_uniqueness.return_value = True

    mock_cls = MagicMock()
    mock_cls.from_configuration.side_effect = ValueError("bad config")
    mocker.patch.dict(
        "superset.commands.semantic_layer.create.registry",
        {"snowflake": mock_cls},
    )

    data = {
        "name": "My Layer",
        "type": "snowflake",
        "configuration": {"bad": "data"},
    }
    with pytest.raises(SemanticLayerCreateFailedError):
        CreateSemanticLayerCommand(data).run()


def test_create_semantic_layer_copies_data(mocker: MockerFixture) -> None:
    """Test that the command copies input data and does not mutate it."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao.validate_uniqueness.return_value = True
    dao.create.return_value = MagicMock()

    mocker.patch.dict(
        "superset.commands.semantic_layer.create.registry",
        {"snowflake": MagicMock()},
    )

    original_data = {
        "name": "Original",
        "type": "snowflake",
        "configuration": {"account": "test"},
    }
    CreateSemanticLayerCommand(original_data).run()

    assert original_data == {
        "name": "Original",
        "type": "snowflake",
        "configuration": {"account": "test"},
    }
