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
"""The sets of states each decision is read against.

Four leaks found by a mutation sweep of this suite, and they share one
signature: the decision *procedure* is well covered while the *list of
states it is read against* is unasserted. ``moved_since`` the predicate is
tested and every test that drives ``approve`` patches it out.
``gate_write``'s author lock has a test named after it and ``gate_delete``'s
does not. "Which statuses are waiting on a reviewer" is parametrised over
the whole enum; "which statuses may be submitted" was never asked.

Each of these mutations left all 1418 tests green:

* ``approve``: delete the staleness check entirely.
* ``gate_delete``: drop the ``author_fk != author_id`` lock.
* ``submit``: add APPROVED and DISCARDED to the statuses it accepts.
* ``discard``: delete its ``is_open`` guard.

So the tests here are written as the suite already writes this kind of test
elsewhere: over the whole enum, with the failing cases named rather than
implied.
"""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import gate, lifecycle
from asset_approval.exceptions import (
    AssetLockedError,
    InvalidTransitionError,
    StaleBaselineError,
)
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    request_store,
)

AUTHOR = 7
REVIEWER = 9
DECIDED_AT = datetime(2026, 11, 6, 12, 0)


# ---- approve: the staleness check, driven for real --------------------------


@pytest.fixture
def approving(mocker: MockerFixture) -> dict[str, Any]:
    """``approve`` with every check satisfied EXCEPT ``moved_since``.

    Which is the point. Every other test that drives ``approve`` patches
    ``moved_since`` to ``[]``, so the call from ``approve`` into it has never
    run: the predicate is tested as a pure function four files over, the
    refusal's wording is tested by constructing the exception by hand, and
    the wire between them was tested nowhere.
    """
    statuses: list[ChangeStatus] = []
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(id=AUTHOR, username="alex"),
        author_fk=AUTHOR,
        asset_type="chart",
        asset_id=42,
        status=ChangeStatus.PENDING.value,
        # What the reviewer was shown the asset holding.
        base_dict={"slice_name": "As reviewed"},
        command_args={},
        note=None,
        reviewer_fk=None,
        decided_at=None,
        set_status=statuses.append,
    )
    live = SimpleNamespace(id=42, slice_name="As reviewed")

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=REVIEWER)
    mocker.patch.object(lifecycle, "_asset_for", return_value=live)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=live)
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_now", return_value=DECIDED_AT)
    mocker.patch.object(lifecycle.db.session, "add", lambda *a, **k: None)
    mocker.patch.object(lifecycle.db.session, "commit")
    mocker.patch.object(lifecycle.db.session, "rollback")
    mocker.patch.object(lifecycle, "_announce_approval")
    applied = mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    return {"request": request, "live": live, "applied": applied}


def test_an_unmoved_asset_is_approved(approving: dict[str, Any]) -> None:
    """The baseline matches the live asset, so there is nothing to refuse."""
    assert lifecycle.approve(1) == "applied"


def test_an_asset_that_moved_under_the_change_is_refused(
    approving: dict[str, Any],
) -> None:
    """QA-24, through the real predicate.

    Without this the whole check can be deleted and nothing fails. What it
    costs: an author captures an edit on Monday, somebody else moves the
    same field on Tuesday, and Wednesday's approval replays Monday's body
    over Tuesday's work. The reviewer is told "Changes approved and
    published" and the overwritten edit survives only in version history.
    """
    approving["live"].slice_name = "Somebody else changed this"

    with pytest.raises(StaleBaselineError) as refusal:
        lifecycle.approve(1)

    # And it names the field, which is the only way the reviewer can tell a
    # real conflict from a bug.
    assert "slice_name" in str(refusal.value)
    approving["applied"].assert_not_called()


def test_a_request_with_no_baseline_is_not_treated_as_stale(
    approving: dict[str, Any],
) -> None:
    """An operation rather than a full-state body -- a delete, a keyword-only
    dataset write -- has no baseline to compare, and must not be refused for
    lacking one."""
    approving["request"].base_dict = {}
    approving["live"].slice_name = "Changed since, and irrelevant"

    assert lifecycle.approve(1) == "applied"


