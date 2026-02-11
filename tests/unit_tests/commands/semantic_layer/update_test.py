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

from superset.commands.semantic_layer.exceptions import (
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticViewForbiddenError,
    SemanticViewNotFoundError,
)
from superset.commands.semantic_layer.update import (
    UpdateSemanticLayerCommand,
    UpdateSemanticViewCommand,
)
from superset.exceptions import SupersetSecurityException


def test_update_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful update of a semantic view."""
    mock_model = MagicMock()
    mock_model.id = 1
    mock_model.configuration = "{}"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model
    dao.update.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.update.security_manager",
    )

    data = {"description": "Updated", "cache_timeout": 300}
    result = UpdateSemanticViewCommand(1, data).run()

    assert result == mock_model
    dao.find_by_id.assert_called_once_with(1)
    dao.update.assert_called_once_with(mock_model, attributes=data)


def test_update_semantic_view_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticViewNotFoundError is raised when model is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = None

    with pytest.raises(SemanticViewNotFoundError):
        UpdateSemanticViewCommand(999, {"description": "test"}).run()


def test_update_semantic_view_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticViewForbiddenError is raised on ownership failure."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    sm = mocker.patch(
        "superset.commands.semantic_layer.update.security_manager",
    )
    # Use a regular MagicMock for raise_for_ownership to avoid AsyncMock issues
    sm.raise_for_ownership = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )

    with pytest.raises(SemanticViewForbiddenError):
        UpdateSemanticViewCommand(1, {"description": "test"}).run()


def test_update_semantic_view_copies_data(mocker: MockerFixture) -> None:
    """Test that the command copies input data and does not mutate it."""
    mock_model = MagicMock()
    mock_model.configuration = "{}"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model
    dao.update.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.update.security_manager",
    )

    original_data = {"description": "Original"}
    UpdateSemanticViewCommand(1, original_data).run()

    # The original dict should not have been modified
    assert original_data == {"description": "Original"}


# =============================================================================
# UpdateSemanticLayerCommand tests
# =============================================================================


def test_update_semantic_layer_success(mocker: MockerFixture) -> None:
    """Test successful update of a semantic layer."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    data = {"name": "Updated", "description": "New desc"}
    result = UpdateSemanticLayerCommand("some-uuid", data).run()

    assert result == mock_model
    dao.find_by_uuid.assert_called_once_with("some-uuid")
    dao.update.assert_called_once_with(mock_model, attributes=data)


def test_update_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticLayerNotFoundError is raised when model is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = None

    with pytest.raises(SemanticLayerNotFoundError):
        UpdateSemanticLayerCommand("missing-uuid", {"name": "test"}).run()


def test_update_semantic_layer_duplicate_name(mocker: MockerFixture) -> None:
    """Test that SemanticLayerInvalidError is raised for duplicate names."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.validate_update_uniqueness.return_value = False

    with pytest.raises(SemanticLayerInvalidError):
        UpdateSemanticLayerCommand("some-uuid", {"name": "Duplicate"}).run()


def test_update_semantic_layer_validates_configuration(
    mocker: MockerFixture,
) -> None:
    """Test that configuration is validated against the plugin."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    mock_cls = MagicMock()
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry",
        {"snowflake": mock_cls},
    )

    config = {"account": "test"}
    UpdateSemanticLayerCommand("some-uuid", {"configuration": config}).run()

    mock_cls.from_configuration.assert_called_once_with(config)


def test_update_semantic_layer_skips_name_check_when_no_name(
    mocker: MockerFixture,
) -> None:
    """Test that name uniqueness is not checked when name is not provided."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    UpdateSemanticLayerCommand("some-uuid", {"description": "Updated"}).run()

    dao.validate_update_uniqueness.assert_not_called()


def test_update_semantic_layer_copies_data(mocker: MockerFixture) -> None:
    """Test that the command copies input data and does not mutate it."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    original_data = {"description": "Original"}
    UpdateSemanticLayerCommand("some-uuid", original_data).run()

    assert original_data == {"description": "Original"}


# =============================================================================
# UpdateSemanticLayerCommand tests
# =============================================================================


