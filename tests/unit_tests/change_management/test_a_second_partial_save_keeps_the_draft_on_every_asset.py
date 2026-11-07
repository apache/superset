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
"""A second save that says nothing about a field leaves that field's draft alone.

``fold_fields`` was passed by the chart gates and by neither of the other two,
so on a dataset or a dashboard the second partial save replaced the author's
whole draft while the response read "Changes updated in your existing draft".
The end-to-end rows are in
``test_what_the_gate_captures_covers_what_the_apply_writes``; these are the
gate-level ones, and the two things that make a dashboard more than "pass
``True``":

* the layout is not in ``position_json`` on the shipped surfaces. The Header's
  Save puts it in ``json_metadata.positions`` and the Properties dialog sends a
  ``json_metadata`` with none, so folding field by field still replaces it;
* the tripwire that tells an author a save "put back" a setting has to be asked
  about the fold, or it accuses a save of the very thing the fold prevented.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import bindings, gate
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.types import AssetType, ChangeStatus, Operation
from pytest_mock import MockerFixture

from superset.utils import json

AUTHOR = 5
LAYOUT = {"ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]}}
EDITED_LAYOUT = {"ROOT_ID": {"type": "ROOT", "children": ["GRID_ID", "HEADER-1"]}}


@pytest.fixture
def review(mocker: MockerFixture) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)


def _draft(body: dict[str, Any], command_args: dict[str, Any] | None = None) -> Any:
    return SimpleNamespace(
        id=7,
        author_fk=AUTHOR,
        status=ChangeStatus.DRAFT.value,
        operation=Operation.UPDATE.value,
        command_args=command_args or {},
        payload_dict=body,
    )


@pytest.fixture
def update(mocker: MockerFixture) -> MagicMock:
    return mocker.patch.object(gate, "_update_own_request", return_value=7)


# ---- datasets --------------------------------------------------------------


@pytest.fixture
def dataset(mocker: MockerFixture, review: None) -> SimpleNamespace:
    asset = SimpleNamespace(
        id=42, sql="SELECT 1", description="live", cache_timeout=None
    )
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    return asset


def test_a_dataset_save_after_a_dataset_save_keeps_both(
    dataset: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft({"sql": "SELECT 2"})
    )
    command = SimpleNamespace(
        _model=dataset, _captured_payload={"cache_timeout": 90}, _captured_arguments={}
    )

    with pytest.raises(ChangeRequestCreated) as held:
        bindings._gate_dataset_update(command)

    assert update.call_args.args[1] == {"sql": "SELECT 2", "cache_timeout": 90}
    assert held.value.updated_existing is True
    assert held.value.reverted_fields == []


# ---- dashboards ------------------------------------------------------------


@pytest.fixture
def dashboard(mocker: MockerFixture, review: None) -> SimpleNamespace:
    """A published dashboard, so that its saves are held at all."""
    asset = SimpleNamespace(
        id=3,
        published=True,
        dashboard_title="Executive",
        css="",
        slug=None,
        position_json=json.dumps(LAYOUT),
        json_metadata=json.dumps({"refresh_frequency": 0}),
    )
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    mocker.patch.object(bindings, "mark_published")
    return asset


def _layout_save() -> dict[str, Any]:
    return {
        "dashboard_title": "Executive",
        "json_metadata": json.dumps(
            {"refresh_frequency": 0, "positions": EDITED_LAYOUT}
        ),
    }


def _properties_save() -> dict[str, Any]:
    return {
        "dashboard_title": "Executive (Q4)",
        "css": "",
        "json_metadata": json.dumps({"refresh_frequency": 0}),
    }


def _gate_dashboard(dashboard: SimpleNamespace, body: dict[str, Any]) -> None:
    bindings._gate_dashboard_update(
        SimpleNamespace(
            _model=dashboard, _captured_payload=body, _captured_arguments={}
        )
    )


def _stored_metadata(update: MagicMock) -> dict[str, Any]:
    return json.loads(update.call_args.args[1]["json_metadata"])


def test_a_properties_save_after_a_layout_save_keeps_the_layout(
    dashboard: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """B3, as shipped: the second ``json_metadata`` has no layout in it."""
    mocker.patch.object(gate, "find_open_request", return_value=_draft(_layout_save()))

    with pytest.raises(ChangeRequestCreated) as held:
        _gate_dashboard(dashboard, _properties_save())

    stored = update.call_args.args[1]
    assert stored["dashboard_title"] == "Executive (Q4)"
    assert _stored_metadata(update)["positions"] == EDITED_LAYOUT
    # And the response does not accuse the save of undoing what it kept.
    assert held.value.reverted_fields == []


def test_a_layout_save_after_a_properties_save_takes_the_new_layout(
    dashboard: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft(_properties_save())
    )

    with pytest.raises(ChangeRequestCreated):
        _gate_dashboard(dashboard, _layout_save())

    stored = update.call_args.args[1]
    assert stored["dashboard_title"] == "Executive"
    assert _stored_metadata(update)["positions"] == EDITED_LAYOUT


def test_a_save_that_states_its_own_layout_replaces_the_drafts(
    dashboard: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    newer = {"ROOT_ID": {"type": "ROOT", "children": ["GRID_ID", "HEADER-2"]}}
    mocker.patch.object(gate, "find_open_request", return_value=_draft(_layout_save()))

    with pytest.raises(ChangeRequestCreated):
        _gate_dashboard(
            dashboard,
            {"json_metadata": json.dumps({"refresh_frequency": 0, "positions": newer})},
        )

    assert _stored_metadata(update)["positions"] == newer


def test_a_raw_position_json_replaces_the_layout_the_drafts_metadata_carried(
    dashboard: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """Otherwise the old layout in ``json_metadata`` would override the new one.

    On apply, a ``json_metadata`` that carries ``positions`` supersedes the
    raw field, so two saves in order end with the raw one and a fold that kept
    both would end with the older.
    """
    mocker.patch.object(gate, "find_open_request", return_value=_draft(_layout_save()))
    raw = json.dumps({"ROOT_ID": {"type": "ROOT", "children": []}})

    with pytest.raises(ChangeRequestCreated):
        _gate_dashboard(dashboard, {"position_json": raw})

    stored = update.call_args.args[1]
    assert stored["position_json"] == raw
    assert "positions" not in _stored_metadata(update)


def test_an_empty_json_metadata_leaves_the_drafts_metadata_standing(
    dashboard: SimpleNamespace, update: MagicMock, mocker: MockerFixture
) -> None:
    """The Properties dialog posts ``null`` when the metadata box is empty.

    The command reads that as "leave the stored metadata alone", so the fold
    must not turn it into a statement that wipes the draft's.
    """
    mocker.patch.object(gate, "find_open_request", return_value=_draft(_layout_save()))

    with pytest.raises(ChangeRequestCreated):
        _gate_dashboard(
            dashboard, {"dashboard_title": "Renamed", "json_metadata": None}
        )

    assert _stored_metadata(update)["positions"] == EDITED_LAYOUT


def test_the_fold_a_double_click_reaches_keeps_the_layout_too(
    dashboard: SimpleNamespace, mocker: MockerFixture
) -> None:
    """``_lost_the_slot`` is the second fold site, and a fix that lands on only
    one of the two is this epic's own failure mode."""
    holder = _draft(_layout_save())
    mocker.patch.object(gate, "find_open_request", return_value=holder)
    update = mocker.patch.object(gate, "_update_own_request", return_value=7)
    from sqlalchemy.exc import IntegrityError

    gate._lost_the_slot(
        AssetType.DASHBOARD,
        3,
        _properties_save(),
        AUTHOR,
        None,
        None,
        Operation.UPDATE,
        None,
        IntegrityError("insert", {}, Exception("unique")),
        fold_fields=bindings._keep_the_layout_the_draft_holds,
        live=dashboard,
    )

    assert (
        json.loads(update.call_args.args[1]["json_metadata"])["positions"]
        == EDITED_LAYOUT
    )
    # And the baseline is recomputed on the FOLDED body, not the one this
    # save arrived with. The baseline is what an approval measures staleness
    # against (``moved_since``), so taken against the pre-fold body it
    # describes a draft that no longer exists: the approval then either
    # refuses a change nothing moved under, or passes one that did (QA-24).
    #
    # Asserted here because this is the race path, and the race path is the
    # one no test reaches through production: the loser of the slot sees the
    # holder and folds through ``gate_write`` instead, so only a direct call
    # exercises this branch.
    # And the baseline is recomputed AFTER the fold, so it covers the body
    # the request ends up holding rather than the one this save arrived with.
    #
    # ``json_metadata`` is the proof: a Properties save does not carry it,
    # and the fold is what puts the draft's layout back into it. A baseline
    # taken before the fold has no entry for it at all -- and the baseline is
    # what an approval measures staleness against (``moved_since``), so it
    # would then be measuring a draft that does not exist, refusing a change
    # nothing moved under or passing one that did (QA-24).
    #
    # Asserted here because this is the race path, and no test reaches it
    # through production: the loser of the slot sees the holder and folds
    # through ``gate_write`` instead, so only a direct call gets here.
    base = update.call_args.kwargs.get("base")
    assert base is not None, "the fold left the baseline unset"
    assert "json_metadata" in base, (
        "the baseline was taken before the fold, so it does not cover the "
        "layout the fold put back"
    )


def test_the_dashboard_gate_passes_the_refined_fold(
    dashboard: SimpleNamespace, mocker: MockerFixture
) -> None:
    """Pinned so that ``True`` is not put back: it is the shortcut that looks
    right, passes every unit test that posts ``position_json``, and loses the
    layout in the browser."""
    write = mocker.patch.object(bindings, "gate_write")

    _gate_dashboard(dashboard, _properties_save())

    assert (
        write.call_args.kwargs["fold_fields"]
        is bindings._keep_the_layout_the_draft_holds
    )
