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

from copy import deepcopy
from typing import Any
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


@pytest.fixture(autouse=True)
def configuration_schema(mocker: MockerFixture) -> MagicMock:
    """Publish secret classifications for command masking tests."""
    provider: MagicMock = MagicMock()
    auth: dict[str, Any] = {
        "properties": {
            "private_key": {"writeOnly": True},
            "password": {"writeOnly": True},
            "token": {"writeOnly": True},
        }
    }
    provider.get_configuration_schema.return_value = {
        "properties": {
            "password": {"writeOnly": True},
            "token": {"writeOnly": True},
            "auth": {"anyOf": [auth, {"type": "array", "items": auth}]},
        }
    }
    mocker.patch.dict(
        "superset.semantic_layers.masking.registry", {"test_provider": provider}
    )
    return provider


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


def test_update_semantic_layer_requires_access(mocker: MockerFixture) -> None:
    """A user without access to the layer cannot update it."""
    mock_model = MagicMock()
    mock_model.raise_for_access.side_effect = SupersetSecurityException(MagicMock())

    dao = mocker.patch("superset.commands.semantic_layer.update.SemanticLayerDAO")
    dao.find_by_uuid.return_value = mock_model

    with pytest.raises(SemanticLayerForbiddenError):
        UpdateSemanticLayerCommand("not-mine-uuid", {"name": "test"}).run()

    dao.update.assert_not_called()


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

    mock_cls.configuration_class.model_validate.assert_called_once_with(config)


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