def test_update_semantic_layer_success(mocker: MockerFixture) -> None:
    """Test successful update of a semantic layer."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    data = {"name": "Updated", "description": "New desc"}
    result = UpdateSemanticLayerCommand("some-uuid", data).run()

    assert result == mock_model
    dao.find_by_uuid.assert_called_once_with("some-uuid")
    dao.update.assert_called_once_with(mock_model, attributes=data)


def test_update_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticLayerNotFoundError is raised when model is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = None

    with pytest.raises(SemanticLayerNotFoundError):
        UpdateSemanticLayerCommand("missing-uuid", {"name": "test"}).run()


def test_update_semantic_layer_duplicate_name(mocker: MockerFixture) -> None:
    """Test that SemanticLayerInvalidError is raised for duplicate names."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.validate_update_uniqueness.return_value = False

    with pytest.raises(SemanticLayerInvalidError):
        UpdateSemanticLayerCommand("some-uuid", {"name": "Duplicate"}).run()


def test_update_semantic_layer_validates_configuration(
    mocker: MockerFixture,
) -> None:
    """Test that configuration is validated against the plugin."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    mock_cls = MagicMock()
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry",
        {"snowflake": mock_cls},
    )

    config = {"account": "test"}
    UpdateSemanticLayerCommand("some-uuid", {"configuration": config}).run()

    mock_cls.from_configuration.assert_called_once_with(config)


def test_update_semantic_layer_skips_name_check_when_no_name(
    mocker: MockerFixture,
) -> None:
    """Test that name uniqueness is not checked when name is not provided."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    UpdateSemanticLayerCommand("some-uuid", {"description": "Updated"}).run()

    dao.validate_update_uniqueness.assert_not_called()


def test_update_semantic_layer_copies_data(mocker: MockerFixture) -> None:
    """Test that the command copies input data and does not mutate it."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    original_data = {"description": "Original"}
    UpdateSemanticLayerCommand("some-uuid", original_data).run()

    assert original_data == {"description": "Original"}


def _make_view_model(
    uuid: str = "view-uuid-1",
    name: str = "my_view",
    layer_uuid: str = "layer-uuid-1",
    configuration: str = '{"schema": "prod"}',
) -> MagicMock:
    model = MagicMock()
    model.uuid = uuid
    model.name = name
    model.semantic_layer_uuid = layer_uuid
    model.configuration = configuration
    return model


def test_update_uniqueness_different_config_same_name(
    mocker: MockerFixture,
) -> None:
    """Same name but different configuration is allowed."""
    mock_model = _make_view_model(configuration='{"schema": "prod"}')

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model
    dao.update.return_value = mock_model
    dao.validate_update_uniqueness.return_value = True

    mocker.patch(
        "superset.commands.semantic_layer.update.security_manager",
    )

    # Update to a config that differs from an existing view
    data = {"name": "my_view", "configuration": {"schema": "testing"}}
    result = UpdateSemanticViewCommand(1, data).run()

    assert result == mock_model
    dao.validate_update_uniqueness.assert_called_once_with(
        view_uuid="view-uuid-1",
        name="my_view",
        layer_uuid="layer-uuid-1",
        configuration={"schema": "testing"},
    )


def test_update_uniqueness_same_config_different_name(
    mocker: MockerFixture,
) -> None:
    """Same configuration but different name is allowed."""
    mock_model = _make_view_model(configuration='{"schema": "prod"}')

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model
    dao.update.return_value = mock_model
    dao.validate_update_uniqueness.return_value = True

    mocker.patch(
        "superset.commands.semantic_layer.update.security_manager",
    )

    data = {"name": "renamed_view", "configuration": {"schema": "prod"}}
    result = UpdateSemanticViewCommand(1, data).run()

    assert result == mock_model
    dao.validate_update_uniqueness.assert_called_once_with(
        view_uuid="view-uuid-1",
        name="renamed_view",
        layer_uuid="layer-uuid-1",
        configuration={"schema": "prod"},
    )


def test_update_uniqueness_same_config_same_name_fails(
    mocker: MockerFixture,
) -> None:
    """Same name and same configuration is a duplicate."""
    mock_model = _make_view_model(configuration='{"schema": "prod"}')

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model
    dao.validate_update_uniqueness.return_value = False

    mocker.patch(
        "superset.commands.semantic_layer.update.security_manager",
    )

    from superset.commands.semantic_layer.exceptions import (
        SemanticViewUpdateFailedError,
    )

    data = {"name": "my_view", "configuration": {"schema": "prod"}}
    with pytest.raises(SemanticViewUpdateFailedError):
        UpdateSemanticViewCommand(1, data).run()

    dao.validate_update_uniqueness.assert_called_once_with(
        view_uuid="view-uuid-1",
        name="my_view",
        layer_uuid="layer-uuid-1",
        configuration={"schema": "prod"},
    )
