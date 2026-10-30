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
"""An approval is published and recorded together, or not at all (R2-01).

``approve`` replays the author's command and then writes the decision --
status, reviewer, decision time -- onto the request. The replay commits
through the host's own command; the decision only reaches the database
because ``approve`` is a unit of work.

It stopped being one by accident. ``_author_name`` was added directly
beneath the ``@transaction()`` that belonged to ``approve``, so the
decorator bound to the new helper and ``approve`` silently lost it. Every
check still passed and the change still went live, because that half
commits elsewhere; only the decision was dropped at teardown. The request
stayed pending, kept the asset locked and stayed in the approver's queue.

So the tests here are about the unit of work rather than any one field:
that a successful approval commits, that a failed replay takes the
decision down with it, and that no lifecycle mutator has silently lost
its wrapper the same way.
"""

from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle
from asset_approval.models import ChangeStatus
from pytest_mock import MockerFixture

DECIDED_AT = datetime(2026, 10, 30, 9, 15)


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method the test does not exercise."""


@pytest.fixture
def approval(mocker: MockerFixture) -> dict[str, Any]:
    """``approve`` with every check satisfied, down to the replay."""
    statuses: list[ChangeStatus] = []
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(id=7, username="alex"),
        author_fk=7,
        asset_type="chart",
        asset_id=42,
        status=ChangeStatus.PENDING.value,
        base_dict={},
        # Every real request carries these; a restore is identified by
        # the command it stores rather than by its operation (R3-01).
        command_args={},
        note=None,
        reviewer_fk=None,
        decided_at=None,
        set_status=statuses.append,
    )
    asset = SimpleNamespace(id=42)

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=9)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_now", return_value=DECIDED_AT)
    mocker.patch.object(lifecycle.db.session, "add", _ignore)
    commit = mocker.patch.object(lifecycle.db.session, "commit")
    rollback = mocker.patch.object(lifecycle.db.session, "rollback")
    applied = mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    return {
        "request": request,
        "statuses": statuses,
        "commit": commit,
        "rollback": rollback,
        "applied": applied,
    }


def test_a_successful_approval_is_committed(approval: dict[str, Any]) -> None:
    # The bug: this passed everywhere except here. The replay published,
    # and the decision was left in the session for teardown to discard.
    assert lifecycle.approve(1) == "applied"

    approval["commit"].assert_called_once()


def test_the_decision_records_the_reviewer_and_the_time(
    approval: dict[str, Any],
) -> None:
    lifecycle.approve(1)

    assert approval["statuses"] == [ChangeStatus.APPROVED]
    assert approval["request"].reviewer_fk == 9
    assert approval["request"].decided_at == DECIDED_AT


def test_a_replay_that_fails_takes_the_decision_down_with_it(
    approval: dict[str, Any],
) -> None:
    approval["applied"].side_effect = RuntimeError("the command failed")

    with pytest.raises(RuntimeError):
        lifecycle.approve(1)

    approval["rollback"].assert_called_once()
    approval["commit"].assert_not_called()
    # Nothing claims the request was approved over a change that never
    # landed; it is still pending for whoever looks next.
    assert approval["statuses"] == []


@pytest.mark.parametrize(
    "name",
    ["submit", "approve", "request_changes", "withdraw", "discard"],
)
def test_no_lifecycle_mutator_has_lost_its_unit_of_work(name: str) -> None:
    """The guard for the way this broke, not just the instance of it.

    ``@transaction()`` sits on the line above a ``def``, so inserting a
    helper between the two moves it without touching either. Each of these
    writes the request's state and has to commit it; a bare function here
    means the decorator is now on whatever was put in front of it.
    """
    mutator = getattr(lifecycle, name)

    assert hasattr(mutator, "__wrapped__"), (
        f"{name} is not wrapped -- check whether a function was added "
        "between it and its @transaction() decorator"
    )


def test_the_helper_that_took_the_decorator_does_not_need_one() -> None:
    # It only reads a name off a loaded row. Leaving it wrapped would
    # commit the session in the middle of building a refusal message.
    assert not hasattr(lifecycle._author_name, "__wrapped__")
