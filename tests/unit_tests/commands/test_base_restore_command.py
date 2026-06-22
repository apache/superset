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
"""Unit tests for ``BaseRestoreCommand.validate``.

Concrete entity restore commands (chart, dashboard, dataset) have their
own integration tests on the entity-rollout PRs. This module exercises
the abstract base class directly so the validation contract is pinned
at the infrastructure level — refactors to ``BaseRestoreCommand`` get
fast local feedback rather than waiting for entity-branch integration
CI.
"""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.restore import BaseRestoreCommand
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import SoftDeleteMixin


class _NotFoundError(Exception):
    """Synthetic not-found exception for tests."""


class _ForbiddenError(Exception):
    """Synthetic forbidden exception for tests."""


class _RestoreFailedError(Exception):
    """Synthetic restore-failed exception used by the transaction wrapper."""


def _make_command(
    dao_find_result: object,
) -> BaseRestoreCommand[SoftDeleteMixin]:
    """Build a concrete ``BaseRestoreCommand`` subclass whose DAO is a
    ``MagicMock`` returning ``dao_find_result`` from ``find_by_id``.
    """
    dao_mock = MagicMock()
    dao_mock.find_by_id.return_value = dao_find_result

    class _SyntheticRestoreCommand(BaseRestoreCommand[SoftDeleteMixin]):
        dao: ClassVar[MagicMock] = dao_mock
        not_found_exc: ClassVar[type[Exception]] = _NotFoundError
        forbidden_exc: ClassVar[type[Exception]] = _ForbiddenError
        restore_failed_exc: ClassVar[type[Exception]] = _RestoreFailedError

    return _SyntheticRestoreCommand("uuid-1")


def test_validate_raises_not_found_when_model_missing(app_context: None) -> None:
    """If the DAO can't find the row, validate() raises ``not_found_exc``."""
    cmd = _make_command(dao_find_result=None)

    with pytest.raises(_NotFoundError, match="No row with uuid"):
        cmd.validate()


def test_validate_raises_not_found_when_model_is_live(app_context: None) -> None:
    """A live row (``deleted_at is None``) has nothing to restore;
    validate() raises ``not_found_exc`` with a message that points at
    the "not soft-deleted" case (distinguishable from "no such row")."""
    live = MagicMock()
    live.deleted_at = None
    cmd = _make_command(dao_find_result=live)

    with pytest.raises(_NotFoundError, match="not soft-deleted"):
        cmd.validate()


def test_validate_returns_model_when_owned_and_soft_deleted(
    app_context: None,
) -> None:
    """A soft-deleted row owned by the caller passes the ownership check
    and is returned to ``run()`` for restoration."""
    soft_deleted = MagicMock()
    soft_deleted.deleted_at = datetime(2026, 1, 1)
    cmd = _make_command(dao_find_result=soft_deleted)

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = MagicMock(return_value=None)
        result = cmd.validate()

    assert result is soft_deleted
    mock_sec.raise_for_ownership.assert_called_once_with(soft_deleted)


def test_validate_raises_forbidden_when_ownership_check_fails(
    app_context: None,
) -> None:
    """The security manager's raise_for_ownership raises
    ``SupersetSecurityException`` for non-owners; validate() translates
    that to the command's ``forbidden_exc`` (keeping the security-layer
    exception type out of caller code)."""
    soft_deleted = MagicMock()
    soft_deleted.deleted_at = datetime(2026, 1, 1)
    cmd = _make_command(dao_find_result=soft_deleted)

    def reject_ownership(_resource: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = reject_ownership
        with pytest.raises(_ForbiddenError):
            cmd.validate()


def test_validate_calls_dao_with_visibility_bypass_only(app_context: None) -> None:
    """The DAO load uses ``skip_visibility_filter=True`` (so the
    soft-deleted row is visible) and ``id_column='uuid'`` — but does
    NOT bypass the entity's ``base_filter``. Restore should honor RBAC
    the same way ``delete`` does (which loads through ``find_by_ids``
    without ``skip_base_filter=True``); the visibility bypass is the
    only escape hatch needed for restore."""
    soft_deleted = MagicMock()
    soft_deleted.deleted_at = datetime(2026, 1, 1)
    cmd = _make_command(dao_find_result=soft_deleted)

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = MagicMock(return_value=None)
        cmd.validate()

    cmd.dao.find_by_id.assert_called_once_with(
        "uuid-1",
        id_column="uuid",
        skip_visibility_filter=True,
    )


def test_run_calls_model_restore_on_success(app_context: None) -> None:
    """The happy path: ``run()`` resolves the model via ``validate()`` and
    calls ``model.restore()`` on it. The transactional wrapper applied
    by the base ``run()`` commits the cleared ``deleted_at`` to the DB.
    """
    soft_deleted = MagicMock()
    soft_deleted.deleted_at = datetime(2026, 1, 1)
    cmd = _make_command(dao_find_result=soft_deleted)

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = MagicMock(return_value=None)
        cmd.run()

    soft_deleted.restore.assert_called_once_with()


def test_run_translates_sqlalchemy_errors_via_restore_failed_exc(
    app_context: None,
) -> None:
    """The base ``run()`` wraps the operation in ``@transaction(on_error=
    partial(on_error, reraise=self.restore_failed_exc))``. A SQLAlchemy
    error raised below (e.g., during commit) gets caught and re-raised
    as the subclass's ``restore_failed_exc``. Pinning this prevents a
    refactor from accidentally dropping the transaction wrapper or
    pointing it at the wrong exception type.
    """
    from sqlalchemy.exc import SQLAlchemyError

    soft_deleted = MagicMock()
    soft_deleted.deleted_at = datetime(2026, 1, 1)
    # model.restore() raises during the transactional block — simulates a
    # SQLAlchemy failure inside the unit-of-work.
    soft_deleted.restore.side_effect = SQLAlchemyError("simulated commit failure")
    cmd = _make_command(dao_find_result=soft_deleted)

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = MagicMock(return_value=None)
        with pytest.raises(_RestoreFailedError):
            cmd.run()
