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
"""The Approvals list reads one page, and the filters go with it.

The endpoint read every request on the instance and serialized all of them,
and the browser then filtered the result. Serializing diffs each request
against its asset, so the cost grew with the instance rather than with the
page: about 1.3s of API and 7.3s of page at a hundred requests (R5-04).

Two things have to stay true while it is paged.

``count`` is every row the reader may see, not the length of the page, so
the list can say "1-25 of 90" and page at all.

The filters are applied by the server. Narrowing the rows the browser
happens to be holding answers a different question from the one the filter
appears to ask: a match on page four would simply not be found. The From
filter's options are collected before the filters narrow anything, so it
still offers an author whose rows are not on this page.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api as cm_api
from asset_approval.models import ChangeRequest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

READER_ID = 1
ONE_AUTHOR = 2
ANOTHER_AUTHOR = 3

TITLES = {
    1: "Alpha revenue",
    2: "Beta revenue",
    3: "Gamma ops",
    4: "Delta ops",
    5: "Epsilon ops",
}


@pytest.fixture
def requests(mocker: MockerFixture, session: Session) -> Session:
    ChangeRequest.__table__.create(session.get_bind())
    for pk in sorted(TITLES):
        session.add(
            ChangeRequest(
                id=pk,
                asset_type="dashboard" if pk % 2 else "chart",
                asset_id=pk,
                operation="update",
                status="pending",
                active_slot=1,
                author_fk=ONE_AUTHOR if pk <= 3 else ANOTHER_AUTHOR,
                payload=ChangeRequest.serialize_payload({"dashboard_title": "t"}),
            )
        )
    session.flush()

    mocker.patch.object(cm_api, "is_enabled", return_value=True)
    mocker.patch.object(
        cm_api,
        "load_asset",
        side_effect=lambda kind, asset_id, include_deleted=False: SimpleNamespace(
            id=asset_id, dashboard_title=TITLES[asset_id]
        ),
    )
    mocker.patch.object(cm_api, "is_strict_editor", return_value=True)
    mocker.patch.object(cm_api, "can_approve", return_value=True)
    mocker.patch.object(
        cm_api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    mocker.patch.object(cm_api, "eligible_approvers", return_value=[])
    mocker.patch.object(cm_api, "get_user_id", return_value=READER_ID)
    # The real one names the users in one query. Answering with the ids keeps
    # this about *which* authors were collected.
    mocker.patch.object(
        cm_api, "_authors_named", side_effect=lambda ids: sorted(ids)
    )
    return session


def _get(client: Any, query: str = "") -> Any:
    response = client.get(f"/api/v1/change_request/?show=all_pending{query}")
    assert response.status_code == 200
    return response.json


def _ids(payload: Any) -> list[int]:
    return [row["id"] for row in payload["result"]]


def test_a_page_holds_only_what_was_asked_for(
    client: Any, full_api_access: None, requests: Session
) -> None:
    payload = _get(client, "&page=0&page_size=2")

    assert len(payload["result"]) == 2
    assert payload["page"] == 0
    assert payload["page_size"] == 2


def test_the_count_is_every_visible_row_not_the_page(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Without this the list cannot say how much there is to page through."""
    payload = _get(client, "&page=0&page_size=2")

    assert payload["count"] == len(TITLES)


def test_the_pages_together_are_the_whole_view_with_nothing_repeated(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """What an unordered query cost: rows could repeat or go missing."""
    seen = [
        pk
        for page in range(3)
        for pk in _ids(_get(client, f"&page={page}&page_size=2"))
    ]

    assert sorted(seen) == sorted(TITLES)
    assert len(set(seen)) == len(seen)


def test_a_page_past_the_end_is_empty_rather_than_an_error(
    client: Any, full_api_access: None, requests: Session
) -> None:
    payload = _get(client, "&page=9&page_size=2")

    assert payload["result"] == []
    assert payload["count"] == len(TITLES)


def test_an_unreadable_page_falls_back_to_the_first(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """This endpoint feeds the bell, so a bad query string must not empty it."""
    payload = _get(client, "&page=nonsense&page_size=also-nonsense")

    assert payload["page"] == 0
    assert payload["page_size"] == cm_api.DEFAULT_PAGE_SIZE
    assert payload["count"] == len(TITLES)


def test_a_page_size_cannot_be_used_to_ask_for_everything(
    client: Any, full_api_access: None, requests: Session
) -> None:
    payload = _get(client, "&page_size=100000")

    assert payload["page_size"] == cm_api.MAX_PAGE_SIZE


def test_the_name_filter_is_applied_by_the_server(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Against the asset's title, which lives on the asset, not the request."""
    payload = _get(client, "&name=revenue")

    assert sorted(_ids(payload)) == [1, 2]
    assert payload["count"] == 2


def test_the_name_filter_ignores_case(
    client: Any, full_api_access: None, requests: Session
) -> None:
    assert sorted(_ids(_get(client, "&name=ALPHA"))) == [1]


def test_the_type_filter_is_applied_by_the_server(
    client: Any, full_api_access: None, requests: Session
) -> None:
    payload = _get(client, "&asset_type=chart")

    assert sorted(_ids(payload)) == [2, 4]


def test_the_author_filter_is_applied_by_the_server(
    client: Any, full_api_access: None, requests: Session
) -> None:
    payload = _get(client, f"&author={ANOTHER_AUTHOR}")

    assert sorted(_ids(payload)) == [4, 5]


def test_the_filters_narrow_the_count_too(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Or the list would offer pages that are not there."""
    payload = _get(client, "&name=ops&page_size=2")

    assert payload["count"] == 3
    assert len(payload["result"]) == 2


def test_the_author_options_are_the_whole_view_not_the_page(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """The From filter used to be built from the rows the browser held."""
    payload = _get(client, "&page=0&page_size=1")

    assert payload["authors"] == [ONE_AUTHOR, ANOTHER_AUTHOR]


def test_the_author_options_survive_a_filter_that_excludes_them(
    client: Any, full_api_access: None, requests: Session
) -> None:
    """Otherwise choosing an author would remove every other author from the
    list of authors you could choose, and there would be no way back."""
    payload = _get(client, f"&author={ONE_AUTHOR}")

    assert payload["authors"] == [ONE_AUTHOR, ANOTHER_AUTHOR]
