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
"""A draft that proposes nothing is not sent to a reviewer.

A tester put a chart back exactly as it was, saved, pressed Request review and
was accepted. The dashboard "refuses" the same thing, but only in the toolbar:
the "No changes to review yet" tooltip is the front end disabling its own
button. ``POST /change_request/<id>/submit`` has never asked, for a dashboard
or a chart, so any client that does not draw that button -- the banner's
identical one, REST, a double click -- could send a reviewer an empty request.

The question is the gate's own. ``gate_write`` already declines to make a
request for a save that alters nothing; this asks it again of the request when
it is about to be submitted, with the same test and the same conditions, so
there is one definition of "changed" and a draft that *became* equal to live
(someone else's change was approved meanwhile) is caught as well.

What this does not do is decide that an Explore save's extra controls are
defaults. See the last two tests.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import lifecycle
from asset_approval.exceptions import NothingToReviewError
from asset_approval.gate import COMMAND_KEY, KWARGS_KEY
from asset_approval.models import ChangeStatus
from asset_approval.types import Operation
from pytest_mock import MockerFixture

from superset.utils import json

AUTHOR = 7
LIVE_PARAMS = {"viz_type": "table", "metrics": ["count"], "row_limit": 100}


def _chart(**over: Any) -> SimpleNamespace:
    base = {
        "id": 42,
        "slice_name": "qa_chart",
        "description": None,
        "params": json.dumps(LIVE_PARAMS),
        "query_context": None,
    }
    base.update(over)
    return SimpleNamespace(**base)


def _draft(
    payload: dict[str, Any],
    asset_type: str = "chart",
    operation: str = Operation.UPDATE.value,
    command_args: dict[str, Any] | None = None,
) -> MagicMock:
    request = MagicMock()
    request.id = 1
    request.asset_type = asset_type
    request.asset_id = 42
    request.author_fk = AUTHOR
    request.status = ChangeStatus.DRAFT.value
    request.operation = operation
    request.command_args = command_args or {}
    request.payload_dict = payload
    return request


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


def test_a_chart_draft_identical_to_live_is_refused(submitting: Any) -> None:
    request = _draft({"slice_name": "qa_chart", "params": json.dumps(LIVE_PARAMS)})
    submitting(request, _chart())

    with pytest.raises(NothingToReviewError) as refusal:
        lifecycle.submit(1)

    assert "nothing to review" in str(refusal.value)
    request.set_status.assert_not_called()


def test_the_comparison_is_by_meaning_not_by_bytes(submitting: Any) -> None:
    """Superset round-trips ``params``, so the same settings arrive reordered
    and re-spaced. That is the empty save the gate already knows."""
    reshuffled = json.dumps(dict(reversed(list(LIVE_PARAMS.items()))), indent=2)
    submitting(_draft({"params": reshuffled}), _chart())

    with pytest.raises(NothingToReviewError):
        lifecycle.submit(1)


def test_a_chart_draft_that_differs_from_live_is_submitted(submitting: Any) -> None:
    request = _draft({"slice_name": "renamed"})
    submitting(request, _chart())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


def test_the_refusal_is_the_same_test_the_gate_uses(
    submitting: Any, mocker: MockerFixture
) -> None:
    """Not a second definition of "changed": whatever the gate's
    ``is_empty_change`` says is what decides this."""
    request = _draft({"slice_name": "renamed"})
    submitting(request, _chart())
    mocker.patch("asset_approval.gate.is_empty_change", return_value=True)

    with pytest.raises(NothingToReviewError):
        lifecycle.submit(1)


def test_a_dashboard_draft_that_matches_live_is_refused_too(
    submitting: Any,
) -> None:
    dashboard = SimpleNamespace(
        id=42, dashboard_title="Sales", json_metadata=None, position_json=None
    )
    submitting(_draft({"dashboard_title": "Sales"}, asset_type="dashboard"), dashboard)

    with pytest.raises(NothingToReviewError) as refusal:
        lifecycle.submit(1)

    assert "dashboard" in str(refusal.value)


def test_a_refusal_leaves_the_request_a_draft(submitting: Any) -> None:
    request = _draft({"slice_name": "qa_chart"})
    submitting(request, _chart())

    with pytest.raises(NothingToReviewError):
        lifecycle.submit(1)

    assert request.status == ChangeStatus.DRAFT.value
    lifecycle.snapshot_draft_for_review.assert_not_called()  # type: ignore[attr-defined]


# ------------------------------------------- what is never "nothing to review"


def test_a_delete_is_never_empty(submitting: Any) -> None:
    """The asset is the change."""
    request = _draft({}, operation=Operation.DELETE.value)
    submitting(request, _chart())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


def test_a_sub_command_body_is_not_measured_against_the_asset(
    submitting: Any,
) -> None:
    """A native-filter diff shares no field with the asset, so measuring it
    finds nothing in common and would call every such request empty."""
    request = _draft({"modified": []}, command_args={COMMAND_KEY: "native_filters"})
    submitting(request, _chart())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


def test_a_write_whose_keywords_act_on_the_asset_is_not_empty(
    submitting: Any,
) -> None:
    request = _draft(
        {"slice_name": "qa_chart"},
        command_args={KWARGS_KEY: {"delete_metric_ids": [3]}},
    )
    submitting(request, _chart())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


def test_a_request_that_cannot_be_read_is_not_called_empty(
    submitting: Any,
) -> None:
    """Unknowable is not empty; the gate is allowed to err towards review."""
    request = _draft({"slice_name": "qa_chart"})
    request.operation = "not-an-operation"
    submitting(request, _chart())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


def test_the_refusal_is_a_422_the_api_reports_as_such() -> None:
    assert NothingToReviewError("chart").status == 422


# ----------------------------------- what this deliberately does not decide


def test_an_explore_body_with_controls_live_never_held_is_still_a_change(
    submitting: Any,
) -> None:
    """Pinned so nobody mistakes it for a bug: the chart in the tester's run
    had minimal ``params`` and no ``query_context``, and Explore posted every
    control and a fresh ``query_context``. Those are keys live does not hold,
    which is a difference by the gate's own test.

    Calling them defaults would need the control defaults, which live in the
    front end, or a client's say-so, which would let an author file a change
    as "just defaults" and be refused review of it. Neither belongs in a gate.
    """
    explore = dict(LIVE_PARAMS, matrixify_enable=False, allow_render_html=True)
    request = _draft(
        {
            "params": json.dumps(explore),
            "query_context": json.dumps({"datasource": {"id": 23, "type": "table"}}),
        }
    )
    submitting(request, _chart())

    lifecycle.submit(1)

    request.set_status.assert_called_once_with(ChangeStatus.PENDING)


def test_the_same_controls_once_live_holds_them_are_no_change(
    submitting: Any,
) -> None:
    """After the first save lands, the next unchanged Explore save posts keys
    live already has, and that *is* refused."""
    explore = dict(LIVE_PARAMS, matrixify_enable=False, allow_render_html=True)
    live = _chart(
        params=json.dumps(explore),
        query_context=json.dumps({"datasource": {"id": 23, "type": "table"}}),
    )
    submitting(
        _draft(
            {
                "params": json.dumps(explore),
                "query_context": json.dumps(
                    {"datasource": {"type": "table", "id": 23}}
                ),
            }
        ),
        live,
    )

    with pytest.raises(NothingToReviewError):
        lifecycle.submit(1)
