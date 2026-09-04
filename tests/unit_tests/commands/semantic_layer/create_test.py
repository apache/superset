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
    expected = {**data, "configuration": '{"account": "test"}'}
    dao.create.assert_called_once_with(attributes=expected)
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


def test_create_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful creation of a semantic view."""
    mock_layer = MagicMock()
    dao_layer = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao_layer.find_by_uuid.return_value = mock_layer

    dao_view = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticViewDAO",
    )
    dao_view.validate_uniqueness.return_value = True
    mock_model = MagicMock()
    mock_model.uuid = "new-uuid"
    mock_model.name = "orders"
    dao_view.create.return_value = mock_model

    from superset.commands.semantic_layer.create import CreateSemanticViewCommand

    result = CreateSemanticViewCommand(
        {
            "name": "orders",
            "semantic_layer_uuid": "layer-uuid",
            "configuration": {"db": "prod"},
        }
    ).run()

    assert result == mock_model
    dao_view.validate_uniqueness.assert_called_once_with(
        "orders", "layer-uuid", {"db": "prod"}
    )


def test_create_semantic_view_layer_not_found(mocker: MockerFixture) -> None:
    """Test CreateSemanticViewCommand raises when layer not found."""
    dao_layer = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao_layer.find_by_uuid.return_value = None

    mocker.patch(
        "superset.commands.semantic_layer.create.SemanticViewDAO",
    )

    from superset.commands.semantic_layer.create import CreateSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import (
        SemanticLayerNotFoundError,
    )

    with pytest.raises(SemanticLayerNotFoundError):
        CreateSemanticViewCommand({"name": "v", "semantic_layer_uuid": "missing"}).run()


def test_create_semantic_view_duplicate(mocker: MockerFixture) -> None:
    """Test CreateSemanticViewCommand raises on duplicate view."""
    mock_layer = MagicMock()
    dao_layer = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticLayerDAO",
    )
    dao_layer.find_by_uuid.return_value = mock_layer

    dao_view = mocker.patch(
        "superset.commands.semantic_layer.create.SemanticViewDAO",
    )
    dao_view.validate_uniqueness.return_value = False

    from superset.commands.semantic_layer.create import CreateSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import (
        SemanticViewCreateFailedError,
    )

    with pytest.raises(SemanticViewCreateFailedError):
        CreateSemanticViewCommand(
            {
                "name": "orders",
                "semantic_layer_uuid": "layer-uuid",
                "configuration": {"db": "prod"},
            }
        ).run()
