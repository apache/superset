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
"""A command's keyword arguments are part of the write.

The gate captured a request's body and then one or two keywords it had been
told about, so every keyword a command grew was a way for a write to reach the
asset unreviewed, or to be reviewed as something else:

* ``delete_metric_ids`` -- a body of ``{}`` has no diff, so the metric delete
  went straight through, and took the author's unrelated open draft with it;
* ``preserve_existing_metrics`` -- not captured, so approval replayed an
  additive write as a replacing one and deleted the metrics it never named;
* the legacy chart save's ``save_to_dashboard_id`` -- not captured, so the
  reviewer approved a rename, was told "published", and nothing was attached.

These pin the fix at its source: the rule is the other way round now. What the
command was constructed with is captured, only what is declared inert is left
out, and replay hands every captured keyword back or refuses to approve.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import bindings, gate
from asset_approval.exceptions import (
    AssetLockedError,
    ChangeManagementException,
    ChangeRequestCreated,
    UnreviewableWriteRefusedError,
)
from asset_approval.gate import KWARGS_KEY
from asset_approval.models import ChangeRequest
from asset_approval.replay import build_command
from asset_approval.types import ChangeStatus, Operation
from pytest_mock import MockerFixture

AUTHOR = 5


@pytest.fixture
def review(mocker: MockerFixture) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)


@pytest.fixture
def dataset(mocker: MockerFixture) -> SimpleNamespace:
    """A dataset the gate can measure a body against."""
    asset = SimpleNamespace(
        id=42, description="live", cache_timeout=None, metrics=[], columns=[]
    )
    mocker.patch("asset_approval.replay.load_asset", return_value=asset)
    return asset


def _draft(body: dict[str, Any], command_args: dict[str, Any] | None = None) -> Any:
    return SimpleNamespace(
        id=7,
        author_fk=AUTHOR,
        status=ChangeStatus.DRAFT.value,
        operation=Operation.UPDATE.value,
        command_args=command_args or {},
        payload_dict=body,
    )


def _update_dataset(body: dict[str, Any], **keywords: Any) -> Any:
    """The shipped command, constructed as the callers construct it."""
    from superset.commands.dataset.update import UpdateDatasetCommand

    command = UpdateDatasetCommand(42, body, **keywords)
    command._model = SimpleNamespace(id=42, description="live", cache_timeout=None)
    return command


# ---- capture ----------------------------------------------------------------


def test_a_keyword_that_differs_from_its_default_is_captured() -> None:
    command = _update_dataset(
        {}, delete_metric_ids={9, 3}, preserve_existing_metrics=True
    )

    assert bindings._arguments_of(command) == {
        KWARGS_KEY: {"delete_metric_ids": [3, 9], "preserve_existing_metrics": True}
    }


def test_a_keyword_left_at_its_default_is_not_an_argument() -> None:
    command = _update_dataset(
        {"cache_timeout": 5},
        override_columns=False,
        preserve_existing_metrics=False,
        delete_metric_ids=set(),
    )

    assert bindings._arguments_of(command) == {}


def test_a_keyword_nobody_has_heard_of_is_captured_anyway() -> None:
    """The point of inverting the rule: the next keyword is caught by default.

    A command the table has never seen, with a keyword nobody wrote a line
    about. Under the old shape of the gate this write reaches the asset with
    nothing recorded; under this one it is in the capture.
    """

    class UpdateWidgetCommand:
        def __init__(self, model_id: int, data: dict, *, brand_new_flag: bool = False):
            self._model_id = model_id

    bindings.capture_arguments(UpdateWidgetCommand)

    assert bindings._arguments_of(UpdateWidgetCommand(1, {}, brand_new_flag=True)) == {
        KWARGS_KEY: {"brand_new_flag": True}
    }


def test_a_keyword_that_cannot_be_stored_is_refused_up_front(
    review: None,
) -> None:
    """A capture approval cannot reproduce must not be made at all."""

    class UpdateWidgetCommand:
        def __init__(self, model_id: int, data: dict, *, hook: object = None):
            self._model_id = model_id

    bindings.capture_arguments(UpdateWidgetCommand)

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._arguments_of(UpdateWidgetCommand(1, {}, hook=lambda: None))


def test_the_bookkeeping_keyword_is_left_to_the_key_it_already_has() -> None:
    from superset.commands.chart.update import UpdateChartCommand

    command = UpdateChartCommand(1, {}, normalization_changes=["time_range"])

    assert (
        bindings._arguments_of(command, already_captured=("normalization_changes",))
        == {}
    )


# ---- the gate ---------------------------------------------------------------


@pytest.fixture
def inserted(mocker: MockerFixture) -> MagicMock:
    mocker.patch.object(gate, "find_open_request", return_value=None)
    return mocker.patch.object(gate, "_insert_request", return_value=7)


def test_a_metric_delete_with_an_empty_body_is_held(
    review: None, dataset: SimpleNamespace, inserted: MagicMock
) -> None:
    """A12. No diff, because there is no body -- and it was waved through."""
    command = _update_dataset({}, delete_metric_ids={9})

    with pytest.raises(ChangeRequestCreated):
        bindings._gate_dataset_update(command)

    args = inserted.call_args.args
    assert args[2] == {}
    assert args[5] == {KWARGS_KEY: {"delete_metric_ids": [9]}}


def test_an_empty_body_with_nothing_else_is_still_not_a_change(
    review: None, dataset: SimpleNamespace, inserted: MagicMock
) -> None:
    """129076 stands: the rule is about keywords that act, not about emptiness."""
    bindings._gate_dataset_update(_update_dataset({}))

    inserted.assert_not_called()


def test_an_exempt_only_body_with_a_keyword_that_acts_is_held(
    review: None, dataset: SimpleNamespace, inserted: MagicMock
) -> None:
    """The exemption is for a write that touches nothing a viewer sees.

    Add a metric delete to a description edit and it touches what viewers see.
    """
    command = _update_dataset({"description": "new"}, delete_metric_ids={9})

    with pytest.raises(ChangeRequestCreated):
        bindings._gate_dataset_update(command)


def test_an_empty_body_does_not_discard_the_authors_open_draft(
    review: None,
    dataset: SimpleNamespace,
    mocker: MockerFixture,
) -> None:
    """The other half of A12: the draft was thrown away for a write it was not.

    An empty body folded onto a draft is the draft, and a body that is empty
    but acts is not "typed all the way back" either. Neither may discard it.
    """
    discard = mocker.patch.object(gate, "_discard_request")
    mocker.patch.object(
        gate, "find_open_request", return_value=_draft({"cache_timeout": 90})
    )
    update = mocker.patch.object(gate, "_update_own_request", return_value=7)

    with pytest.raises(ChangeRequestCreated):
        bindings._gate_dataset_update(_update_dataset({}))

    discard.assert_not_called()
    assert update.call_args.args[1] == {"cache_timeout": 90}


def test_a_draft_that_deletes_a_metric_is_not_closed_by_a_body_that_matches_live(
    review: None, dataset: SimpleNamespace, mocker: MockerFixture
) -> None:
    """R4-01 closes a draft that proposes nothing; this one proposes a delete."""
    discard = mocker.patch.object(gate, "_discard_request")
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft({}, {KWARGS_KEY: {"delete_metric_ids": [9]}}),
    )

    bindings._gate_dataset_update(_update_dataset({"description": "live"}))

    discard.assert_not_called()


def test_two_saves_with_the_same_keywords_fold(
    review: None, dataset: SimpleNamespace, mocker: MockerFixture
) -> None:
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft(
            {"cache_timeout": 90}, {KWARGS_KEY: {"delete_metric_ids": [9]}}
        ),
    )
    update = mocker.patch.object(gate, "_update_own_request", return_value=7)

    with pytest.raises(ChangeRequestCreated):
        bindings._gate_dataset_update(
            _update_dataset({"description": "new"}, delete_metric_ids={9})
        )

    assert update.call_args.args[1] == {"cache_timeout": 90, "description": "new"}


def test_two_saves_with_different_keywords_are_not_folded_and_not_replaced(
    review: None, dataset: SimpleNamespace, mocker: MockerFixture
) -> None:
    """There is no rule that composes two keywords, so there is no fold.

    The second save is told the first is open, and the first is untouched.
    Replacing it would drop the delete; guessing a merge would apply both to a
    body neither was written for.
    """
    mocker.patch.object(
        gate,
        "find_open_request",
        return_value=_draft({}, {KWARGS_KEY: {"delete_metric_ids": [9]}}),
    )
    update = mocker.patch.object(gate, "_update_own_request")

    with pytest.raises(AssetLockedError):
        bindings._gate_dataset_update(
            _update_dataset({"description": "new"}, preserve_existing_metrics=True)
        )

    update.assert_not_called()


# ---- replay -----------------------------------------------------------------


def _request(
    asset_type: str, body: dict[str, Any], args: dict[str, Any]
) -> ChangeRequest:
    return ChangeRequest(
        id=1,
        asset_type=asset_type,
        asset_id=42,
        operation="update",
        payload=ChangeRequest.serialize_payload(body, args),
    )


def test_replay_hands_the_captured_keywords_back_to_the_command() -> None:
    command = build_command(
        _request(
            "dataset",
            {},
            {KWARGS_KEY: {"delete_metric_ids": [9], "preserve_existing_metrics": True}},
        )
    )

    # A set again, because the command reads membership off it.
    assert command._delete_metric_ids == {9}
    assert command._preserve_existing_metrics is True


def test_replay_reads_override_columns_from_the_captured_keywords() -> None:
    from asset_approval.replay import DatasetSaveWithRefresh

    command = build_command(
        _request("dataset", {"sql": "x"}, {KWARGS_KEY: {"override_columns": True}})
    )

    assert isinstance(command, DatasetSaveWithRefresh)
    assert command._update.override_columns is True


def test_replay_refuses_a_keyword_the_command_no_longer_takes() -> None:
    """Dropping it would approve a different write than the one reviewed."""
    with pytest.raises(ChangeManagementException, match="no longer takes"):
        build_command(_request("dataset", {}, {KWARGS_KEY: {"retired_flag": True}}))


def test_replay_refuses_arguments_it_cannot_give_a_delete() -> None:
    request = ChangeRequest(
        id=1,
        asset_type="dataset",
        asset_id=42,
        operation="delete",
        payload=ChangeRequest.serialize_payload({}, {KWARGS_KEY: {"hard": True}}),
    )

    with pytest.raises(ChangeManagementException, match="cannot hand back"):
        build_command(request)


# ---- the legacy chart save --------------------------------------------------


@pytest.fixture
def legacy_save(mocker: MockerFixture) -> Any:
    """Explore's ``?action=overwrite`` as the gate sees it, on a test request."""
    from flask import Flask

    mocker.patch(
        "superset.views.utils.get_form_data", return_value=({"viz_type": "table"}, None)
    )
    captured = mocker.patch.object(bindings, "gate_write")

    def run(query: str) -> MagicMock:
        with Flask(__name__).test_request_context(f"/?{query}"):
            bindings._gate_legacy_slice_save(
                SimpleNamespace(id=13), datasource_id=1, datasource_type="table"
            )
        return captured

    return run


