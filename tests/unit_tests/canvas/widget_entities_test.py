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
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest
from cachelib import SimpleCache
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from superset_core.canvas import StoredWidget

from superset.utils import json
from tests.unit_tests.canvas.fixtures import FakeResolver, ops

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


@pytest.fixture
def draft_cache(mocker: MockerFixture) -> SimpleCache:
    """Keep draft state isolated while using the real widget database."""
    cache = SimpleCache()
    mocker.patch(
        "superset.commands.canvas.draft.cache_manager",
        SimpleNamespace(explore_form_data_cache=cache),
    )
    mocker.patch("superset.commands.canvas.draft.get_user_id", return_value=5)
    return cache


def publish_elsewhere(canvas: Any) -> None:
    """Publish a change to ``canvas`` without a draft, as another writer would."""
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand

    ApplyCanvasOperationsCommand(
        canvas.id, canvas.revision, ops({"op": "add", "widgetType": "markdown"})
    ).run()


def draft_canceling_a_new_widget(canvas: Any, calls: str) -> Any:
    """A draft of ``canvas`` that adds a new chart and then removes it."""
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CreateCanvasDraftCommand,
    )

    add = {"op": "add", "id": "canceled", "widgetType": "chart"}
    remove = {"op": "remove", "id": "canceled"}
    draft = CreateCanvasDraftCommand(canvas.id).run()
    for batch in [[add, remove]] if calls == "batch" else [[add], [remove]]:
        draft, _ = ApplyCanvasDraftOperationsCommand(
            draft.token, draft.revision, ops(*batch)
        ).run()
    return draft


def commit_draft(client: Any, draft: Any) -> Any:
    """Commit ``draft`` at its current revision through the REST API."""
    return client.post(
        "/api/v1/canvas/draft/commit",
        json={"revision": draft.revision},
        headers={"X-Canvas-Draft": draft.token},
    )


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


@pytest.mark.parametrize(
    "scenario",
    ["separate", "batch", "parent", "sibling", "shared_placement", "readded"],
)
def test_commit_after_removing_a_new_widget(
    canvas: Any, session: Session, draft_cache: SimpleCache, scenario: str
) -> None:
    """Canceled draft widgets never prevent commit or leave orphan rows."""
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
        draft_payload,
        load_draft,
    )
    from superset.commands.canvas.exceptions import CanvasDraftNotFoundError
    from superset.widgets.models import Widget

    draft = CreateCanvasDraftCommand(canvas.id).run()
    initial: list[dict[str, Any]] = []
    if scenario == "parent":
        initial.append({"op": "add", "id": "group", "widgetType": "group"})
    initial.append(
        {
            "op": "add",
            "id": "canceled",
            "widgetType": "chart",
            "parent": "group" if scenario == "parent" else "root",
        }
    )
    if scenario == "sibling":
        initial.append({"op": "add", "id": "kept", "widgetType": "chart"})
    removal = {"op": "remove", "id": "group" if scenario == "parent" else "canceled"}
    if scenario == "batch":
        initial.append(removal)
    draft, _ = ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(*initial)).run()
    if scenario in {"shared_placement", "readded"}:
        widget_id = draft.definition["nodes"]["canceled"]["widgetId"]
        placements = [{"op": "add", "id": "kept", "widgetId": widget_id}]
        if scenario == "readded":
            placements.insert(0, removal)
        draft, _ = ApplyCanvasDraftOperationsCommand(
            draft.token,
            draft.revision,
            ops(*placements),
        ).run()
    if scenario not in {"batch", "readded"}:
        draft, _ = ApplyCanvasDraftOperationsCommand(
            draft.token, draft.revision, ops(removal)
        ).run()
    expected = draft.definition
    visible_widget_ids = {
        node["widgetId"] for node in expected["nodes"].values() if "widgetId" in node
    }

    assert session.query(Widget).count() == 0
    assert set(draft_payload(draft)["widgets"]) == visible_widget_ids
    CommitCanvasDraftCommand(draft.token, draft.revision).run()

    assert json.loads(canvas.definition) == expected
    widgets = session.query(Widget).all()
    assert len(widgets) == len(visible_widget_ids)
    if widgets:
        assert str(widgets[0].uuid) == expected["nodes"]["kept"]["widgetId"]
    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(draft.token)


