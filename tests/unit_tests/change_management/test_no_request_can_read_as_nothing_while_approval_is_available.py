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
"""A held request that shows the reviewer nothing cannot be approved.

Whatever else is rendered, there is one outcome that must not exist: an open
request opens to an empty panel that says nothing changed, with Approve
enabled. It was reachable (a keyword over an empty body) and it can be reached
again by whatever the renderers do not cover next, so this does not depend on
them. A request with no changed field, no keyword and no dataset row is
reported as unreviewable, its raw captured call is shown instead of a
confident "nothing differs", and the approve route refuses it.

Raw call over refusing outright to render: a reviewer working through a queue
who is told only "cannot review" learns nothing and cannot tell a no-op from a
write the page failed to describe; shown the body and the arguments they can.
Approve is withheld either way, because a click-through reviewer is exactly
who an enabled button over an empty panel is a trap for.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.gate import KWARGS_KEY
from asset_approval.models import ChangeRequest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


def _request(
    body: dict[str, Any] | None = None,
    command_args: dict[str, Any] | None = None,
    **state: Any,
) -> Any:
    fields = {
        "id": 4,
        "asset_type": "chart",
        "asset_id": 42,
        "author": SimpleNamespace(id=7, username="alex", first_name="A", last_name="D"),
        "author_fk": 7,
        "requested_approver": None,
        "reviewer": None,
        "status": "pending",
        "is_open": True,
        "note": None,
        "review_note": None,
        "created_on": None,
        "changed_on": None,
        "submitted_at": None,
        "decided_at": None,
        "operation": "update",
        "payload_dict": body or {},
        "base_dict": {},
        "command_args": command_args or {},
    }
    fields.update(state)
    return SimpleNamespace(**fields)


CHART = SimpleNamespace(id=42, slice_name="Revenue", deleted_at=None, editors=[])


@pytest.fixture(autouse=True)
def quiet_neighbours(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "find_open_request", return_value=None)
    mocker.patch.object(api, "load_asset", return_value=CHART)
    mocker.patch.object(api, "_names_of", return_value={})
    mocker.patch.object(api, "is_strict_editor", return_value=True)


def test_an_open_request_with_nothing_to_show_is_reported_unreviewable() -> None:
    payload = api.serialize(_request({"slice_name": "Revenue"}), CHART)

    assert payload["review_blocked"] == api.NOTHING_TO_REVIEW


def test_it_is_not_presented_as_a_list_that_says_nothing_changed() -> None:
    """``changes`` is never empty for a blocked request, so a client that
    does not know about the flag still shows something rather than a blank."""
    payload = api.serialize(_request({"slice_name": "Revenue"}), CHART)

    [entry] = payload["changes"]
    assert entry["unreadable"] is True
    assert "slice_name" in entry["after"]


def test_the_raw_call_holds_the_body_the_arguments_and_the_command() -> None:
    request = _request(
        {"slice_name": "Revenue"},
        {"command": "brand_new", KWARGS_KEY: {}, "exempt_fields": ["tags"]},
    )

    [entry] = api.serialize(request, CHART)["changes"]

    assert '"command": "brand_new"' in entry["after"]
    assert '"body": {"slice_name": "Revenue"}' in entry["after"]
    assert '"arguments": {}' in entry["after"]
    assert '"exempt_fields_written": ["tags"]' in entry["after"]


def test_a_long_captured_call_is_shortened_and_says_so() -> None:
    payload = api.serialize(_request({"slice_name": "Revenue", "x": "y" * 9000}), CHART)

    assert payload["changes"][0]["truncated"] is True


def test_a_request_with_a_changed_field_is_not_blocked() -> None:
    payload = api.serialize(_request({"slice_name": "Renamed"}), CHART)

    assert payload["review_blocked"] is None
    assert [entry["field"] for entry in payload["changes"]] == ["slice_name"]


def test_a_request_with_only_a_keyword_is_not_blocked() -> None:
    """The case that was: nothing in the body, something in the call."""
    request = _request({}, {KWARGS_KEY: {"never_heard_of_it": True}})

    payload = api.serialize(request, CHART)

    assert payload["review_blocked"] is None
    assert [entry["field"] for entry in payload["changes"]] == ["never_heard_of_it"]


def test_a_delete_is_not_empty() -> None:
    """The asset is the change; a delete has no fields and needs none."""
    payload = api.serialize(_request({}, operation="delete"), CHART)

    assert payload["review_blocked"] is None


def test_a_request_that_is_no_longer_open_is_not_flagged() -> None:
    """History reads as history: an approved change matches the live asset."""
    payload = api.serialize(
        _request({"slice_name": "Revenue"}, status="approved", is_open=False), CHART
    )

    assert payload["review_blocked"] is None
    assert payload["changes"] == []


def test_a_dataset_change_shown_only_in_its_definition_diff_is_not_blocked(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(
        api, "dataset_impact", return_value={"charts": 0, "dashboards": 0}
    )
    mocker.patch.object(
        api,
        "describe_changes",
        return_value=[],
    )
    mocker.patch.object(
        api,
        "dataset_detail",
        return_value={
            "impact": {"charts": 0, "dashboards": 0},
            "metrics": {"added": [{"name": "m"}], "changed": [], "removed": []},
        },
    )

    payload = api.serialize(_request({}, asset_type="dataset"), CHART)

    assert payload["review_blocked"] is None


def test_no_combination_of_empty_parts_slips_past() -> None:
    """The property: for every way a request can be empty, it is blocked."""
    empties = [
        ({}, {}),
        ({}, {KWARGS_KEY: {}}),
        ({}, {"exempt_fields": []}),
        ({"slice_name": "Revenue"}, {}),
        ({"slice_name": "Revenue"}, {"exempt_fields": ["tags"]}),
        ({"last_saved_at": "yesterday"}, {}),
    ]
    for body, args in empties:
        payload = api.serialize(_request(body, args), CHART)
        assert payload["review_blocked"], (body, args)
        assert payload["changes"], (body, args)


# ------------------------------------------------------------ the approve route


@pytest.fixture
def pending(mocker: MockerFixture, session: Session) -> Any:
    ChangeRequest.__table__.create(session.get_bind())

    def _add(body: dict[str, Any], command_args: dict[str, Any] | None = None) -> int:
        row = ChangeRequest(
            id=9,
            asset_type="chart",
            asset_id=42,
            operation="update",
            status="pending",
            active_slot=1,
            author_fk=7,
            payload=ChangeRequest.serialize_payload(body, command_args or {}),
        )
        session.add(row)
        session.flush()
        return row.id

    mocker.patch.object(api, "can_approve", return_value=True)
    mocker.patch.object(api, "get_user_id", return_value=1)
    # What the route answers with after the action is not under test, and
    # naming the author needs a user table.
    mocker.patch.object(
        api, "serialize", side_effect=lambda cr, asset=None: {"id": cr.id}
    )
    return _add


def test_the_route_refuses_to_approve_a_request_with_nothing_to_review(
    mocker: MockerFixture, client: Any, full_api_access: None, pending: Any
) -> None:
    approve = mocker.patch.object(api.lifecycle, "approve")
    pk = pending({"slice_name": "Revenue"})

    response = client.post(f"/api/v1/change_request/{pk}/approve", json={})

    assert response.status_code == 422
    assert response.json["message"] == api.NOTHING_TO_REVIEW
    approve.assert_not_called()


def test_the_route_still_approves_a_request_with_something_to_review(
    mocker: MockerFixture, client: Any, full_api_access: None, pending: Any
) -> None:
    approve = mocker.patch.object(api.lifecycle, "approve")
    pk = pending({"slice_name": "Renamed"})

    response = client.post(f"/api/v1/change_request/{pk}/approve", json={})

    assert response.status_code == 200
    approve.assert_called_once()


def test_the_route_does_not_tell_someone_who_cannot_approve(
    mocker: MockerFixture, client: Any, full_api_access: None, pending: Any
) -> None:
    """The refusal is asked only of someone entitled to approve; anyone else
    gets the workflow's own answer and learns nothing about the request."""
    mocker.patch.object(api, "can_approve", return_value=False)
    approve = mocker.patch.object(api.lifecycle, "approve")
    pk = pending({"slice_name": "Revenue"})

    client.post(f"/api/v1/change_request/{pk}/approve", json={})

    approve.assert_called_once()
