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
Canvas drafts: a private copy of a canvas definition that operations build up
before an explicit commit publishes them, following SIP-231's widget drafts.

A draft lives in the cache that holds Explore's temporary state
(``EXPLORE_FORM_DATA_CACHE_CONFIG``), under an unguessable token, so with a
cache such as Redis behind it editing a draft never writes to the metadata
database; only a commit does. The token locates the draft but never
authorizes it: every use checks that the caller created the draft and can
still edit its canvas. Drafts expire after ``CANVAS_DRAFT_TTL_SECONDS``
without a write, and are deleted on commit.

Widgets the draft creates or changes are held with it too, and saved with the
canvas on commit; a widget created in a draft that is discarded never exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

from flask import current_app
from pydantic import TypeAdapter
from superset_core.canvas import StoredWidget

from superset import security_manager
from superset.canvas.definition.pending import (
    pending_from_value,
    pending_to_value,
    PendingWidgetResolver,
)
from superset.canvas.definition.registry import get_widget_resolver
from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import Operation, ROOT_ID
from superset.canvas.definition.scopes import resolve_scopes
from superset.commands.canvas.apply_ops import (
    apply_batches,
    apply_or_raise,
    ApplyCanvasOperationsCommand,
    placement_issues,
)
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    CanvasNotFoundError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import cache_manager
from superset.models.canvas import Canvas
from superset.utils import json
from superset.utils.core import get_user_id

KEY_PREFIX = "canvas_draft:"
OPERATIONS = TypeAdapter(list[Operation])


#: A step read from a draft written before steps were summarised.
_UNKNOWN_STEP: dict[str, Any] = {"by": "user", "changes": []}

#: Who asked for a step. The agent reaches a draft through its own tool, so
#: the two callers are told apart at the door rather than guessed at later.
BY_USER = "user"
BY_AI = "ai"


def _parent_of(definition: dict[str, Any], node_id: str) -> str:
    """Which container holds ``node_id``, or the root if nothing does."""
    for parent, node in (definition.get("nodes") or {}).items():
        if node_id in (node.get("children") or []):
            return parent
    return ROOT_ID


def _change(op: dict[str, Any], before: dict[str, Any]) -> dict[str, Any] | None:
    """
    What one operation did, in the words the banner lists it under.

    ``before`` is the definition as it stood when the operation was applied,
    which is the only place a move can be told from a resize: the operation
    carries the layout it asked for, not the one it replaced.
    """
    kind = op.get("op")
    node_id = op.get("id")
    if not isinstance(node_id, str):
        return None
    if kind == "move" and op.get("parent") not in (None, _parent_of(before, node_id)):
        # Carried to another grid, which is a move whatever the spans say: a
        # layout is in its own grid's units, so a widget taken from a
        # twelve-column group onto a twenty-four-column canvas has its span
        # doubled to keep the width it had. Compared as numbers that reads as
        # a resize, and the widget came to wear a tag for something nobody
        # did to it.
        return {"kind": "moved", "nodeId": node_id}
    if kind == "add":
        return {"kind": "new", "nodeId": node_id}
    if kind == "remove":
        return {"kind": "removed", "nodeId": node_id}
    if kind in {"place", "move", "swap"}:
        was = (before.get("nodes") or {}).get(node_id, {}).get("layout") or {}
        # A swap carries no layout of its own -- it takes the partner's slot --
        # so it reads as a move, which is what it is. Only the widget that was
        # dragged is listed: the one it changed places with gave way, as the
        # siblings a plain drop pushes aside do.
        now = op.get("layout") or {}
        resized = any(
            span in now and now[span] != was.get(span)
            for span in ("colSpan", "rowSpan")
        )
        return {"kind": "resized" if resized else "moved", "nodeId": node_id}
    # set_props, set_scope, set_settings: the widget itself changed.
    return {"kind": "edited", "nodeId": node_id}


