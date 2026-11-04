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
"""R7-05: an author's save landing while their request is approved.

QA: "Author save landing during an approval rewrites the approved request back
to draft (19/19), so the audit trail is wrong."

The capture path reads the asset's open request, decides to fold into it, and
writes the fold with an UPDATE keyed on the request's id alone. Nothing in it
takes the lifecycle's row lock, so when a reviewer's approval is in flight the
two meet like this: the approval holds the row, the save's UPDATE waits on a
connection of its own, the approval commits (``approved``, slot freed), and
the UPDATE then runs against a row it no longer had any business with. It
set the status back to ``draft``, took the slot again, and replaced the
payload that had just been approved with the one that had not.

``find_open_request`` does not call an approved request open, and 17b3b5d138
(``_drop_a_fully_reverted_draft`` never checked the status) closed the sibling
that discarded a *submitted* request; neither touched this write.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import gate
from asset_approval.exceptions import AssetLockedError
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    AUTHOR,
    request_store,
)


def _open_a_request(store: Any, **payload: Any) -> int:
    return gate._insert_request(
        AssetType.DASHBOARD, 5, payload or {"dashboard_title": "v1"}, AUTHOR, None
    )


def test_a_fold_cannot_land_on_a_request_that_has_been_approved(
    request_store: Any,
) -> None:
    request_id = _open_a_request(request_store)
    request_store.decide(request_id, ChangeStatus.APPROVED.value)
    approved = request_store.row(request_id)

    with pytest.raises(AssetLockedError):
        gate._update_own_request(request_id, {"dashboard_title": "v2"}, None)

    after = request_store.row(request_id)
    assert after.status == ChangeStatus.APPROVED.value
    assert after.active_slot is None
    assert after.payload == approved.payload
    assert after.reviewer_fk == approved.reviewer_fk


def test_a_fold_cannot_land_on_a_request_that_was_discarded(
    request_store: Any,
) -> None:
    request_id = _open_a_request(request_store)
    request_store.decide(request_id, ChangeStatus.DISCARDED.value)

    with pytest.raises(AssetLockedError):
        gate._update_own_request(request_id, {"dashboard_title": "v2"}, None)

    assert request_store.row(request_id).status == ChangeStatus.DISCARDED.value


def test_the_save_that_lost_the_race_is_told_to_save_again(
    request_store: Any, mocker: MockerFixture
) -> None:
    """The whole path: the open request was read as pending, and then decided."""
    request_id = _open_a_request(request_store)
    stale_read = SimpleNamespace(
        id=request_id,
        author_fk=AUTHOR,
        author=None,
        status=ChangeStatus.PENDING.value,
        operation=Operation.UPDATE.value,
        command_args={},
        payload_dict={"dashboard_title": "v1"},
    )
    mocker.patch.object(gate, "_open_request_or_none", return_value=stale_read)
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    mocker.patch(
        "asset_approval.replay.load_asset",
        return_value=SimpleNamespace(id=5, dashboard_title="v1"),
    )
    # The reviewer's approval commits between the read above and the write.
    request_store.decide(request_id, ChangeStatus.APPROVED.value)

    with pytest.raises(AssetLockedError) as refusal:
        gate.gate_write(AssetType.DASHBOARD, 5, {"dashboard_title": "v2"})

    assert "reviewed while you were saving" in str(refusal.value)
    assert request_store.row(request_id).status == ChangeStatus.APPROVED.value
    assert '"v2"' not in request_store.row(request_id).payload


def test_a_fold_into_a_request_that_is_still_open_works_as_before(
    request_store: Any,
) -> None:
    request_id = _open_a_request(request_store)

    gate._update_own_request(request_id, {"dashboard_title": "v2"}, None)

    row = request_store.row(request_id)
    assert row.status == ChangeStatus.DRAFT.value
    assert row.active_slot == 1
    assert '"v2"' in row.payload


@pytest.mark.parametrize("status", ["approved", "discarded"])
def test_closing_a_reverted_draft_does_not_close_a_decided_request(
    request_store: Any, status: str
) -> None:
    request_id = _open_a_request(request_store)
    request_store.decide(request_id, status)
    before = request_store.row(request_id)

    gate._discard_request(request_id, AUTHOR)

    assert request_store.row(request_id) == before


def test_closing_a_reverted_draft_does_not_close_one_that_was_submitted(
    request_store: Any,
) -> None:
    request_id = _open_a_request(request_store)
    with request_store.engine.begin() as connection:
        connection.execute(
            request_store.table.update()
            .where(request_store.table.c.id == request_id)
            .values(status=ChangeStatus.PENDING.value)
        )

    gate._discard_request(request_id, AUTHOR)

    assert request_store.row(request_id).status == ChangeStatus.PENDING.value
