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
from superset.commands.semantic_layer.exceptions import SemanticLayerNotFoundError


def test_delete_semantic_layer_success(mocker: MockerFixture) -> None:
    """Test successful deletion of a semantic layer."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

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


def test_delete_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful deletion of a semantic view."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand

    DeleteSemanticViewCommand(42).run()

    dao.find_by_id.assert_called_once_with(42, id_column="id")
    dao.delete.assert_called_once_with([mock_model])


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

    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand

    BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.find_by_ids.assert_called_once_with([1, 2], id_column="id")
    dao.delete.assert_called_once_with(mock_models)


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