@dataclass
class CanvasDraft:
    token: str
    # The principal that created the draft; only it can use the token.
    owner_id: int | None
    # Authorized request-local model; only its ID is persisted in the cache.
    canvas: Canvas
    # The canvas revision the draft started from; commit requires it unchanged.
    base_revision: int
    # Incremented on every accepted write to the draft.
    revision: int
    definition: dict[str, Any]
    # The operations applied so far that change the canvas, grouped by the
    # request that carried them; commit replays each group as its own batch.
    #
    # The grouping is not bookkeeping: a request's operations are applied
    # together and layout is resolved once for the batch, so an operation in
    # the same request does not see where an earlier one in it pushed the
    # widgets, while one in a later request does. Replaying a flattened log
    # resolves at the wrong boundaries and lays the canvas out differently
    # from the plan that was approved.
    ops: list[list[dict[str, Any]]] = field(default_factory=list)
    # Widgets created or changed so far, by UUID, including new widgets needed
    # to replay earlier operations. Commit saves only new widgets still placed.
    widgets: dict[str, StoredWidget] = field(default_factory=dict)
    # What ``widgets`` held after each group in ``ops``, so undo can put it
    # back. It cannot be replayed: ``add`` rewrites its own logged operation,
    # stripping the widget's type, props and name and leaving a bare UUID, and
    # an edit to a widget's props is not in the log at all (it applies to the
    # widget entity rather than the canvas, so it is never replayed). Entry
    # ``i`` pairs with ``ops[i]``.
    widget_history: list[dict[str, StoredWidget]] = field(default_factory=list)
    # What each group in ``ops`` did, in the same order: who made the request
    # and the change each of its operations was. Recorded when the operations
    # are applied, because telling a move from a resize needs the layout as it
    # stood before them, which a replay of the log no longer has.
    steps: list[dict[str, Any]] = field(default_factory=list)
    # Groups taken off ``ops`` by undo, newest last, each with the widgets it
    # was carrying. Any new write discards them, as a redo stack does.
    undone: list[
        tuple[list[dict[str, Any]], dict[str, StoredWidget], dict[str, Any]]
    ] = field(default_factory=list)

    @property
    def can_undo(self) -> bool:
        # Only as far back as the history reaches: a draft written before
        # history was kept has operations but nothing to restore them to.
        return len(self.widget_history) == len(self.ops) and bool(self.ops)

    @property
    def can_redo(self) -> bool:
        return bool(self.undone)

    @property
    def canvas_id(self) -> int:
        return self.canvas.id

    def resolver(self) -> PendingWidgetResolver:
        return PendingWidgetResolver(get_widget_resolver(), self.widgets)

    def to_value(self) -> dict[str, Any]:
        return {
            "ownerId": self.owner_id,
            "canvasId": self.canvas_id,
            "baseRevision": self.base_revision,
            "revision": self.revision,
            "definition": self.definition,
            "ops": self.ops,
            # Marks the grouped shape, so a draft written before grouping
            # existed is still readable.
            "opsGrouped": True,
            "widgets": pending_to_value(self.widgets),
            "widgetHistory": [
                pending_to_value(widgets) for widgets in self.widget_history
            ],
            "steps": self.steps,
            "undone": [
                {"ops": ops, "widgets": pending_to_value(widgets), "step": step}
                for ops, widgets, step in self.undone
            ],
        }


def _cache_key(token: str) -> str:
    try:
        return f"{KEY_PREFIX}{UUID(token)}"
    except (TypeError, ValueError) as ex:
        raise CanvasDraftNotFoundError() from ex


def _save(draft: CanvasDraft) -> None:
    # Stored as a JSON string: the Explore cache rewrites dict values on read.
    cache_manager.explore_form_data_cache.set(
        _cache_key(draft.token),
        json.dumps(draft.to_value()),
        timeout=current_app.config["CANVAS_DRAFT_TTL_SECONDS"],
    )


def _editable_canvas(canvas_ref: int | str) -> Canvas:
    canvas = CanvasDAO.find_by_id_or_uuid(str(canvas_ref))
    if canvas is None:
        raise CanvasNotFoundError()
    try:
        security_manager.raise_for_editorship(canvas)
    except SupersetSecurityException as ex:
        raise CanvasForbiddenError() from ex
    return canvas


def load_draft(token: str) -> CanvasDraft:
    """
    The caller's draft for ``token``. Any other principal's draft, an expired
    or unknown token, or a canvas the caller can no longer edit all look the
    same: not found, or forbidden for the canvas.
    """
    raw = cache_manager.explore_form_data_cache.get(_cache_key(token))
    if not isinstance(raw, str):
        raise CanvasDraftNotFoundError()
    value = json.loads(raw)
    if value.get("ownerId") is None or value["ownerId"] != get_user_id():
        raise CanvasDraftNotFoundError()
    canvas = _editable_canvas(value["canvasId"])
    return CanvasDraft(
        token=token,
        owner_id=value["ownerId"],
        canvas=canvas,
        base_revision=value["baseRevision"],
        revision=value["revision"],
        definition=value["definition"],
        ops=_op_groups(value),
        widgets=pending_from_value(value.get("widgets") or {}),
        # Absent on a draft written before history was kept, which leaves
        # undo unavailable on it rather than wrong.
        widget_history=[
            pending_from_value(widgets) for widgets in value.get("widgetHistory") or []
        ],
        # Absent on a draft written before steps were summarised, which
        # leaves its banner without a list rather than with a wrong one.
        steps=value.get("steps") or [],
        undone=[
            (
                entry["ops"],
                pending_from_value(entry.get("widgets") or {}),
                entry.get("step") or _UNKNOWN_STEP,
            )
            for entry in value.get("undone") or []
        ],
    )