@pytest.fixture(params=[False, True], ids=["nested-object", "list-union"])
def nested_masked_configuration(
    request: pytest.FixtureRequest,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Pair stored and echoed credentials in object and union-list shapes."""
    stored: dict[str, Any] = {
        "account_identifier": "account",
        "role": "role",
        "warehouse": "warehouse",
        "database": "database",
        "auth": {"type": "key_pair", "private_key": "stored-key"},
    }
    submitted: dict[str, Any] = deepcopy(stored)
    submitted["auth"]["private_key"] = PASSWORD_MASK
    if request.param:
        stored["auth"] = [
            stored["auth"],
            {"type": "password", "password": "explicit-password"},
        ]
        submitted["auth"] = [
            submitted["auth"],
            {"type": "password", "password": "explicit-password"},
        ]
    return stored, submitted


@pytest.mark.parametrize(
    "field", ["account_identifier", "role", "warehouse", "database"]
)
def test_nested_mask_rejects_configuration_change(
    nested_masked_configuration: tuple[dict[str, Any], dict[str, Any]], field: str
) -> None:
    """A stored credential at any depth requires an unchanged configuration."""
    stored: dict[str, Any]
    submitted: dict[str, Any]
    stored, submitted = nested_masked_configuration
    submitted[field] = "changed"
    with pytest.raises(SemanticLayerInvalidError, match="reusing a stored"):
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")


@pytest.mark.parametrize("remove", [False, True], ids=["add-null", "remove-key"])
def test_nested_mask_rejects_configuration_shape_change(
    nested_masked_configuration: tuple[dict[str, Any], dict[str, Any]], remove: bool
) -> None:
    """Missing keys and explicit nulls remain distinct with nested masks."""
    stored: dict[str, Any]
    submitted: dict[str, Any]
    stored, submitted = nested_masked_configuration
    if remove:
        del submitted["role"]
    else:
        submitted["extra"] = None
    with pytest.raises(SemanticLayerInvalidError, match="reusing a stored"):
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")


def test_nested_mask_allows_unchanged_resend(
    nested_masked_configuration: tuple[dict[str, Any], dict[str, Any]],
) -> None:
    """An unchanged resend restores nested credentials without mutating input."""
    stored: dict[str, Any]
    submitted: dict[str, Any]
    stored, submitted = nested_masked_configuration
    original: dict[str, Any] = deepcopy(submitted)
    assert (
        _unmask_configuration(json.dumps(stored), submitted, "test_provider") == stored
    )
    assert submitted == original


def test_nested_explicit_credentials_allow_configuration_change(
    nested_masked_configuration: tuple[dict[str, Any], dict[str, Any]],
) -> None:
    """Supplying actual credentials still permits configuration edits."""
    stored: dict[str, Any] = nested_masked_configuration[0]
    submitted: dict[str, Any] = deepcopy(stored)
    submitted.update(
        account_identifier="changed",
        role="changed",
        warehouse="changed",
        database="changed",
    )
    assert (
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")
        == submitted
    )


@pytest.mark.parametrize(
    "submitted",
    [
        {"auth": {"private_key": PASSWORD_MASK, "username": "changed"}},
        {"auth": {"private_key": PASSWORD_MASK}},
        {"auth": {"private_key": PASSWORD_MASK, "username": "user", "extra": None}},
    ],
    ids=["nested-edit", "nested-remove", "nested-add-null"],
)
def test_nested_mask_rejects_changed_credential_siblings(
    submitted: dict[str, Any],
) -> None:
    """A nested mask also freezes non-secret siblings in its credential block."""
    stored: dict[str, Any] = {"auth": {"private_key": "stored-key", "username": "user"}}
    with pytest.raises(SemanticLayerInvalidError, match="reusing a stored"):
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")


def test_nested_mask_refusal_precedes_validation_and_write(
    mocker: MockerFixture,
    nested_masked_configuration: tuple[dict[str, Any], dict[str, Any]],
    configuration_schema: MagicMock,
) -> None:
    """A refused edit neither validates credentials nor changes the saved layer."""
    stored: dict[str, Any]
    submitted: dict[str, Any]
    stored, submitted = nested_masked_configuration
    submitted["role"] = "changed"
    model: MagicMock = MagicMock(type="test_provider", configuration=json.dumps(stored))
    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO"
    )
    dao.find_by_uuid.return_value = model
    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object"
    )
    provider: MagicMock = MagicMock()
    provider.get_configuration_schema.return_value = (
        configuration_schema.get_configuration_schema.return_value
    )
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry",
        {"test_provider": provider},
        clear=True,
    )
    with pytest.raises(SemanticLayerInvalidError, match="reusing a stored"):
        UpdateSemanticLayerCommand("layer", {"configuration": submitted}).run()
    provider.configuration_class.model_validate.assert_not_called()
    dao.update.assert_not_called()
    model.clear_metadata_cache.assert_not_called()
    assert model.configuration == json.dumps(stored)


@pytest.mark.parametrize(
    ("stored", "submitted"),
    [
        ({"auth": {"private_key": None}}, {"auth": {"private_key": PASSWORD_MASK}}),
        ({"auth": {}}, {"auth": {"private_key": PASSWORD_MASK}}),
    ],
    ids=["stored-null", "missing-path"],
)
def test_nested_mask_preserves_null_and_missing_path_semantics(
    stored: dict[str, Any], submitted: dict[str, Any]
) -> None:
    """Null values and missing stored paths keep the mask for provider validation."""
    assert (
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")
        == submitted
    )


@pytest.mark.parametrize("token", ["different", "stored-token", "", None])
@pytest.mark.parametrize("nested", [False, True], ids=["top-level", "nested"])
def test_mask_allows_explicit_secret_replacement(
    token: str | None, nested: bool
) -> None:
    """Replacing a declared secret never compares it to the stored secret."""
    stored: dict[str, Any] = {"password": "stored-password", "token": "stored-token"}
    submitted: dict[str, Any] = {"password": PASSWORD_MASK, "token": token}
    expected: dict[str, Any] = {"password": "stored-password", "token": token}
    if nested:
        stored = {"auth": stored}
        submitted = {"auth": submitted}
        expected = {"auth": expected}
    assert (
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")
        == expected
    )


@pytest.mark.parametrize(
    "fallback", [False, True], ids=["secret-union", "combined-classification"]
)
@pytest.mark.parametrize("container", ["object", "list"])
@pytest.mark.parametrize("in_list", [False, True], ids=["field", "list-entry"])
@pytest.mark.parametrize("replacement", ["partial", "explicit", "echo"])
def test_whole_secret_containers_require_explicit_replacement(
    configuration_schema: MagicMock,
    fallback: bool,
    container: str,
    in_list: bool,
    replacement: str,
) -> None:
    """A wholly secret field accepts an echo or explicit value, not inner masks."""
    auth_schema: dict[str, Any] = {
        "properties": {
            "type": {"type": "string"},
            "private_key": {"writeOnly": True},
            "role": {"type": "string"},
        }
    }
    auth: dict[str, Any] = {
        "type": "k",
        "private_key": "stored-key",
        "role": "original",
    }
    changed_auth: dict[str, Any] = {
        "type": "k",
        "private_key": PASSWORD_MASK if replacement == "partial" else "new-key",
        "role": "changed",
    }
    if container == "list":
        auth_schema = {"type": "array", "items": auth_schema}
    schema: dict[str, Any] = (
        {
            "anyOf": [
                {"properties": {"auth": {"writeOnly": True}}},
                {"properties": {"auth": auth_schema}},
            ]
        }
        if fallback
        else {"properties": {"auth": {"anyOf": [{"writeOnly": True}, auth_schema]}}}
    )
    schema.setdefault("properties", {})["password"] = {"writeOnly": True}
    stored: dict[str, Any] = {
        "password": "stored-password",
        "auth": [auth] if container == "list" else auth,
    }
    submitted: dict[str, Any] = {
        "password": PASSWORD_MASK,
        "auth": PASSWORD_MASK
        if replacement == "echo"
        else ([changed_auth] if container == "list" else changed_auth),
    }
    expected: dict[str, Any] = {
        "password": "stored-password",
        "auth": stored["auth"] if replacement == "echo" else submitted["auth"],
    }
    if in_list:
        schema = {"properties": {"connections": {"type": "array", "items": schema}}}
        stored = {"connections": [stored]}
        submitted = {"connections": [submitted]}
        expected = {"connections": [expected]}
    configuration_schema.get_configuration_schema.return_value = schema
    if replacement == "partial":
        with pytest.raises(SemanticLayerInvalidError, match="reusing a stored"):
            _unmask_configuration(json.dumps(stored), submitted, "test_provider")
    else:
        assert (
            _unmask_configuration(json.dumps(stored), submitted, "test_provider")
            == expected
        )


@pytest.mark.parametrize(
    "schema",
    [
        None,
        {"$ref": "#/$defs/missing"},
        {"properties": {"password": {"$ref": "#/$defs/missing"}}},
    ],
)
def test_mask_refuses_unavailable_classification(
    configuration_schema: MagicMock, schema: Any
) -> None:
    """Unchanged masked resends require usable secret classifications too."""
    configuration_schema.get_configuration_schema.return_value = schema
    with pytest.raises(SemanticLayerInvalidError, match="schema"):
        _unmask_configuration(
            '{"password":"stored"}', {"password": PASSWORD_MASK}, "test_provider"
        )


def test_mask_refuses_schema_failure(configuration_schema: MagicMock) -> None:
    """Schema errors never fall back to treating every field as a secret."""
    configuration_schema.get_configuration_schema.side_effect = RuntimeError(
        "private-detail"
    )
    error: pytest.ExceptionInfo[SemanticLayerInvalidError]
    with pytest.raises(SemanticLayerInvalidError, match="schema") as error:
        _unmask_configuration(
            '{"password":"stored"}', {"password": PASSWORD_MASK}, "test_provider"
        )
    assert "private-detail" not in str(error.value)


def test_mask_refuses_unclassified_pattern_fields(
    configuration_schema: MagicMock,
) -> None:
    """A broad read-mask fallback cannot authorize edits to unrelated settings."""
    configuration_schema.get_configuration_schema.return_value = {
        "properties": {"password": {"writeOnly": True}, "role": {"type": "string"}},
        "patternProperties": {"^token_": {"writeOnly": True}},
    }
    with pytest.raises(SemanticLayerInvalidError, match="schema"):
        _unmask_configuration(
            '{"password":"stored", "role":"original"}',
            {"password": PASSWORD_MASK, "role": "changed"},
            "test_provider",
        )


@pytest.mark.parametrize(
    ("stored", "submitted"),
    [
        ({"password": "stored"}, {"password": PASSWORD_MASK, "extra": PASSWORD_MASK}),
        (
            {"password": "stored", "role": PASSWORD_MASK},
            {"password": PASSWORD_MASK, "role": "changed"},
        ),
        (
            {"password": "stored", "option": False},
            {"password": PASSWORD_MASK, "option": 0},
        ),
    ],
    ids=["new-undeclared-mask", "literal-mask-nonsecret", "scalar-type-change"],
)
def test_mask_freezes_nonsecret_values_without_sentinel_collisions(
    stored: dict[str, Any], submitted: dict[str, Any]
) -> None:
    """Only schema-declared secrets may be omitted from the comparison."""
    with pytest.raises(SemanticLayerInvalidError):
        _unmask_configuration(json.dumps(stored), submitted, "test_provider")


@pytest.mark.parametrize("masked", [False, True])
def test_mask_requires_registered_schema_only_for_masked_updates(masked: bool) -> None:
    """Explicit updates do not depend on a schema lookup to restore credentials."""
    submitted: dict[str, Any] = {
        "password": PASSWORD_MASK if masked else "new-password",
        "role": "new-role",
    }
    if masked:
        with pytest.raises(SemanticLayerInvalidError, match="schema"):
            _unmask_configuration('{"password":"stored"}', submitted, "absent_provider")
    else:
        assert (
            _unmask_configuration('{"password":"stored"}', submitted, "absent_provider")
            == submitted
        )


@pytest.mark.parametrize("old_token", [None, "", "stored-token"])
def test_masked_list_allows_replacing_empty_secrets(old_token: str | None) -> None:
    """The stored value's truthiness cannot influence explicit secret replacement."""
    stored: dict[str, Any] = {
        "auth": [{"password": "stored-password", "token": old_token}]
    }
    submitted: dict[str, Any] = {
        "auth": [{"password": PASSWORD_MASK, "token": "new-token"}]
    }
    assert _unmask_configuration(json.dumps(stored), submitted, "test_provider") == {
        "auth": [{"password": "stored-password", "token": "new-token"}]
    }


def test_mask_refuses_unresolvable_schema_in_new_field(
    configuration_schema: MagicMock,
) -> None:
    """Classification must also succeed for fields present only in the submission."""
    configuration_schema.get_configuration_schema.return_value = {
        "properties": {
            "password": {"writeOnly": True},
            "extra": {"$ref": "#/$defs/missing"},
        }
    }
    with pytest.raises(SemanticLayerInvalidError, match="schema"):
        _unmask_configuration(
            '{"password":"stored"}',
            {"password": PASSWORD_MASK, "extra": "value"},
            "test_provider",
        )


def test_unmask_configuration_restores_masked_secret() -> None:
    """A masked write-only field in the payload is replaced by the stored
    value rather than overwriting the real credential with the mask."""
    result: dict[str, Any] = _unmask_configuration(
        '{"account": "test", "password": "hunter2"}',
        {"account": "test", "password": PASSWORD_MASK},
        "test_provider",
    )

    assert result == {"account": "test", "password": "hunter2"}


def test_unmask_configuration_keeps_fresh_secret() -> None:
    """A genuinely new secret value (not the mask sentinel) passes through
    unchanged."""
    result: dict[str, Any] = _unmask_configuration(
        '{"account": "test", "password": "old-secret"}',
        {"account": "test", "password": "new-secret"},
        "test_provider",
    )

    assert result == {"account": "test", "password": "new-secret"}


def test_unmask_configuration_restores_fail_closed_masked_fields() -> None:
    """When the read path fell back to masking every value (schema
    unavailable at GET time), the update path must restore all of them on
    round-trip, not just write-only ones -- otherwise a name-only save
    persists the literal mask into non-secret fields like ``account`` once
    the schema becomes available again."""
    result: dict[str, Any] = _unmask_configuration(
        '{"account": "test", "database": "prod", "password": "hunter2"}',
        {
            "account": PASSWORD_MASK,
            "database": PASSWORD_MASK,
            "password": PASSWORD_MASK,
        },
        "test_provider",
    )

    assert result == {
        "account": "test",
        "database": "prod",
        "password": "hunter2",
    }


def test_unmask_configuration_missing_existing_key() -> None:
    """A masked field with no corresponding stored value passes through
    unchanged rather than raising."""
    result: dict[str, Any] = _unmask_configuration(
        '{"account": "test"}',
        {"account": "test", "password": PASSWORD_MASK},
        "test_provider",
    )

    assert result == {"account": "test", "password": PASSWORD_MASK}


def test_unmask_configuration_rejects_secret_reveal_with_changed_field() -> None:
    """
    A masked field must not be revealed in the same update that also
    changes some other configuration field. An editor is entitled to edit
    this connection, but not to see its real secret (that's the entire
    reason the read path masks it) -- revealing it while also changing a
    potentially destination-relevant field would poison the stored
    configuration with the real secret attached to attacker-controlled
    config, silently leaking it on the next legitimate use of this layer.
    """
    with pytest.raises(SemanticLayerInvalidError):
        _unmask_configuration(
            '{"account": "prod-account", "password": "hunter2"}',
            {"account": "attacker-account", "password": PASSWORD_MASK},
            "test_provider",
        )


def test_unmask_configuration_rejects_secret_reveal_with_new_none_valued_key() -> None:
    """
    A newly introduced key with an explicit ``None`` value must be treated
    as a configuration change, the same as any other new/changed key --
    ``dict.get(key)`` alone can't distinguish "key absent from storage" from
    "key present and stored as None" (both return None), which would let
    this slip through as "unchanged" and reveal the masked secret alongside
    it.
    """
    with pytest.raises(SemanticLayerInvalidError):
        _unmask_configuration(
            '{"account": "prod-account", "password": "hunter2"}',
            {
                "account": "prod-account",
                "password": PASSWORD_MASK,
                "proxy_host": None,
            },
            "test_provider",
        )


def test_unmask_configuration_rejects_secret_reveal_with_removed_key() -> None:
    """
    Dropping a stored key while reusing the masked secret is a configuration
    change too: the update replaces the stored dictionary wholesale, so the
    key really is gone afterwards while the real secret is carried over.
    Comparing only the submitted keys would let that through.
    """
    with pytest.raises(SemanticLayerInvalidError):
        _unmask_configuration(
            '{"account": "prod-account", "region": "eu-west-1", "password": "hunter2"}',
            {"account": "prod-account", "password": PASSWORD_MASK},
            "test_provider",
        )


def test_unmask_configuration_allows_removed_key_with_fresh_secret() -> None:
    """
    Dropping a stored key is still allowed when a genuinely fresh secret is
    supplied alongside it -- only the masked round-trip is restricted.
    """
    result = _unmask_configuration(
        '{"account": "prod-account", "region": "eu-west-1", "password": "hunter2"}',
        {"account": "prod-account", "password": "fresh-secret"},
        "test_provider",
    )

    assert result == {"account": "prod-account", "password": "fresh-secret"}


def test_unmask_configuration_allows_fresh_secret_with_changed_field() -> None:
    """
    A deliberate configuration change is still possible when a genuinely
    fresh (non-masked) secret is supplied alongside it.
    """
    result = _unmask_configuration(
        '{"account": "prod-account", "password": "hunter2"}',
        {"account": "new-account", "password": "fresh-secret"},
        "test_provider",
    )

    assert result == {"account": "new-account", "password": "fresh-secret"}


def test_unmask_configuration_allows_unrelated_field_addition_with_no_mask() -> None:
    """
    Adding/changing fields with no masked value present at all is
    unaffected -- there's no secret being reused, so nothing to protect.
    """
    result = _unmask_configuration(
        '{"account": "prod-account"}',
        {"account": "new-account", "extra_option": "value"},
        "test_provider",
    )

    assert result == {"account": "new-account", "extra_option": "value"}


def test_update_semantic_layer_preserves_masked_secret_end_to_end(
    mocker: MockerFixture,
) -> None:
    """A name-only PUT that round-trips the masked GET response does not
    overwrite the stored credential with the literal mask."""
    mock_model: MagicMock = MagicMock()
    mock_model.type = "snowflake"
    mock_model.configuration = '{"account": "test", "password": "hunter2"}'

    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model
    dao.update.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
    )

    mock_cls: MagicMock = MagicMock()
    mock_cls.get_configuration_schema.return_value = {
        "properties": {"password": {"type": "string", "writeOnly": True}}
    }
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry",
        {"snowflake": mock_cls},
        clear=True,
    )

    data: dict[str, Any] = {
        "name": "Renamed",
        "configuration": {"account": "test", "password": PASSWORD_MASK},
    }
    UpdateSemanticLayerCommand("some-uuid", data).run()

    mock_cls.configuration_class.model_validate.assert_called_once_with(
        {"account": "test", "password": "hunter2"}
    )
    dao.update.assert_called_once_with(
        mock_model,
        attributes={"name": "Renamed"},
    )
    assert mock_model.configuration == '{"account": "test", "password": "hunter2"}'
    mock_model.clear_metadata_cache.assert_not_called()


