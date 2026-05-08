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
"""Unit tests for RestoreDatasetCommand."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest


def test_restore_dataset_clears_deleted_at(app_context: None) -> None:
    """RestoreDatasetCommand.run() restores a soft-deleted dataset."""
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1)
    dataset.id = 1

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset
        ) as mock_find,
        patch("superset.commands.restore.security_manager") as mock_sec,
    ):
        mock_sec.raise_for_ownership.return_value = None

        cmd = RestoreDatasetCommand("1")
        cmd.run()

    mock_find.assert_called_once()
    dataset.restore.assert_called_once()


def test_restore_dataset_not_found_raises(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetNotFoundError for missing dataset."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
        cmd = RestoreDatasetCommand("999")
        with pytest.raises(DatasetNotFoundError):
            cmd.run()


def test_restore_active_dataset_raises_not_found(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetNotFoundError for non-deleted dataset."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = None  # not soft-deleted

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset):
        cmd = RestoreDatasetCommand("1")
        with pytest.raises(DatasetNotFoundError):
            cmd.run()


def test_restore_dataset_forbidden_raises(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetForbiddenError on permission check."""
    from superset.commands.dataset.exceptions import DatasetForbiddenError
    from superset.commands.dataset.restore import RestoreDatasetCommand
    from superset.exceptions import SupersetSecurityException

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1)

    def raise_security(*args: object, **kwargs: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.restore.security_manager") as mock_sec,
    ):
        mock_sec.raise_for_ownership = raise_security

        cmd = RestoreDatasetCommand("1")
        with pytest.raises(DatasetForbiddenError):
            cmd.run()
