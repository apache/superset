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

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = dataset

    with (
        patch("superset.commands.dataset.restore.db") as mock_db,
        patch("superset.commands.dataset.restore.security_manager") as mock_sec,
    ):
        mock_db.session.query.return_value = query_mock
        mock_sec.raise_for_ownership.return_value = None

        cmd = RestoreDatasetCommand(1)
        cmd.run()

    dataset.restore.assert_called_once()


def test_restore_dataset_not_found_raises(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetNotFoundError when missing."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = None

    with patch("superset.commands.dataset.restore.db") as mock_db:
        mock_db.session.query.return_value = query_mock

        cmd = RestoreDatasetCommand(999)
        with pytest.raises(DatasetNotFoundError):
            cmd.run()


def test_restore_active_dataset_raises_not_found(
    app_context: None,
) -> None:
    """RestoreDatasetCommand raises error for non-deleted dataset."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = None

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = dataset

    with patch("superset.commands.dataset.restore.db") as mock_db:
        mock_db.session.query.return_value = query_mock

        cmd = RestoreDatasetCommand(1)
        with pytest.raises(DatasetNotFoundError):
            cmd.run()


def test_restore_dataset_forbidden_raises(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetForbiddenError."""
    from superset.commands.dataset.exceptions import DatasetForbiddenError
    from superset.commands.dataset.restore import RestoreDatasetCommand
    from superset.exceptions import SupersetSecurityException

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1)

    query_mock = MagicMock()
    query_mock.execution_options.return_value = query_mock
    query_mock.filter.return_value = query_mock
    query_mock.one_or_none.return_value = dataset

    def raise_security(*args: object, **kwargs: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with (
        patch("superset.commands.dataset.restore.db") as mock_db,
        patch("superset.commands.dataset.restore.security_manager") as mock_sec,
    ):
        mock_db.session.query.return_value = query_mock
        mock_sec.raise_for_ownership = raise_security

        cmd = RestoreDatasetCommand(1)
        with pytest.raises(DatasetForbiddenError):
            cmd.run()
