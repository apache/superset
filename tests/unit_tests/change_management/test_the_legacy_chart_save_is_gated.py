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
"""Explore's legacy save, the chart half of 129068.

``POST /superset/explore/?action=overwrite`` writes through ``ChartDAO``
inline. No command binding sees it, so an editor could change a reviewed
chart with nothing held. The view method is the only seam, which is why
this one is bound ``via="method"`` rather than on a command.

Its sibling, ``POST /datasource/save/``, already has
``test_route_rebinding.py`` -- and that file exists because the first fix
for it went on the class while Flask-AppBuilder had already captured the
bound method, so the gate was reported as installed and was not. This path
is bound the same way and had no test at all.

The carve-out is asserted too. ``save_to_dashboard_id`` on this same call
attaches the chart to a dashboard, which changes that dashboard for its
viewers (129069). It is deliberately **not** captured, because replaying it
means re-attaching a chart to a dashboard and no command expresses that --
capturing a request approval cannot apply would turn a visible bug into a
silent one. That is a decision, so it is pinned here rather than left to be
rediscovered as a defect.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings
from asset_approval.types import AssetType
from pytest_mock import MockerFixture

SLICE_ID = 44


@pytest.fixture
def captured(mocker: MockerFixture) -> Any:
    return mocker.patch.object(bindings, "gate_write")


def _explore_request(mocker: MockerFixture, action: str | None) -> None:
    """The request this view reads: its args, and Explore's form data.

    Patched where the gate imports them -- it does both imports inside the
    function body, so the module attribute it reads is the real one at call
    time, not anything bound when this module loaded.
    """
    args = {"action": action, "slice_name": "Signups by week"}
    mocker.patch(
        "flask.request",
        SimpleNamespace(args=SimpleNamespace(get=args.get)),
    )
    mocker.patch(
        "superset.views.utils.get_form_data",
        return_value=({"viz_type": "echarts_timeseries_bar"}, None),
    )
    mocker.patch("superset.utils.core.remove_extra_adhoc_filters")


def test_an_overwrite_is_captured(
    captured: Any, mocker: MockerFixture
) -> None:
    _explore_request(mocker, "overwrite")

    bindings._gate_legacy_slice_save(
        SimpleNamespace(id=SLICE_ID),
        datasource_id=3,
        datasource_type="table",
    )

    captured.assert_called_once()
    asset_type, asset_id, payload = captured.call_args.args
    assert asset_type is AssetType.CHART
    assert asset_id == SLICE_ID
    assert payload["slice_name"] == "Signups by week"
    assert payload["viz_type"] == "echarts_timeseries_bar"
    assert payload["datasource_id"] == 3


def test_the_dashboard_attachment_is_not_captured(
    captured: Any, mocker: MockerFixture
) -> None:
    """129069's half of this call, pinned as the decision it is.

    If this ever starts being captured, the request has to be one approval
    can replay -- so this test failing means read the comment on
    ``_gate_legacy_slice_save`` before changing it.
    """
    _explore_request(mocker, "overwrite")

    bindings._gate_legacy_slice_save(SimpleNamespace(id=SLICE_ID))

    payload = captured.call_args.args[2]
    assert "save_to_dashboard_id" not in payload


@pytest.mark.parametrize("action", ["saveas", None, ""])
def test_anything_that_is_not_an_overwrite_is_left_alone(
    captured: Any, mocker: MockerFixture, action: str | None
) -> None:
    """Save-as creates a new chart; a create is not a governed write."""
    _explore_request(mocker, action)

    bindings._gate_legacy_slice_save(SimpleNamespace(id=SLICE_ID))

    captured.assert_not_called()


def test_a_slice_with_no_id_is_left_alone(
    captured: Any, mocker: MockerFixture
) -> None:
    """Nothing to review yet, and nothing to attribute a request to."""
    _explore_request(mocker, "overwrite")

    bindings._gate_legacy_slice_save(None)
    bindings._gate_legacy_slice_save(SimpleNamespace(id=None))

    captured.assert_not_called()


def test_the_path_is_bound_on_the_method_not_the_command() -> None:
    """The structural half, and the lesson of ``test_route_rebinding``.

    Binding this on a command would report a gate that the route never
    reaches, which is exactly how its sibling read "Fixed" while live
    content was still changing.
    """
    paths = [
        path
        for path in bindings.WRITE_PATHS
        if path.attr == "save_or_overwrite_slice"
    ]

    assert len(paths) == 1, "Explore's legacy save must be bound exactly once"
    (path,) = paths
    assert path.via == "method"
    assert path.gate is bindings._gate_legacy_slice_save