@pytest.mark.parametrize("registered", [True, False])
def test_update_explicit_empty_configuration_is_validated(
    mocker: MockerFixture, registered: bool
) -> None:
    """Empty input is validated; unavailable providers fail with a controlled error."""
    model: MagicMock = MagicMock(type="test_provider", configuration="{}")
    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO"
    )
    dao.find_by_uuid.return_value = model
    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
        return_value=True,
    )
    provider: MagicMock = MagicMock()
    provider.configuration_class.model_validate.side_effect = ValueError(
        "missing required password"
    )
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry",
        {"test_provider": provider} if registered else {},
        clear=True,
    )
    with pytest.raises(SemanticLayerInvalidError):
        UpdateSemanticLayerCommand("layer", {"configuration": {}}).run()
    if registered:
        provider.configuration_class.model_validate.assert_called_once_with({})
    else:
        provider.configuration_class.model_validate.assert_not_called()
    dao.update.assert_not_called()


def test_update_missing_provider_nonempty_configuration(mocker: MockerFixture) -> None:
    """A stale provider gives a controlled error independently of empty input."""
    model: MagicMock = MagicMock(type="missing", configuration="{}")
    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.update.SemanticLayerDAO"
    )
    dao.find_by_uuid.return_value = model
    mocker.patch(
        "superset.commands.semantic_layer.update.current_user_can_modify_object",
        return_value=True,
    )
    mocker.patch.dict(
        "superset.commands.semantic_layer.update.registry", {}, clear=True
    )
    with pytest.raises(SemanticLayerInvalidError, match="Unknown type: missing"):
        UpdateSemanticLayerCommand(
            "layer", {"configuration": {"host": "example"}}
        ).run()
    dao.update.assert_not_called()
