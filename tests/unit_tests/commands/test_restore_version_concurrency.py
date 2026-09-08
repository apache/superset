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
"""Unit tests for the version-restore concurrency lock (sc-115423).

``BaseRestoreVersionCommand._do_restore`` re-reads the live entity with a
locking ``populate_existing`` query (``... FOR UPDATE WHERE id = ? AND
deleted_at IS NULL``) before reverting. The wiring asserted here — the
``with_for_update`` lock and the ``one_or_none`` miss → ``not_found_exc`` — is
what makes the concurrent-write, hard-delete, and soft-delete races safe; the
real-DB behaviour is exercised in the chart integration suite.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from superset.commands.chart.restore_version import RestoreChartVersionCommand
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dataset.restore_version import RestoreDatasetVersionCommand
from superset.commands.version_restore import BaseRestoreVersionCommand

_COMMAND_CLASSES = [
    RestoreChartVersionCommand,
    RestoreDashboardVersionCommand,
    RestoreDatasetVersionCommand,
]


def _self_returning_query(mock_db: MagicMock) -> MagicMock:
    """Wire ``db.session.query(...)`` so the ``populate_existing().filter_by()
    .with_for_update()`` chain returns the query object itself, and hand back
    that object so a test can set ``one_or_none`` and assert the calls."""
    query = mock_db.session.query.return_value
    query.populate_existing.return_value = query
    query.enable_eagerloads.return_value = query
    query.filter_by.return_value = query
    query.with_for_update.return_value = query
    return query


@pytest.mark.parametrize("command_cls", _COMMAND_CLASSES)
def test_do_restore_reads_the_entity_under_a_row_lock(
    command_cls: type[BaseRestoreVersionCommand], app_context: None
) -> None:
    """sc-115423: _do_restore re-reads the entity with a FOR UPDATE,
    populate_existing query before reverting — locking (serialises the revert)
    and reloading current committed state. Asserting with_for_update +
    populate_existing guards the MySQL-REPEATABLE-READ correctness."""
    entity = MagicMock()
    entity.id = 123
    cmd = command_cls(uuid4(), uuid4())

    with (
        patch.object(cmd, "validate", return_value=entity),
        patch("superset.commands.version_restore.db") as mock_db,
        patch(
            "superset.commands.version_restore.resolve_version",
            return_value=(0, 5),
        ),
        patch("superset.commands.version_restore.restore_version") as mock_restore,
    ):
        query = _self_returning_query(mock_db)
        query.one_or_none.return_value = entity
        result: Any = MagicMock()
        mock_restore.return_value = result
        assert cmd._do_restore() is result

    mock_db.session.query.assert_called_once_with(cmd.model_cls)
    query.populate_existing.assert_called_once_with()
    # Eager loaders MUST be disabled before FOR UPDATE: a ``lazy="subquery"``
    # relationship (e.g. Slice.table) otherwise emits ``SELECT DISTINCT …
    # FOR UPDATE``, which Postgres rejects. This guards that regression (the
    # real SQL only compiles that way at execution against Postgres, so the
    # integration suite is the behavioural guard; this pins the call site).
    query.enable_eagerloads.assert_called_once_with(False)
    # The active-row predicate (deleted_at IS NULL) is what makes a concurrent
    # *soft* delete read as absent — assert it is part of the locking filter.
    query.filter_by.assert_called_once_with(id=entity.id, deleted_at=None)
    query.with_for_update.assert_called_once_with()
    query.one_or_none.assert_called_once_with()


def test_do_restore_reads_before_resolving_and_reverting(app_context: None) -> None:
    """The locking read must run after validate() and before the version is
    resolved and reverted — pins the full order validate → read → resolve →
    revert."""
    entity = MagicMock()
    entity.id = 7
    cmd = RestoreChartVersionCommand(uuid4(), uuid4())
    calls: list[str] = []

    def _validate() -> MagicMock:
        calls.append("validate")
        return entity

    def _read() -> MagicMock:
        calls.append("read")
        return entity

    def _resolve(*_args: Any, **_kwargs: Any) -> tuple[int, int]:
        calls.append("resolve")
        return (0, 5)

    def _restore(*_args: Any, **_kwargs: Any) -> Any:
        calls.append("restore")
        return MagicMock()

    with (
        patch.object(cmd, "validate", side_effect=_validate),
        patch("superset.commands.version_restore.db") as mock_db,
        patch(
            "superset.commands.version_restore.resolve_version",
            side_effect=_resolve,
        ),
        patch(
            "superset.commands.version_restore.restore_version",
            side_effect=_restore,
        ),
    ):
        query = _self_returning_query(mock_db)
        query.one_or_none.side_effect = _read
        cmd._do_restore()

    assert calls == ["validate", "read", "resolve", "restore"], calls


def test_do_restore_maps_missing_row_to_not_found(app_context: None) -> None:
    """When the locking query finds no active row — the entity was hard-deleted
    or soft-deleted and committed between validate() and the lock — _do_restore
    raises the command's not_found_exc (HTTP 404), not the transaction
    wrapper's 422. The query's ``deleted_at IS NULL`` predicate makes a
    soft-deleted row read as absent too."""
    entity = MagicMock()
    entity.id = 5
    cmd = RestoreChartVersionCommand(uuid4(), uuid4())

    with (
        patch.object(cmd, "validate", return_value=entity),
        patch("superset.commands.version_restore.db") as mock_db,
    ):
        query = _self_returning_query(mock_db)
        query.one_or_none.return_value = None
        with pytest.raises(cmd.not_found_exc):
            cmd._do_restore()
