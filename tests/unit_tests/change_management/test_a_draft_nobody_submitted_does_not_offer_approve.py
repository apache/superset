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
"""QA-93: ``can_approve`` was answering a question nobody asked.

``eligibility.can_approve`` asks who may decide a change -- not the author,
a live human account, a second editor of the asset -- and says nothing about
whether there is a decision to make. The API served it verbatim. So a
co-editor opening an asset whose author had a draft they had never submitted
was handed ``can_approve: true`` beside ``review_blocked: null``, drew an
Approve from it, and got a 409 every time. An already-decided request read
the same way.

``serialize`` had already written down why that is not allowed, two fields
above the one that did it: "a button that can only fail is the same trap as
``can_approve`` was before QA-07." The route it arrives on is ``for_asset``,
which is the banner on the dashboard -- a reviewer's ordinary way to a
change, not an edge case.

The status is *not* folded into ``can_approve`` itself, and that is on
purpose: the reviewer actions authorize before they say anything about the
request's state, so that somebody with no say over an asset cannot read its
state off the refusal. A ``can_approve`` that knew the status would answer
"you cannot approve this change" to a reviewer whose author had just saved
over their page -- which is the other half of QA-93, pinned in
``test_a_reviewer_is_told_what_moved_and_not_the_status``. So the narrow
question is asked as two: ``in_review`` and then ``can_approve``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import api as cm_api
from asset_approval.eligibility import in_review
from asset_approval.models import ChangeRequest
from asset_approval.types import ChangeStatus
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

AUTHOR_ID = 3
#: A second editor of the asset: the person the Approve button is drawn for.
CO_EDITOR_ID = 2

#: asset id -> the request on it, and the status that request is in.
UNSUBMITTED = 11
IN_REVIEW = 12
DECIDED = 13


@pytest.fixture
def requests(mocker: MockerFixture, session: Session) -> Session:
    """One asset per status, each with a request by someone else's author."""
    ChangeRequest.__table__.create(session.get_bind())
    for pk, (asset_id, status) in enumerate(
        (
            (UNSUBMITTED, ChangeStatus.DRAFT),
            (IN_REVIEW, ChangeStatus.PENDING),
            (DECIDED, ChangeStatus.APPROVED),
        ),
        start=1,
    ):
        session.add(
            ChangeRequest(
                id=pk,
                asset_type="dashboard",
                asset_id=asset_id,
                operation="update",
                status=status.value,
                active_slot=1 if status is not ChangeStatus.APPROVED else None,
                author_fk=AUTHOR_ID,
                payload=ChangeRequest.serialize_payload(
                    {"dashboard_title": "Quarterly"}
                ),
                decided_at=datetime.now(timezone.utc)
                if status is ChangeStatus.APPROVED
                else None,
            )
        )
    session.flush()

    mocker.patch.object(cm_api, "is_enabled", return_value=True)
    mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: MagicMock(
            id=asset_id
        ),
    )
    # The co-editor really is an editor of every asset here, so editorship is
    # never what decides these answers.
    mocker.patch.object(cm_api, "is_strict_editor", return_value=True)
    mocker.patch.object(
        cm_api,
        "can_approve",
        side_effect=lambda cr, asset, user_id: user_id != cr.author_fk,
    )
    mocker.patch.object(
        cm_api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    mocker.patch.object(cm_api, "eligible_approvers", return_value=[])
    mocker.patch.object(cm_api, "get_user_id", return_value=CO_EDITOR_ID)
    return session


def _for_asset(client: Any, asset_id: int) -> dict[str, Any]:
    response = client.get(f"/api/v1/change_request/asset/dashboard/{asset_id}")
    assert response.status_code == 200
    return response.json["result"]


# ---- the banner on the asset, which is how a reviewer gets here -------------


def test_a_draft_nobody_submitted_offers_the_co_editor_nothing(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """The defect: this field was ``true`` and Approve 409'd every time."""
    assert _for_asset(client, UNSUBMITTED)["can_approve"] is False


def test_a_request_actually_in_review_still_offers_it(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """The control. The narrowing must not take away the real button."""
    assert _for_asset(client, IN_REVIEW)["can_approve"] is True


# ---- the request's own page -------------------------------------------------


def test_a_decided_request_offers_nothing_either(
    client: Any, full_api_access: None, requests: Session
) -> None:
    response = client.get("/api/v1/change_request/3")

    assert response.status_code == 200
    assert response.json["result"]["can_approve"] is False


def test_the_same_page_offers_it_while_the_request_is_in_review(
    client: Any, full_api_access: None, requests: Session
) -> None:
    response = client.get("/api/v1/change_request/2")

    assert response.status_code == 200
    assert response.json["result"]["can_approve"] is True


# ---- and the two questions it is made of ------------------------------------


@pytest.mark.parametrize(
    "status,waiting",
    [
        (ChangeStatus.DRAFT, False),
        (ChangeStatus.PENDING, True),
        (ChangeStatus.CHANGES_REQUESTED, False),
        (ChangeStatus.APPROVED, False),
        (ChangeStatus.DISCARDED, False),
    ],
)
def test_only_a_pending_request_is_waiting_on_a_reviewer(
    status: ChangeStatus, waiting: bool
) -> None:
    """``changes_requested`` is open, and still nobody's to decide."""
    assert in_review(SimpleNamespace(status=status.value)) is waiting


def test_the_standing_right_is_still_asked_separately(
    mocker: MockerFixture,
) -> None:
    """A reviewer's right does not depend on the status, and must not.

    Folding the two together is what would turn "the author saved over this
    while you were reading it" back into "you cannot approve this change".
    """
    may = mocker.patch.object(cm_api, "can_approve", return_value=False)
    request = SimpleNamespace(status=ChangeStatus.PENDING.value)

    assert cm_api._approvable_now(request, object(), 9) is False
    may.assert_called_once()


def test_a_request_nobody_may_decide_is_not_approvable_either(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(cm_api, "can_approve", return_value=True)
    draft = SimpleNamespace(status=ChangeStatus.DRAFT.value)

    assert cm_api._approvable_now(draft, object(), 9) is False
