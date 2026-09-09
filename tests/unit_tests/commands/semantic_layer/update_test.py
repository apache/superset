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
    SemanticLayerForbiddenError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticViewForbiddenError,
    SemanticViewNotFoundError,
)
from superset.commands.semantic_layer.update import (
    _unmask_configuration,
    UpdateSemanticLayerCommand,
    UpdateSemanticViewCommand,
)
from superset.constants import PASSWORD_MASK
from superset.exceptions import SupersetSecurityException
from superset.utils import json


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
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
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

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
        return_value=False,
    )

    with pytest.raises(SemanticViewForbiddenError):
        UpdateSemanticViewCommand(1, {"description": "test"}).run()


def test_update_semantic_view_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created the view, but holds no explicit editorship on
    it, can still update it."""
    mock_model = MagicMock()
    mock_model.id = 1
    mock_model.configuration = "{}"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model
    dao.update.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = sm.current_user

    data = {"description": "Updated"}
    result = UpdateSemanticViewCommand(1, data).run()

    assert result == mock_model
    dao.update.assert_called_once_with(mock_model, attributes=data)


def test_update_semantic_view_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who neither created the view nor is an editor of it is
    rejected."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticViewForbiddenError):
        UpdateSemanticViewCommand(1, {"description": "test"}).run()

    dao.update.assert_not_called()


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
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
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

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

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


def test_update_semantic_layer_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticLayerForbiddenError is raised on ownership failure."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
        return_value=False,
    )

    with pytest.raises(SemanticLayerForbiddenError):
        UpdateSemanticLayerCommand("some-uuid", {"name": "test"}).run()

    dao.update.assert_not_called()


def test_update_semantic_layer_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created the layer, but holds no explicit editorship
    on it, can still update it."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = sm.current_user

    data = {"description": "Updated"}
    result = UpdateSemanticLayerCommand("some-uuid", data).run()

    assert result == mock_model
    dao.update.assert_called_once_with(mock_model, attributes=data)


def test_update_semantic_layer_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who neither created the layer nor is an editor of it is
    rejected."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticLayerForbiddenError):
        UpdateSemanticLayerCommand("some-uuid", {"name": "test"}).run()

    dao.update.assert_not_called()


def test_update_semantic_layer_duplicate_name(mocker: MockerFixture) -> None:
    """Test that SemanticLayerInvalidError is raised for duplicate names."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.validate_update_uniqueness.return_value = False

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

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

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

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

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

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

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

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
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
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
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
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
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
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


# =============================================================================
# _unmask_configuration tests
# =============================================================================


def test_unmask_configuration_restores_masked_secret() -> None:
    """A masked write-only field in the payload is replaced by the stored
    value rather than overwriting the real credential with the mask."""
    result = _unmask_configuration(
        '{"account": "test", "password": "hunter2"}',
        {"account": "test", "password": PASSWORD_MASK},
    )

    assert result == {"account": "test", "password": "hunter2"}


def test_unmask_configuration_keeps_fresh_secret() -> None:
    """A genuinely new secret value (not the mask sentinel) passes through
    unchanged."""
    result = _unmask_configuration(
        '{"account": "test", "password": "old-secret"}',
        {"account": "test", "password": "new-secret"},
    )

    assert result == {"account": "test", "password": "new-secret"}


def test_unmask_configuration_restores_fail_closed_masked_fields() -> None:
    """When the read path fell back to masking every value (schema
    unavailable at GET time), the update path must restore all of them on
    round-trip, not just write-only ones -- otherwise a name-only save
    persists the literal mask into non-secret fields like ``account`` once
    the schema becomes available again."""
    result = _unmask_configuration(
        '{"account": "test", "database": "prod", "password": "hunter2"}',
        {
            "account": PASSWORD_MASK,
            "database": PASSWORD_MASK,
            "password": PASSWORD_MASK,
        },
    )

    assert result == {
        "account": "test",
        "database": "prod",
        "password": "hunter2",
    }


def test_unmask_configuration_missing_existing_key() -> None:
    """A masked field with no corresponding stored value passes through
    unchanged rather than raising."""
    result = _unmask_configuration(
        '{"account": "test"}',
        {"account": "test", "password": PASSWORD_MASK},
    )

    assert result == {"account": "test", "password": PASSWORD_MASK}


def test_update_semantic_layer_preserves_masked_secret_end_to_end(
    mocker: MockerFixture,
) -> None:
    """A name-only PUT that round-trips the masked GET response does not
    overwrite the stored credential with the literal mask."""
    mock_model = MagicMock()
    mock_model.type = "snowflake"
    mock_model.configuration = '{"account": "test", "password": "hunter2"}'

    dao = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

    mock_cls = MagicMock()
    mock_cls.get_configuration_schema.return_value = {
        "properties": {"password": {"type": "string", "writeOnly": True}}
    }
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    data = {
        "name": "Renamed",
        "configuration": {"account": "test", "password": PASSWORD_MASK},
    }
    UpdateSemanticLayerCommand("some-uuid", data).run()

    mock_cls.from_configuration.assert_called_once_with(
        {"account": "test", "password": "hunter2"}
    )
    dao.update.assert_called_once_with(
        mock_model,
        attributes={
            "name": "Renamed",
            "configuration": json.dumps({"account": "test", "password": "hunter2"}),
        },
    )
