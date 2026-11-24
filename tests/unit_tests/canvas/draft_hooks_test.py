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
"""
Canvas draft events and recorded steps (``superset_core.canvas.drafts``):
what a widget whose content keeps a draft of its own hears of a canvas draft,
and how the canvas's undo and redo reach its steps.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from superset_core.canvas.drafts import CanvasDraftEvent, DraftStep, DraftStepError

from superset.canvas.definition.schemas import DraftOperationsRequest, empty_definition
from superset.commands.canvas.exceptions import (
    DraftConflictError,
    DraftStepFailedError,
)
from tests.unit_tests.canvas.draft_test import DRAFT, Store
from tests.unit_tests.canvas.fixtures import FakeResolver

KIND = "extensions.acme.notes.edit"
ADD = {"op": "add", "id": "notes", "widgetId": "chart-1"}


def ops(*raw: dict[str, Any]) -> Any:
    return DraftOperationsRequest.model_validate({"revision": 0, "ops": list(raw)}).ops


def step(after: str, before: str = "v0") -> DraftStep:
    return DraftStep(
        kind=KIND, payload={"before": before, "after": after}, widget_id="chart-1"
    )


class Handler:
    """Keeps what the canvas asked of it, and can refuse."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, DraftStep, str]] = []
        self.refusal: str | None = None

    def undo(self, recorded: DraftStep, token: str) -> None:
        self._call("undo", recorded, token)

    def redo(self, recorded: DraftStep, token: str) -> None:
        self._call("redo", recorded, token)

    def _call(self, name: str, recorded: DraftStep, token: str) -> None:
        if self.refusal is not None:
            raise DraftStepError(self.refusal)
        self.calls.append((name, recorded, token))


@pytest.fixture
def store(mocker: MockerFixture, widget_types: FakeResolver) -> Store:
    """The Explore cache in memory, and a canvas the caller may edit."""
    fake = Store()
    mocker.patch(f"{DRAFT}.cache_manager", MagicMock(explore_form_data_cache=fake))
    mocker.patch(f"{DRAFT}.get_user_id", side_effect=lambda: fake.user_id)
    mocker.patch(
        f"{DRAFT}.current_app", MagicMock(config={"CANVAS_DRAFT_TTL_SECONDS": 60})
    )
    canvas = MagicMock(id=7, revision=3, is_managed_externally=False)
    dao = mocker.patch(f"{DRAFT}.CanvasDAO")
    dao.find_by_id_or_uuid.return_value = canvas
    dao.load.return_value = empty_definition()
    mocker.patch(f"{DRAFT}.security_manager", new_callable=MagicMock)
    return fake


@pytest.fixture
def events() -> Iterator[list[CanvasDraftEvent]]:
    from superset.canvas import draft_hooks

    heard: list[CanvasDraftEvent] = []
    unsubscribe = draft_hooks.on_draft_event(heard.append)
    yield heard
    unsubscribe()


@pytest.fixture
def handler() -> Iterator[Handler]:
    from superset.canvas import draft_hooks

    registered = Handler()
    unregister = draft_hooks.register_step_handler(KIND, registered)
    yield registered
    unregister()


def placed_draft() -> Any:
    """A draft that places the saved widget ``chart-1`` as ``notes``."""
    from superset.commands.canvas import draft as drafts

    draft = drafts.CreateCanvasDraftCommand(7).run()
    draft, _ = drafts.ApplyCanvasDraftOperationsCommand(draft.token, 0, ops(ADD)).run()
    return draft


