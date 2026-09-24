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

from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from superset.versioning.baseline import OPERATION_DELETE, OPERATION_INSERT
from superset.versioning.restore import _child_state_provable_at, restore_version
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
    child relations (mirrors _version_endpoint_models's fail-closed
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
    """Minimal validity interval consumed by the restore proof."""

    def __init__(self, tx: int, end: int | None, op: int) -> None:
        self.transaction_id: int = tx
        self.end_transaction_id: int | None = end
        self.operation_type: int = op


def _provable(rows: list[_Row], target_tx: int) -> bool:
    """Evaluate the real proof against a small same-parent history."""
    return _child_state_provable_at(rows, target_tx)


_INSERT: int = OPERATION_INSERT
_UPDATE: int = 1
_DELETE: int = OPERATION_DELETE


@pytest.mark.parametrize(
    ("rows", "expected"),
    [
        ([_Row(25, None, _DELETE), _Row(20, 25, _INSERT)], True),
        (
            [_Row(30, None, _INSERT), _Row(20, 25, _UPDATE), _Row(25, 30, _DELETE)],
            False,
        ),
    ],
    ids=["earliest-insert-proves-birth", "later-insert-does-not-prove-birth"],
)
def test_born_after_proof_uses_earliest_transaction(
    rows: list[_Row], expected: bool
) -> None:
    """Unsorted input must use tx 20, not the first returned row, as evidence.

    The explicit verdicts are independent of query ordering: INSERT@20 proves
    birth after target 10; UPDATE@20 leaves the original birth unknown.
    """
    assert _child_state_provable_at(rows, 10) is expected


@pytest.mark.parametrize(
    ("rows", "target_tx", "expected", "case"),
    [
        # A surviving closed terminal DELETE proves absence
        # UNCONDITIONALLY (ratified, sc-120012): retention cannot erase
        # its closer without erasing the DELETE row itself (the pruner's
        # close-tx predicate), and purge never touches the live parent's
        # rows — so the missing closer is a purged foreign incarnation
        # of a recycled id. This was the #44251 CI false-refusal class.
        (
            [_Row(2, 5, _INSERT), _Row(5, 8, _DELETE)],
            10,
            True,
            "closed terminal delete is provable absence",
        ),
        # Ping-pong recycling: the pk went foreign and came BACK after
        # the target; the last same-parent row at/before the target is
        # the DELETE — absent, regardless of the later re-birth.
        (
            [
                _Row(2, 5, _INSERT),
                _Row(5, 8, _DELETE),
                _Row(15, 20, _INSERT),
                _Row(20, None, _DELETE),
            ],
            10,
            True,
            "ping-pong: target inside the foreign period is absent",
        ),
        # The guard's core case stays closed: a non-DELETE row whose
        # interval expired before the target means its same-parent
        # successor was pruned (close-tx pruned, create-tx kept) — the
        # child may have existed at the target.
        (
            [_Row(2, 5, _INSERT), _Row(5, 8, _DELETE), _Row(9, 10, _UPDATE)],
            10,
            False,
            "expired non-delete last row refuses",
        ),
    ],
)
def test_child_state_absence_and_refusal_rules(
    rows: list[_Row],
    target_tx: int,
    expected: bool,
    case: str,
) -> None:
    """sc-120012 ratified semantics after the #44251 CI rounds: closed
    terminal DELETEs are absence; expired non-DELETE intervals refuse."""
    assert _child_state_provable_at(rows, target_tx) is expected, case


@pytest.mark.parametrize(
    ("rows", "target_tx", "expected", "case"),
    [
        # A surviving non-DELETE row covers the target: complete.
        ([_Row(5, None, _INSERT)], 10, True, "live row covers"),
        ([_Row(5, 20, _UPDATE)], 10, True, "closed row covers"),
        # [tx, end) includes a child changed in the target transaction.
        ([_Row(10, None, _UPDATE)], 10, True, "row created at target covers"),
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
        # Deleted at/before the target with the DELETE interval COVERING
        # it (open end, or closed end beyond the target): provably absent.
        (
            [_Row(2, 5, _INSERT), _Row(5, None, _DELETE)],
            10,
            True,
            "deleted before target, never re-born",
        ),
        (
            [_Row(2, 5, _INSERT), _Row(5, 20, _DELETE)],
            10,
            True,
            "deleted before target, re-born after it",
        ),
        # RATIFIED REVERSAL (sc-120012, after the #44251 CI rounds): a
        # surviving closed terminal DELETE is provable absence even when
        # its closer row is gone — retention cannot erase the closer
        # without erasing this DELETE row too (close-tx predicate), and
        # purge never touches the live parent's rows.
        (
            [_Row(2, 5, _INSERT), _Row(5, 8, _DELETE)],
            10,
            True,
            "closed terminal delete is absence (ratified reversal)",
        ),
        # DOCUMENTED LIMITATION: an erased same-parent re-birth (8,15)
        # and its closing DELETE (15,20) look like a purged foreign
        # incarnation. The ratified rule accepts absence, not refusal.
        # sc-120945 is the separate post-GA retention-policy follow-up.
        (
            [_Row(2, 5, _INSERT), _Row(5, 8, _DELETE), _Row(20, None, _INSERT)],
            10,
            True,
            "post-target re-birth does not disturb the delete verdict",
        ),
        # Codex M1 regression: a covering DELETE proves absence by its
        # own interval even when its long-pruned predecessor is gone — a
        # dead column must not block every later restore.
        (
            [_Row(20, None, _DELETE)],
            30,
            True,
            "M1: covering delete with pruned predecessor",
        ),
        # Pruned INSERT with a surviving mid-chain row and no cover:
        # ambiguous → refuse.
        (
            [_Row(2, 5, _INSERT), _Row(20, None, _UPDATE)],
            10,
            False,
            "hole between early history and tail",
        ),
        # Post-target rows never affect the verdict at the target: the
        # last same-parent row AT/BEFORE it is the DELETE → absent
        # (ratified reversal; the pre-relaxation rule refused here).
        (
            [_Row(2, 5, _INSERT), _Row(5, 8, _DELETE), _Row(20, None, _UPDATE)],
            10,
            True,
            "post-target update does not disturb the delete verdict",
        ),
    ],
)
def test_child_state_provable_case_algebra(
    rows: list[_Row], target_tx: int, expected: bool, case: str
) -> None:
    """sc-120012 fail-closed algebra: covered / provably-absent pass,
    every detectable pruning hole refuses."""
    assert _provable(rows, target_tx) is expected, case


def test_documented_limitation_rebirth_looks_like_first_birth() -> None:
    """Erased birth/covering history cannot be distinguished from born-after.

    This characterizes missing evidence, not a desired fidelity guarantee.
    It is not a retention-policy regression: no pruner runs in this unit test.
    """
    survivors: list[_Row] = [_Row(20, None, _INSERT)]
    assert _provable(survivors, 10)


def test_restore_endpoint_maps_pruned_history_to_422(app_context: None) -> None:
    """The fail-closed refusal surfaces as a user-facing 422, not a 500.

    PrunedChildHistoryError passes through the command's @transaction
    untouched (on_error re-raises non-SQLAlchemy exceptions as-is), so
    the endpoint must catch it ahead of the generic failed_exc branch."""
    from superset.models.dashboard import Dashboard
    from superset.versioning.api_helpers import restore_version_endpoint
    from superset.versioning.restore import PrunedChildHistoryError

    error: PrunedChildHistoryError = PrunedChildHistoryError(
        "SqlaTable", "2 column/metric history row(s)"
    )

    class _Command:
        not_found_exc: type[Exception] = KeyError
        forbidden_exc: type[Exception] = PermissionError
        failed_exc: type[Exception] = RuntimeError

        def __init__(self, *_args: object) -> None:
            pass

        def run(self) -> None:
            raise error

    api: MagicMock = MagicMock()
    api.response_422.return_value = "resp-422"

    response: Any = restore_version_endpoint(
        api,
        Dashboard,
        _Command,
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
    )

    assert response == "resp-422"
    api.response_422.assert_called_once_with(message=str(error))
    assert "left unchanged" in str(error)
