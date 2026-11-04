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
"""A save that takes the place of a delete does not inherit the delete's note.

The note is what the approver reads beside the change. Left on the request
when a rename replaced the delete, "delete it" was read as the author's
explanation of a rename. The delete direction already cleared the edit's
note (129078); this is the mirror of it.
"""

from __future__ import annotations

from typing import Any

import pytest
from asset_approval import gate
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.models import ChangeRequest
from asset_approval.types import AssetType, Operation
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

AUTHOR = 5
CHART_ID = 41


def _scratch_chart(session: Session) -> Any:
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())
    chart = Slice(
        id=CHART_ID,
        slice_name="Live",
        viz_type="table",
        datasource_id=1,
        datasource_type="table",
        params="{}",
    )
    session.add(chart)
    session.commit()
    return chart


@pytest.fixture
def updates(session: Session, mocker: MockerFixture) -> list[dict[str, Any]]:
    """Every call the gate makes to fold into the author's open request."""
    chart = _scratch_chart(session)
    # The live asset is read through the DAO, which wants a logged-in user.
    mocker.patch("asset_approval.replay.load_asset", return_value=chart)
    calls: list[dict[str, Any]] = []

    def record(change_request_id: int, *args: Any, **kwargs: Any) -> int:
        calls.append({"id": change_request_id, "args": args, **kwargs})
        return change_request_id

    def waiting(operation: Operation, note: str) -> ChangeRequest:
        return ChangeRequest(
            id=1,
            asset_type=AssetType.CHART.value,
            asset_id=CHART_ID,
            operation=operation.value,
            status="draft",
            author_fk=AUTHOR,
            note=note,
            payload=ChangeRequest.serialize_payload({}, {}),
        )

    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(gate, "_update_own_request", record)
    calls.append({"waiting": waiting})  # popped by the tests below
    return calls


def _save_rename(existing: ChangeRequest, mocker: MockerFixture) -> None:
    mocker.patch.object(gate, "find_open_request", return_value=existing)
    with pytest.raises(ChangeRequestCreated):
        gate.gate_write(
            AssetType.CHART, CHART_ID, {"slice_name": "Renamed"}, fold_fields=True
        )


def test_a_rename_that_replaces_a_delete_clears_the_deletes_note(
    updates: list[dict[str, Any]], mocker: MockerFixture
) -> None:
    waiting = updates.pop(0)["waiting"]

    _save_rename(waiting(Operation.DELETE, "delete it"), mocker)

    assert len(updates) == 1
    assert updates[0].get("clear_note") is True


def test_a_rename_that_folds_into_an_edit_keeps_the_authors_note(
    updates: list[dict[str, Any]], mocker: MockerFixture
) -> None:
    """The note is cleared for the change it no longer describes, not always."""
    waiting = updates.pop(0)["waiting"]

    _save_rename(waiting(Operation.UPDATE, "tidying the title"), mocker)

    assert len(updates) == 1
    assert not updates[0].get("clear_note")