# ---- gate_delete: the author lock ------------------------------------------


def _request_row(store: Any, author_fk: int, **over: Any) -> None:
    values: dict[str, Any] = {
        "id": 1,
        "asset_type": AssetType.CHART.value,
        "asset_id": 42,
        "operation": Operation.UPDATE.value,
        "status": ChangeStatus.DRAFT.value,
        "active_slot": 1,
        "author_fk": author_fk,
        "note": "Renamed it for the reviewer.",
        "payload": '{"body": {"slice_name": "Theirs"}}',
    }
    values.update(over)
    with store.engine.begin() as connection:
        connection.execute(store.table.insert().values(**values))


@pytest.fixture
def deleting(mocker: MockerFixture, request_store: Any) -> Any:  # noqa: F811
    """``gate_delete`` over a real ``change_requests`` row.

    ``find_open_request`` is stubbed because it reads through the session a
    unit test has no shape for, but ``_update_own_request`` is left real and
    writes to this store -- which is what lets these two tests assert what
    happens to the other author's row rather than only which exception came
    back.
    """
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)

    def holder_of(author_fk: int) -> None:
        mocker.patch.object(
            gate,
            "find_open_request",
            return_value=SimpleNamespace(
                id=1,
                asset_id=42,
                author_fk=author_fk,
                operation=Operation.UPDATE.value,
                author=SimpleNamespace(
                    first_name="Priya", last_name="Shah", username="priya"
                ),
                payload_dict={"slice_name": "Theirs"},
            ),
        )

    request_store.holder_of = holder_of
    return request_store


def test_a_delete_over_another_authors_request_is_refused(
    deleting: Any, mocker: MockerFixture
) -> None:
    """``gate_write``'s lock has a test named after it; this one had none.

    Removed, the loop falls through to ``_update_own_request`` and rewrites
    the other author's row into a delete: their payload is emptied, the note
    they wrote for the reviewer is cleared, and ``author_fk`` stays theirs.
    So a queued rename becomes "delete this chart, requested by them" -- a
    delete they never asked for, attributed to them, with their work gone and
    neither party told.
    """
    _request_row(deleting, author_fk=AUTHOR + 1)
    deleting.holder_of(AUTHOR + 1)

    with pytest.raises(AssetLockedError):
        gate.gate_delete(AssetType.CHART, [42])

    row = deleting.row(1)
    assert row.operation == Operation.UPDATE.value, "their request was rewritten"
    assert row.note == "Renamed it for the reviewer.", "their note was cleared"
    assert row.status == ChangeStatus.DRAFT.value


def test_but_the_authors_own_request_still_becomes_the_delete(
    deleting: Any,
) -> None:
    """The lock is about whose work it is, not about there being work."""
    _request_row(deleting, author_fk=AUTHOR)
    deleting.holder_of(AUTHOR)

    with pytest.raises(Exception) as captured:  # noqa: PT011
        gate.gate_delete(AssetType.CHART, [42])

    assert not isinstance(captured.value, AssetLockedError)
    assert deleting.row(1).operation == Operation.DELETE.value


# ---- submit and discard: the statuses they accept --------------------------

#: Every status, and whether an author may submit a request in it.
MAY_BE_SUBMITTED = {
    ChangeStatus.DRAFT: True,
    ChangeStatus.CHANGES_REQUESTED: True,
    ChangeStatus.PENDING: False,
    ChangeStatus.APPROVED: False,
    ChangeStatus.DISCARDED: False,
}

#: Every status, and whether an editor may discard a request in it.
MAY_BE_DISCARDED = {
    ChangeStatus.DRAFT: True,
    ChangeStatus.CHANGES_REQUESTED: True,
    ChangeStatus.PENDING: True,
    ChangeStatus.APPROVED: False,
    ChangeStatus.DISCARDED: False,
}


