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
"""QA-93: approving a delete made the decision unreadable to everyone.

Approving a delete soft-deletes the asset, which is the point. From that
moment ``_asset_of`` could not load it -- ``load_asset`` hides soft-deleted
rows -- and every read path drops a request whose asset will not load. So
``GET /change_request/<pk>`` answered 404 to the approver who had just
pressed the button and to the author, the row vanished from the lists, and
the approve response could not even name what it had deleted
(``asset_title: null``).

Nothing was lost: the asset is recoverable and the request row is intact.
There was simply no longer any way to reach either, so an approved delete
could not be walked back.

R3-01 is the same lookup and the same fix from the other end. It taught
``_asset_of`` to read past the visibility filter for a *restore*, whose
premise is an archived asset, and left the delete -- which arrives at that
same state by being approved -- behind.

The boundary this must not cross is the one R3-01 drew deliberately: an
ordinary edit whose asset was deleted out from under it really is dead, and
still answers 404.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api as cm_api
from asset_approval.gate import COMMAND_KEY, RESTORE_COMMAND
from asset_approval.models import ChangeRequest
from asset_approval.types import ChangeStatus
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

APPROVER_ID = 2
AUTHOR_ID = 3

ARCHIVED = SimpleNamespace(
    id=42,
    dashboard_title="Q3 Regional Rollup",
    deleted_at=datetime(2026, 11, 5, 9, 30),
)


def _request(
    operation: str = "delete",
    status: ChangeStatus = ChangeStatus.APPROVED,
    command_args: dict[str, Any] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=4,
        asset_type="dashboard",
        asset_id=42,
        operation=operation,
        status=status.value,
        is_open=status
        in {ChangeStatus.DRAFT, ChangeStatus.PENDING, ChangeStatus.CHANGES_REQUESTED},
        author_fk=AUTHOR_ID,
        base_dict={},
        command_args=command_args or {},
    )


@pytest.fixture
def trash(mocker: MockerFixture) -> None:
    """``load_asset``'s real behaviour in miniature: archived rows are hidden.

    The same shape ``test_restore_request_is_actionable`` uses on the DAO,
    one level up, because what is being asked here is which requests get to
    ask past the filter.
    """
    mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: (
            ARCHIVED if include_deleted else None
        ),
    )


# ---- which requests may see an archived asset -------------------------------


def test_an_approved_delete_can_still_find_what_it_deleted(trash: None) -> None:
    """The defect. This returned ``None``, and every read path dropped it."""
    assert cm_api._asset_of(_request()) is ARCHIVED


def test_a_delete_still_waiting_for_review_is_unaffected(trash: None) -> None:
    """Its asset is live, so the wider lookup is simply never needed."""
    assert cm_api._archived_is_normal(_request(status=ChangeStatus.PENDING)) is True


def test_a_restore_still_sees_its_archived_asset(trash: None) -> None:
    """R3-01, which this generalises rather than replaces."""
    restore = _request(
        operation="update", command_args={COMMAND_KEY: RESTORE_COMMAND}
    )

    assert cm_api._asset_of(restore) is ARCHIVED


def test_an_ordinary_edit_whose_asset_is_gone_is_still_dead(trash: None) -> None:
    """The boundary. An edit cannot be approved onto something in the trash,
    so widening this one too would resurrect the bug R3-01's narrowness
    prevents."""
    assert cm_api._archived_is_normal(_request(operation="update")) is False
    assert cm_api._asset_of(_request(operation="update")) is None


# ---- what the approver and the author can read afterwards -------------------


@pytest.fixture
def decided(mocker: MockerFixture, session: Session, trash: None) -> Session:
    """One approved delete, on an asset that is now in the trash."""
    ChangeRequest.__table__.create(session.get_bind())
    session.add(
        ChangeRequest(
            id=4,
            asset_type="dashboard",
            asset_id=42,
            operation="delete",
            status=ChangeStatus.APPROVED.value,
            active_slot=None,
            author_fk=AUTHOR_ID,
            reviewer_fk=APPROVER_ID,
            decided_at=datetime.now(timezone.utc),
            payload=ChangeRequest.serialize_payload({}),
        )
    )
    session.flush()

    mocker.patch.object(cm_api, "is_enabled", return_value=True)
    mocker.patch.object(cm_api, "is_strict_editor", return_value=True)
    mocker.patch.object(cm_api, "can_approve", return_value=False)
    mocker.patch.object(cm_api, "eligible_approvers", return_value=[])
    mocker.patch.object(cm_api, "get_user_id", return_value=APPROVER_ID)
    # As the other API-visibility tests do: the request's own fields are not
    # what is in question here, and the real one reaches for ``ab_user``.
    mocker.patch.object(
        cm_api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    return session


def test_the_approver_can_still_open_the_decision(
    client: Any, full_api_access: None, decided: Session
) -> None:
    """The defect as the retest found it: a 404 to whoever pressed Approve."""
    response = client.get("/api/v1/change_request/4")

    assert response.status_code == 200
    assert response.json["result"]["id"] == 4


def test_the_decision_still_appears_in_what_was_recently_decided(
    client: Any, full_api_access: None, decided: Session
) -> None:
    response = client.get("/api/v1/change_request/?show=recently_decided")

    assert response.status_code == 200
    assert [row["id"] for row in response.json["result"]] == [4]


def test_the_author_can_still_open_it_too(
    client: Any, full_api_access: None, decided: Session, mocker: MockerFixture
) -> None:
    mocker.patch.object(cm_api, "get_user_id", return_value=AUTHOR_ID)

    assert client.get("/api/v1/change_request/4").status_code == 200


# ---- and it can say what it deleted -----------------------------------------


def _approved_delete() -> ChangeRequest:
    """The row as it stands after the delete was approved."""
    return ChangeRequest(
        id=4,
        asset_type="dashboard",
        asset_id=42,
        operation="delete",
        status=ChangeStatus.APPROVED.value,
        author_fk=AUTHOR_ID,
        reviewer_fk=APPROVER_ID,
        payload=ChangeRequest.serialize_payload({}),
    )


def test_the_confirmation_names_the_asset_it_deleted(trash: None) -> None:
    """``asset_title: null`` was the other half: nothing to render.

    ``_act`` reloads the request through ``_asset_of`` to build the response,
    so the approval of a delete answered without a title.
    """
    request = _approved_delete()

    payload = cm_api.serialize(request, cm_api._asset_of(request))

    assert payload["asset_title"] == "Q3 Regional Rollup"


def test_it_says_the_asset_is_in_the_trash(trash: None) -> None:
    """Which is the signal a client needs to offer a way back rather than a
    link to a page that no longer renders."""
    request = _approved_delete()

    payload = cm_api.serialize(request, cm_api._asset_of(request))

    assert payload["asset_archived"] is True
