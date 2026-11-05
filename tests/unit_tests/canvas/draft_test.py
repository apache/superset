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

from collections.abc import Callable
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.canvas.definition.schemas import DraftOperationsRequest, empty_definition
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    CanvasNotFoundError,
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
    assert excinfo.value.to_payload()["draftRevision"] == 1
    assert excinfo.value.to_payload()["error_type"] == "DraftRevisionConflict"
    assert "currentCanvasRevision" not in excinfo.value.to_payload()


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
    assert store.entries


def test_a_missing_canvas_keeps_its_existing_not_found_error(store: Store) -> None:
    """An owned token is not reclassified when its canvas disappears."""
    from superset.commands.canvas import draft as drafts

    draft = drafts.CreateCanvasDraftCommand(7).run()
    dao: Any = drafts.CanvasDAO
    dao.find_by_id_or_uuid.return_value = None

    with pytest.raises(CanvasNotFoundError):
        drafts.load_draft(draft.token)
    assert store.entries


@pytest.mark.parametrize("action", ["get", "apply", "commit"])
def test_discarded_drafts_cannot_be_read_changed_or_committed(
    store: Store, action: str
) -> None:
    """A discarded token never reconstructs private or published state."""
    from superset.commands.canvas import draft as drafts

    draft = drafts.CreateCanvasDraftCommand(7).run()
    drafts.DeleteCanvasDraftCommand(draft.token).run()
    calls: dict[str, Callable[[], object]] = {
        "get": lambda: drafts.load_draft(draft.token),
        "apply": drafts.ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run,
        "commit": drafts.CommitCanvasDraftCommand(draft.token, 0).run,
    }

    with pytest.raises(CanvasDraftNotFoundError):
        calls[action]()
    assert store.entries == {}


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
    assert command.call_args.kwargs == {"strict": True, "widgets": {}}
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

    assert CommitCanvasDraftCommand(draft.token, 0).run().revision == 3
    command.assert_not_called()
    assert store.entries == {}


def test_mutating_commit_keeps_its_revision_after_a_later_published_change(
    store: Store, mocker: MockerFixture
) -> None:
    """A response describes this commit, not a later published write."""
    from superset.commands.canvas import draft as drafts
    from superset.commands.canvas.apply_ops import ApplyResult

    dao: Any = drafts.CanvasDAO

    def publish_then_advance() -> ApplyResult:
        """Return this commit after another writer advances the canvas."""
        dao.find_by_id_or_uuid.return_value.revision = 5
        return ApplyResult(4, [], {}, {})

    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    command.return_value.run.side_effect = publish_then_advance
    draft = drafts.CreateCanvasDraftCommand(7).run()
    drafts.ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run()

    result = drafts.CommitCanvasDraftCommand(draft.token, 1).run()

    assert result.revision == 4
    assert store.entries == {}


def test_drafts_are_stored_as_json_strings(store: Store) -> None:
    from superset.commands.canvas.draft import CreateCanvasDraftCommand

    draft = CreateCanvasDraftCommand(7).run()

    ((key, value),) = store.entries.items()
    assert key == f"canvas_draft:{draft.token}"
    assert isinstance(value, str)


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
    assert [op["op"] for op in reloaded.ops] == ["add"]

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