@pytest.mark.parametrize("calls", ["batch", "separate"])
def test_committing_a_canceled_new_widget_publishes_a_revision(
    client: Any,
    full_api_access: None,
    canvas: Any,
    session: Session,
    draft_cache: SimpleCache,
    mocker: MockerFixture,
    calls: str,
) -> None:
    """
    Changes that cancel out do not make an empty draft: it keeps both
    operations, and the canceled widget so they replay. Committing writes them
    as publishing the same batch without a draft does, leaving the definition
    as it was: the revision increments, viewers are notified, and the
    operation log records the ``add`` of a widget that is never saved, then
    its ``remove``. Closing such a draft without a write, as an empty draft
    closes, would be a change of behavior.
    """
    from superset.commands.canvas.draft import load_draft
    from superset.commands.canvas.exceptions import CanvasDraftNotFoundError
    from superset.widgets.models import Widget

    definition = json.loads(canvas.definition)
    draft = draft_canceling_a_new_widget(canvas, calls)
    widget_id = draft.ops[0]["widgetId"]
    # Nothing is left to publish, but the draft is not empty.
    assert draft.definition == definition
    assert [op["op"] for op in draft.ops] == ["add", "remove"]
    assert set(draft.widgets) == {widget_id}
    publish = mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")

    response = commit_draft(client, draft)

    assert response.status_code == 200
    assert response.json["result"] == {"canvasId": canvas.id, "revision": 2}
    assert canvas.revision == 2
    assert json.loads(canvas.definition) == definition
    assert session.query(Widget).count() == 0
    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(draft.token)
    assert [call.kwargs["payload"] for call in publish.call_args_list] == [
        {"entity_type": "canvas", "id": canvas.id}
    ]
    assert client.get(f"{URL}/changes?since=1").json["result"] == {
        "revision": 2,
        "changes": [{"revision": 2, "ops": draft.ops}],
    }


@pytest.mark.parametrize("calls", ["batch", "separate"])
def test_committing_a_canceled_new_widget_conflicts_where_an_empty_draft_closes(
    client: Any,
    full_api_access: None,
    canvas: Any,
    session: Session,
    draft_cache: SimpleCache,
    mocker: MockerFixture,
    calls: str,
) -> None:
    """
    Once the canvas changes after the fork, committing changes that cancel out
    is rejected as a canvas conflict and publishes nothing, while an empty
    draft forked at the same revision closes successfully.
    """
    from superset.commands.canvas.draft import CreateCanvasDraftCommand, load_draft
    from superset.commands.canvas.exceptions import CanvasDraftNotFoundError
    from superset.widgets.models import Widget

    canceled = draft_canceling_a_new_widget(canvas, calls)
    empty = CreateCanvasDraftCommand(canvas.id).run()
    publish_elsewhere(canvas)
    assert (canceled.base_revision, empty.base_revision, canvas.revision) == (1, 1, 2)
    published = (canvas.revision, canvas.definition)
    publish = mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")

    rejected = commit_draft(client, canceled)
    closed = commit_draft(client, empty)

    assert rejected.status_code == 409
    assert rejected.json["error_type"] == "CanvasRevisionConflict"
    assert rejected.json["canvasChanged"] is True
    assert rejected.json["revision"] == 2
    assert closed.status_code == 200
    assert closed.json["result"] == {"canvasId": canvas.id, "revision": 2}
    assert (canvas.revision, canvas.definition) == published
    assert session.query(Widget).count() == 0
    publish.assert_not_called()
    assert load_draft(canceled.token).to_value() == canceled.to_value()
    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(empty.token)


