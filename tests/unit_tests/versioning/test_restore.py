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
"""Unit-level coverage for the version-restore engine control flow.

The happy path is exercised end-to-end in the per-entity integration
suites (``version_restore_tests.py``); here we pin the cheap, DB-free
guard branches with mocks: unknown entity, missing target transaction,
DELETE-row target, unregistered model, and the ``single_flush_scope``
flush contract.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from superset.versioning.baseline import OPERATION_DELETE
from superset.versioning.restore import restore_version
from superset.versioning.utils import single_flush_scope

_UUID = UUID("00000000-0000-0000-0000-000000000000")


@patch("superset.versioning.restore.find_active_by_uuid", return_value=None)
def test_restore_version_returns_none_for_unknown_entity(mock_find) -> None:
    """Unknown entity UUID → engine returns None (caller raises 404)."""
    result = restore_version(MagicMock(__name__="Dashboard"), _UUID, 123)
    assert result is None
    mock_find.assert_called_once()


def _engine_with_target(target: object) -> MagicMock:
    """A db.session mock whose version query resolves to *target*."""
    session = MagicMock()
    session.query.return_value.filter.return_value.one_or_none.return_value = target
    return session


@patch("superset.versioning.restore.version_class")
@patch("superset.versioning.restore.db")
def test_restore_version_returns_none_for_missing_transaction(
    mock_db, mock_version_class
) -> None:
    """No version row at the resolved transaction_id → None (404), e.g.
    the row was retention-pruned between resolve and restore."""
    mock_db.session = _engine_with_target(None)
    result = restore_version(
        MagicMock(__name__="Slice"), _UUID, 123, entity=MagicMock(id=1, uuid=_UUID)
    )
    assert result is None


@patch("superset.versioning.restore.version_class")
@patch("superset.versioning.restore.db")
def test_restore_version_refuses_delete_row_target(mock_db, mock_version_class) -> None:
    """A DELETE version row is never a valid target: Continuum's Reverter
    would delete the live entity and report success. Engine treats it as
    not-found."""
    target = MagicMock(operation_type=OPERATION_DELETE)
    mock_db.session = _engine_with_target(target)
    result = restore_version(
        MagicMock(__name__="Slice"), _UUID, 123, entity=MagicMock(id=1, uuid=_UUID)
    )
    assert result is None
    target.revert.assert_not_called()


@patch("superset.versioning.restore.version_class")
@patch("superset.versioning.restore.db")
def test_restore_version_fails_closed_for_unregistered_model(
    mock_db, mock_version_class
) -> None:
    """An unregistered model must raise, not silently restore without its
    child relations (mirrors _RAISE_FOR_ACCESS_KWARG's fail-closed
    dispatch)."""
    mock_db.session = _engine_with_target(MagicMock(operation_type=0))
    with pytest.raises(LookupError, match="SomeNewModel"):
        restore_version(
            MagicMock(__name__="SomeNewModel"),
            _UUID,
            123,
            entity=MagicMock(id=1, uuid=_UUID),
        )


@patch("superset.versioning.restore.version_class")
@patch("superset.versioning.restore.db")
def test_restore_version_rejects_entity_uuid_mismatch(
    mock_db, mock_version_class
) -> None:
    """A preloaded *entity* must be the row *entity_uuid* names. If they
    disagree the engine would restore one entity while the caller logs
    another, so it raises instead of guessing."""
    mock_db.session = _engine_with_target(MagicMock(operation_type=0))
    other_uuid = UUID("00000000-0000-0000-0000-0000000000ff")
    with pytest.raises(ValueError, match="does not match entity_uuid"):
        restore_version(
            MagicMock(__name__="Slice"),
            _UUID,
            123,
            entity=MagicMock(id=1, uuid=other_uuid),
        )


def test_single_flush_scope_flushes_once_on_clean_exit() -> None:
    session = MagicMock()
    with single_flush_scope(session):
        session.flush.assert_not_called()
    session.flush.assert_called_once()


def test_single_flush_scope_skips_flush_on_exception() -> None:
    session = MagicMock()
    with pytest.raises(RuntimeError):
        with single_flush_scope(session):
            raise RuntimeError("boom")
    session.flush.assert_not_called()


class _Row:
    def __init__(self, tx: int, end: int | None, op: int) -> None:
        self.transaction_id = tx
        self.end_transaction_id = end
        self.operation_type = op


def _provable(rows: list[_Row], target_tx: int) -> bool:
    from superset.versioning.restore import _child_state_provable_at

    return _child_state_provable_at(rows, target_tx)


_INSERT, _UPDATE, _DELETE = 0, 1, 2


@pytest.mark.parametrize(
    ("rows", "target_tx", "expected", "case"),
    [
        # A surviving non-DELETE row covers the target: complete.
        ([_Row(5, None, _INSERT)], 10, True, "live row covers"),
        ([_Row(5, 20, _UPDATE)], 10, True, "closed row covers"),
        # Headline sc-120012 case: the covering closed row was pruned and
        # its successor survives — contiguity hole → refuse.
        ([_Row(20, None, _UPDATE)], 10, False, "pruned cover, survivor update"),
        (
            [_Row(20, 30, _UPDATE), _Row(30, None, _UPDATE)],
            10,
            False,
            "pruned cover, surviving chain tail",
        ),
        # Born after the target (contiguous chain): provably absent.
        ([_Row(20, None, _INSERT)], 10, True, "born after target"),
        (
            [_Row(20, 30, _INSERT), _Row(30, None, _UPDATE)],
            10,
            True,
            "born after target, contiguous chain",
        ),
        # Deleted at/before the target (contiguous): provably absent.
        ([_Row(2, 5, _INSERT), _Row(5, 8, _DELETE)], 10, True, "deleted before target"),
        # Pruned INSERT with a surviving mid-chain row and no cover:
        # ambiguous → refuse.
        (
            [_Row(2, 5, _INSERT), _Row(20, None, _UPDATE)],
            10,
            False,
            "hole between early history and tail",
        ),
        # Pruned re-birth: DELETE before target, then an UPDATE after it
        # with no surviving predecessor — the re-birth may have covered
        # the target → refuse.
        (
            [_Row(2, 5, _INSERT), _Row(5, 8, _DELETE), _Row(20, None, _UPDATE)],
            10,
            False,
            "pruned re-birth after delete",
        ),
    ],
)
def test_child_state_provable_case_algebra(
    rows: list[_Row], target_tx: int, expected: bool, case: str
) -> None:
    """sc-120012 fail-closed algebra: covered / provably-absent pass,
    every detectable pruning hole refuses."""
    assert _provable(rows, target_tx) is expected, case