def _op_groups(value: dict[str, Any]) -> list[list[dict[str, Any]]]:
    """
    The stored operation log as request groups.

    A draft written before the log was grouped holds a flat list. It is read
    as a single group, which is how such a draft was replayed when it was
    written; drafts are short-lived cache entries, so this only has to cover
    the ones open across a deploy.
    """
    ops = value["ops"]
    if value.get("opsGrouped"):
        return ops
    return [ops] if ops else []


def draft_payload(draft: CanvasDraft, resolved: bool = True) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "canvasId": draft.canvas_id,
        "baseRevision": draft.base_revision,
        "revision": draft.revision,
        "definition": draft.definition,
        # Whether the toolbar's undo and redo have anything to do.
        "canUndo": draft.can_undo,
        "canRedo": draft.can_redo,
        # What the banner lists, newest first: one entry per change, carrying
        # who made it. The widget's name is not repeated here -- the response
        # already carries ``titles``, keyed by the same node id.
        "changes": [
            {**change, "by": step.get("by", BY_USER)}
            for step in reversed(draft.steps)
            for change in reversed(step.get("changes") or [])
        ],
        # Whether the user has done anything, which is not the same as whether
        # anything is *listed*: an operation with no node to name it after --
        # a canvas setting, say -- is a step that took effect and leaves
        # ``changes`` empty. Saving is offered on this rather than on the list,
        # or a draft that only changed a setting could never be saved. Undo
        # takes a step back off, so undoing to the start empties this too.
        "empty": not draft.steps,
        # A draft only loads for someone who may edit its canvas
        # (``load_draft`` -> ``_editable_canvas``), so object editorship is
        # already settled and only the route-level permission is left. Named
        # as on the definition response, so a client gates its editing
        # affordances the same way on either surface.
        "canEdit": security_manager.can_access("can_write", "Canvas"),
    }
    if resolved:
        payload.update(resolve_scopes(draft.definition, resolver=draft.resolver()))
        payload.update(render_context(draft.definition, resolver=draft.resolver()))
    return payload


class CreateCanvasDraftCommand:
    """Start a draft from a canvas's current definition."""

    def __init__(self, canvas_ref: int | str) -> None:
        self._canvas_ref = canvas_ref

    def run(self) -> CanvasDraft:
        canvas = _editable_canvas(self._canvas_ref)
        draft = CanvasDraft(
            token=str(uuid4()),
            owner_id=get_user_id(),
            canvas=canvas,
            base_revision=canvas.revision,
            revision=0,
            definition=CanvasDAO.load(canvas),
        )
        _save(draft)
        return draft


class ApplyCanvasDraftOperationsCommand:
    """
    Apply operations to a draft, validated as they would be on the canvas.
    The write must be based on the draft's current revision.
    """

    def __init__(
        self,
        token: str,
        revision: int,
        ops: list[Operation],
        by: str = BY_USER,
    ) -> None:
        self._token = token
        self._revision = revision
        self._ops = ops
        self._by = by

    def run(self) -> tuple[CanvasDraft, list[dict[str, Any]]]:
        draft = load_draft(self._token)
        if self._revision != draft.revision:
            raise DraftConflictError(draft.revision, draft_revision=draft.revision)
        if issues := placement_issues(self._ops, draft.resolver()):
            raise DefinitionInvalidError(
                "The operations add widgets that cannot be placed", issues=issues
            )
        before = draft.definition
        definition, applied = apply_or_raise(
            draft.definition, self._ops, draft.widgets, keep_unplaced=True
        )
        logged = [operation.op for operation in applied]
        # Summarised against the definition as it stood, before it is
        # replaced: a resize is only a resize next to the span it replaced.
        changes = [
            change
            for operation in applied
            if (change := _change(operation.op, before)) is not None
        ]
        draft.definition = definition
        # One group per request, so the replay resolves where this did, and
        # one undo step per request to match.
        #
        # The group is appended even when nothing in it replays. A request can
        # change only a widget's props, which applies to the widget entity
        # rather than to the canvas; the group is then empty and replays as a
        # no-op, but it still marks a step the user took, and the widgets
        # beside it are what undo puts back.
        draft.ops = [*draft.ops, [a.op for a in applied if a.replay]]
        draft.widget_history = [*draft.widget_history, dict(draft.widgets)]
        draft.steps = [*draft.steps, {"by": self._by, "changes": changes}]
        # A new step discards anything undone, as a redo stack does.
        draft.undone = []
        draft.revision += 1
        _save(draft)
        return draft, logged


