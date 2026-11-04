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
"""A body that speaks for some of a chart must not answer for all of it.

One command, two shapes of body. Explore posts every control, so its save
asserts the whole chart. The chart Properties dialog posts eight fields,
and the REST and MCP clients post whatever they like -- those say nothing
about the fields they leave out, and the gate used to read the silence as
"make it so". A captured ``params`` edit therefore disappeared the moment
the author renamed the chart through the dialog, with the answer reading
"Changes updated in your existing draft".

The second half is R4-01 reaching too far for the same reason: its "fully
reverted" test judged the **body** rather than the draft, so a partial save
whose own fields all matched live was called empty and discarded a draft
carrying an unrelated edit.

Both are fixed by asking every question of the *fold* rather than of the
body, and the rows below are the semantics that follows. ``fold_fields``,
never ``combine``: ``combine`` also switches off ``comparable``, and with it
the empty-change test (129076), the baseline (QA-24) and R4-01 itself. The
last three tests are there so nobody takes that shortcut later.
"""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import gate
from asset_approval.changes import changed_fields
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

from superset.utils import json

AUTHOR = 5
LIVE_NAME = "Live"
LIVE_PARAMS = {"metric": "live_metric"}
DRAFTED_PARAMS = {"metric": "drafted_metric"}


@pytest.fixture
def live(mocker: MockerFixture) -> SimpleNamespace:
    """A chart named Live, loadable by the gate."""
    asset = SimpleNamespace(
        id=13,
        slice_name=LIVE_NAME,
        params=json.dumps(LIVE_PARAMS, sort_keys=True),
        description=None,
    )
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    return asset


def _draft(
    body: dict[str, Any],
    status: str = ChangeStatus.DRAFT.value,
    command_args: dict[str, Any] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=7,
        author_fk=AUTHOR,
        status=status,
        operation=Operation.UPDATE.value,
        command_args=command_args or {},
        payload_dict=body,
    )


@pytest.fixture
def update(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(gate, "_update_own_request", return_value=7)


@pytest.fixture
def discard(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(gate, "_discard_request")


def _chart_save(body: dict[str, Any], **over: Any) -> None:
    """A chart save, gated the way ``_gate_chart_update`` gates one."""
    gate.gate_write(
        AssetType.CHART, 13, body, fold_fields=True, **over
    )


def _stored(update: MagicMock) -> dict[str, Any]:
    return update.call_args.args[1]


def test_a_partial_body_leaves_the_rest_of_the_draft_standing(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """D={params}, B={slice_name} -> both."""
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft({"params": json.dumps(DRAFTED_PARAMS)}),
    )

    with pytest.raises(ChangeRequestCreated):
        _chart_save({"slice_name": "Renamed"})

    stored = _stored(update)
    assert json.loads(stored["params"]) == DRAFTED_PARAMS
    assert stored["slice_name"] == "Renamed"


def test_a_full_state_body_still_replaces_the_field_it_carries(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """D={params:P1}, B={params:P2} -> P2.

    Explore's body asserts the whole chart, so its ``params`` is the
    author's latest word on every control in it. Merging *inside* the blob
    is the thing this must not do: the server cannot tell a key the author
    edited from one Explore normalised on the way through.
    """
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft({"params": json.dumps(DRAFTED_PARAMS)}),
    )
    second = {"metric": "second_metric"}

    with pytest.raises(ChangeRequestCreated):
        _chart_save({"params": json.dumps(second)})

    assert json.loads(_stored(update)["params"]) == second


def test_a_draft_typed_all_the_way_back_still_closes(
    live: SimpleNamespace, update: MagicMock, discard: MagicMock, mocker: MockerFixture
) -> None:
    """R4-01, intact: the fold comes out equal to live, so nothing is left."""
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft({"slice_name": "Renamed"})
    )

    _chart_save({"slice_name": LIVE_NAME})

    discard.assert_called_once_with(7, AUTHOR)
    update.assert_not_called()


def test_a_draft_carrying_more_than_the_body_survives_the_revert(
    live: SimpleNamespace, update: MagicMock, discard: MagicMock, mocker: MockerFixture
) -> None:
    """The R4-01 over-reach.

    The body's own fields all equal live, so judged alone it is "empty" and
    the whole draft was discarded -- taking a ``params`` edit nobody had
    reverted with it. Judged as the fold, the draft still proposes
    something and lives.
    """
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {
                "slice_name": "Renamed",
                "params": json.dumps(DRAFTED_PARAMS),
            }
        ),
    )

    with pytest.raises(ChangeRequestCreated):
        _chart_save({"slice_name": LIVE_NAME})

    discard.assert_not_called()
    stored = _stored(update)
    assert stored["slice_name"] == LIVE_NAME
    # And "What changed" now names the one thing still proposed.
    assert changed_fields(live, stored) == ["params"]


