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
"""Extensions read placed widgets through ``superset_core.canvas.placements``."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils import json
from tests.unit_tests.canvas.fixtures import FakeResolver

pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)

BINDING = {"datasetId": 13, "metrics": ["count"], "dimensions": ["country"]}


@pytest.fixture
def canvas(
    session: Session, mocker: MockerFixture, widget_types: FakeResolver
) -> Iterator[Any]:
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas

    definition = empty_definition()
    definition["root"]["children"] = ["chart", "text"]
    widget_types.props["chart-1"] = {"dataBinding": BINDING}
    definition["nodes"] = {
        "chart": {"widgetId": "chart-1"},
        "text": {"widgetType": "markdown", "props": {}},
    }
    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    canvas = Canvas(
        id=100,
        title="Exec overview",
        definition=json.dumps(definition),
        definition_version=1,
        revision=1,
    )
    session.add(canvas)
    session.commit()
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    yield canvas
    session.rollback()


@pytest.fixture
def placements(monkeypatch: pytest.MonkeyPatch) -> Any:
    from superset_core.canvas import placements

    from superset.core.api.core_api_injection import inject_canvas_implementations

    # Puts back whatever the app injected, once the test ends.
    for name in ("load_placed_widget", "editable_widgets"):
        monkeypatch.setattr(placements, name, getattr(placements, name))
    inject_canvas_implementations()
    return placements


def test_a_placement_loads_with_its_widget_type_and_props(
    full_api_access: None, canvas: Any, widget_types: FakeResolver
) -> None:
    from superset.commands.canvas.exceptions import CanvasPlacementNotFoundError
    from superset.commands.canvas.placement_data import load_placement, StoredPlacement

    assert load_placement("100", "chart") == StoredPlacement(
        widget_type="chart",
        props={"dataBinding": BINDING},
        widget_id="chart-1",
        widget=widget_types.widgets({"chart-1"})["chart-1"],
    )
    assert load_placement("100", "text") == StoredPlacement(
        widget_type="markdown", props={}
    )
    with pytest.raises(CanvasPlacementNotFoundError):
        load_placement("100", "missing")


def test_extensions_read_a_placed_widget_with_the_canvas_access_rules(
    full_api_access: None,
    canvas: Any,
    widget_types: FakeResolver,
    placements: Any,
    mocker: MockerFixture,
) -> None:
    from superset.commands.canvas.exceptions import CanvasForbiddenError

    mocker.patch(
        "superset.commands.canvas.placement_data.load_draft",
        side_effect=CanvasForbiddenError(),
    )

    assert placements.load_placed_widget("100", "chart") == (
        "chart-1",
        widget_types.widgets({"chart-1"})["chart-1"],
    )
    # A missing placement or canvas, a draft the caller may not use, and a
    # placement that stores its own content all look the same.
    for canvas_id, placement_id, token in [
        ("100", "missing", None),
        ("101", "chart", None),
        ("100", "chart", "token"),
        ("100", "text", None),
    ]:
        with pytest.raises(placements.PlacementNotFoundError):
            placements.load_placed_widget(canvas_id, placement_id, token)


def test_a_placement_reads_from_the_callers_own_draft(
    full_api_access: None,
    canvas: Any,
    widget_types: FakeResolver,
    placements: Any,
    mocker: MockerFixture,
) -> None:
    from unittest.mock import MagicMock

    widget_types.props["chart-2"] = {"dataBinding": {**BINDING, "datasetId": 14}}
    draft = mocker.patch(
        "superset.commands.canvas.placement_data.load_draft",
        return_value=MagicMock(
            canvas_id=100,
            definition={"nodes": {"chart": {"widgetId": "chart-2"}}},
            resolver=lambda: widget_types,
        ),
    )

    widget_id, widget = placements.load_placed_widget("100", "chart", "token")

    assert (widget_id, widget.props["dataBinding"]["datasetId"]) == ("chart-2", 14)
    draft.assert_called_once_with("token")


def test_extensions_learn_which_widgets_the_caller_may_change(
    full_api_access: None,
    widget_types: FakeResolver,
    placements: Any,
) -> None:
    widget_types.readonly = {"chart-2"}

    assert placements.editable_widgets({"chart-1", "chart-2", "missing-3"}) == {
        "chart-1"
    }
    assert placements.editable_widgets(set()) == set()


def test_extensions_get_no_unfiltered_read_of_saved_widgets() -> None:
    """Canvases read placed widgets without an access filter, since a canvas
    grants read access to what it places; that resolver stays the host's."""
    from superset_core.canvas import placements

    public = {name for name in vars(placements) if not name.startswith("_")}

    assert "get_widget_resolver" not in public
    assert {"load_placed_widget", "editable_widgets"} <= public