@pytest.fixture
def dashboard_the_author_edits(mocker: MockerFixture) -> SimpleNamespace:
    target = SimpleNamespace(id=21)
    query = MagicMock()
    query.filter_by.return_value.one_or_none.return_value = target
    mocker.patch("superset.db.session.query", return_value=query)
    mocker.patch("superset.security_manager.is_editor", return_value=True)
    return target


def test_the_dashboard_a_legacy_save_names_is_captured(
    legacy_save: Any, dashboard_the_author_edits: SimpleNamespace
) -> None:
    """B7. Rename and attach, held as one thing and shown as one thing."""
    held = legacy_save("action=overwrite&slice_name=Renamed&save_to_dashboard_id=21")

    assert held.call_args.kwargs["command_args"] == {
        KWARGS_KEY: {"save_to_dashboard_id": 21}
    }


def test_a_new_dashboard_name_on_a_legacy_save_is_captured_too(
    legacy_save: Any, mocker: MockerFixture
) -> None:
    mocker.patch("superset.security_manager.can_access", return_value=True)

    held = legacy_save("action=overwrite&slice_name=Renamed&new_dashboard_name=Q4")

    assert held.call_args.kwargs["command_args"] == {
        KWARGS_KEY: {"new_dashboard_name": "Q4"}
    }


