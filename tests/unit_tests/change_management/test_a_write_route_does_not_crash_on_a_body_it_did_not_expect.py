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
"""The three write routes, driven with bodies they were not written for.

A test leak, found by a sweep of this suite. ``submit``, ``approve`` and
``request_changes`` read their optional fields off the JSON body with
``request.get_json(silent=True) or {}``. ``silent`` suppresses the parse
*error*, not the parsed *type*: a JSON array, string or number parses
perfectly and is truthy, so the ``or {}`` never fired and ``body.get(...)``
raised ``AttributeError``. All three answered ``500 Fatal error``.

Two things made it worse than a crash. It was reachable by any authenticated
caller, including a plain viewer, because the crash landed before both the
404 and the authorization check -- so a 500 was the one answer a viewer could
provoke on a request every other route refuses to tell them about. And the
note fields went the same way: a non-string either reached ``.strip()`` and
raised, or was coerced by the database into something nobody wrote, so a
JSON array arrived in the audit record as the Postgres array literal
``{1,2}``.

Nothing in this suite posted a body to any of these routes. The whole
directory held three route-level write calls, all ``json={}``. The nearest
thing was a test asserting that a viewer is refused every one of these
actions -- but it called ``lifecycle.*`` directly with correct argument
types, and production crashes in the route layer before ``lifecycle`` is
entered, so the viewer's real request never reached the refusal it asserts.
"""

from __future__ import annotations

from typing import Any

import pytest
from asset_approval import api
from asset_approval.models import ChangeRequest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

#: Bodies that are valid JSON and are not objects. Each parses, each is
#: truthy, and each used to crash the route it was sent to.
NOT_AN_OBJECT = [[1, 2, 3], "hi", 5, True]

ROUTES = ["submit", "approve", "request_changes"]


@pytest.fixture
def pending(mocker: MockerFixture, session: Session) -> Any:
    """One submitted request, with the route's collaborators stubbed.

    The lifecycle itself is replaced: what it does is covered elsewhere, and
    what is under test here is whether the route reaches it at all.
    """
    ChangeRequest.__table__.create(session.get_bind())
    row = ChangeRequest(
        id=9,
        asset_type="chart",
        asset_id=42,
        operation="update",
        status="pending",
        active_slot=1,
        author_fk=7,
        payload=ChangeRequest.serialize_payload({"slice_name": "Revenue"}, {}),
    )
    session.add(row)
    session.flush()

    mocker.patch.object(api, "can_approve", return_value=True)
    mocker.patch.object(api, "get_user_id", return_value=1)
    mocker.patch.object(
        api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    # The route reloads the asset to answer with; a unit test has no
    # ``slices`` table, and what it answers with is not what is under test.
    mocker.patch.object(
        api, "load_asset", return_value=SimpleNamespaceLike(id=42, slice_name="R")
    )
    return SimpleNamespaceLike(
        pk=row.id,
        submit=mocker.patch.object(api.lifecycle, "submit"),
        approve=mocker.patch.object(api.lifecycle, "approve"),
        request_changes=mocker.patch.object(api.lifecycle, "request_changes"),
    )


class SimpleNamespaceLike:
    def __init__(self, **kwargs: Any) -> None:
        self.__dict__.update(kwargs)


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("body", NOT_AN_OBJECT)
def test_a_body_that_is_not_an_object_does_not_crash_the_route(
    client: Any, full_api_access: None, pending: Any, route: str, body: Any
) -> None:
    """Whatever else it answers, it does not answer 500."""
    response = client.post(
        f"/api/v1/change_request/{pending.pk}/{route}", json=body
    )

    assert response.status_code != 500, (route, body, response.json)


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("body", NOT_AN_OBJECT)
def test_and_is_read_as_no_body_at_all(
    client: Any, full_api_access: None, pending: Any, route: str, body: Any
) -> None:
    """Which is the answer it already had for a client that sends nothing.

    Asserted against the empty-object answer rather than a status code
    written in here, so this keeps holding if those routes' normal answers
    change.
    """
    empty = client.post(f"/api/v1/change_request/{pending.pk}/{route}", json={})
    sent = client.post(f"/api/v1/change_request/{pending.pk}/{route}", json=body)

    assert sent.status_code == empty.status_code, (route, body)


def test_a_note_that_is_not_text_is_not_stored_as_a_note(
    client: Any, full_api_access: None, pending: Any
) -> None:
    """It reaches the lifecycle as absent, not as a coerced value.

    Passed through, a list became ``{1,2}`` in the note a reviewer later
    reads -- a value nobody typed, in an audit field.
    """
    client.post(
        f"/api/v1/change_request/{pending.pk}/submit", json={"note": [1, 2]}
    )

    pending.submit.assert_called_once()
    assert pending.submit.call_args.kwargs["note"] is None


def test_a_real_note_still_gets_through(
    client: Any, full_api_access: None, pending: Any
) -> None:
    client.post(
        f"/api/v1/change_request/{pending.pk}/submit", json={"note": "Renamed it."}
    )

    assert pending.submit.call_args.kwargs["note"] == "Renamed it."


def test_a_review_note_that_is_not_text_is_answered_not_crashed(
    client: Any, full_api_access: None, pending: Any
) -> None:
    """``request_changes`` requires a note, so a non-string has an answer
    already: the same one a blank note gets."""
    response = client.post(
        f"/api/v1/change_request/{pending.pk}/request_changes",
        json={"review_note": [1]},
    )

    assert response.status_code != 500
    # It reached the lifecycle as no note, which raises ReviewNoteRequiredError.
    pending.request_changes.assert_called_once()
    assert pending.request_changes.call_args.args[1] == ""
