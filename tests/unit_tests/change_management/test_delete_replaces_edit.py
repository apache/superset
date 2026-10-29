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
"""What the answer says when a delete takes the place of an edit.

Deleting an asset you already have an edit waiting on replaces that edit:
the delete is a different change, not an update to the same one, so the
edit's note is cleared with it. The dialogs warn before that happens. A
caller that never saw a dialog -- the REST API, a script, the MCP tools --
was told only that the delete was captured, and the edit disappeared with
nothing in the answer to show for it (QA-03).
"""

from types import SimpleNamespace
from typing import Any

from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.http import (
    CAPTURED_STATUS,
    DELETE_MESSAGE,
    DELETE_REPLACED_MESSAGE,
    signal_response,
)


def _captured(**over: Any) -> ChangeRequestCreated:
    kwargs: dict[str, Any] = {
        "change_request_id": 5,
        "asset_type": "dashboard",
        "asset_id": 3,
        "operation": "delete",
    }
    kwargs.update(over)
    return ChangeRequestCreated(**kwargs)


def test_a_delete_that_replaced_an_edit_says_so() -> None:
    body, status = signal_response(_captured(replaced_edit=True))

    assert status == CAPTURED_STATUS
    assert body["message"] == DELETE_REPLACED_MESSAGE
    assert "replaced the edit you had waiting" in body["message"]


def test_a_plain_delete_is_unchanged() -> None:
    body, _ = signal_response(_captured())

    assert body["message"] == DELETE_MESSAGE


def test_the_flag_defaults_to_false() -> None:
    """An older caller constructing this signal keeps the old wording."""
    assert _captured().replaced_edit is False


def test_a_bulk_delete_still_counts_rather_than_explains() -> None:
    """One sentence cannot describe four assets, so the count wins."""
    body, _ = signal_response(
        _captured(count=4, change_request_ids=[5, 6, 7, 8], replaced_edit=True)
    )

    assert "4" in body["message"]


def test_the_gate_reports_a_replaced_edit(mocker: Any) -> None:
    """The link between the replacement happening and the answer saying so."""
    import pytest
    from asset_approval import gate
    from asset_approval.types import AssetType, Operation

    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=7)
    mocker.patch.object(gate, "_update_own_request", return_value=5)
    # An edit of the author's own, waiting on this asset.
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=SimpleNamespace(
            id=5,
            asset_id=3,
            author_fk=7,
            operation=Operation.UPDATE.value,
            author=None,
        ),
    )

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_delete(AssetType.DASHBOARD, [3])

    assert raised.value.replaced_edit is True


def test_the_gate_does_not_report_one_when_there_was_none(mocker: Any) -> None:
    import pytest
    from asset_approval import gate
    from asset_approval.types import AssetType

    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=7)
    mocker.patch.object(gate, "find_open_request", return_value=None)
    mocker.patch.object(gate, "_insert_request", return_value=9)

    with pytest.raises(ChangeRequestCreated) as raised:
        gate.gate_delete(AssetType.DASHBOARD, [3])

    assert raised.value.replaced_edit is False
