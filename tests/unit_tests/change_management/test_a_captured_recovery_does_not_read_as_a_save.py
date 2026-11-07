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
"""Recovering an archived asset, when the recovery is held for review.

A restore is an ``update`` like any other, so it fell through every branch
of ``_what_was_captured`` to "Changes saved. Viewers still see the live
version." On a never-published asset that sentence is false twice over:
nothing was saved, and there has never been a live version for viewers to
see. It also never said a second step was needed, which the delete copy
beside it does.

The test leak behind it: the only assertion on this sentence lived in
``ArchivedList.test.tsx``, against a string written into that test's own
fixture under the comment "the server's own sentence". The server never
produced it. This file is where the server's side is pinned, so the two
cannot drift again.
"""

from __future__ import annotations

from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.gate import RESTORE_COMMAND
from asset_approval.http import (
    BULK_RESTORE_MESSAGE,
    captured_message,
    DELETE_MESSAGE,
    RESTORE_MESSAGE,
    SAVED_MESSAGE,
)


def _captured(**over: object) -> ChangeRequestCreated:
    kwargs: dict[str, object] = {"operation": "update", **over}
    return ChangeRequestCreated(1, "chart", 7, **kwargs)  # type: ignore[arg-type]


def test_a_captured_recovery_says_a_recovery_was_captured() -> None:
    message = captured_message(_captured(command=RESTORE_COMMAND))

    assert message == RESTORE_MESSAGE
    assert message != SAVED_MESSAGE


def test_it_does_not_claim_anything_was_saved_or_is_live() -> None:
    """The two halves of the old sentence, both wrong here."""
    message = captured_message(_captured(command=RESTORE_COMMAND))

    assert "Changes saved" not in message
    assert "live version" not in message


def test_it_says_nothing_has_come_back_yet() -> None:
    """The asset is still archived. A reader who thinks it is back goes
    looking for it where it is not."""
    message = captured_message(_captured(command=RESTORE_COMMAND))

    assert "Nothing has been recovered yet" in message


def test_and_that_the_author_still_owes_a_submission() -> None:
    """Like the delete copy beside it. A captured recovery is a draft no
    reviewer can see until it is submitted."""
    assert "Request review" in captured_message(
        _captured(command=RESTORE_COMMAND)
    )


def test_several_recoveries_are_counted() -> None:
    message = captured_message(
        _captured(command=RESTORE_COMMAND, count=3, change_request_ids=[1, 2, 3])
    )

    assert message == BULK_RESTORE_MESSAGE % 3
    assert "3" in message
    assert "Nothing has been recovered" in message


def test_an_ordinary_save_is_untouched() -> None:
    """The restore branch is asked about before the update branches, so this
    is the regression it could cause."""
    assert captured_message(_captured()) == SAVED_MESSAGE


def test_and_so_is_a_delete() -> None:
    assert captured_message(_captured(operation="delete")) == DELETE_MESSAGE


def test_a_command_this_does_not_know_reads_as_a_save() -> None:
    """Which is what it is: an ordinary governed write that happens to have
    arrived through a named command."""
    assert captured_message(_captured(command="some_other_command")) == (
        SAVED_MESSAGE
    )
