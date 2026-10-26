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
"""Change requests are only listed to their author and the asset's editors.

``can_read`` on ChangeRequest is a route permission; it must not let anyone
holding it read other people's pending work on assets they have no say over.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval import api as cm_api
from asset_approval.models import ChangeRequest

VIEWER_ID = 9
EDITOR_ID = 2
AUTHOR_ID = 3

#: asset id -> users who are strict editors of it
EDITORS = {1: {EDITOR_ID, AUTHOR_ID}, 2: {AUTHOR_ID}, 3: {AUTHOR_ID}}


@pytest.fixture
def requests(mocker: MockerFixture, session: Session) -> Session:
    ChangeRequest.__table__.create(session.get_bind())
    for pk, asset_id, status in (
        (1, 1, "pending"),
        (2, 2, "pending"),
        (3, 3, "approved"),
    ):
        session.add(
            ChangeRequest(
                id=pk,
                asset_type="dashboard",
                asset_id=asset_id,
                operation="update",
                status=status,
                active_slot=1 if status == "pending" else None,
                author_fk=AUTHOR_ID,
                reviewer_fk=VIEWER_ID if status == "approved" else None,
                payload=ChangeRequest.serialize_payload({"dashboard_title": "t"}),
            )
        )
    session.flush()

    mocker.patch.object(cm_api, "is_enabled", return_value=True)
    mocker.patch.object(
        cm_api, "load_asset", side_effect=lambda kind, asset_id: MagicMock(id=asset_id)
    )
    mocker.patch.object(
        cm_api,
        "is_strict_editor",
        side_effect=lambda asset, user_id: user_id in EDITORS[asset.id],
    )
    mocker.patch.object(
        cm_api,
        "can_approve",
        side_effect=lambda cr, asset, user_id: user_id != cr.author_fk
        and user_id in EDITORS[asset.id],
    )
    mocker.patch.object(
        cm_api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    mocker.patch.object(cm_api, "eligible_approvers", return_value=[])
    return session


def _as(mocker: MockerFixture, user_id: int) -> None:
    mocker.patch.object(cm_api, "get_user_id", return_value=user_id)


def _ids(client: Any, show: str) -> list[int]:
    response = client.get(f"/api/v1/change_request/?show={show}")
    assert response.status_code == 200
    return sorted(row["id"] for row in response.json["result"])


def test_all_pending_hidden_from_non_editor(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    _as(mocker, VIEWER_ID)
    assert _ids(client, "all_pending") == []


def test_all_pending_scoped_to_editorship(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    _as(mocker, EDITOR_ID)
    assert _ids(client, "all_pending") == [1]

    _as(mocker, AUTHOR_ID)
    assert _ids(client, "all_pending") == [1, 2]


def test_recently_decided_requires_continued_entitlement(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """A former reviewer who is no longer an editor no longer sees the row."""
    _as(mocker, VIEWER_ID)
    assert _ids(client, "recently_decided") == []

    _as(mocker, AUTHOR_ID)
    assert _ids(client, "recently_decided") == [3]


def test_detail_forbidden_to_non_editor(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    _as(mocker, VIEWER_ID)
    assert client.get("/api/v1/change_request/1").status_code == 403

    _as(mocker, EDITOR_ID)
    assert client.get("/api/v1/change_request/1").status_code == 200


def test_count_only_counts_approvable(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    _as(mocker, VIEWER_ID)
    response = client.get("/api/v1/change_request/count")
    assert response.json["result"] == {"needs_me": 0, "returned": 0}

    _as(mocker, EDITOR_ID)
    response = client.get("/api/v1/change_request/count")
    assert response.json["result"]["needs_me"] == 1