@pytest.mark.parametrize(
    ("external_publishes", "published_revision"), [(0, 1), (1, 2), (3, 4)]
)
def test_empty_draft_commit_reports_the_observed_published_revision(
    client: Any,
    full_api_access: None,
    canvas: Any,
    session: Session,
    draft_cache: SimpleCache,
    mocker: MockerFixture,
    external_publishes: int,
    published_revision: int,
) -> None:
    """
    Closing an empty draft reports published state without changing it.

    The draft forks at revision 1, with draft revision 0. Writes published
    after the fork make the observed revision differ from ``base_revision``,
    and three of them from ``base_revision + 1`` as well; they also change
    the definition, which the close must keep as published.
    """
    from superset.commands.canvas.draft import CreateCanvasDraftCommand, load_draft
    from superset.commands.canvas.exceptions import CanvasDraftNotFoundError
    from superset.widgets.models import Widget

    draft = CreateCanvasDraftCommand(canvas.id).run()
    for _ in range(external_publishes):
        publish_elsewhere(canvas)
    definition = canvas.definition
    assert (draft.base_revision, draft.revision) == (1, 0)
    assert canvas.revision == published_revision
    publish = mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")

    response = commit_draft(client, draft)

    assert response.status_code == 200
    assert response.json["result"] == {
        "canvasId": canvas.id,
        "revision": published_revision,
    }
    assert canvas.revision == published_revision
    assert canvas.definition == definition
    assert session.query(Widget).count() == 0
    publish.assert_not_called()
    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(draft.token)


@pytest.mark.parametrize("reset", ["scope", "settings"])
def test_nullable_resets_survive_draft_replay(
    canvas: Any, session: Session, draft_cache: SimpleCache, reset: str
) -> None:
    """Explicit reset values remain valid when the draft is committed."""
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
    )

    draft = CreateCanvasDraftCommand(canvas.id).run()
    operations: list[dict[str, Any]]
    if reset == "scope":
        operations = [
            {"op": "add", "id": "filter", "widgetType": "filter"},
            {
                "op": "set_scope",
                "id": "filter",
                "kind": "filter",
                "scope": {"mode": "global"},
            },
            {"op": "set_scope", "id": "filter", "kind": "filter", "scope": None},
        ]
    else:
        operations = [
            {"op": "set_settings", "key": "display", "value": {"showTimestamps": True}},
            {"op": "set_settings", "key": "display", "value": None},
        ]
    draft, _ = ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(*operations)).run()
    expected = draft.definition

    CommitCanvasDraftCommand(draft.token, draft.revision).run()

    assert json.loads(canvas.definition) == expected


