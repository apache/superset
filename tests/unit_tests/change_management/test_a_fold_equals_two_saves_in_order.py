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
"""A fold of two saves equals making them one after the other.

The invariant the lost-edit defect reduces to, stated once: *folding body B
into open draft D must leave the asset exactly where applying D and then B
would have left it.* Measured against the real replay machinery rather
than against an expected dictionary, because replay is what an approval
actually runs and the stored payload is only correct relative to it.

It is exercised through **both** fold sites. There are two -- ``gate_write``
and ``_lost_the_slot``, which one author's double click on Save reaches --
and a fix that lands on the branch a unit test calls and not on the branch a
double click reaches is this epic's own failure mode in miniature. The race
variant runs two real threads for the same reason: the branch only exists
because two requests really do arrive at once.
"""

from __future__ import annotations

import threading
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import gate
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.models import ChangeRequest
from asset_approval.replay import apply_change
from asset_approval.types import AssetType, Operation
from pytest_mock import MockerFixture
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session

from superset.utils import json

AUTHOR = 5

#: The chart every case starts from.
LIVE_NAME = "Live"
LIVE_PARAMS = {"metric": "live_metric", "colour": "live_colour"}


def _scratch_chart(session: Session, chart_id: int) -> Any:
    """A throwaway chart holding the live name and params."""
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())
    chart = Slice(
        id=chart_id,
        slice_name=LIVE_NAME,
        viz_type="table",
        datasource_id=1,
        datasource_type="table",
        params=json.dumps(LIVE_PARAMS, sort_keys=True),
    )
    session.add(chart)
    session.commit()
    return chart


@pytest.fixture
def replaying_a_chart(session: Session, mocker: MockerFixture) -> Any:
    """``apply_change`` against a scratch chart, with validation stubbed.

    Only ``validate`` is replaced, and only because a unit test has no
    security manager to pass. ``run`` is the shipped command: tag diffing,
    the audit stamp and ``ChartDAO.update`` all happen as they would on the
    author's own save, which is the whole point of replaying rather than
    writing the asset here.
    """
    from superset.commands.chart.update import UpdateChartCommand
    from superset.models.slice import Slice

    def validate(self: Any) -> None:
        self._model = session.query(Slice).get(self._model_id)

    mocker.patch.object(UpdateChartCommand, "validate", validate)

    def replay(chart_id: int, body: dict[str, Any]) -> None:
        apply_change(
            ChangeRequest(
                asset_type=AssetType.CHART.value,
                asset_id=chart_id,
                operation=Operation.UPDATE.value,
                payload=ChangeRequest.serialize_payload(body, {}),
            )
        )

    return replay


class _Slot:
    """The asset's single open request, held in memory.

    Stands in for the ``change_requests`` row and nothing else: the real
    ``_insert_request`` and ``_update_own_request`` commit on their own
    connections, which a unit test has no engine for. The unique constraint
    on the open slot is modelled faithfully, because the second insert
    failing is precisely what drives the race path.
    """

    def __init__(self) -> None:
        self.request: ChangeRequest | None = None
        self.lock = threading.Lock()

    def insert(
        self,
        asset_type: AssetType,
        asset_id: int,
        payload: dict[str, Any],
        author_id: int,
        note: str | None = None,
        command_args: dict[str, Any] | None = None,
        operation: Operation = Operation.UPDATE,
        base: dict[str, Any] | None = None,
        **_fold: Any,
    ) -> int:
        with self.lock:
            if self.request is not None:
                raise IntegrityError("open slot taken", {}, Exception())
            self.request = ChangeRequest(
                id=1,
                asset_type=asset_type.value,
                asset_id=asset_id,
                operation=operation.value,
                status="draft",
                author_fk=author_id,
                payload=ChangeRequest.serialize_payload(payload, command_args, base),
            )
        return 1

    def update(
        self,
        _change_request_id: int,
        payload: dict[str, Any],
        _note: str | None = None,
        command_args: dict[str, Any] | None = None,
        operation: Operation = Operation.UPDATE,
        clear_note: bool = False,
        base: dict[str, Any] | None = None,
    ) -> int:
        with self.lock:
            assert self.request is not None
            self.request.payload = ChangeRequest.serialize_payload(
                payload, command_args, base
            )
            self.request.operation = operation.value
        return 1


@pytest.fixture
def gating(session: Session, mocker: MockerFixture) -> _Slot:
    """The real gate, writing its request into memory instead of a table.

    ``is_replaying`` is deliberately **not** stubbed: the replays below go
    through ``replaying()``, and a gate that cannot be suspended would
    capture the approval instead of applying it -- the feature deadlocking
    against itself, which is the one thing that flag exists to prevent.
    """
    slot = _Slot()
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(
        gate, "find_open_request", side_effect=lambda *_args: slot.request
    )
    mocker.patch.object(gate, "_insert_request", slot.insert)
    mocker.patch.object(gate, "_update_own_request", slot.update)
    return slot


def _save(chart_id: int, body: dict[str, Any]) -> None:
    """One gated chart save, as ``bindings._gate_chart_update`` makes it."""
    with pytest.raises(ChangeRequestCreated):
        gate.gate_write(
            AssetType.CHART, chart_id, body, fold_fields=True
        )


def _fields(chart: Any) -> dict[str, Any]:
    return {
        "slice_name": chart.slice_name,
        "params": json.loads(chart.params or "{}"),
        "description": chart.description,
    }


