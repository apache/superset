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
"""R7-03: the dashboard can still be edited after "Request to publish".

QA: "After 'Request to publish', the dashboard can still be edited; approving
publishes content the reviewer never saw."

Two things were suspected, and only one is true.

*A fold after submission* is by design (a later save is folded into the
author's open request) and it does move the reviewer's revision: the fold
rewrites ``changed_on`` and returns the request to ``draft``, so Approve
answers "not pending" or 409 and the reviewer has to read it again. That is
asserted below as the thing that already worked.

*An edit to a never-published draft* is the hole. The draft is exempt from the
gate (SOW 5.1), the request to publish it carries ``published: true`` and
nothing else, so a title or layout edit applied straight to the dashboard,
left the request and its revision exactly as the reviewer saw them, and the
approval published whatever the dashboard had become. Decision 5 says
submitting locks the content; for a draft nothing did.
"""

from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings, gate, lifecycle
from asset_approval.changes import moved_since
from asset_approval.exceptions import UnreviewableWriteRefusedError
from asset_approval.models import ChangeRequest
from asset_approval.types import AssetType, ChangeStatus
from pytest_mock import MockerFixture

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    AUTHOR,
    commit_or_raise,
    guarded_world,
    request_store,
)


def _edit(published: bool = False, **payload: Any) -> SimpleNamespace:
    return SimpleNamespace(
        _model=SimpleNamespace(id=7, published=published),
        _captured_payload={"dashboard_title": "Edited after submitting", **payload},
    )


@pytest.fixture
def seen(mocker: MockerFixture) -> dict[str, Any]:
    return {
        "gate_write": mocker.patch.object(bindings, "gate_write"),
        "mark_published": mocker.patch.object(bindings, "mark_published"),
        "ever": mocker.patch.object(bindings, "has_ever_been_published"),
        "pending": mocker.patch.object(bindings, "has_pending_request"),
    }


# ---- the gate ----------------------------------------------------------------


def test_a_draft_with_a_request_waiting_is_no_longer_edited_freely(
    seen: dict[str, Any],
) -> None:
    seen["ever"].return_value = False
    seen["pending"].return_value = True

    bindings._gate_dashboard_update(_edit())

    seen["gate_write"].assert_called_once()
    assert seen["gate_write"].call_args.args[2]["dashboard_title"] == (
        "Edited after submitting"
    )


def test_a_draft_nobody_is_reviewing_is_still_built_freely(
    seen: dict[str, Any],
) -> None:
    """SOW 5.1: gating every save would mean building one approval at a time."""
    seen["ever"].return_value = False
    seen["pending"].return_value = False

    bindings._gate_dashboard_update(_edit())

    seen["gate_write"].assert_not_called()


def test_the_exempt_fields_stay_free_while_it_is_in_review(
    seen: dict[str, Any],
) -> None:
    """A certification or a description is exempt on every path (SOW 5.2)."""
    seen["ever"].return_value = False
    seen["pending"].return_value = True

    bindings._gate_dashboard_update(
        SimpleNamespace(
            _model=SimpleNamespace(id=7, published=False, description="old"),
            _captured_payload={"description": "new"},
        )
    )

    seen["gate_write"].assert_not_called()


# ---- the guard behind the gate -------------------------------------------------


def test_a_draft_in_review_is_not_written_around_the_gate(
    guarded_world: Any,
) -> None:
    guarded_world.state.in_review.add(guarded_world.draft.id)
    guarded_world.draft.dashboard_title = "swapped under the reviewer"

    refusal = commit_or_raise(guarded_world.session)

    assert isinstance(refusal, UnreviewableWriteRefusedError)
    assert "in review" in str(refusal)


def test_the_same_draft_is_editable_once_nobody_is_reviewing_it(
    guarded_world: Any,
) -> None:
    guarded_world.draft.dashboard_title = "building"

    assert commit_or_raise(guarded_world.session) is None


# ---- the approval ----------------------------------------------------------------


def _first_publish_request(**base: Any) -> ChangeRequest:
    request = ChangeRequest(
        asset_type=AssetType.DASHBOARD.value,
        asset_id=7,
        author_fk=AUTHOR,
        status=ChangeStatus.DRAFT.value,
        payload=ChangeRequest.serialize_payload(
            {"published": True}, {}, {"published": False, **base}
        ),
    )
    return request