def test_every_status_has_an_answer_for_both() -> None:
    """Or a status added later drops silently out of both tables."""
    assert set(MAY_BE_SUBMITTED) == set(ChangeStatus)
    assert set(MAY_BE_DISCARDED) == set(ChangeStatus)


@pytest.fixture
def transitioning(mocker: MockerFixture) -> SimpleNamespace:
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(id=AUTHOR, username="alex"),
        author_fk=AUTHOR,
        asset_type="chart",
        asset_id=42,
        status=ChangeStatus.DRAFT.value,
        is_open=True,
        base_dict={},
        command_args={},
        note=None,
        reviewer=None,
        reviewer_fk=None,
        decided_at=None,
        submitted_at=None,
        changed_on=DECIDED_AT,
        set_status=lambda status: setattr(request, "status", status.value),
    )
    live = SimpleNamespace(id=42)
    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(lifecycle, "_asset_for", return_value=live)
    mocker.patch.object(lifecycle, "load_asset", return_value=live)
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "eligible_approvers", return_value=[live])
    mocker.patch.object(lifecycle, "_now", return_value=DECIDED_AT)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle.db.session, "add", lambda *a, **k: None)
    mocker.patch.object(lifecycle.db.session, "commit")
    mocker.patch.object(lifecycle.db.session, "rollback")
    return request


@pytest.mark.parametrize(
    "status,allowed",
    sorted(MAY_BE_SUBMITTED.items(), key=lambda pair: pair[0].value),
    ids=[status.value for status in sorted(MAY_BE_SUBMITTED, key=lambda s: s.value)],
)
def test_only_an_open_undecided_request_may_be_submitted(
    transitioning: SimpleNamespace, status: ChangeStatus, allowed: bool
) -> None:
    """The guard nobody asked about.

    Widened to accept a decided status, an author can re-submit a change
    that was already approved and applied: ``set_status(PENDING)`` re-takes
    the asset's open slot, the applied change returns to a reviewer's queue,
    and approving it a second time replays the old body over whatever is
    live now. "Changes discarded" also becomes reversible by its author with
    one press.
    """
    transitioning.status = status.value
    transitioning.is_open = status in {
        ChangeStatus.DRAFT,
        ChangeStatus.CHANGES_REQUESTED,
        ChangeStatus.PENDING,
    }

    if allowed:
        lifecycle.submit(1)
        assert transitioning.status == ChangeStatus.PENDING.value
    else:
        with pytest.raises(InvalidTransitionError):
            lifecycle.submit(1)


@pytest.mark.parametrize(
    "status,allowed",
    sorted(MAY_BE_DISCARDED.items(), key=lambda pair: pair[0].value),
    ids=[status.value for status in sorted(MAY_BE_DISCARDED, key=lambda s: s.value)],
)
def test_only_an_open_request_may_be_discarded(
    transitioning: SimpleNamespace, status: ChangeStatus, allowed: bool
) -> None:
    """Driven as a legitimate editor, which is what was missing.

    The one test that set ``is_open = False`` and called ``discard`` did it
    as a viewer, so the authorization refusal fired first and the status
    guard below it never ran. Without the guard, an editor can "discard" an
    already-approved change: ``reviewer_fk`` and ``decided_at`` are
    overwritten with whoever pressed the button, so the record of who
    approved it and when is destroyed -- the maker-checker evidence this
    feature exists to produce, editable after the fact from a normal button.
    """
    transitioning.status = status.value
    transitioning.is_open = status in {
        ChangeStatus.DRAFT,
        ChangeStatus.CHANGES_REQUESTED,
        ChangeStatus.PENDING,
    }

    if allowed:
        lifecycle.discard(1)
        assert transitioning.status == ChangeStatus.DISCARDED.value
    else:
        with pytest.raises(InvalidTransitionError):
            lifecycle.discard(1)
        assert transitioning.status == status.value, "the decision was overwritten"
