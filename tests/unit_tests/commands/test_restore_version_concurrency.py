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

``BaseRestoreVersionCommand._do_restore`` re-reads the live entity under a
``FOR UPDATE`` lock (``refresh(..., with_for_update=True)``) before reverting,
so a concurrent write cannot interleave and the revert is computed against the
current committed state — the ``with_for_update`` flag is load-bearing: a plain
refresh is a non-locking consistent read that returns a stale snapshot on
MySQL/InnoDB REPEATABLE READ.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.orm.exc import ObjectDeletedError

from superset.commands.chart.restore_version import RestoreChartVersionCommand
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dataset.restore_version import RestoreDatasetVersionCommand
from superset.commands.version_restore import BaseRestoreVersionCommand

_COMMAND_CLASSES = [
    RestoreChartVersionCommand,
    RestoreDashboardVersionCommand,
    RestoreDatasetVersionCommand,
]


@pytest.mark.parametrize("command_cls", _COMMAND_CLASSES)
def test_do_restore_refreshes_the_entity_under_a_row_lock(
    command_cls: type[BaseRestoreVersionCommand], app_context: None
) -> None:
    """sc-115423: _do_restore re-reads the live entity with
    ``with_for_update=True`` — a locking read that both serialises the revert
    and reloads the current committed state. Asserting the flag guards the
    MySQL-REPEATABLE-READ correctness: dropping it (a plain refresh) fails
    this test."""
    entity = MagicMock()
    entity.id = 123
    cmd = command_cls(uuid4(), uuid4())

    with (
        patch.object(cmd, "validate", return_value=entity),
        # db is mocked so refresh()/action-kind stamping don't touch a real
        # session for the MagicMock entity.
        patch("superset.commands.version_restore.db") as mock_db,
        patch(
            "superset.commands.version_restore.resolve_version",
            return_value=(0, 5),
        ),
        patch("superset.commands.version_restore.restore_version") as mock_restore,
    ):
        result: Any = MagicMock()
        mock_restore.return_value = result
        assert cmd._do_restore() is result

    mock_db.session.refresh.assert_called_once_with(entity, with_for_update=True)


def test_do_restore_refreshes_before_resolving_and_reverting(
    app_context: None,
) -> None:
    """The locking refresh must run before the version is resolved and before
    the revert — a refresh after either would not protect the read it feeds."""
    entity = MagicMock()
    entity.id = 7
    cmd = RestoreChartVersionCommand(uuid4(), uuid4())
    calls: list[str] = []

    def _refresh(*_args: Any, **_kwargs: Any) -> None:
        calls.append("refresh")

    def _resolve(*_args: Any, **_kwargs: Any) -> tuple[int, int]:
        calls.append("resolve")
        return (0, 5)

    def _restore(*_args: Any, **_kwargs: Any) -> Any:
        calls.append("restore")
        return MagicMock()

    with (
        patch.object(cmd, "validate", return_value=entity),
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
        mock_db.session.refresh.side_effect = _refresh
        cmd._do_restore()

    assert calls == ["refresh", "resolve", "restore"], calls


def test_do_restore_maps_hard_deleted_row_to_not_found(app_context: None) -> None:
    """If the row is hard-deleted and committed between validate() and the
    lock, the locking refresh raises ObjectDeletedError; _do_restore maps it to
    the command's not_found_exc (HTTP 404), preserving the documented
    entity-gone-race behaviour rather than a generic 422."""
    entity = MagicMock()
    entity.id = 5
    cmd = RestoreChartVersionCommand(uuid4(), uuid4())

    with (
        patch.object(cmd, "validate", return_value=entity),
        patch("superset.commands.version_restore.db") as mock_db,
    ):
        # Raise an ObjectDeletedError without invoking its state-dependent
        # constructor.
        mock_db.session.refresh.side_effect = ObjectDeletedError.__new__(
            ObjectDeletedError
        )
        with pytest.raises(cmd.not_found_exc):
            cmd._do_restore()
