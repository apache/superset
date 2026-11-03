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
"""A change sent back to its author appears in the view they open.

``for_me`` filtered on ``status == PENDING``, so a CHANGES_REQUESTED row
could never be in it, and the Approvals page opens on ``for_me``. The bell
counts returned changes, though, so an author saw a badge of 1, clicked
"View all approvals", and was told "Nothing needs you right now"
(sc-131033). Mock 16c asks for the Approvals count to match the bell, which
it could not while this view dropped half of what the bell counts.

The row was never unreachable: ``submitted_by_me`` returned it, labelled
"Returned to you". Nothing steered the author there.

These are backend tests on purpose. The frontend already had a passing test
called "a change sent back to its author reads as returned", but it handed
the row straight to the component, so it proved the label renders and never
asked which view returns the row. That is why this shipped.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api as cm_api
from asset_approval.models import ChangeRequest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

AUTHOR = 2
SOMEBODY_ELSE = 3
REVIEWER = 4

# id, author, status
ROWS = (
    (1, SOMEBODY_ELSE, "pending"),          # waiting on AUTHOR as approver
    (2, AUTHOR, "changes_requested"),       # sent back to AUTHOR
    (3, AUTHOR, "pending"),                 # AUTHOR's own, waiting on others
    (4, AUTHOR, "draft"),                   # not submitted at all
    (5, SOMEBODY_ELSE, "changes_requested"),  # sent back to somebody else
)


@pytest.fixture
def requests(mocker: MockerFixture, session: Session) -> Session:
    ChangeRequest.__table__.create(session.get_bind())
    for pk, author, status in ROWS:
        session.add(
            ChangeRequest(
                id=pk,
                asset_type="dashboard",
                asset_id=pk,
                operation="update",
                status=status,
                active_slot=1 if status != "approved" else None,
                author_fk=author,
                payload=ChangeRequest.serialize_payload({"dashboard_title": "t"}),
            )
        )
    session.flush()

    mocker.patch.object(cm_api, "is_enabled", return_value=True)
    mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: SimpleNamespace(
            id=asset_id, dashboard_title=f"Asset {asset_id}"
        ),
    )
    mocker.patch.object(cm_api, "is_strict_editor", return_value=True)
    # The real rule, which is the point: you can never approve your own.
    mocker.patch.object(
        cm_api,
        "can_approve",
        side_effect=lambda cr, asset, user_id: cr.author_fk != user_id,
    )
    mocker.patch.object(
        cm_api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    mocker.patch.object(cm_api, "eligible_approvers", return_value=[])
    mocker.patch.object(cm_api, "_authors_named", side_effect=lambda ids: [])
    mocker.patch.object(cm_api, "get_user_id", return_value=AUTHOR)
    return session


def _view(client: Any, show: str) -> Any:
    response = client.get(f"/api/v1/change_request/?show={show}")
    assert response.status_code == 200
    return response.json


def _ids(payload: Any) -> list[int]:
    return sorted(row["id"] for row in payload["result"])


def test_the_default_view_carries_the_change_sent_back_to_me(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """The bug. Row 2 is the author's returned change."""
    assert 2 in _ids(_view(client, "for_me"))


def test_it_still_carries_the_reviews_waiting_on_me(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Widening the filter must not have cost the view its original job."""
    assert 1 in _ids(_view(client, "for_me"))


def test_my_own_submitted_change_is_still_not_mine_to_action(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Decision 9 holds for everything except the returned case: a request
    you submitted and that is still pending is waiting on somebody else."""
    ids = _ids(_view(client, "for_me"))

    assert 3 not in ids
    assert 4 not in ids


def test_somebody_elses_returned_change_is_not_my_problem(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """It is waiting on its own author, and I cannot approve it either."""
    assert 5 not in _ids(_view(client, "for_me"))


def test_the_view_is_exactly_the_two_things_that_need_me(
    client: Any, full_api_access: None, requests: Session
) -> None:
    assert _ids(_view(client, "for_me")) == [1, 2]


def test_the_count_matches_what_the_bell_counts(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Mock 16c: the Approvals count matches the bell.

    Both endpoints are asked, rather than a literal being asserted against
    one of them. The literal version of this test could not have failed for
    the thing it is named after, since the drift it guards is between the
    two numbers.
    """
    page = _view(client, "for_me")["count"]

    counted = client.get("/api/v1/change_request/count")
    assert counted.status_code == 200
    bell = counted.json["result"]

    assert page == bell["needs_me"] + bell["returned"]


def test_the_two_numbers_are_the_two_kinds_of_work(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """And that the parity above is not two zeros agreeing."""
    bell = client.get("/api/v1/change_request/count").json["result"]

    assert bell == {"needs_me": 1, "returned": 1}


def test_submitted_by_me_is_unchanged(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """It already returned the row and is still where the author's work in
    flight lives, so the fix must not have moved anything out of it."""
    assert _ids(_view(client, "submitted_by_me")) == [2, 3, 4]


def test_all_pending_is_unchanged(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """A returned change is not awaiting review, so it does not belong here."""
    assert _ids(_view(client, "all_pending")) == [1, 3]
