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
"""A viewer holds the route permissions and can still do nothing (S-08).

Gamma gets `can_read` and `can_write` on ChangeRequest from the security
manager's denylist, so the route permission is not what keeps a viewer out.
That is deliberate: Gamma also holds `can_write` on Dashboard and Chart on a
stock install, so a Gamma user authors governed writes, and taking the route
permission away would leave their own change request unreadable,
unsubmittable and unwithdrawable.

What keeps them out is the row-level check every action makes for itself.
Reads are covered in ``test_api_visibility``; the five writes are covered
here, because nothing else in the suite exercises them from the point of
view of someone with no say over the asset -- and because
``conftest.full_api_access`` answers every route permission with ``True``,
so no test in the suite can tell a route permission apart from an authorized
one.

Viewers see no workflow UI at all (SOW 5.5, Visa Q6). This is what happens
when one reaches the API anyway.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import lifecycle
from asset_approval.exceptions import ApprovalForbiddenError
from asset_approval.models import ChangeStatus
from pytest_mock import MockerFixture

AUTHOR_ID = 3
VIEWER_ID = 9


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method these tests do not exercise."""


@pytest.fixture
def viewer(mocker: MockerFixture) -> Any:
    """A pending request on an asset the acting user has no say over.

    Every check before the authorization one is satisfied, so a refusal here
    can only be the authorization.
    """
    request = SimpleNamespace(
        id=1,
        author_fk=AUTHOR_ID,
        asset_type="dashboard",
        asset_id=42,
        status=ChangeStatus.PENDING.value,
        is_open=True,
        base_dict={},
        command_args={},
        note=None,
    )
    # A real transition, so a test can tell "refused" from "went through".
    request.set_status = lambda status: setattr(request, "status", status.value)
    asset = SimpleNamespace(id=42)
    mocker.patch.object(lifecycle, "find", return_value=request)
    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "get_user_id", return_value=VIEWER_ID)
    # Not an editor of this asset, which is the whole of what makes them a
    # viewer. ``can_approve`` reads it, and so does ``discard``.
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=False)
    mocker.patch(
        "asset_approval.eligibility.is_strict_editor", return_value=False
    )
    mocker.patch(
        "asset_approval.eligibility.holds_approval_permission", return_value=True
    )
    mocker.patch(
        "asset_approval.eligibility.is_eligible_approver", return_value=True
    )
    mocker.patch(
        "asset_approval.eligibility.load_user",
        return_value=SimpleNamespace(id=VIEWER_ID, active=True, roles=[]),
    )
    mocker.patch(
        "asset_approval.eligibility.security_manager",
        SimpleNamespace(is_guest_user=lambda: False),
    )
    return request


@pytest.mark.parametrize(
    "action",
    [
        pytest.param(lambda: lifecycle.approve(1), id="approve"),
        pytest.param(
            lambda: lifecycle.request_changes(1, "please change this"),
            id="request_changes",
        ),
        pytest.param(lambda: lifecycle.withdraw(1), id="withdraw"),
        pytest.param(lambda: lifecycle.discard(1), id="discard"),
        pytest.param(lambda: lifecycle.submit(1), id="submit"),
    ],
)
def test_every_write_refuses_someone_with_no_say_over_the_asset(
    viewer: Any, action: Any
) -> None:
    with pytest.raises(ApprovalForbiddenError):
        action()

    # Refused before anything was written, not after.
    assert viewer.status == ChangeStatus.PENDING.value


def test_the_refusal_does_not_leak_the_requests_state(
    mocker: MockerFixture, viewer: Any
) -> None:
    """Authorization is answered before the transition is.

    Otherwise someone with no say over the asset could probe whether a
    request exists, and what state it is in, from which refusal they got.
    """
    viewer.status = ChangeStatus.APPROVED.value
    viewer.is_open = False

    with pytest.raises(ApprovalForbiddenError):
        lifecycle.approve(1)
    with pytest.raises(ApprovalForbiddenError):
        lifecycle.discard(1)


def test_the_author_is_not_locked_out_of_their_own_request(
    mocker: MockerFixture, viewer: Any
) -> None:
    """The control is editorship, not the route permission.

    A Gamma author is the reason Gamma keeps ``can_write`` on ChangeRequest.
    They are an editor of nothing by role, and they still have to be able to
    take their own change back -- which is what a least-privilege change to
    the route permission would have broken.
    """
    mocker.patch.object(lifecycle, "get_user_id", return_value=AUTHOR_ID)
    mocker.patch.object(lifecycle, "db", SimpleNamespace(session=MagicMock()))

    lifecycle.withdraw(1)

    assert viewer.status == ChangeStatus.DRAFT.value
