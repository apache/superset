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

"""Unit tests for DeleteSemanticViewCommand."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.semantic_view.delete import DeleteSemanticViewCommand
from superset.commands.semantic_view.exceptions import SemanticViewNotFoundError


def test_delete_semantic_view_success(mocker: MockerFixture) -> None:
    """
    Test successful semantic view deletion.
    """
    mock_view = MagicMock()
    mock_view.uuid = "view-uuid"
    mock_view.name = "test_view"

    dao = mocker.patch("superset.commands.semantic_view.delete.SemanticViewDAO")
    dao.find_by_id.return_value = mock_view
    dao.delete.return_value = None

    command = DeleteSemanticViewCommand("view-uuid")
    result = command.run()

    assert result is None
    dao.delete.assert_called_once_with([mock_view])


def test_delete_semantic_view_not_found(mocker: MockerFixture) -> None:
    """
    Test delete fails when semantic view not found.
    """
    dao = mocker.patch("superset.commands.semantic_view.delete.SemanticViewDAO")
    dao.find_by_id.return_value = None

    command = DeleteSemanticViewCommand("nonexistent-uuid")

    with pytest.raises(SemanticViewNotFoundError):
        command.run()
