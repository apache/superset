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
        cm_api,
        "load_asset",
        # The real one takes include_deleted, which every read path now
        # passes so a restore can see its archived asset (R3-01).
        side_effect=lambda kind, asset_id, include_deleted=False: MagicMock(
            id=asset_id
        ),
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


# ---- the two routes a viewer's ordinary pages call -------------------------
#
# Neither had a test of its audience. Both are reached on every dashboard and
# chart list load, by everyone, because the list pages call them before
# knowing who is looking -- so what they answer a viewer is the question, and
# `grep` found nothing touching either through the API.


def test_open_changes_tells_a_non_editor_nothing(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """The map the list pages tag their rows from. Keyed by asset, so a
    single leaked entry tells a viewer that a particular dashboard has a
    change pending -- which is the one fact SOW 5.5 keeps from them."""
    _as(mocker, VIEWER_ID)

    response = client.get("/api/v1/change_request/open/dashboard")

    assert response.status_code == 200
    assert response.json["result"] == {}


def test_open_changes_tells_an_editor_about_their_own_assets(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    _as(mocker, EDITOR_ID)

    response = client.get("/api/v1/change_request/open/dashboard")

    assert response.json["result"] == {"1": "pending"}


def test_open_changes_is_scoped_per_asset_not_per_type(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """The author edits both; the other editor edits only asset 1. Editorship
    of one asset must not reveal a change on another."""
    _as(mocker, AUTHOR_ID)

    assert client.get("/api/v1/change_request/open/dashboard").json["result"] == {
        "1": "pending",
        "2": "pending",
    }


def test_open_changes_is_empty_with_review_off(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    mocker.patch.object(cm_api, "is_enabled", return_value=False)
    _as(mocker, AUTHOR_ID)

    assert client.get("/api/v1/change_request/open/dashboard").json["result"] == {}


def test_open_changes_refuses_an_asset_kind_it_does_not_know(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    _as(mocker, AUTHOR_ID)

    assert (
        client.get("/api/v1/change_request/open/wombat").status_code == 400
    )


def test_the_governed_lookup_discloses_nothing_about_an_asset(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """It answers any caller about any id, and that is deliberate: an id the
    caller may not read comes back ``true``, the same answer a governed asset
    gives, so the reply cannot be used to tell the two apart or to discover
    that an asset exists.

    Pinned because the alternative -- 404 or a missing key for an
    unreadable id -- would turn the delete dialog's copy helper into an
    existence oracle on every list page load.
    """
    _as(mocker, VIEWER_ID)
    # The predicate reads the flag through its own module, not through this
    # one, so the route's guard being on is not enough to drive it.
    mocker.patch("asset_approval.bindings.is_enabled", return_value=True)
    # Asset 1 loads; 999999 does not, which is what "an id the caller may
    # not read" looks like from here -- the loader applies the host's own
    # access rules, so an asset they cannot see is indistinguishable from one
    # that is not there.
    mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: (
            None if asset_id == 999999 else MagicMock(id=asset_id, published=True)
        ),
    )

    response = client.get(
        "/api/v1/change_request/governed/dashboard?ids=1,999999"
    )

    assert response.status_code == 200
    # Both answer the same, so the reply cannot be read as "this exists" or
    # "you may not see this". The alternative -- a 404, or a missing key --
    # would make the delete dialog's copy helper an existence oracle on
    # every list page load.
    assert response.json["result"] == {"1": True, "999999": True}


def test_the_governed_lookup_answers_nothing_with_review_off(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """Off, every delete is an ordinary delete and the copy needs no
    lookup."""
    mocker.patch.object(cm_api, "is_enabled", return_value=False)
    _as(mocker, AUTHOR_ID)

    response = client.get("/api/v1/change_request/governed/dashboard?ids=1")

    assert response.json["result"] == {}


# ---- the asset is loaded where entitlement needs it, and not otherwise -----
#
# These two views span an instance's whole history, and the list loaded the
# asset and asked `can_approve` for every row in them before paging: 774
# asset loads to serve a page of 25, measured at 1.9s against 35ms for
# `for_me` (R5-04). An author's own row is admitted by `_may_see` without
# the asset, so it does not need one unless it is on the page.
#
# The rule is per ROW, not per view, and a first attempt at per-view broke
# the test below. `recently_decided` also admits on `reviewer_fk`, which is
# not one of `_may_see`'s grounds: a past reviewer who has since lost edit
# access must stop seeing the row, and only the asset can say so.


def test_an_authors_own_history_does_not_load_an_asset_per_row(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    loads = mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: MagicMock(
            id=asset_id
        ),
    )
    _as(mocker, AUTHOR_ID)

    response = client.get("/api/v1/change_request/?show=submitted_by_me&page_size=1")

    assert response.status_code == 200
    # Three rows are the author's; one page of one is asked for. Only that
    # row's asset is needed.
    assert response.json["count"] == 3
    assert loads.call_count == 1, (
        "an asset was loaded for a row the page never serialized"
    )


def test_but_a_past_reviewer_still_has_their_entitlement_checked(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """The case the per-view shortcut got wrong.

    The viewer is recorded as the reviewer of request 3, so the view's SQL
    admits them. They are not its author and not an editor of the asset, so
    `_may_see` must exclude them -- and that answer needs the asset.
    """
    loads = mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: MagicMock(
            id=asset_id
        ),
    )
    _as(mocker, VIEWER_ID)

    response = client.get("/api/v1/change_request/?show=recently_decided")

    assert response.json["result"] == []
    assert loads.call_count >= 1, (
        "entitlement was assumed from the query, so a former reviewer kept "
        "seeing a decided row on an asset they no longer edit"
    )


def test_a_name_search_still_reads_every_rows_title(
    mocker: MockerFixture, client: Any, full_api_access: None, requests: Session
) -> None:
    """The filter reads the asset's title, so it needs the asset even for a
    row the page will not show."""
    loads = mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: MagicMock(
            id=asset_id
        ),
    )
    _as(mocker, AUTHOR_ID)

    client.get("/api/v1/change_request/?show=submitted_by_me&page_size=1&name=zzz")

    assert loads.call_count == 3