def test_a_recorded_step_is_a_step_of_the_draft_like_any_other(
    store: Store,
    widget_types: FakeResolver,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    recorded = drafts.RecordCanvasDraftStepCommand(
        draft.token, step("v1"), by=drafts.BY_AI
    ).run()

    assert recorded.revision == draft.revision + 1
    # It replays nothing: the canvas definition is the one it was.
    assert recorded.definition == draft.definition
    assert recorded.ops[-1] == []
    payload = drafts.draft_payload(recorded)
    assert payload["canUndo"] is True
    assert payload["empty"] is False
    # Listed as an edit of the placement that shows the widget, by whoever
    # the recorder said asked for it, newest first.
    assert payload["changes"][0] == {"kind": "edited", "nodeId": "notes", "by": "ai"}
    assert drafts.load_draft(draft.token).steps[-1][drafts.RECORDED] == {
        "kind": KIND,
        "payload": {"before": "v0", "after": "v1"},
        "widgetId": "chart-1",
    }


def test_undo_and_redo_reach_a_recorded_step_through_its_handler(
    store: Store,
    widget_types: FakeResolver,
    handler: Handler,
    events: list[CanvasDraftEvent],
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()

    undo = drafts.RewindCanvasDraftCommand(draft.token, draft.revision)
    draft = undo.run()
    assert handler.calls == [("undo", step("v1"), draft.token)]
    assert undo.recorded == step("v1")
    assert draft.can_redo is True

    redo = drafts.RewindCanvasDraftCommand(draft.token, draft.revision, forward=True)
    draft = redo.run()
    assert handler.calls[-1] == ("redo", step("v1"), draft.token)

    assert [(event.kind, event.steps) for event in events] == [
        ("undone", (step("v1"),)),
        ("redone", (step("v1"),)),
    ]
    assert events[0].canvas_id == 7
    assert events[0].token == draft.token
    assert events[0].widget_ids == frozenset({"chart-1"})

    # The canvas's own step is undone as before, without the handler, and
    # tells listeners it moved no recorded step.
    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    assert list(draft.definition["nodes"]) == []
    assert len(handler.calls) == 3
    assert (events[-1].kind, events[-1].steps) == ("undone", ())


def test_a_handler_that_refuses_leaves_the_draft_as_it_was(
    store: Store,
    widget_types: FakeResolver,
    handler: Handler,
    events: list[CanvasDraftEvent],
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
    handler.refusal = "The notes changed meanwhile"

    with pytest.raises(DraftStepFailedError) as excinfo:
        drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()

    assert excinfo.value.to_payload() == {
        "message": "The notes changed meanwhile",
        "error_type": "DraftStepFailed",
    }
    kept = drafts.load_draft(draft.token)
    assert (kept.revision, kept.steps, kept.undone) == (
        draft.revision,
        draft.steps,
        [],
    )
    assert events == []


def test_a_handler_that_breaks_fails_the_step_without_its_details(
    store: Store,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    from superset.canvas import draft_hooks
    from superset.commands.canvas import draft as drafts

    broken = MagicMock()
    broken.undo.side_effect = RuntimeError("secret internals")
    unregister = draft_hooks.register_step_handler(KIND, broken)
    try:
        draft = placed_draft()
        draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
        with pytest.raises(DraftStepFailedError) as excinfo:
            drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    finally:
        unregister()

    assert "secret" not in str(excinfo.value.message)
    assert drafts.load_draft(draft.token).revision == draft.revision


def test_a_step_whose_kind_has_no_handler_is_stepped_over(
    store: Store,
    widget_types: FakeResolver,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()

    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()

    assert draft.can_redo is True
    assert list(draft.definition["nodes"]) == ["notes"]


def test_a_recorded_step_discards_what_was_undone(
    store: Store,
    widget_types: FakeResolver,
    handler: Handler,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    assert draft.can_redo is True

    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v2")).run()

    assert draft.can_redo is False
    assert drafts.load_draft(draft.token).undone == []


def test_discard_tells_listeners_what_the_draft_held(
    store: Store,
    widget_types: FakeResolver,
    handler: Handler,
    events: list[CanvasDraftEvent],
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v2", "v1")).run()
    draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
    events.clear()

    drafts.DeleteCanvasDraftCommand(draft.token).run()

    assert events == [
        CanvasDraftEvent(
            kind="discarded",
            canvas_id=7,
            token=draft.token,
            widget_ids=frozenset({"chart-1"}),
            # Undone steps too: what they changed may still be held.
            steps=(step("v1"), step("v2", "v1")),
        )
    ]


def test_a_listener_that_fails_neither_fails_the_discard_nor_silences_others(
    store: Store,
    widget_types: FakeResolver,
    events: list[CanvasDraftEvent],
) -> None:
    from superset.canvas import draft_hooks
    from superset.commands.canvas import draft as drafts

    def failing(_event: CanvasDraftEvent) -> None:
        raise RuntimeError("listener bug")

    unsubscribe = draft_hooks.on_draft_event(failing)
    try:
        draft = placed_draft()
        drafts.DeleteCanvasDraftCommand(draft.token).run()
    finally:
        unsubscribe()

    assert [event.kind for event in events] == ["discarded"]
    assert store.entries == {}


def test_a_draft_of_recorded_steps_alone_commits_without_writing_the_canvas(
    store: Store,
    widget_types: FakeResolver,
    events: list[CanvasDraftEvent],
    mocker: MockerFixture,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = drafts.CreateCanvasDraftCommand(7).run()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")

    result = drafts.CommitCanvasDraftCommand(draft.token, draft.revision).run()

    command.assert_not_called()
    assert result.revision == 3
    assert store.entries == {}
    assert [(event.kind, event.steps) for event in events] == [
        ("committed", (step("v1"),))
    ]


def test_a_commit_with_canvas_changes_tells_listeners_once_it_is_written(
    store: Store,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    from superset.canvas import draft_hooks
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
    order: list[str] = []
    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")

    def write() -> MagicMock:
        order.append("written")
        return MagicMock(revision=4)

    command.return_value.run.side_effect = write
    unsubscribe = draft_hooks.on_draft_event(lambda event: order.append(event.kind))
    try:
        result = drafts.CommitCanvasDraftCommand(draft.token, draft.revision).run()
    finally:
        unsubscribe()

    assert result.revision == 4
    assert order == ["written", "committed"]


def test_recording_waits_for_a_write_in_flight(
    store: Store,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    lock = f"{drafts._cache_key(draft.token)}:lock"
    store.add(lock, "writer")
    # The other writer finishes while this one waits its first turn.
    sleep = mocker.patch(
        f"{DRAFT}.time.sleep", side_effect=lambda _s: store.delete(lock)
    )

    recorded = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()

    assert recorded.revision == draft.revision + 1
    sleep.assert_called_once()


def test_recording_gives_up_on_a_lock_that_stays_taken(
    store: Store,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    store.add(f"{drafts._cache_key(draft.token)}:lock", "writer")
    sleep = mocker.patch(f"{DRAFT}.time.sleep")

    with pytest.raises(DraftConflictError):
        drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()

    assert sleep.call_count == len(drafts.RECORD_RETRY_SECONDS)
    assert drafts.load_draft(draft.token).revision == draft.revision


def test_a_step_whose_payload_isnt_json_is_refused(
    store: Store,
    widget_types: FakeResolver,
) -> None:
    from superset.commands.canvas import draft as drafts

    draft = placed_draft()
    with pytest.raises(ValueError, match="JSON"):
        drafts.RecordCanvasDraftStepCommand(
            draft.token, DraftStep(kind=KIND, payload={"at": object()})
        ).run()
    assert drafts.load_draft(draft.token).revision == draft.revision


def test_a_kind_has_one_handler(handler: Handler) -> None:
    from superset.canvas import draft_hooks

    with pytest.raises(ValueError, match="handler already"):
        draft_hooks.register_step_handler(KIND, Handler())
    # The same handler again is the registration it already has.
    draft_hooks.register_step_handler(KIND, handler)
    assert draft_hooks.step_handler(KIND) is handler


def test_extensions_reach_the_draft_hooks_through_superset_core(
    store: Store,
    widget_types: FakeResolver,
    handler: Handler,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from superset_core.canvas import drafts as core_drafts

    from superset.core.api.core_api_injection import inject_canvas_draft_implementations

    # Puts back whatever the app injected, once the test ends.
    for name in ("on_draft_event", "register_step_handler", "record_step"):
        monkeypatch.setattr(core_drafts, name, getattr(core_drafts, name))
    inject_canvas_draft_implementations()

    draft = placed_draft()
    heard: list[CanvasDraftEvent] = []
    unsubscribe = core_drafts.on_draft_event(heard.append)
    try:
        revision = core_drafts.record_step(draft.token, step("v1"), by="ai")
        from superset.commands.canvas import draft as drafts

        drafts.RewindCanvasDraftCommand(draft.token, revision).run()
    finally:
        unsubscribe()
    assert revision == draft.revision + 1
    assert [event.kind for event in heard] == ["undone"]
    assert handler.calls == [("undo", step("v1"), draft.token)]

    # Someone else's draft, or none, looks the same.
    store.user_id = 2
    with pytest.raises(core_drafts.DraftNotFoundError):
        core_drafts.record_step(draft.token, step("v2"))
    with pytest.raises(core_drafts.DraftNotFoundError):
        core_drafts.record_step("not-a-token", step("v2"))


def test_what_an_extension_registers_runs_in_its_extension_context(
    store: Store,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    """
    An extension registers its listener and step handler while it loads, and
    a draft's requests call each much later, in that extension's context; the
    host's own run as they are.
    """
    from superset.canvas import draft_hooks
    from superset.commands.canvas import draft as drafts
    from superset.extensions.context import (
        extension_context,
        get_context,
        get_current_extension_context,
    )
    from tests.unit_tests.extensions.storage.conftest import create_manifest

    seen: list[tuple[str, str]] = []
    host: list[object] = []

    def heard(what: str) -> None:
        seen.append((what, get_context().extension.id))

    class Steps:
        def undo(self, _recorded: DraftStep, _token: str) -> None:
            heard("undo")

        def redo(self, _recorded: DraftStep, _token: str) -> None:
            heard("redo")

    steps = Steps()
    with extension_context(create_manifest("acme", "notes")):
        removals = [
            draft_hooks.on_draft_event(lambda event: heard(event.kind)),
            draft_hooks.register_step_handler(KIND, steps),
        ]
    removals.append(
        draft_hooks.on_draft_event(
            lambda _event: host.append(get_current_extension_context())
        )
    )
    command = mocker.patch(f"{DRAFT}.ApplyCanvasOperationsCommand")
    command.return_value.run.return_value = MagicMock(revision=4)
    try:
        draft = placed_draft()
        draft = drafts.RecordCanvasDraftStepCommand(draft.token, step("v1")).run()
        draft = drafts.RewindCanvasDraftCommand(draft.token, draft.revision).run()
        draft = drafts.RewindCanvasDraftCommand(
            draft.token, draft.revision, forward=True
        ).run()
        drafts.CommitCanvasDraftCommand(draft.token, draft.revision).run()
        # The same handler again is the registration it already has.
        draft_hooks.register_step_handler(KIND, steps)
    finally:
        for remove in removals:
            remove()

    acme = "acme.notes"
    assert seen == [
        ("undo", acme),
        ("undone", acme),
        ("redo", acme),
        ("redone", acme),
        ("committed", acme),
    ]
    assert host == [None, None, None]
    assert get_current_extension_context() is None
    assert draft_hooks.step_handler(KIND) is None