def test_the_baseline_covers_everything_the_request_proposes(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """QA-24 on the fold.

    The baseline is what an approval checks for movement, so it has to
    cover the merged payload. Measured on the body alone, the draft's
    ``params`` edit would be republished over whatever had happened to the
    chart since, with nothing refused and nothing said.
    """
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft({"params": json.dumps(DRAFTED_PARAMS)}),
    )

    with pytest.raises(ChangeRequestCreated):
        _chart_save({"slice_name": "Renamed"})

    base = update.call_args.kwargs["base"]
    assert base["params"] == LIVE_PARAMS
    assert base["slice_name"] == LIVE_NAME


def test_what_explore_normalised_is_not_forgotten_by_a_partial_save(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """``command_args`` is replaced wholesale on a fold.

    The chart gate carries ``normalization_changes`` -- the keys Explore
    rewrote on its own as it loaded the chart, which version history reads
    to tell an author's edit from the host's own migration. A second body
    with no ``params`` has nothing to say about normalisation, so replacing
    the args with its own ``{normalization_changes: None}`` erased the
    first save's list.
    """
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {"params": json.dumps(DRAFTED_PARAMS)},
            command_args={gate.NORMALIZATION_KEY: ["time_range"]},
        ),
    )

    with pytest.raises(ChangeRequestCreated):
        _chart_save(
            {"slice_name": "Renamed"},
            command_args={gate.NORMALIZATION_KEY: None},
        )

    assert update.call_args.args[3] == {gate.NORMALIZATION_KEY: ["time_range"]}


def test_a_body_that_does_carry_params_speaks_for_normalisation_too(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The other direction: a full-state save's own list is the current one."""
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {"params": json.dumps(DRAFTED_PARAMS)},
            command_args={gate.NORMALIZATION_KEY: ["time_range"]},
        ),
    )

    with pytest.raises(ChangeRequestCreated):
        _chart_save(
            {"params": json.dumps({"metric": "third"})},
            command_args={gate.NORMALIZATION_KEY: ["viewport"]},
        )

    assert update.call_args.args[3] == {gate.NORMALIZATION_KEY: ["viewport"]}


def test_a_chart_save_that_changes_nothing_is_still_let_through(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """129076, which ``combine`` would have switched off.

    ``comparable`` in the gate is ``operation is UPDATE and combine is None
    and not COMMAND_KEY``. ``fold_fields`` is a separate flag precisely so
    that this check, the baseline above and R4-01 all keep working on
    charts.
    """
    mocker.patch.object(gate, "find_open_request", return_value=None)
    insert = mocker.patch.object(gate, "_insert_request")

    _chart_save({"slice_name": LIVE_NAME})

    insert.assert_not_called()
    update.assert_not_called()


def test_a_draft_of_another_kind_is_still_refused(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """A properties body cannot be folded onto a native-filter draft."""
    from asset_approval.exceptions import AssetLockedError

    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {"modified": []}, command_args={gate.COMMAND_KEY: "native_filters"}
        ),
    )

    with pytest.raises(AssetLockedError):
        _chart_save({"slice_name": "Renamed"})

    update.assert_not_called()


def test_somebody_elses_draft_is_not_folded_into(
    live: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The lock still holds, and their payload never reaches this one."""
    from asset_approval.exceptions import AssetLockedError

    theirs = _draft({"params": json.dumps(DRAFTED_PARAMS)})
    theirs.author_fk = AUTHOR + 1
    theirs.author = SimpleNamespace(first_name="Alex", last_name="Rivera")
    mocker.patch.object(gate, "find_open_request", return_value=theirs)

    with pytest.raises(AssetLockedError):
        _chart_save({"slice_name": "Renamed"})

    update.assert_not_called()


def test_the_chart_gate_does_not_reach_for_combine() -> None:
    """The trap, as a test.

    ``combine=combine_key_values`` is the obvious one-line fix and it would
    pass every fold test above while silently switching off 129076, the
    QA-24 baseline and R4-01 for every chart -- a fix that passes the tests
    and fails the rows.
    """
    from asset_approval import bindings

    for binding in (bindings._gate_chart_update, bindings._gate_legacy_slice_save):
        source = inspect.getsource(binding)
        assert "fold_fields=True" in source
        assert "combine=" not in source


def test_the_gate_reads_the_open_slot_before_it_judges_the_write() -> None:
    """The ordering, stated so a later edit cannot quietly undo it.

    Everything downstream -- the emptiness test, the baseline, R4-01 --
    has to be asked of the fold, which cannot be computed before the open
    request is known. Both halves of this file's defect were that order
    being the other way round.
    """
    source = inspect.getsource(gate.gate_write)

    assert source.index("_open_request_or_none") < source.index("is_empty_change")
    assert source.index("_fold_into") < source.index("is_empty_change")
    assert source.index("is_empty_change") < source.index("baseline_of")
