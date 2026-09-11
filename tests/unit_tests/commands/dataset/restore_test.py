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

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

# Stable UUIDs make the test boundary realistic: the production command
# loads by UUID, not integer ID. The test only mocks the DAO lookup, but
# the argument shape should still match.
_DATASET_UUID = str(uuid.uuid4())
_MISSING_UUID = str(uuid.uuid4())


def test_restore_dataset_clears_deleted_at(app_context: None) -> None:
    """RestoreDatasetCommand.run() restores a soft-deleted dataset."""
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dataset.id = 1

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset
        ) as mock_find,
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch(
            "superset.daos.dataset.DatasetDAO.has_active_logical_duplicate",
            return_value=False,
        ),
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDatasetCommand(_DATASET_UUID)
        cmd.run()

    mock_find.assert_called_once_with(
        _DATASET_UUID,
        id_column="uuid",
        # Both bypasses are the lookup's contract: skip_base_filter keeps an
        # editor's trash reachable when the RBAC base_filter has no editorship
        # leg (audience is enforced by raise_for_editorship instead);
        # skip_visibility_filter lets the lookup see soft-deleted rows.
        skip_base_filter=True,
        skip_visibility_filter=True,
    )
    dataset.restore.assert_called_once()


def test_restore_dataset_not_found_raises(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetNotFoundError for missing dataset."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
        cmd = RestoreDatasetCommand(_MISSING_UUID)
        with pytest.raises(DatasetNotFoundError):
            cmd.run()


def test_restore_active_dataset_raises_not_found(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetNotFoundError for non-deleted dataset."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = None  # not soft-deleted

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset):
        cmd = RestoreDatasetCommand(_DATASET_UUID)
        with pytest.raises(DatasetNotFoundError):
            cmd.run()


def test_restore_dataset_forbidden_raises(app_context: None) -> None:
    """RestoreDatasetCommand raises DatasetForbiddenError on permission check."""
    from superset.commands.dataset.exceptions import DatasetForbiddenError
    from superset.commands.dataset.restore import RestoreDatasetCommand
    from superset.exceptions import SupersetSecurityException

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def raise_security(*args: object, **kwargs: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.restore.security_manager") as mock_sec,
    ):
        mock_sec.raise_for_editorship = raise_security

        cmd = RestoreDatasetCommand(_DATASET_UUID)
        with pytest.raises(DatasetForbiddenError):
            cmd.run()


def test_restore_dataset_logical_duplicate_raises(app_context: None) -> None:
    """Restore raises DatasetLogicalDuplicateError when another active dataset
    already references the same physical table.

    DB-level enforcement of SqlaTable logical uniqueness is inconsistent
    across schema builds (the model-level UniqueConstraint is metadata-only;
    the legacy _customer_location_uc has no catalog leg and is NULL-leaky),
    so a soft-deleted dataset can have its logical slot claimed by a new
    active row before restore. The command refuses the restore so the
    operator sees a clean error instead of an IntegrityError or a silent
    twin.
    """
    from superset.commands.dataset.exceptions import DatasetLogicalDuplicateError
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dataset.id = 42

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch(
            "superset.daos.dataset.DatasetDAO.has_active_logical_duplicate",
            return_value=True,
        ) as mock_dup_check,
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDatasetCommand(_DATASET_UUID)
        with pytest.raises(DatasetLogicalDuplicateError):
            cmd.run()

    mock_dup_check.assert_called_once_with(dataset)


def test_restore_dataset_no_logical_duplicate_when_none_exists(
    app_context: None,
) -> None:
    """The duplicate check is consulted on every restore, even when the
    answer is no — guards against a regression where the override silently
    short-circuits and never queries.
    """
    from superset.commands.dataset.restore import RestoreDatasetCommand

    dataset = MagicMock()
    dataset.deleted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    dataset.id = 42

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.restore.security_manager") as mock_sec,
        patch(
            "superset.daos.dataset.DatasetDAO.has_active_logical_duplicate",
            return_value=False,
        ) as mock_dup_check,
    ):
        mock_sec.raise_for_editorship.return_value = None

        cmd = RestoreDatasetCommand(_DATASET_UUID)
        cmd.run()

    mock_dup_check.assert_called_once_with(dataset)
    dataset.restore.assert_called_once()
