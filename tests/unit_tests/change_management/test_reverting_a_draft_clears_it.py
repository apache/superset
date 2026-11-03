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
"""Typing a draft back to the live value undoes it (R4-01).

A save that leaves the asset as it is was let through without being
captured, which is right -- there is nothing to apply. It was let through
before anyone asked whose open request the asset was carrying, so an author
who renamed a chart in a draft and then typed the original name back was
answered 200 and told nothing: their draft went on proposing the name they
believed they had undone, and an approver could still publish it.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import gate
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

AUTHOR = 5
OTHER = 9


@pytest.fixture
def live(mocker: MockerFixture) -> SimpleNamespace:
    """A chart named Tree, loadable by the gate."""
    asset = SimpleNamespace(id=13, slice_name="Tree")
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    return asset


@pytest.fixture
def discard(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(gate, "_discard_request")


def _draft(
    author_fk: int = AUTHOR,
    status: str = ChangeStatus.DRAFT.value,
    **command_args: Any,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        author_fk=author_fk,
        status=status,
        operation=Operation.UPDATE.value,
        command_args=command_args,
        payload_dict={"slice_name": "Tree DRAFT"},
    )


def _save_the_live_name() -> None:
    gate.gate_write(AssetType.CHART, 13, {"slice_name": "Tree"})


def test_the_authors_own_fully_reverted_draft_is_discarded(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "find_open_request", return_value=_draft())

    _save_the_live_name()

    discard.assert_called_once_with(7, AUTHOR)


def test_the_write_is_still_let_through(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    """Reverting is not itself a change, so nothing is captured."""
    mocker.patch.object(gate, "find_open_request", return_value=_draft())
    insert = mocker.patch.object(gate, "_insert_request")

    _save_the_live_name()

    insert.assert_not_called()


def test_somebody_elses_draft_is_left_alone(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "find_open_request", return_value=_draft(author_fk=OTHER))

    _save_the_live_name()

    discard.assert_not_called()


def test_a_sub_command_draft_is_left_alone(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    """A properties save cannot speak for a native-filter draft."""
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(**{gate.COMMAND_KEY: "native_filters"}),
    )

    _save_the_live_name()

    discard.assert_not_called()


def test_an_asset_with_no_open_request_is_untouched(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "find_open_request", return_value=None)

    _save_the_live_name()

    discard.assert_not_called()


def test_a_partial_revert_still_updates_the_draft(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    """Only a save that leaves nothing proposed closes the draft."""
    mocker.patch.object(gate, "find_open_request", return_value=_draft())
    update = mocker.patch.object(gate, "_update_own_request", return_value=7)

    with pytest.raises(gate.ChangeRequestCreated):
        gate.gate_write(
            AssetType.CHART, 13, {"slice_name": "Tree", "description": "new"}
        )

    discard.assert_not_called()
    update.assert_called_once()


def test_an_unidentified_writer_discards_nothing(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    """An empty write without an identity was always allowed; keep it so."""
    mocker.patch.object(gate, "get_user_id", return_value=None)
    mocker.patch.object(gate, "find_open_request", return_value=_draft())

    _save_the_live_name()

    discard.assert_not_called()


def test_a_failed_lookup_leaves_the_draft_as_it_was(
    live: SimpleNamespace, discard: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "find_open_request", side_effect=RuntimeError("no db"))

    _save_the_live_name()

    discard.assert_not_called()


@pytest.mark.parametrize(
    "status",
    [ChangeStatus.PENDING.value, ChangeStatus.CHANGES_REQUESTED.value],
)
def test_a_submitted_change_survives_its_authors_no_op_save(
    live: SimpleNamespace,
    discard: MagicMock,
    mocker: MockerFixture,
    status: str,
) -> None:
    """Undoing a draft is the author's to do. Undoing a *review* is not.

    ``find_open_request`` returns every open status, so without a status
    check this helper reached past the draft it is named for. An author who
    had already submitted, then pressed Save with nothing edited, got 200
    and no mention of review while the request was discarded, recorded
    against them as its own reviewer, and taken out of the approver's queue
    with nothing said to either of them.

    Withdrawing a submitted change is a transition with its own name, and
    this is not it.
    """
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft(status=status)
    )

    _save_the_live_name()

    discard.assert_not_called()
