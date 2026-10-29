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
"""Every message a capture can answer with has to be reachable.

The copy used to be chosen twice: once in a response built off the FAB view
object, once again inside ``signal_response``. Only the second was ever
wired up, and it knew about deletes but not about a delete that replaced an
edit, nor about a second save folding into an existing draft. So two
messages were written, covered by tests against the unreachable function,
and reported fixed -- while every caller kept reading the plain wording
(QA-03, QA-11).

These tests go through ``signal_response``, the function the error handler
and the ``after_request`` hook actually call, and assert that each message
is produced by some capture. A branch that stops being reachable fails
here rather than passing against dead code.
"""

from __future__ import annotations

from typing import Any

import pytest
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.http import (
    BULK_DELETE_MESSAGE,
    BULK_MESSAGE,
    CAPTURED_STATUS,
    DELETE_MESSAGE,
    DELETE_REPLACED_MESSAGE,
    SAVED_MESSAGE,
    signal_response,
    UPDATED_MESSAGE,
)


def _captured(**over: Any) -> ChangeRequestCreated:
    kwargs: dict[str, Any] = {
        "change_request_id": 5,
        "asset_type": "dashboard",
        "asset_id": 3,
    }
    kwargs.update(over)
    return ChangeRequestCreated(**kwargs)


@pytest.mark.parametrize(
    "signal,expected",
    [
        (_captured(), SAVED_MESSAGE),
        (_captured(updated_existing=True), UPDATED_MESSAGE),
        (_captured(operation="delete"), DELETE_MESSAGE),
        (
            _captured(operation="delete", replaced_edit=True),
            DELETE_REPLACED_MESSAGE,
        ),
        (
            _captured(count=3, change_request_ids=[5, 6, 7]),
            BULK_MESSAGE % 3,
        ),
        (
            _captured(count=3, change_request_ids=[5, 6, 7], operation="delete"),
            BULK_DELETE_MESSAGE % 3,
        ),
    ],
)
def test_the_live_path_produces_each_message(
    signal: ChangeRequestCreated, expected: str
) -> None:
    body, status = signal_response(signal)

    assert body["message"] == expected
    assert status == CAPTURED_STATUS
    assert body["review_required"] is True


def test_a_second_save_does_not_read_as_a_new_draft() -> None:
    """QA-11: "Changes saved" twice leaves the author hunting for two."""
    body, _ = signal_response(_captured(updated_existing=True))

    assert body["message"] != SAVED_MESSAGE
    assert "existing draft" in body["message"]


def test_no_message_constant_is_unreachable() -> None:
    """The invariant the split had broken: nothing is written and orphaned."""
    reachable = {
        signal_response(signal)[0]["message"]
        for signal in (
            _captured(),
            _captured(updated_existing=True),
            _captured(operation="delete"),
            _captured(operation="delete", replaced_edit=True),
            _captured(count=3, change_request_ids=[5, 6, 7]),
            _captured(count=3, change_request_ids=[5, 6, 7], operation="delete"),
        )
    }

    assert reachable == {
        SAVED_MESSAGE,
        UPDATED_MESSAGE,
        DELETE_MESSAGE,
        DELETE_REPLACED_MESSAGE,
        BULK_MESSAGE % 3,
        BULK_DELETE_MESSAGE % 3,
    }
