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
"""A save that replaces another request says which one.

One open change per asset is the design, so a second write folds into the
one already there. 129078 was that the fold was *silent*.

A delete landing on a waiting edit was fixed and says so. The mirror was
not: an ordinary save landing on a waiting **delete** answered "Changes
updated in your existing draft", while the delete the author had submitted
was discarded and the approver's queued item disappeared. Saying "updated"
describes neither.
"""

from __future__ import annotations

from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.http import (
    DELETE_MESSAGE,
    DELETE_REPLACED_MESSAGE,
    SAVED_MESSAGE,
    UPDATED_LEFT_REVIEW_MESSAGE,
    UPDATED_MESSAGE,
    UPDATED_REPLACED_DELETE_MESSAGE,
    captured_message,
)


def _captured(**over: object) -> ChangeRequestCreated:
    kwargs: dict[str, object] = {
        "operation": "update",
        "updated_existing": False,
        **over,
    }
    return ChangeRequestCreated(1, "chart", 7, **kwargs)  # type: ignore[arg-type]


def test_a_first_save_is_just_saved() -> None:
    assert captured_message(_captured()) == SAVED_MESSAGE


def test_a_second_save_on_a_draft_folds_quietly() -> None:
    """Nothing was lost, so nothing needs saying beyond where it went."""
    assert (
        captured_message(_captured(updated_existing=True)) == UPDATED_MESSAGE
    )


def test_a_save_that_replaces_a_waiting_delete_says_so() -> None:
    """The bug. The author's delete is no longer requested, and only this
    sentence tells them."""
    message = captured_message(
        _captured(updated_existing=True, replaced_delete=True)
    )

    assert message == UPDATED_REPLACED_DELETE_MESSAGE
    assert message != UPDATED_MESSAGE
    assert "delete" in message.lower()


def test_a_save_that_pulls_a_request_out_of_review_says_so() -> None:
    """The approver's queued item is gone, and the author is the only one
    in a position to know why."""
    message = captured_message(
        _captured(updated_existing=True, left_review=True)
    )

    assert message == UPDATED_LEFT_REVIEW_MESSAGE
    assert "review" in message.lower()


def test_replacing_a_delete_is_said_even_when_it_was_also_in_review() -> None:
    """Losing the delete is the bigger fact of the two."""
    assert (
        captured_message(
            _captured(updated_existing=True, replaced_delete=True, left_review=True)
        )
        == UPDATED_REPLACED_DELETE_MESSAGE
    )


def test_the_delete_direction_is_unchanged() -> None:
    """It already said so, and this must not have disturbed it."""
    assert captured_message(_captured(operation="delete")) == DELETE_MESSAGE
    assert (
        captured_message(_captured(operation="delete", replaced_edit=True))
        == DELETE_REPLACED_MESSAGE
    )


def test_the_two_directions_do_not_share_a_sentence() -> None:
    """Each names what it replaced, so neither can be read as the other."""
    assert UPDATED_REPLACED_DELETE_MESSAGE != DELETE_REPLACED_MESSAGE
