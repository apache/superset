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

from superset.commands.semantic_layer.delete import DeleteSemanticLayerCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerForbiddenError,
    SemanticLayerNotFoundError,
)
from superset.exceptions import SupersetSecurityException


def test_delete_semantic_layer_success(mocker: MockerFixture) -> None:
    """Test successful deletion of a semantic layer."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )

    DeleteSemanticLayerCommand("some-uuid").run()

    dao.find_by_uuid.assert_called_once_with("some-uuid")
    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticLayerNotFoundError is raised when model is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = None

    with pytest.raises(SemanticLayerNotFoundError):
        DeleteSemanticLayerCommand("missing-uuid").run()


def test_delete_semantic_layer_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticLayerForbiddenError is raised for non-editors."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=False,
    )

    with pytest.raises(SemanticLayerForbiddenError):
        DeleteSemanticLayerCommand("some-uuid").run()

    dao.delete.assert_not_called()


def test_delete_semantic_layer_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created the layer, but holds no explicit editorship
    on it, can still delete it."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = sm.current_user

    DeleteSemanticLayerCommand("some-uuid").run()

    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_layer_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who neither created the layer nor is an editor of it is
    rejected."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticLayerForbiddenError):
        DeleteSemanticLayerCommand("some-uuid").run()

    dao.delete.assert_not_called()


def test_delete_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful deletion of a semantic view."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    # Admin (or an editor) can modify anything — no exception raised.
    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )

    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand

    DeleteSemanticViewCommand(42).run()

    dao.find_by_id.assert_called_once_with(42, id_column="id")
    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_view_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticViewForbiddenError is raised for non-owners."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    model = MagicMock()
    model.created_by = None
    dao.find_by_id.return_value = model

    mocker.patch(
        "superset.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(MagicMock()),
    )

    with pytest.raises(SemanticViewForbiddenError):
        DeleteSemanticViewCommand(42).run()


def test_delete_semantic_view_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created the view, but holds no explicit editorship on
    it, can still delete it."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand

    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = sm.current_user

    DeleteSemanticViewCommand(42).run()

    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_view_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who neither created the view nor is an editor of it is
    rejected."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticViewForbiddenError):
        DeleteSemanticViewCommand(42).run()

    dao.delete.assert_not_called()


def test_delete_semantic_view_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticViewNotFoundError is raised when view is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = None

    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import (
        SemanticViewNotFoundError,
    )

    with pytest.raises(SemanticViewNotFoundError):
        DeleteSemanticViewCommand(999).run()


def test_bulk_delete_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful bulk deletion of semantic views."""
    mock_models = [MagicMock(), MagicMock()]

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = mock_models

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )

    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand

    BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.find_by_ids.assert_called_once_with([1, 2], id_column="id")
    dao.delete.assert_called_once_with(mock_models)


def test_bulk_delete_semantic_view_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticViewForbiddenError is raised for non-owners."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = [MagicMock(), MagicMock()]

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=False,
    )

    with pytest.raises(SemanticViewForbiddenError):
        BulkDeleteSemanticViewCommand([1, 2]).run()


def test_bulk_delete_semantic_view_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created every view in the batch, but holds no
    explicit editorship on them, can still bulk-delete them."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand

    mock_models = [MagicMock(), MagicMock()]

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = mock_models

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    for model in mock_models:
        model.created_by = sm.current_user

    BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.delete.assert_called_once_with(mock_models)


def test_bulk_delete_semantic_view_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who is neither the creator of, nor an editor for, one of
    the views in the batch is rejected."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    mock_models = [MagicMock(), MagicMock()]

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = mock_models

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    # The first view belongs to the current user, the second doesn't.
    mock_models[0].created_by = sm.current_user
    mock_models[1].created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticViewForbiddenError):
        BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.delete.assert_not_called()


def test_bulk_delete_semantic_view_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticViewNotFoundError is raised when any id is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    # Only one model returned for two requested ids
    dao.find_by_ids.return_value = [MagicMock()]

    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewNotFoundError

    with pytest.raises(SemanticViewNotFoundError):
        BulkDeleteSemanticViewCommand([1, 2]).run()
