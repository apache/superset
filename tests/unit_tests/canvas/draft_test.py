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
"""Canvas drafts: isolated, principal-bound, strictly committed."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.canvas.definition.schemas import DraftOperationsRequest, empty_definition
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.exceptions import SupersetSecurityException
from tests.unit_tests.canvas.fixtures import FakeResolver

DRAFT = "superset.commands.canvas.draft"


class Store:
    """An in-memory stand-in for the Explore temporary-state cache."""

    def __init__(self) -> None:
        self.entries: dict[str, Any] = {}
        self.user_id = 1

    def get(self, key: str) -> Any:
        return self.entries.get(key)

    def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
        self.entries[key] = value
        return True

    def delete(self, key: str) -> bool:
        return self.entries.pop(key, None) is not None


@pytest.fixture
def store(mocker: MockerFixture, widget_types: FakeResolver) -> Store:
    fake = Store()
    mocker.patch(f"{DRAFT}.cache_manager", MagicMock(explore_form_data_cache=fake))
    mocker.patch(f"{DRAFT}.get_user_id", side_effect=lambda: fake.user_id)
    mocker.patch(
        f"{DRAFT}.current_app", MagicMock(config={"CANVAS_DRAFT_TTL_SECONDS": 60})
    )
    canvas = MagicMock(id=7, revision=3)
    dao = mocker.patch(f"{DRAFT}.CanvasDAO")
    dao.find_by_id_or_uuid.return_value = canvas
    dao.load.return_value = empty_definition()
    mocker.patch(f"{DRAFT}.security_manager", new_callable=MagicMock)
    return fake


def ops(*raw: dict[str, Any]) -> Any:
    return DraftOperationsRequest.model_validate({"revision": 0, "ops": list(raw)}).ops


ADD = {"op": "add", "id": "chart", "widgetId": "chart-1"}


def test_a_draft_starts_from_the_canvas_and_changes_only_itself(store: Store) -> None:
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CreateCanvasDraftCommand,
        load_draft,
    )

    draft = CreateCanvasDraftCommand(7).run()
    assert (draft.base_revision, draft.revision) == (3, 0)

    draft, logged = ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run()

    assert draft.revision == 1
    assert list(draft.definition["nodes"]) == ["chart"]
    assert logged == [
        {
            "op": "add",
            "id": "chart",
            "widgetId": "chart-1",
            "layout": {},
            "parent": "root",
        }
    ]
    assert list(load_draft(draft.token).definition["nodes"]) == ["chart"]


def test_a_write_must_be_based_on_the_draft_revision(store: Store) -> None:
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CreateCanvasDraftCommand,
    )

    draft = CreateCanvasDraftCommand(7).run()
    ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run()

    with pytest.raises(DraftConflictError) as excinfo:
        ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run()
    assert excinfo.value.to_payload()["revision"] == 1


def test_draft_writes_are_validated_like_canvas_writes(store: Store) -> None:
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CreateCanvasDraftCommand,
    )

    draft = CreateCanvasDraftCommand(7).run()

    with pytest.raises(DefinitionInvalidError):
        ApplyCanvasDraftOperationsCommand(
            draft.token, 0, ops({"op": "add", "widgetId": "chart-secret"})
        ).run()


def test_only_the_draft_author_can_use_its_token(store: Store) -> None:
    from superset.commands.canvas.draft import CreateCanvasDraftCommand, load_draft

    draft = CreateCanvasDraftCommand(7).run()
    store.user_id = 2

    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(draft.token)


@pytest.mark.parametrize(
    "token", ["not-a-uuid", "00000000-0000-4000-8000-000000000000"]
)
def test_unknown_tokens_are_not_found(store: Store, token: str) -> None:
    from superset.commands.canvas.draft import load_draft

    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(token)


def test_expired_drafts_are_not_found(store: Store) -> None:
    from superset.commands.canvas.draft import CreateCanvasDraftCommand, load_draft

    draft = CreateCanvasDraftCommand(7).run()
    store.entries.clear()  # the cache dropped it after the timeout

    with pytest.raises(CanvasDraftNotFoundError):
        load_draft(draft.token)


def test_losing_editorship_closes_the_draft(store: Store) -> None:
    from superset.commands.canvas import draft as drafts

    draft = drafts.CreateCanvasDraftCommand(7).run()
    security: Any = drafts.security_manager
    security.raise_for_editorship.side_effect = SupersetSecurityException(MagicMock())

    with pytest.raises(CanvasForbiddenError):
        drafts.load_draft(draft.token)


def test_commit_replays_the_ops_strictly_and_deletes_the_draft(
    store: Store, mocker: MockerFixture
) -> None:
    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
    )

    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    command.return_value.run.return_value = MagicMock(revision=4)
    draft = CreateCanvasDraftCommand(7).run()
    ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run()

    result = CommitCanvasDraftCommand(draft.token, 1).run()

    canvas_id, base_revision, replayed = command.call_args.args
    assert (canvas_id, base_revision) == (7, 3)
    assert [op.id for op in replayed] == ["chart"]
    assert command.call_args.kwargs["strict"] is True
    assert command.call_args.kwargs["widgets"] == {}
    # Grouped by the request that carried them, so the replay resolves layout
    # where the draft resolved it.
    batches = command.call_args.kwargs["batches"]
    assert [[op.id for op in batch] for batch in batches] == [["chart"]]
    assert result is not None
    assert result.revision == 4
    assert store.entries == {}


def test_commit_needs_the_current_draft_revision(store: Store) -> None:
    from superset.commands.canvas.draft import (
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
    )

    draft = CreateCanvasDraftCommand(7).run()

    with pytest.raises(DraftConflictError):
        CommitCanvasDraftCommand(draft.token, 5).run()


def test_committing_an_empty_draft_changes_nothing(
    store: Store, mocker: MockerFixture
) -> None:
    from superset.commands.canvas.draft import (
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
    )

    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    draft = CreateCanvasDraftCommand(7).run()

    assert CommitCanvasDraftCommand(draft.token, 0).run() is None
    command.assert_not_called()


def test_drafts_are_stored_as_json_strings(store: Store) -> None:
    from superset.commands.canvas.draft import CreateCanvasDraftCommand

    draft = CreateCanvasDraftCommand(7).run()

    ((key, value),) = store.entries.items()
    assert key == f"canvas_draft:{draft.token}"
    assert isinstance(value, str)


def test_draft_payload_reports_whether_the_caller_may_edit(
    store: Store, mocker: MockerFixture
) -> None:
    """
    A client gates drag and resize on ``canEdit`` on either surface, so the
    draft payload carries it too. Object editorship is already settled by
    ``load_draft``; what's left to report is the route-level permission.
    """
    from superset.commands.canvas.draft import CreateCanvasDraftCommand, draft_payload

    draft = CreateCanvasDraftCommand(7).run()

    # Granting every permission would pass whichever one production checks, so
    # each case allows exactly one.
    allowed = mocker.patch(f"{DRAFT}.security_manager.can_access")
    allowed.side_effect = lambda permission, view: (
        permission == "can_write" and view == "Canvas"
    )
    assert draft_payload(draft)["canEdit"] is True
    # Also present on the unresolved payload the create response returns.
    assert draft_payload(draft, resolved=False)["canEdit"] is True

    # Read-only on Canvas: enough to open the draft, not to change it.
    allowed.side_effect = lambda permission, view: (
        permission == "can_read" and view == "Canvas"
    )
    assert draft_payload(draft)["canEdit"] is False


def test_a_draft_holds_the_widgets_it_creates_and_commits_them(
    store: Store, mocker: MockerFixture
) -> None:
    from superset_core.canvas import StoredWidget

    from superset.commands.canvas.draft import (
        ApplyCanvasDraftOperationsCommand,
        CommitCanvasDraftCommand,
        CreateCanvasDraftCommand,
        load_draft,
    )

    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    draft = CreateCanvasDraftCommand(7).run()
    draft, logged = ApplyCanvasDraftOperationsCommand(
        draft.token,
        0,
        ops({"op": "add", "id": "sales", "widgetType": "chart", "name": "Sales"}),
    ).run()
    widget_id = logged[0]["widgetId"]
    # Edits to a widget are held with it, not replayed on the canvas.
    ApplyCanvasDraftOperationsCommand(
        draft.token,
        1,
        ops({"op": "set_props", "id": "sales", "props": {"metric": "avg"}}),
    ).run()

    reloaded = load_draft(draft.token)
    assert reloaded.widgets == {
        widget_id: StoredWidget("chart", 1, "Sales", {"metric": "avg"})
    }
    # One group per request. The first carried the `add`; the second changed
    # only the widget's props, which applies to the widget entity rather than
    # the canvas, so its group is empty -- it still marks a step, and the
    # widgets recorded beside it are what undo would put back.
    assert [[op["op"] for op in group] for group in reloaded.ops] == [["add"], []]
    assert len(reloaded.widget_history) == 2

    CommitCanvasDraftCommand(draft.token, 2).run()

    assert command.call_args.kwargs["widgets"] == reloaded.widgets


def test_a_draft_that_only_changes_widgets_still_commits(
    store: Store, mocker: MockerFixture
) -> None:
    from superset.canvas.definition.schemas import empty_definition
    from superset.commands.canvas import draft as drafts

    placed = empty_definition()
    placed["root"]["children"] = ["chart"]
    placed["nodes"]["chart"] = {"widgetId": "chart-1", "layout": {}}
    dao: Any = drafts.CanvasDAO
    dao.load.return_value = placed
    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    draft = drafts.CreateCanvasDraftCommand(7).run()
    drafts.ApplyCanvasDraftOperationsCommand(
        draft.token, 0, ops({"op": "set_props", "id": "chart", "props": {}})
    ).run()

    drafts.CommitCanvasDraftCommand(draft.token, 1).run()

    assert command.call_args.args[2] == []
    assert set(command.call_args.kwargs["widgets"]) == {"chart-1"}


def test_publishing_a_multi_op_request_lays_out_as_the_draft_showed(
    store: Store, mocker: MockerFixture
) -> None:
    """
    End to end through the commands: what the commit sends has to reproduce
    the layout the draft showed.

    The UI batches gestures into one request while a save is in flight, so a
    request carrying several moves is the ordinary case rather than an edge
    one. ``ApplyCanvasOperationsCommand`` needs a database, so it is replaced
    here and the batches it was handed are replayed against the same starting
    definition instead.
    """
    from superset.canvas.definition.render import render_context
    from superset.commands.canvas import draft as drafts
    from superset.commands.canvas.apply_ops import apply_batches

    def base() -> dict[str, Any]:
        definition = empty_definition()
        definition["root"]["children"] = ["a", "b", "c"]
        for index, node_id in enumerate(("a", "b", "c")):
            definition["nodes"][node_id] = {
                "widgetType": "markdown",
                "schemaVersion": 1,
                "props": {},
                "layout": {
                    "col": 1,
                    "row": index + 1,
                    "colSpan": 24,
                    "rowSpan": 1,
                },
            }
        return definition

    def rows(definition: dict[str, Any]) -> dict[str, int]:
        placements = render_context(definition)["placements"]
        return {node: rect["row"] for node, rect in sorted(placements.items())}

    def place(node_id: str, row: int) -> dict[str, Any]:
        return {
            "op": "place",
            "id": node_id,
            "layout": {"col": 1, "row": row, "colSpan": 24, "rowSpan": 1},
        }

    dao: Any = drafts.CanvasDAO
    dao.load.return_value = base()
    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    command.return_value.run.return_value = MagicMock(revision=4)

    draft = drafts.CreateCanvasDraftCommand(7).run()
    # One request, two moves: 'a' down onto 'b' and 'b' up into its place.
    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token, 0, ops(place("a", 2), place("b", 1))
    ).run()

    # What the draft shows: the two swapped, and 'c' left alone.
    assert rows(draft.definition) == {"a": 2, "b": 1, "c": 3}

    drafts.CommitCanvasDraftCommand(draft.token, 1).run()

    batches = command.call_args.kwargs["batches"]
    # One request in, one batch out.
    assert len(batches) == 1
    published, _ = apply_batches(base(), batches)

    assert rows(published) == rows(draft.definition)


def test_a_draft_written_before_grouping_is_still_readable(store: Store) -> None:
    """
    Drafts are cache entries, so some are open across a deploy. One written as
    a flat log reads as a single group, which is how it would have been
    replayed when it was written.
    """
    from superset.commands.canvas.draft import _op_groups

    flat = [{"op": "place", "id": "a"}, {"op": "place", "id": "b"}]
    assert _op_groups({"ops": flat}) == [flat]
    assert _op_groups({"ops": []}) == []

    grouped = [[{"op": "place", "id": "a"}], [{"op": "place", "id": "b"}]]
    assert _op_groups({"ops": grouped, "opsGrouped": True}) == grouped
    assert _op_groups({"ops": [], "opsGrouped": True}) == []


def test_undo_steps_the_draft_back_a_request_at_a_time(
    store: Store, mocker: MockerFixture
) -> None:
    """
    One request is one step, rebuilt rather than reversed: the last group of
    operations comes off and the rest are replayed.
    """
    from superset.canvas.definition.render import render_context
    from superset.commands.canvas import draft as drafts

    def base() -> dict[str, Any]:
        definition = empty_definition()
        definition["root"]["children"] = ["a", "b"]
        for index, node_id in enumerate(("a", "b")):
            definition["nodes"][node_id] = {
                "widgetType": "markdown",
                "schemaVersion": 1,
                "props": {},
                "layout": {"col": 1, "row": index * 2 + 1, "colSpan": 24, "rowSpan": 2},
            }
        return definition

    def rows(definition: dict[str, Any]) -> dict[str, int]:
        placements = render_context(definition)["placements"]
        return {node: rect["row"] for node, rect in sorted(placements.items())}

    def place(node_id: str, row: int) -> dict[str, Any]:
        return {
            "op": "place",
            "id": node_id,
            "layout": {"col": 1, "row": row, "colSpan": 24, "rowSpan": 2},
        }

    dao: Any = drafts.CanvasDAO
    dao.load.return_value = base()

    draft = drafts.CreateCanvasDraftCommand(7).run()
    assert drafts.draft_payload(draft, resolved=False)["canUndo"] is False

    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token, 0, ops(place("a", 5))
    ).run()
    assert rows(draft.definition) == {"a": 5, "b": 3}

    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token, 1, ops(place("b", 9))
    ).run()
    assert rows(draft.definition) == {"a": 5, "b": 9}

    # Back one step: the second request is gone, the first still stands.
    draft = drafts.RewindCanvasDraftCommand(draft.token, 2).run()
    assert rows(draft.definition) == {"a": 5, "b": 3}
    payload = drafts.draft_payload(draft, resolved=False)
    assert (payload["canUndo"], payload["canRedo"]) == (True, True)

    # And back again: the canvas as it started.
    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    assert rows(draft.definition) == {"a": 1, "b": 3}
    assert drafts.draft_payload(draft, resolved=False)["canUndo"] is False

    # Forward twice returns to where the draft was.
    draft = drafts.RewindCanvasDraftCommand(
        draft.token, draft.revision, forward=True
    ).run()
    draft = drafts.RewindCanvasDraftCommand(
        draft.token, draft.revision, forward=True
    ).run()
    assert rows(draft.definition) == {"a": 5, "b": 9}
    assert drafts.draft_payload(draft, resolved=False)["canRedo"] is False


def test_a_new_change_discards_what_was_undone(
    store: Store, mocker: MockerFixture
) -> None:
    from superset.commands.canvas import draft as drafts

    placed = empty_definition()
    placed["root"]["children"] = ["a"]
    placed["nodes"]["a"] = {
        "widgetType": "markdown",
        "schemaVersion": 1,
        "props": {},
        "layout": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 2},
    }
    dao: Any = drafts.CanvasDAO
    dao.load.return_value = placed

    def place(row: int) -> dict[str, Any]:
        return {
            "op": "place",
            "id": "a",
            "layout": {"col": 1, "row": row, "colSpan": 24, "rowSpan": 2},
        }

    draft = drafts.CreateCanvasDraftCommand(7).run()
    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token, 0, ops(place(5))
    ).run()
    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    assert draft.can_redo is True

    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token, draft.revision, ops(place(9))
    ).run()

    # The branch that was undone is gone, as a redo stack does.
    assert draft.can_redo is False


def test_undo_restores_a_widget_prop_edit(store: Store, mocker: MockerFixture) -> None:
    """
    The case the widget history exists for.

    A prop edit applies to the widget entity rather than to the canvas, so it
    is not in the replayable log at all. Replaying the operations could never
    put it back; the widgets recorded beside each step are what does.
    """
    from superset.commands.canvas import draft as drafts

    mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    draft = drafts.CreateCanvasDraftCommand(7).run()
    draft, logged = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token,
        0,
        ops({"op": "add", "id": "sales", "widgetType": "chart", "name": "Sales"}),
    ).run()
    widget_id = logged[0]["widgetId"]

    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(
        draft.token,
        draft.revision,
        ops({"op": "set_props", "id": "sales", "props": {"metric": "avg"}}),
    ).run()
    assert draft.widgets[widget_id].props == {"metric": "avg"}

    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()

    # The props are back, and the widget the `add` minted is still there.
    assert draft.widgets[widget_id].props == {}
    assert "sales" in draft.definition["nodes"]


def test_a_draft_written_before_history_cannot_undo(store: Store) -> None:
    """
    Drafts are cache entries, so some are open across a deploy. One with
    operations but no recorded widgets reports that undo is unavailable rather
    than rebuilding to a state it cannot know.
    """
    from superset.commands.canvas.draft import CanvasDraft, draft_payload

    draft = CanvasDraft(
        token="tok",  # noqa: S106
        owner_id=1,
        canvas_id=7,
        base_revision=3,
        revision=2,
        definition=empty_definition(),
        ops=[[{"op": "place", "id": "a", "layout": {}}]],
    )

    assert draft.can_undo is False
    assert draft_payload(draft, resolved=False)["canUndo"] is False
