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
"""An edit-mode save states more of the metadata than the dashboard holds.

A tester changed a dashboard title, saved, changed it back to live's exact
value, saved and submitted -- and the request was accepted and sent to a
reviewer as a "change" made of raw JSON, for work the author had fully
reverted. Reproduced over HTTP against a governed dashboard: ``submit``
answered 200 and the status went to ``pending``.

The sentence in ``343ed5ccf5`` that says this cannot happen on a dashboard
"because the gate declines to open a draft with nothing in it" was the thing
to check, and it was wrong -- not because the gate does not decline, but
because the draft was never empty to begin with. ``saveDashboardRequest``
builds ``json_metadata`` from ``cleanedData.metadata`` plus
``getCrossFiltersConfiguration``, and on a dashboard whose stored metadata
has no global cross-filter scope the client *synthesises* one: the default
whole-dashboard scope, with every chart listed in it. Against a stored
metadata that has never had the key that is an added entry, so every
edit-mode save of such a dashboard differs from live whatever the author did.
(``chart_configuration`` was not the cause: the client posts ``{}`` for it
and the comparison already reads an empty blob and an absent one as one
thing. The same goes for ``filter_scopes``.)

Two rules close it, both read off the write rather than guessed:

* ``set_dash_metadata`` seeds a fixed set of entries with ``setdefault`` when
  the stored metadata has never had them, so a key the metadata lacks, sent
  as exactly that default, is stored with the value the write would have put
  there anyway.
* an absent ``global_chart_configuration`` already means the whole dashboard,
  to the client's ``getCrossFiltersConfiguration`` and to the backend's own
  ``_derive_cross_filter_scopes`` alike, so the default is what absence says.

A scope somebody actually set is untouched by either, which is the point: a
chart entering or leaving a cross-filter scope stays reviewable.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import gate, lifecycle
from asset_approval.bindings import _keep_the_layout_the_draft_holds
from asset_approval.changes import changed_fields
from asset_approval.exceptions import ChangeRequestCreated, NothingToReviewError
from asset_approval.models import ChangeStatus
from asset_approval.types import AssetType, Operation
from pytest_mock import MockerFixture

from superset.utils import json

AUTHOR = 7
LIVE_TITLE = "Sales Dashboard"

LAYOUT = {
    "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
    "GRID_ID": {
        "type": "GRID",
        "id": "GRID_ID",
        "children": ["ROW-1"],
        "parents": ["ROOT_ID"],
    },
    "ROW-1": {
        "type": "ROW",
        "id": "ROW-1",
        "children": ["CHART-rev"],
        "parents": ["ROOT_ID", "GRID_ID"],
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
    },
    "CHART-rev": {
        "type": "CHART",
        "id": "CHART-rev",
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
        "meta": {
            "chartId": 1,
            "sliceName": "Quarterly Revenue",
            "width": 4,
            "height": 50,
            "uuid": "7feb1d00-d2b6-410f-bdbd-33de78bd5d8a",
        },
    },
}

#: What a dashboard that has never been saved from edit mode holds. No
#: ``global_chart_configuration``, no ``refresh_frequency``: nobody has set
#: either, so nothing wrote them.
STORED_METADATA = {
    "color_scheme": "",
    "label_colors": {},
    "shared_label_colors": [],
    "map_label_colors": {},
    "color_scheme_domain": [],
}

WHOLE_DASHBOARD = {"rootPath": ["ROOT_ID"], "excluded": []}


def _dashboard(**over: Any) -> SimpleNamespace:
    base = {
        "id": 151,
        "dashboard_title": LIVE_TITLE,
        "css": "",
        "slug": None,
        "description": None,
        "certified_by": None,
        "certification_details": "",
        "position_json": json.dumps(LAYOUT),
        "json_metadata": json.dumps(STORED_METADATA),
    }
    base.update(over)
    return SimpleNamespace(**base)


def _edit_mode_save(title: str = LIVE_TITLE, **metadata: Any) -> dict[str, Any]:
    """The body ``saveDashboardRequest(SAVE_TYPE_OVERWRITE)`` posts.

    Every entry here is the client's, not the author's: the seeded defaults
    from ``cleanedData.metadata``, the serialized empty filter set, and the
    cross-filter configuration ``getCrossFiltersConfiguration`` computes.
    """
    blob = {
        **STORED_METADATA,
        "color_namespace": None,
        "positions": LAYOUT,
        "refresh_frequency": 0,
        "expanded_slices": {},
        "expand_all_slices": False,
        "timed_refresh_immune_slices": [],
        "cross_filters_enabled": True,
        "default_filters": "{}",
        "filter_scopes": {},
        "chart_configuration": {},
        "global_chart_configuration": {
            "scope": WHOLE_DASHBOARD,
            "chartsInScope": [1],
        },
    }
    blob.update(metadata)
    return {
        "dashboard_title": title,
        "css": "",
        "slug": None,
        "description": None,
        "certified_by": None,
        "certification_details": "",
        "json_metadata": json.dumps(blob),
    }


# ------------------------------------------------------- the measurement


def test_an_edit_mode_save_that_changes_nothing_changes_nothing() -> None:
    """The defect at its root: this body is what every edit-mode save posts,
    and it used to differ from live on a dashboard nobody had scoped."""
    assert changed_fields(_dashboard(), _edit_mode_save()) == []


def test_a_title_edit_in_the_same_body_is_still_the_only_change() -> None:
    assert changed_fields(_dashboard(), _edit_mode_save(title="Sales Q4")) == [
        "dashboard_title"
    ]


# ------------------------------------------------------- what is still a change


def test_a_cross_filter_scope_somebody_narrowed_is_still_a_change() -> None:
    """Only the default is what absence says. An excluded chart was chosen."""
    payload = _edit_mode_save(
        global_chart_configuration={
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [1]},
            "chartsInScope": [],
        }
    )

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_scope_rooted_on_a_tab_is_still_a_change() -> None:
    payload = _edit_mode_save(
        global_chart_configuration={
            "scope": {"rootPath": ["TAB-1"], "excluded": []},
            "chartsInScope": [1],
        }
    )

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_scope_turned_back_to_the_whole_dashboard_is_still_a_change() -> None:
    """Widening a scope somebody had narrowed is an edit: the rule only
    reconciles a key the stored metadata does not have at all."""
    live = _dashboard(
        json_metadata=json.dumps(
            {
                **STORED_METADATA,
                "global_chart_configuration": {
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": [1]},
                    "chartsInScope": [],
                },
            }
        )
    )

    assert changed_fields(live, _edit_mode_save()) == ["json_metadata"]


def test_a_refresh_frequency_the_author_set_is_still_a_change() -> None:
    assert changed_fields(_dashboard(), _edit_mode_save(refresh_frequency=300)) == [
        "json_metadata"
    ]


def test_turning_off_a_refresh_the_dashboard_had_is_still_a_change() -> None:
    """``0`` is the seeded default, but only against a key that is absent."""
    live = _dashboard(
        json_metadata=json.dumps({**STORED_METADATA, "refresh_frequency": 300})
    )

    assert changed_fields(live, _edit_mode_save()) == ["json_metadata"]


def test_turning_cross_filters_off_is_still_a_change() -> None:
    live = _dashboard(
        json_metadata=json.dumps({**STORED_METADATA, "cross_filters_enabled": True})
    )

    assert changed_fields(live, _edit_mode_save(cross_filters_enabled=False)) == [
        "json_metadata"
    ]


def test_a_value_that_merely_looks_like_the_default_is_still_a_change() -> None:
    """Type-strict, as core's own reading of these defaults is: ``1`` is not
    ``True`` and reporting it as nothing would hide a real value."""
    assert changed_fields(_dashboard(), _edit_mode_save(cross_filters_enabled=1)) == [
        "json_metadata"
    ]


# ------------------------------------------------------- the draft, end to end


@pytest.fixture
def submitting(mocker: MockerFixture) -> Any:
    """``lifecycle.submit`` with everything but the empty-change test stubbed."""

    def arrange(request: Any, asset: Any) -> None:
        mocker.patch.object(lifecycle, "_locked", return_value=request)
        mocker.patch.object(lifecycle, "get_user_id", return_value=AUTHOR)
        mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
        mocker.patch.object(lifecycle, "eligible_approvers", return_value=[object()])
        mocker.patch.object(lifecycle, "snapshot_draft_for_review")
        mocker.patch.object(lifecycle, "db")

    return arrange


def _draft(payload: dict[str, Any]) -> MagicMock:
    request = MagicMock()
    request.id = 1
    request.asset_type = "dashboard"
    request.asset_id = 151
    request.author_fk = AUTHOR
    request.status = ChangeStatus.DRAFT.value
    request.operation = Operation.UPDATE.value
    request.command_args = {}
    request.payload_dict = payload
    return request


def test_a_dashboard_draft_holding_only_an_edit_mode_echo_is_refused(
    submitting: Any,
) -> None:
    """The tester's submit: 200 and ``pending`` before, 422 now."""
    request = _draft(_edit_mode_save())
    submitting(request, _dashboard())

    with pytest.raises(NothingToReviewError) as refusal:
        lifecycle.submit(1)

    assert "dashboard" in str(refusal.value)
    request.set_status.assert_not_called()


