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
"""QA-93: the author's next save destroys the reviewer's reason.

A reviewer sends a change back and has to say why (``ReviewNoteRequiredError``
-- "Say what needs to change."). The author sees it. Their next save folds
into the same request and sets ``review_note`` to NULL, so the one person the
note was written for loses it at exactly the moment they begin revising
against it. There is nowhere else it is kept: Visa holds no review history
(Q7).

The note belongs to the decision that was made, and a save does not un-make
that decision. The row proves it: the fold leaves ``reviewer_fk`` and
``decided_at`` exactly as the reviewer left them, so the record still says
who decided and when, and only the text of the reason is thrown away.

The deliberate clearing nearby is a different note and a different reason.
``clear_note`` clears ``note`` -- the *author's* own "what changed?" -- when
the request's content has moved out from under it (a save replacing a
delete, or a save pulling a submitted request out of review), because that
note is pre-filled into the next request-review dialog and would send the
reviewer a description of work the draft no longer contains. None of that
is true of the reviewer's note: it is not the author's to resend, it
describes the decision rather than the content, and it stays correct until
the author submits again and a reviewer decides again.

So the fix is to stop clearing ``review_note`` unconditionally in
``gate._update_own_request`` -- one line of its ``values`` dict -- and to
leave ``clear_note`` alone.

``gate.py`` belongs to another agent in this round, so the two tests that
pin the fix are marked ``xfail(strict=True)``: they fail today for exactly
that one line, and they will fail *as XPASS* the moment it is removed,
which is the signal to delete these markers.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from asset_approval import gate
from asset_approval.types import ChangeStatus, Operation

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    request_store,
)

AUTHOR = 5
REVIEWER = 9
CHART_ID = 41

SENT_BACK = "The subtitle still names last quarter -- please update it."
AUTHORS_NOTE = "Renamed the chart."
DECIDED_AT = datetime(2026, 11, 5, 11, 0)

PENDING_GATE_FIX = (
    "gate._update_own_request still sets review_note=None; that line is "
    "owned by another agent this round"
)


@pytest.fixture
def returned(request_store: Any) -> Any:  # noqa: F811
    """One request a reviewer has sent back, with their reason on it."""
    with request_store.engine.begin() as connection:
        connection.execute(
            request_store.table.insert().values(
                id=1,
                asset_type="chart",
                asset_id=CHART_ID,
                operation=Operation.UPDATE.value,
                status=ChangeStatus.CHANGES_REQUESTED.value,
                active_slot=1,
                author_fk=AUTHOR,
                reviewer_fk=REVIEWER,
                review_note=SENT_BACK,
                note=AUTHORS_NOTE,
                decided_at=DECIDED_AT,
                payload="{}",
            )
        )
    return request_store


def _the_author_saves_again(clear_note: bool = False) -> None:
    gate._update_own_request(
        1,
        {"slice_name": "Renamed again"},
        None,
        {},
        Operation.UPDATE,
        clear_note=clear_note,
    )


# ---- the defect -------------------------------------------------------------


@pytest.mark.xfail(strict=True, reason=PENDING_GATE_FIX)
def test_the_reviewers_reason_survives_the_authors_next_save(
    returned: Any,
) -> None:
    """The author is revising against this note. It is nulled instead."""
    _the_author_saves_again()

    assert returned.row(1).review_note == SENT_BACK


@pytest.mark.xfail(strict=True, reason=PENDING_GATE_FIX)
def test_it_survives_even_when_the_authors_own_note_is_cleared(
    returned: Any,
) -> None:
    """The two notes are cleared for different reasons, or should be.

    ``clear_note`` exists because the author's note would be resent to a
    reviewer describing content that has moved. The reviewer's note is not
    the author's to resend.
    """
    _the_author_saves_again(clear_note=True)

    row = returned.row(1)
    assert row.note is None
    assert row.review_note == SENT_BACK


# ---- what must not change ---------------------------------------------------


def test_the_decision_the_note_belongs_to_is_already_kept(
    returned: Any,
) -> None:
    """Which is the argument. The fold keeps the decision and drops its text.

    Passes today, and is the thing the fix makes consistent rather than
    something it changes.
    """
    _the_author_saves_again()

    row = returned.row(1)
    assert row.reviewer_fk == REVIEWER
    assert row.decided_at == DECIDED_AT


def test_the_save_still_returns_the_request_to_its_author(
    returned: Any,
) -> None:
    """A fresh edit takes a bounced request back into the author's hands."""
    _the_author_saves_again()

    row = returned.row(1)
    assert row.status == ChangeStatus.DRAFT.value
    assert row.submitted_at is None
    assert row.active_slot == 1


def test_the_authors_own_note_is_still_cleared_when_asked(
    returned: Any,
) -> None:
    """``clear_note`` keeps working, for the cases it was written for (E3,
    129078)."""
    _the_author_saves_again(clear_note=True)

    assert returned.row(1).note is None
