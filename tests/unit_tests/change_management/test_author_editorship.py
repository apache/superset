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
"""An approval re-checks the author, not only the approver (QA-07).

The replay runs the author's command as the author, so the host's own
``raise_for_editorship`` re-checks them. Two things were wrong with leaving
it at that. The refusal came back as the command's own "You don't have the
rights to alter ...", addressed to the approver -- who does have the rights
and cannot tell from the message what is wrong. And that check treats an
administrator as an editor of everything, so an admin author removed from
an asset was replayed anyway.

``is_strict_editor`` has no administrator shortcut, which is why the check
here is on it and not on the host's.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle
from asset_approval.exceptions import AuthorNoLongerEditorError
from asset_approval.models import ChangeStatus
from pytest_mock import MockerFixture


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method the test does not exercise."""


@pytest.fixture
def approval(mocker: MockerFixture) -> dict[str, Any]:
    """``approve`` with every check before the author's one satisfied."""
    author = SimpleNamespace(
        id=7, username="alex", first_name="Alex", last_name="Diaz"
    )
    request = SimpleNamespace(
        id=1,
        author=author,
        author_fk=7,
        asset_type="chart",
        asset_id=42,
        status=ChangeStatus.PENDING.value,
        base_dict={},
        # Every real request carries these; a restore is identified by
        # the command it stores rather than by its operation (R3-01).
        command_args={},
        note=None,
        set_status=_ignore,
    )
    asset = SimpleNamespace(id=42)

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=9)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle, "_now", return_value=None)
    mocker.patch.object(lifecycle.db.session, "add", _ignore)
    applied = mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    return {"request": request, "asset": asset, "applied": applied}


def test_an_author_who_is_still_an_editor_is_approved(
    approval: dict[str, Any], mocker: MockerFixture
) -> None:
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)

    assert lifecycle.approve(1) == "applied"
    approval["applied"].assert_called_once()


def test_an_author_who_lost_edit_access_is_refused(
    approval: dict[str, Any], mocker: MockerFixture
) -> None:
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=False)

    with pytest.raises(AuthorNoLongerEditorError):
        lifecycle.approve(1)


def test_nothing_is_replayed_when_the_author_is_refused(
    approval: dict[str, Any], mocker: MockerFixture
) -> None:
    # The point of checking here rather than letting the replay fail: the
    # command never runs, so there is nothing half-applied to roll back.
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=False)

    with pytest.raises(AuthorNoLongerEditorError):
        lifecycle.approve(1)
    approval["applied"].assert_not_called()


def test_the_check_is_on_the_author_not_the_approver(
    approval: dict[str, Any], mocker: MockerFixture
) -> None:
    strict = mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)

    lifecycle.approve(1)

    # author_fk, never the approver's id (9).
    assert strict.call_args.args[1] == 7


def test_the_refusal_names_the_author_and_what_to_do(
    approval: dict[str, Any], mocker: MockerFixture
) -> None:
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=False)

    with pytest.raises(AuthorNoLongerEditorError) as caught:
        lifecycle.approve(1)

    message = str(caught.value)
    assert "Alex Diaz" in message
    assert "edit access" in message
    # The approver is told what they can do about it, not just refused.
    assert "Discard" in message


def test_the_refusal_is_a_conflict_not_a_server_error() -> None:
    # It reached the approver as a 500 before, because the host's own
    # permission error is not a ChangeManagementException and nothing in
    # the API caught it.
    assert AuthorNoLongerEditorError.status == 409


def test_the_refusal_reads_without_a_name() -> None:
    assert "The author no longer has" in str(AuthorNoLongerEditorError(None))