def _draft(**fields: Any) -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        published=False,
        dashboard_title="Quarterly",
        position_json='{"ROOT_ID": {}}',
        json_metadata="{}",
        css="",
        slug=None,
        theme_id=None,
        **fields,
    )


def test_submitting_records_what_the_reviewer_is_about_to_see() -> None:
    request = _first_publish_request()

    gate.snapshot_draft_for_review(request, _draft())

    assert request.base_dict["dashboard_title"] == "Quarterly"
    # Named here rather than compared against ``FIRST_PUBLISH_CONTENT``,
    # which is the tuple the snapshot is built from: both sides of
    # ``set(FIRST_PUBLISH_CONTENT) <= set(base_dict)`` shrink together, so
    # dropping a field from the tuple left the assertion true and the field
    # out of the snapshot. ``json_metadata`` is the one that matters most --
    # colour scheme, native filters, filter scopes and cross-filters all
    # live in it, so out of the snapshot the author can rewrite every one of
    # them between submit and approval and ``moved_since`` stays silent.
    assert set(request.base_dict) >= {
        "dashboard_title",
        "position_json",
        "json_metadata",
        "css",
        "slug",
        "theme_id",
    }
    assert request.payload_dict == {"published": True}


def test_approving_after_the_draft_moved_is_refused_by_name() -> None:
    """The backstop: whatever path moved it, the approval notices."""
    request = _first_publish_request()
    gate.snapshot_draft_for_review(request, _draft())

    moved = moved_since(
        _draft(), request.base_dict
    )
    assert moved == []

    edited = _draft()
    edited.dashboard_title = "Something the reviewer never read"
    edited.position_json = '{"ROOT_ID": {}, "CHART-1": {}}'

    assert moved_since(edited, request.base_dict) == [
        "dashboard_title",
        "position_json",
    ]


def test_the_snapshot_is_taken_at_submit_not_at_capture() -> None:
    """The author keeps editing the draft until they ask for review."""
    request = _first_publish_request(dashboard_title="Old title")

    gate.snapshot_draft_for_review(request, _draft())

    assert request.base_dict["dashboard_title"] == "Quarterly"


@pytest.mark.parametrize(
    "request_fields",
    [
        {"payload": ChangeRequest.serialize_payload({"dashboard_title": "x"}, {}, {})},
        {
            "payload": ChangeRequest.serialize_payload(
                {"published": True}, {"command": "native_filters"}, {}
            )
        },
    ],
    ids=["not a publish", "a sub-command"],
)
def test_only_a_first_publish_is_snapshotted(request_fields: dict[str, Any]) -> None:
    request = _first_publish_request()
    request.payload = request_fields["payload"]
    before = request.payload

    gate.snapshot_draft_for_review(request, _draft())

    assert request.payload == before


def test_a_dashboard_that_is_already_published_is_not_snapshotted() -> None:
    request = _first_publish_request()
    before = request.payload
    live = _draft()
    live.published = True

    gate.snapshot_draft_for_review(request, live)

    assert request.payload == before


def test_submit_takes_the_snapshot(mocker: MockerFixture) -> None:
    request = _first_publish_request()
    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(lifecycle, "_asset_for", return_value=_draft())
    mocker.patch.object(lifecycle, "eligible_approvers", return_value=[object()])
    mocker.patch.object(lifecycle, "db", SimpleNamespace(session=mocker.MagicMock()))

    lifecycle.submit.__wrapped__(1)

    assert request.status == ChangeStatus.PENDING.value
    assert request.base_dict["dashboard_title"] == "Quarterly"


# ---- what already worked: a fold after submission moves the revision ---------------


def test_a_fold_after_submission_moves_the_revision_the_reviewer_holds(
    request_store: Any,
) -> None:
    """Not a hole. It is why a published dashboard's edits could not be swapped."""
    request_id = gate._insert_request(
        AssetType.DASHBOARD, 7, {"dashboard_title": "v1"}, AUTHOR, None
    )
    with request_store.engine.begin() as connection:
        connection.execute(
            request_store.table.update()
            .where(request_store.table.c.id == request_id)
            .values(
                status=ChangeStatus.PENDING.value,
                changed_on=datetime(2026, 11, 4, 9, 0),
            )
        )
    held = request_store.row(request_id).changed_on

    gate._update_own_request(request_id, {"dashboard_title": "v2"}, None)

    after = request_store.row(request_id)
    assert after.changed_on != held
    assert after.status == ChangeStatus.DRAFT.value