@pytest.mark.parametrize("conflict", ["widget", "canvas", "draft"])
def test_commit_conflicts_preserve_the_draft_and_all_published_widgets(
    canvas: Any, session: Session, draft_cache: SimpleCache, conflict: str
) -> None:
    """Conflicts retain their provenance and roll back earlier widget writes."""
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
        load_draft,
    )
    from superset.commands.canvas.exceptions import DraftConflictError
    from superset.widgets.models import Widget

    ApplyCanvasOperationsCommand(
        canvas.id,
        canvas.revision,
        ops(
            {"op": "add", "id": "first", "widgetType": "chart"},
            {"op": "add", "id": "conflicted", "widgetType": "chart"},
        ),
    ).run()
    draft = CreateCanvasDraftCommand(canvas.id).run()
    draft, _ = ApplyCanvasDraftOperationsCommand(
        draft.token,
        draft.revision,
        ops(
            {"op": "add", "id": "new", "widgetType": "chart"},
            {"op": "set_props", "id": "first", "props": {"metric": "avg"}},
            {"op": "set_props", "id": "conflicted", "props": {"metric": "sum"}},
        ),
    ).run()
    conflicted_id = draft.definition["nodes"]["conflicted"]["widgetId"]
    edited = saved_widget(session, conflicted_id)
    edited.revision += 1
    edited.props = {"metric": "external"}
    if conflict != "widget":
        canvas.revision += 1
    session.commit()
    published_revision = canvas.revision
    published_definition = canvas.definition
    published_widgets = {
        str(widget.uuid): (widget.props, widget.revision)
        for widget in session.query(Widget).all()
    }
    submitted_revision = 0 if conflict == "draft" else draft.revision

    with pytest.raises(DraftConflictError) as excinfo:
        CommitCanvasDraftCommand(draft.token, submitted_revision).run()

    error = excinfo.value
    assert error.draft_revision == draft.revision
    if conflict == "draft":
        assert error.recovery_type == "DraftRevisionConflict"
        assert error.revision == draft.revision
        assert error.current_canvas_revision is None
    else:
        assert error.recovery_type == (
            "CanvasRevisionConflict"
            if conflict == "canvas"
            else "WidgetRevisionConflict"
        )
        assert error.revision == published_revision
        assert error.current_canvas_revision == published_revision
    assert error.canvas_changed is (conflict == "canvas")
    assert error.widgets == ([conflicted_id] if conflict == "widget" else [])
    session.expire_all()
    assert canvas.revision == published_revision
    assert canvas.definition == published_definition
    assert {
        str(widget.uuid): (widget.props, widget.revision)
        for widget in session.query(Widget).all()
    } == published_widgets
    assert load_draft(draft.token).to_value() == draft.to_value()


@pytest.mark.parametrize("draft_write", [True, False])
def test_invalid_middle_operation_leaves_no_draft_or_published_changes(
    canvas: Any, session: Session, draft_cache: SimpleCache, draft_write: bool
) -> None:
    """A valid creation before a bad operation leaves no partial changes."""
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CreateCanvasDraftCommand,
        load_draft,
    )
    from superset.commands.canvas.exceptions import DefinitionInvalidError
    from superset.widgets.models import Widget

    draft = CreateCanvasDraftCommand(canvas.id).run()
    definition, revision = canvas.definition, canvas.revision
    operations = ops(
        {"op": "add", "id": "first", "widgetType": "chart"},
        {"op": "remove", "id": "missing"},
        {"op": "add", "id": "last", "widgetType": "chart"},
    )
    command = (
        ApplyCanvasDraftOperationsCommand(draft.token, 0, operations)
        if draft_write
        else ApplyCanvasOperationsCommand(canvas.id, revision, operations)
    )

    with pytest.raises(DefinitionInvalidError) as excinfo:
        command.run()

    assert excinfo.value.operation_index == 1
    assert excinfo.value.issues[0].path == "/ops/1"
    assert session.query(Widget).count() == 0
    assert (canvas.definition, canvas.revision) == (definition, revision)
    assert load_draft(draft.token).to_value() == draft.to_value()


def test_removing_a_saved_widget_placement_preserves_its_deliberate_edit(
    canvas: Any, session: Session, draft_cache: SimpleCache
) -> None:
    """Pruning canceled creations never deletes or drops edits to saved widgets."""
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
    )
    from superset.widgets.models import Widget

    ApplyCanvasOperationsCommand(
        canvas.id,
        canvas.revision,
        ops({"op": "add", "id": "shared", "widgetType": "chart"}),
    ).run()
    widget_id = json.loads(canvas.definition)["nodes"]["shared"]["widgetId"]
    draft = CreateCanvasDraftCommand(canvas.id).run()
    draft, _ = ApplyCanvasDraftOperationsCommand(
        draft.token,
        draft.revision,
        ops(
            {"op": "set_props", "id": "shared", "props": {"metric": "avg"}},
            {"op": "remove", "id": "shared"},
        ),
    ).run()

    CommitCanvasDraftCommand(draft.token, draft.revision).run()

    assert json.loads(canvas.definition)["nodes"] == {}
    assert session.query(Widget).count() == 1
    widget = saved_widget(session, widget_id)
    assert widget.props == {"metric": "avg"}
    assert widget.revision == 2