#: (name, D, B). Each pair is one shape of second save.
PAIRS: tuple[tuple[str, dict[str, Any], dict[str, Any]], ...] = (
    # The High: Explore captures the controls, then the Properties dialog
    # renames. The dialog's body says nothing about ``params``.
    (
        "a partial body after a full one",
        {"params": json.dumps({"metric": "drafted", "colour": "live_colour"})},
        {"slice_name": "Renamed"},
    ),
    # Two full-state bodies: the second asserts the whole chart, so its
    # ``params`` replaces rather than merges.
    (
        "a full body after a full one",
        {"params": json.dumps({"metric": "first"})},
        {"params": json.dumps({"metric": "second"})},
    ),
    # The partial body puts one field back to the live value while the
    # draft's other edit stands.
    (
        "a partial body that restates the live value",
        {
            "slice_name": "Renamed",
            "params": json.dumps({"metric": "drafted", "colour": "live_colour"}),
        },
        {"slice_name": LIVE_NAME},
    ),
    # Disjoint fields, neither of which the other mentions.
    (
        "two bodies that touch different fields",
        {"slice_name": "Renamed"},
        {"description": "why"},
    ),
)


@pytest.mark.parametrize("name,draft,second", PAIRS, ids=[p[0] for p in PAIRS])
def test_the_folded_payload_lands_where_two_saves_would(
    session: Session,
    gating: _Slot,
    replaying_a_chart: Any,
    mocker: MockerFixture,
    name: str,
    draft: dict[str, Any],
    second: dict[str, Any],
) -> None:
    """T1, on the sequential fold site (``gate_write``).

    Two scratch charts starting from the same live state: one has D and
    then B replayed through the real command, the other has the single
    folded payload replayed once. The two must be the same chart.
    """
    in_order = _scratch_chart(session, 41)
    folded = _scratch_chart(session, 42)
    mocker.patch("asset_approval.replay.load_asset", return_value=folded)

    _save(42, draft)
    _save(42, second)
    assert gating.request is not None

    replaying_a_chart(41, draft)
    replaying_a_chart(41, second)
    replaying_a_chart(42, gating.request.payload_dict)

    assert _fields(folded) == _fields(in_order)


def test_a_partial_second_save_does_not_drop_the_first_ones_edit(
    session: Session, gating: _Slot, mocker: MockerFixture
) -> None:
    """The defect itself, stated without the replay machinery.

    A rename through the chart Properties dialog carries eight fields and
    no ``params``. Replacing the stored payload with it left the captured
    ``params`` edit nowhere, and the author was told their changes had been
    updated.
    """
    chart = _scratch_chart(session, 43)
    mocker.patch("asset_approval.replay.load_asset", return_value=chart)

    _save(43, {"params": json.dumps({"metric": "drafted"})})
    _save(43, {"slice_name": "Renamed"})

    assert gating.request is not None
    stored = gating.request.payload_dict
    assert json.loads(stored["params"]) == {"metric": "drafted"}
    assert stored["slice_name"] == "Renamed"


def test_both_halves_of_a_double_click_survive(
    app: Any,
    session: Session,
    gating: _Slot,
    replaying_a_chart: Any,
    mocker: MockerFixture,
) -> None:
    """T1 on the *other* fold site, with two real threads.

    One author whose Save fires twice is the commonest way into
    ``_lost_the_slot``: both requests are in ``gate_write`` at once, one
    wins the asset's open slot and the other arrives at the race path. That
    path used to replace the payload, so whichever half lost the race lost
    its edit -- a fold on one branch and a replace on the other, which is
    exactly what one shared ``_fold_into`` exists to prevent.

    Bodies that touch different fields, so a replace on either side is
    visible as a missing field rather than as a coin toss.

    The live asset the gate reads is a detached stand-in rather than the
    ORM row: an in-memory SQLite connection belongs to the thread that
    opened it, so touching the row from a worker would fail on the harness
    rather than on the code under test. The replay comparison afterwards
    runs on the real rows, on this thread.
    """
    chart = _scratch_chart(session, 44)
    mocker.patch(
        "asset_approval.replay.load_asset",
        return_value=SimpleNamespace(
            id=44,
            slice_name=LIVE_NAME,
            params=json.dumps(LIVE_PARAMS, sort_keys=True),
            description=None,
        ),
    )

    both_inside = threading.Barrier(2)
    failures: list[BaseException] = []

    def save(body: dict[str, Any]) -> None:
        try:
            # A request context per worker, because that is what each of
            # these is in production: ``replaying()`` and the gate's own
            # flags live on ``flask.g``, which is per context.
            with app.app_context():
                both_inside.wait(timeout=10)
                _save(44, body)
        except BaseException as ex:  # noqa: BLE001 -- reported, not swallowed
            failures.append(ex)

    threads = [
        threading.Thread(target=save, args=({"slice_name": "Renamed"},)),
        threading.Thread(
            target=save, args=({"params": json.dumps({"metric": "drafted"})},)
        ),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)

    assert not failures, failures
    assert gating.request is not None
    stored = gating.request.payload_dict

    # Neither half was dropped, whichever of them won the slot.
    assert stored["slice_name"] == "Renamed"
    assert json.loads(stored["params"]) == {"metric": "drafted"}

    # And the merged payload replays to the same chart two saves would.
    in_order = _scratch_chart(session, 45)
    replaying_a_chart(45, {"slice_name": "Renamed"})
    replaying_a_chart(45, {"params": json.dumps({"metric": "drafted"})})
    replaying_a_chart(44, stored)
    assert _fields(chart) == _fields(in_order)


def test_the_race_path_folds_through_the_same_function() -> None:
    """The structural half: one fold, named once, used by both sites.

    Asserted on the source because the behavioural tests above can only
    see the outcome, and the outcome was right on one branch for weeks
    while the other quietly replaced.
    """
    import inspect

    assert "_fold_into(" in inspect.getsource(gate._lost_the_slot)
    assert "_fold_into(" in inspect.getsource(gate.gate_write)
