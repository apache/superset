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
from collections.abc import Iterator
from contextlib import nullcontext
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock
from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError

from superset.commands.dashboard.permalink.create import CreateDashboardPermalinkCommand

MODULE = "superset.commands.dashboard.permalink.create"
UUID_KEY = UUID("11111111-1111-1111-1111-111111111111")


def _entry(entry_id: int) -> MagicMock:
    entry = MagicMock()
    entry.id = entry_id
    return entry


def _duplicate_key_error() -> IntegrityError:
    return IntegrityError(
        "INSERT INTO key_value",
        {},
        Exception("Duplicate entry for key 'key_value.ix_key_value_uuid'"),
    )


@pytest.fixture
def mocks() -> Iterator[dict[str, Any]]:
    """
    Patch everything the command touches so ``run`` can be exercised without a
    database. ``db.session.begin_nested()`` is a plain context manager that does not
    swallow exceptions, like a real SAVEPOINT.
    """
    with (
        patch(f"{MODULE}.db") as db,
        patch(f"{MODULE}.KeyValueDAO") as key_value_dao,
        patch(f"{MODULE}.DashboardDAO") as dashboard_dao,
        patch(f"{MODULE}.get_user_id", return_value=1),
        patch(f"{MODULE}.get_deterministic_uuid", return_value=UUID_KEY),
        patch(f"{MODULE}.get_fallback_algorithms", return_value=[]),
        patch(
            f"{MODULE}.encode_permalink_key",
            side_effect=lambda key, salt: f"permalink-{key}",
        ),
        patch.object(
            CreateDashboardPermalinkCommand,
            "salt",
            new_callable=PropertyMock,
            return_value="salt",
        ),
    ):
        db.session.begin_nested.side_effect = lambda: nullcontext()
        dashboard_dao.get_by_id_or_slug.return_value = MagicMock(uuid=UUID_KEY)
        yield {"db": db, "dao": key_value_dao}


def _run() -> str:
    command = CreateDashboardPermalinkCommand(dashboard_id="1", state={})
    # ``run`` is wrapped by ``@transaction``, which needs an app context and a real
    # session; call the undecorated function to test the command's own logic.
    return CreateDashboardPermalinkCommand.run.__wrapped__(command)


def test_create_permalink_creates_new_entry(mocks: dict[str, Any]) -> None:
    mocks["dao"].get_entry.return_value = None
    mocks["dao"].create_entry.return_value = _entry(7)

    assert _run() == "permalink-7"
    mocks["dao"].create_entry.assert_called_once()
    mocks["db"].session.flush.assert_called_once()


def test_create_permalink_returns_existing_entry(mocks: dict[str, Any]) -> None:
    mocks["dao"].get_entry.return_value = _entry(3)

    assert _run() == "permalink-3"
    mocks["dao"].create_entry.assert_not_called()


def test_create_permalink_joins_concurrent_winner(mocks: dict[str, Any]) -> None:
    """
    Concurrent identical requests derive the same uuid. When the lookup misses but
    another request inserts the entry first, the loser hits the unique index. It must
    return the winner's permalink instead of failing.
    """
    winner = _entry(5)
    mocks["dao"].get_entry.side_effect = [None, winner]
    mocks["dao"].create_entry.return_value = _entry(99)
    mocks["db"].session.flush.side_effect = _duplicate_key_error()

    assert _run() == "permalink-5"
    assert mocks["dao"].get_entry.call_count == 2
    # The re-read must be a locking read so that it sees the winner's committed row
    # even when the transaction runs under REPEATABLE READ.
    assert mocks["dao"].get_entry.call_args.kwargs == {"for_update": True}


def test_create_permalink_reraises_unexpected_integrity_error(
    mocks: dict[str, Any],
) -> None:
    """
    If the entry cannot be found after a unique violation, the error was not the
    expected duplicate and must not be masked.
    """
    mocks["dao"].get_entry.return_value = None
    mocks["dao"].create_entry.return_value = _entry(99)
    mocks["db"].session.flush.side_effect = _duplicate_key_error()

    with pytest.raises(IntegrityError):
        _run()