def test_a_dashboard_draft_with_a_real_edit_is_still_submitted(
    submitting: Any,
) -> None:
    request = _draft(_edit_mode_save(title="Sales Q4"))
    submitting(request, _dashboard())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


@pytest.fixture
def live(mocker: MockerFixture) -> SimpleNamespace:
    asset = _dashboard()
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    return asset


def test_the_second_save_that_reverts_the_title_drops_the_draft(
    live: SimpleNamespace, mocker: MockerFixture
) -> None:
    """The author's own revert, end to end: the draft goes rather than being
    folded into a request that proposes the metadata echo and nothing else."""
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=SimpleNamespace(
            id=1,
            author_fk=AUTHOR,
            status=ChangeStatus.DRAFT.value,
            operation=Operation.UPDATE.value,
            command_args={},
            payload_dict=_edit_mode_save(title="Sales Q4"),
        ),
    )
    dropped = mocker.patch.object(gate, "_drop_a_fully_reverted_draft")

    gate.gate_write(
        AssetType.DASHBOARD,
        151,
        _edit_mode_save(),
        fold_fields=_keep_the_layout_the_draft_holds,
    )

    dropped.assert_called_once_with(AssetType.DASHBOARD, 151)


def test_the_same_save_carrying_a_real_edit_is_still_captured(
    live: SimpleNamespace, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "find_open_request", return_value=None)
    mocker.patch.object(gate, "_insert_request", return_value=9)

    with pytest.raises(ChangeRequestCreated):
        gate.gate_write(
            AssetType.DASHBOARD,
            151,
            _edit_mode_save(title="Sales Q4"),
            fold_fields=_keep_the_layout_the_draft_holds,
        )