def test_a_legacy_save_that_names_no_dashboard_captures_none(legacy_save: Any) -> None:
    held = legacy_save("action=overwrite&slice_name=Renamed")

    assert held.call_args.kwargs["command_args"] is None


def test_a_dashboard_the_author_cannot_edit_refuses_before_anything_moves(
    review: None, legacy_save: Any, mocker: MockerFixture
) -> None:
    """The gate runs before the view's own check, and the view overwrites first.

    Returning would let the view overwrite the chart and then answer 403;
    capturing would leave a request approval cannot carry out sitting on the
    chart's only slot. So it refuses, with nothing changed.
    """
    target = SimpleNamespace(id=21)
    query = MagicMock()
    query.filter_by.return_value.one_or_none.return_value = target
    mocker.patch("superset.db.session.query", return_value=query)
    mocker.patch("superset.security_manager.is_editor", return_value=False)

    with pytest.raises(UnreviewableWriteRefusedError):
        legacy_save("action=overwrite&save_to_dashboard_id=21")


def test_replay_attaches_the_chart_to_the_dashboard_the_save_named(
    mocker: MockerFixture,
) -> None:
    from asset_approval.replay import ChartSaveWithDashboard

    command = build_command(
        _request(
            "chart",
            {"slice_name": "Renamed"},
            {KWARGS_KEY: {"save_to_dashboard_id": 21}},
        )
    )

    assert isinstance(command, ChartSaveWithDashboard)
    assert command._around == {"save_to_dashboard_id": 21}
    assert command._update._properties == {"slice_name": "Renamed"}


def test_a_chart_save_with_no_dashboard_replays_as_the_plain_command() -> None:
    from superset.commands.chart.update import UpdateChartCommand

    command = build_command(_request("chart", {"slice_name": "Renamed"}, {}))

    assert isinstance(command, UpdateChartCommand)
