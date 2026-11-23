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
"""Apply a batch of operations to a canvas definition."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError, NoResultFound, SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from superset_core.canvas import StoredWidget, WidgetResolver

from superset import db, security_manager
from superset.canvas.definition.ops import (
    AppliedOperation,
    apply_operations,
    FieldGroup,
    named_touches,
    OperationError,
    overlapping,
    Touch,
)
from superset.canvas.definition.pending import PendingWidgetResolver
from superset.canvas.definition.registry import (
    get_widget_resolver,
    TYPE_TURNED_OFF,
    widget_type_enabled,
)
from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import AddOp, Operation
from superset.canvas.definition.scopes import resolve_scopes
from superset.canvas.definition.validation import (
    DefinitionValidationError,
    Issue,
    pointer,
)
from superset.commands.base import BaseCommand
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasNotFoundError,
    CanvasUpdateFailedError,
    DefinitionConflictError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.commands.utils import raise_if_managed_externally
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.realtime.publish import publish_realtime
from superset.utils import json
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction
from superset.widgets.models import Widget

logger = logging.getLogger(__name__)

# Revisions of operation log kept per canvas. A write based on an older
# revision cannot be checked for overlap and is rejected as stale.
OP_LOG_RETAINED_REVISIONS = 500


@dataclass
class ApplyResult:
    revision: int
    # Operations as applied; ``add`` entries carry the new node's id.
    ops: list[dict[str, Any]]
    # Node ids each filter, cross-filter source and customization drives
    # after the write, keyed like the API response.
    scopes: dict[str, dict[str, list[str]]]
    # Resolved placements and widget types after the write.
    render_context: dict[str, Any]
    # UUIDs of the widgets the write created or changed.
    widgets: list[str] = field(default_factory=list)


def placement_issues(
    ops: list[Operation], resolver: WidgetResolver | None = None
) -> list[Issue]:
    """
    Widgets being added that the current user may not place, or whose type the
    host has turned off.
    """
    issues = [
        Issue(pointer("ops", index, "widgetType"), TYPE_TURNED_OFF)
        for index, op in enumerate(ops)
        if isinstance(op, AddOp)
        and op.widget_type is not None
        and not widget_type_enabled(op.widget_type)
    ]
    added = [
        (index, op.widget_id)
        for index, op in enumerate(ops)
        if isinstance(op, AddOp) and op.widget_id is not None
    ]
    if not added:
        return issues
    resolver = resolver or get_widget_resolver()
    allowed = resolver.placeable({widget_id for _, widget_id in added})
    issues += [
        Issue(
            pointer("ops", index, "widgetId"),
            "unknown widget, or no access to it",
        )
        for index, widget_id in added
        if widget_id not in allowed
    ]
    # Only for widgets the user may place, so a hidden one reads the same as
    # one that doesn't exist.
    types = resolver.widget_types(allowed) if allowed else {}
    issues += [
        Issue(pointer("ops", index, "widgetId"), TYPE_TURNED_OFF)
        for index, widget_id in added
        if (widget_type := types.get(widget_id)) is not None
        and not widget_type_enabled(widget_type)
    ]
    return issues


def apply_or_raise(
    definition: dict[str, Any],
    ops: list[Operation],
    pending: dict[str, StoredWidget] | None = None,
    first_index: int = 0,
    *,
    keep_unplaced: bool = False,
) -> tuple[dict[str, Any], list[AppliedOperation]]:
    """
    Apply ``ops`` to a copy of ``definition``, as one atomic batch; widgets
    they create or change are added to ``pending``. Drafts keep unplaced new
    widgets privately so their complete operation history remains replayable.

    ``first_index`` is where these operations start in the caller's own list,
    so an error reported against a slice still names the operation the caller
    sent.
    """
    try:
        return apply_operations(
            definition, ops, pending=pending, keep_unplaced=keep_unplaced
        )
    except OperationError as ex:
        raise DefinitionInvalidError(
            str(ex),
            issues=[Issue(pointer("ops", first_index + ex.index), ex.message)],
            operation_index=first_index + ex.index,
        ) from ex
    except DefinitionValidationError as ex:
        raise DefinitionInvalidError(
            "The operations produce an invalid definition",
            issues=ex.issues,
            operation_index=(
                None if ex.operation is None else first_index + ex.operation
            ),
        ) from ex


def apply_batches(
    definition: dict[str, Any],
    batches: list[list[Operation]],
    pending: dict[str, StoredWidget] | None = None,
    *,
    keep_unplaced: bool = False,
) -> tuple[dict[str, Any], list[AppliedOperation]]:
    """
    Apply each batch in turn, resolving layout once per batch.

    For replaying a draft, whose batches are the requests that built it. Where
    layout is resolved decides the result: operations in one batch are applied
    before anything is resolved, so none of them sees where another pushed the
    widgets, while a later batch sees all of it. Resolving at any other
    boundary lays the canvas out differently from the plan that was approved --
    once for the whole log, and a widget dragged over another and back stops
    pushing it aside; once per operation, and a widget moved by a later
    operation in the same request pushes a third one it never touched.

    One resolve per batch rather than one for the log, which is why this is
    kept to the commit path.
    """
    applied: list[AppliedOperation] = []
    first_index = 0
    for index, batch in enumerate(batches):
        # A widget a later batch adds is unplaced until that batch runs, so
        # only the last batch may drop what ends up unplaced.
        definition, step = apply_or_raise(
            definition,
            batch,
            pending,
            first_index,
            keep_unplaced=keep_unplaced or index < len(batches) - 1,
        )
        applied.extend(step)
        first_index += len(batch)
    return definition, applied


class ApplyCanvasOperationsCommand(BaseCommand):
    """
    Apply operations to the latest definition, as long as no change made since
    ``base_revision`` touched the same nodes and field groups, and save the
    widgets they create or change in the same transaction.
    """

    def __init__(
        self,
        canvas_id_or_uuid: int | str,
        base_revision: int,
        ops: list[Operation],
        strict: bool = False,
        widgets: dict[str, StoredWidget] | None = None,
        batches: list[list[Operation]] | None = None,
    ) -> None:
        self._canvas_ref = str(canvas_id_or_uuid)
        self._canvas_id = 0
        self._base_revision = base_revision
        self._ops = ops
        # A draft commit: any change since ``base_revision`` rejects it.
        self._strict = strict
        # Widgets a draft created or changed, saved with the canvas.
        self._widgets = dict(widgets or {})
        # Replaying a draft: ``ops`` grouped into the requests that built it,
        # so layout is resolved where the draft resolved it. ``ops`` stays the
        # flat list, which is what conflict detection reads.
        self._batches = batches

    def run(self) -> ApplyResult:
        canvas = CanvasDAO.find_by_id_or_uuid(self._canvas_ref)
        if canvas is None:
            raise CanvasNotFoundError()
        self._canvas_id = canvas.id
        result = transaction(on_error=self._on_error)(self._apply)()
        publish_canvas_changed(self._canvas_id)
        return result

    def _on_error(self, ex: Exception) -> None:
        """
        Map database errors to what they mean for the caller where that is
        known, and log the rest, which surface only as a generic failure.
        """
        if isinstance(ex, NoResultFound):
            # Deleted after it was looked up, before it was locked.
            raise CanvasNotFoundError() from ex
        if isinstance(ex, IntegrityError):
            # Another write logged the same revision first: a backend without
            # row locks let both through ``CanvasDAO.lock``.
            canvas = CanvasDAO.find_by_id(self._canvas_id)
            if canvas is None:
                raise CanvasNotFoundError() from ex
            if self._strict:
                raise DraftConflictError(
                    canvas.revision,
                    canvas_changed=True,
                    current_canvas_revision=canvas.revision,
                ) from ex
            raise DefinitionConflictError(canvas.revision, [], stale=True) from ex
        if isinstance(ex, SQLAlchemyError):
            logger.exception("Failed to apply operations to canvas %s", self._canvas_id)
        on_error(ex, reraise=CanvasUpdateFailedError)

    def _apply(self) -> ApplyResult:
        self.validate()
        canvas = CanvasDAO.lock(self._canvas_id)
        current = canvas.revision
        if self._strict and self._base_revision != current:
            raise DraftConflictError(
                current, canvas_changed=True, current_canvas_revision=current
            )
        if self._base_revision != current:
            self._check_overlap(current, named_touches(self._ops))

        pending = dict(self._widgets)
        definition, applied = (
            apply_batches(CanvasDAO.load(canvas), self._batches, pending)
            if self._batches is not None
            else apply_or_raise(CanvasDAO.load(canvas), self._ops, pending)
        )

        if self._base_revision != current:
            self._check_overlap(current, applied_touches(applied))

        widget_changes = save_widgets(pending, canvas, definition)
        revision = current + 1
        canvas.definition = json.dumps(definition)
        canvas.definition_version = definition["version"]
        canvas.revision = revision
        # Widget edits are logged as what was saved rather than as the
        # operations that made them, which a draft does not carry to commit.
        CanvasDAO.log(
            canvas.id,
            revision,
            [a for a in applied if a.replay] + widget_changes,
            get_user_id(),
        )
        CanvasDAO.prune(canvas.id, revision - OP_LOG_RETAINED_REVISIONS)
        return ApplyResult(
            revision=revision,
            ops=[a.op for a in applied],
            scopes=resolve_scopes(definition),
            render_context=render_context(definition),
            widgets=sorted(pending),
        )

    def _check_overlap(self, current: int, touches: list[Touch]) -> None:
        if self._base_revision > current:
            raise DefinitionConflictError(current, [], stale=True)
        oldest = CanvasDAO.oldest_logged_revision(self._canvas_id)
        if oldest is None or oldest > self._base_revision + 1:
            raise DefinitionConflictError(current, [], stale=True)
        earlier = [
            Touch(node_id, FieldGroup(group))
            for row in CanvasDAO.ops_since(self._canvas_id, self._base_revision)
            for node_id, group in row.touched_pairs
        ]
        if conflicts := overlapping(earlier, touches):
            raise DefinitionConflictError(current, sorted(conflicts), stale=False)

    def validate(self) -> None:
        canvas = CanvasDAO.find_by_id(self._canvas_id)
        if canvas is None:
            raise CanvasNotFoundError()
        try:
            security_manager.raise_for_editorship(canvas)
        except SupersetSecurityException as ex:
            raise CanvasForbiddenError() from ex
        raise_if_managed_externally(canvas, CanvasForbiddenError)
        resolver = PendingWidgetResolver(get_widget_resolver(), self._widgets)
        if issues := placement_issues(self._ops, resolver):
            raise DefinitionInvalidError(
                "The operations add widgets that cannot be placed", issues=issues
            )


def save_widgets(
    pending: dict[str, StoredWidget],
    canvas: Canvas,
    definition: dict[str, Any] | None = None,
) -> list[AppliedOperation]:
    """
    Create the new widgets in ``pending`` and write the changed ones, each only
    if nobody saved it since it was loaded. A new widget is edited by the
    canvas's editors and read through the canvases that place it.

    Returns the changes to existing widgets as ``set_props`` and ``rename``
    operations on each placement of them in ``definition``, for the log.
    """
    changed: list[str] = []
    updated: list[str] = []
    changes: list[AppliedOperation] = []
    for widget_id, widget in pending.items():
        if widget.revision is None:
            db.session.add(
                Widget(
                    uuid=UUID(widget_id),
                    widget_type=widget.widget_type,
                    schema_version=widget.schema_version,
                    name=widget.name,
                    props=widget.props,
                    revision=1,
                    editors=list(canvas.editors),
                )
            )
            continue
        row = (
            db.session.query(Widget)
            .filter(Widget.uuid == UUID(widget_id))
            .one_or_none()
        )
        if row is None or row.revision != widget.revision:
            changed.append(widget_id)
            continue
        try:
            security_manager.raise_for_editorship(row)
        except SupersetSecurityException as ex:
            raise CanvasForbiddenError() from ex
        if definition is not None:
            changes += _widget_changes(definition, widget_id, row, widget)
        row.name = widget.name
        row.props = widget.props
        row.schema_version = widget.schema_version
        row.revision = widget.revision + 1
        updated.append(widget_id)
    if changed:
        raise DraftConflictError(
            canvas.revision,
            widgets=sorted(changed),
            current_canvas_revision=canvas.revision,
        )
    # Read before the flush, which leaves the session unusable if it fails.
    revision = canvas.revision
    try:
        db.session.flush()
    except StaleDataError as ex:
        # Widget rows aren't locked: one saved after its revision was read.
        raise DraftConflictError(
            revision, widgets=sorted(updated), current_canvas_revision=revision
        ) from ex
    return changes


def _widget_changes(
    definition: dict[str, Any], widget_id: str, row: Widget, widget: StoredWidget
) -> list[AppliedOperation]:
    placements = [
        node_id
        for node_id, node in definition["nodes"].items()
        if node.get("widgetId") == widget_id
    ]
    # The widget's content stays out of the log: the changes feed is readable
    # by anyone who can read the canvas later, including after the widget is
    # no longer placed, while the widget itself is read through its placements.
    ops: list[dict[str, Any]] = []
    if row.props != widget.props or row.schema_version != widget.schema_version:
        ops += [
            {"op": "set_props", "id": node_id, "widgetId": widget_id}
            for node_id in placements
        ]
    if row.name != widget.name:
        ops += [
            {"op": "rename", "id": node_id, "widgetId": widget_id}
            for node_id in placements
        ]
    return [
        AppliedOperation(op, [Touch(op["id"], FieldGroup.PROPS)], replay=False)
        for op in ops
    ]


def applied_touches(applied: list[AppliedOperation]) -> list[Touch]:
    return [touch for operation in applied for touch in operation.touched]


def publish_canvas_changed(canvas_id: int) -> None:
    """
    Best-effort nudge that a canvas changed.

    Like other ``entity.changed`` messages it carries only the entity id; open
    viewers fetch the changes through the authorized REST API, which is also
    the fallback when no realtime backend is configured.
    """
    try:
        publish_realtime(
            topic="entity.changed",
            scope="authenticated_global",
            payload={"entity_type": "canvas", "id": canvas_id},
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Failed to publish change for canvas %s", canvas_id)
