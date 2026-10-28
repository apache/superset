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
"""Widgets a canvas places are their own entities, saved with the canvas."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from superset_core.canvas import StoredWidget

from superset.utils import json
from tests.unit_tests.canvas.fixtures import FakeResolver

pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)

URL = "/api/v1/canvas/100/definition"


@pytest.fixture
def canvas(
    session: Session, mocker: MockerFixture, widget_types: FakeResolver
) -> Iterator[Any]:
    from superset.canvas.definition import registry
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas
    from superset.subjects.models import Subject

    # The test widget types, but widgets from the ``widgets`` table.
    registry.set_widget_resolver(None)
    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    editor = Subject(id=5, label="alice", type=1)
    canvas = Canvas(
        id=100,
        title="Exec overview",
        definition=json.dumps(empty_definition()),
        definition_version=1,
        revision=1,
        editors=[editor],
    )
    session.add(canvas)
    session.commit()
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    mocker.patch("superset.security_manager.raise_for_editorship")
    mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")
    yield canvas
    session.rollback()


def saved_widget(session: Session, widget_id: str) -> Any:
    from superset.widgets.models import Widget

    return session.query(Widget).filter(Widget.uuid == UUID(widget_id)).one()


def test_adding_a_chart_creates_a_widget_the_canvas_editors_edit(
    client: Any, full_api_access: None, canvas: Any, session: Session
) -> None:
    response = client.patch(
        URL,
        json={
            "base_revision": 1,
            "ops": [
                {
                    "op": "add",
                    "id": "sales",
                    "widgetType": "chart",
                    "name": "Sales",
                    "props": {"metric": "sum"},
                },
                {"op": "add", "id": "notes", "widgetType": "markdown"},
            ],
        },
    )

    assert response.status_code == 200
    result = response.json["result"]
    nodes = json.loads(canvas.definition)["nodes"]
    widget_id = nodes["sales"]["widgetId"]
    widget = saved_widget(session, widget_id)
    assert (widget.widget_type, widget.name, widget.props) == (
        "chart",
        "Sales",
        {"metric": "sum"},
    )
    assert [subject.id for subject in widget.editors] == [5]
    # Text stays part of the canvas.
    assert nodes["notes"]["widgetType"] == "markdown"
    assert result["widgets"] == {
        widget_id: {
            "widgetType": "chart",
            "schemaVersion": 1,
            "name": "Sales",
            "props": {"metric": "sum"},
        }
    }

    definition = client.get(URL).json["result"]
    assert definition["widgets"][widget_id]["props"] == {"metric": "sum"}


def test_changing_a_placed_widget_saves_the_widget_not_the_canvas(
    client: Any, full_api_access: None, canvas: Any, session: Session
) -> None:
    client.patch(
        URL,
        json={
            "base_revision": 1,
            "ops": [{"op": "add", "id": "sales", "widgetType": "chart"}],
        },
    )
    widget_id = json.loads(canvas.definition)["nodes"]["sales"]["widgetId"]

    response = client.patch(
        URL,
        json={
            "base_revision": 2,
            "ops": [{"op": "set_props", "id": "sales", "props": {"metric": "avg"}}],
        },
    )

    assert response.status_code == 200
    widget = saved_widget(session, widget_id)
    assert widget.props == {"metric": "avg"}
    assert widget.revision == 2
    # The canvas itself didn't change: nothing to replay.
    changes = client.get(f"{URL}/changes?since=2").json["result"]
    assert changes["revision"] == 3
    assert changes["changes"] == []


def test_a_draft_commit_fails_if_a_widget_it_changed_was_saved_since(
    client: Any, full_api_access: None, canvas: Any, session: Session
) -> None:
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
    from superset.commands.canvas.exceptions import DraftConflictError

    client.patch(
        URL,
        json={
            "base_revision": 1,
            "ops": [{"op": "add", "id": "sales", "widgetType": "chart"}],
        },
    )
    widget_id = json.loads(canvas.definition)["nodes"]["sales"]["widgetId"]
    saved_widget(session, widget_id).revision = 2
    session.commit()

    with pytest.raises(DraftConflictError) as excinfo:
        ApplyCanvasOperationsCommand(
            100,
            2,
            [],
            strict=True,
            widgets={widget_id: StoredWidget("chart", 1, "Chart", {}, revision=1)},
        ).run()

    assert excinfo.value.widgets == [widget_id]
    assert saved_widget(session, widget_id).props == {}


def test_publishing_a_draft_resolves_layout_once_per_request(
    client: Any, full_api_access: None, canvas: Any, session: Session
) -> None:
    """
    The real command, so the branch that replays a draft batch by batch is
    the one under test.

    Replaying the whole log with a single resolve reaches a different layout
    from the one the draft showed: drag a widget over another and back, and
    the one that was pushed aside returns to where it started instead of
    staying put. Driving ``apply_batches`` directly would not notice, since
    nothing would check that the command actually chooses it.
    """
    from superset.canvas.definition.render import render_context
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
    from superset.commands.canvas.draft import OPERATIONS

    def place(node_id: str, row: int) -> dict[str, Any]:
        return {
            "op": "place",
            "id": node_id,
            "layout": {"col": 1, "row": row, "colSpan": 24, "rowSpan": 2},
        }

    # Two full-width widgets, two rows each, stacked at rows 1 and 3.
    client.patch(
        URL,
        json={
            "base_revision": 1,
            "ops": [
                {
                    "op": "add",
                    "id": node_id,
                    "widgetType": "chart",
                    "layout": {"col": 1, "row": row, "colSpan": 24, "rowSpan": 2},
                }
                for node_id, row in (("a", 1), ("b", 3))
            ],
        },
    )
    session.refresh(canvas)
    revision = canvas.revision

    # Two requests, as a draft records them: 'a' dropped onto 'b', then back.
    batches = [
        OPERATIONS.validate_python([place("a", 3)]),
        OPERATIONS.validate_python([place("a", 1)]),
    ]
    ApplyCanvasOperationsCommand(
        100,
        revision,
        [op for batch in batches for op in batch],
        strict=True,
        batches=batches,
    ).run()

    session.refresh(canvas)
    placements = render_context(json.loads(canvas.definition))["placements"]
    rows = {node: rect["row"] for node, rect in placements.items()}

    # What the draft showed: 'b' was pushed aside and stayed there. Resolving
    # the whole log at once would put it back at row 3.
    assert rows == {"a": 1, "b": 5}