@dataclass(frozen=True)
class CommitResult:
    """The revision written by a commit, or observed while closing an empty draft."""

    revision: int


class RewindCanvasDraftCommand:
    """
    Step a draft back or forward through the requests that built it.

    One request is one step: the operations it carried are a group in ``ops``,
    and the widgets it left behind are the matching entry in
    ``widget_history``. Undo takes the last group off and rebuilds the
    definition by replaying what remains; redo puts it back.

    Rebuilt rather than reversed. No operation records the state it replaced,
    several are applied with values the server chooses (a minted widget id, a
    derived layout, the reordering a drop does to its siblings), and ``remove``
    takes a whole subtree with it. Replaying a prefix needs none of that, and
    it resolves layout at the same request boundaries the draft did -- which is
    the thing the commit path already goes out of its way to preserve.
    """

    def __init__(self, token: str, revision: int, forward: bool = False) -> None:
        self._token = token
        self._revision = revision
        self._forward = forward

    def run(self) -> CanvasDraft:
        draft = load_draft(self._token)
        if self._revision != draft.revision:
            raise DraftConflictError(draft.revision)
        # Replaying starts from the canvas as it was when the draft began, so
        # the canvas must still be there. A draft whose canvas has moved on
        # cannot be published either, so this refuses no more than commit does.
        canvas = _editable_canvas(draft.canvas_id)
        if canvas.revision != draft.base_revision:
            raise DraftConflictError(draft.revision, canvas_changed=True)

        if self._forward:
            if not draft.can_redo:
                return draft
            group, widgets, step = draft.undone[-1]
            draft.undone = draft.undone[:-1]
            draft.ops = [*draft.ops, group]
            draft.widget_history = [*draft.widget_history, widgets]
            draft.steps = [*draft.steps, step]
        else:
            if not draft.can_undo:
                return draft
            draft.undone = [
                *draft.undone,
                (
                    draft.ops[-1],
                    draft.widget_history[-1],
                    draft.steps[-1] if draft.steps else _UNKNOWN_STEP,
                ),
            ]
            draft.ops = draft.ops[:-1]
            draft.widget_history = draft.widget_history[:-1]
            draft.steps = draft.steps[:-1]

        # The widgets a step left behind, not something replay could produce:
        # the log says which widget a placement holds, never what it is.
        draft.widgets = dict(draft.widget_history[-1]) if draft.widget_history else {}
        batches = [OPERATIONS.validate_python(group) for group in draft.ops]
        draft.definition, _ = apply_batches(
            CanvasDAO.load(canvas), batches, draft.widgets
        )
        # Forward, like every other write: the revision is what concurrent
        # writers compare against, so stepping back must still move it on.
        draft.revision += 1
        _save(draft)
        return draft


class CommitCanvasDraftCommand:
    """
    Publish a draft: save its widgets and replay its operations on the canvas,
    neither of which may have changed since the draft started, then delete the
    draft.
    """

    def __init__(self, token: str, revision: int) -> None:
        self._token = token
        self._revision = revision

    def run(self) -> CommitResult:
        draft = load_draft(self._token)
        if self._revision != draft.revision:
            raise DraftConflictError(draft.revision, draft_revision=draft.revision)
        if draft.ops or draft.widgets:
            batches = [OPERATIONS.validate_python(group) for group in draft.ops]
            try:
                applied = ApplyCanvasOperationsCommand(
                    draft.canvas_id,
                    draft.base_revision,
                    [op for batch in batches for op in batch],
                    strict=True,
                    widgets=draft.widgets,
                    # Replayed a request at a time, resolving layout once per
                    # request as the draft did. Replaying the whole log as one
                    # batch, or an operation at a time, resolves at boundaries
                    # the draft never used and lays the canvas out differently
                    # from the plan that was approved.
                    batches=batches,
                ).run()
            except DraftConflictError as ex:
                ex.draft_revision = draft.revision
                raise
            result = CommitResult(applied.revision)
        else:
            result = CommitResult(_editable_canvas(draft.canvas_id).revision)
        DeleteCanvasDraftCommand(self._token).run()
        return result


class DeleteCanvasDraftCommand:
    """Discard a draft."""

    def __init__(self, token: str) -> None:
        self._token = token

    def run(self) -> CanvasDraft:
        draft = load_draft(self._token)
        cache_manager.explore_form_data_cache.delete(_cache_key(self._token))
        return draft
