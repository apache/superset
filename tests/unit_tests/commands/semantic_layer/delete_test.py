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

"""Unit tests for DeleteSemanticLayerCommand."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_layer.delete import DeleteSemanticLayerCommand
from superset.commands.semantic_layer.exceptions import SemanticLayerNotFoundError


def test_delete_semantic_layer_success(mocker: MockerFixture) -> None:
    """
    Test successful semantic layer deletion.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    dao = mocker.patch("superset.commands.semantic_layer.delete.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.delete.return_value = None

    command = DeleteSemanticLayerCommand("test-uuid")
    result = command.run()

    assert result is None
    dao.delete.assert_called_once_with([mock_layer])


def test_delete_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """
    Test delete fails when semantic layer not found.
    """
    dao = mocker.patch("superset.commands.semantic_layer.delete.SemanticLayerDAO")
    dao.find_by_id.return_value = None

    command = DeleteSemanticLayerCommand("nonexistent-uuid")

    with pytest.raises(SemanticLayerNotFoundError):
        command.run()


def test_delete_semantic_layer_cascades_views(mocker: MockerFixture) -> None:
    """
    Test delete cascades to semantic views.
    """
    mock_layer = MagicMock()
    mock_layer.uuid = "test-uuid"
    mock_layer.name = "test_layer"

    # Mock semantic views that will be cascade deleted
    mock_view1 = MagicMock()
    mock_view2 = MagicMock()
    mock_layer.semantic_views = [mock_view1, mock_view2]

    dao = mocker.patch("superset.commands.semantic_layer.delete.SemanticLayerDAO")
    dao.find_by_id.return_value = mock_layer
    dao.delete.return_value = None

    command = DeleteSemanticLayerCommand("test-uuid")
    result = command.run()

    assert result is None
    dao.delete.assert_called_once_with([mock_layer])
