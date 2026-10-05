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
from dataclasses import dataclass
from functools import partial
from typing import Any

from superset import security_manager
from superset.canvas.definition.ops import (
    AppliedOperation,
    apply_operations,
    FieldGroup,
    named_touches,
    OperationError,
    overlapping,
    Touch,
)
from superset.canvas.definition.registry import get_instance_resolver
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
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.realtime.publish import publish_realtime
from superset.utils import json
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

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


def placement_issues(ops: list[Operation]) -> list[Issue]:
    """Persisted instances being added that the current user may not place."""
    added = [
        (index, op.instance)
        for index, op in enumerate(ops)
        if isinstance(op, AddOp) and op.instance is not None
    ]
    if not added:
        return []
    allowed = get_instance_resolver().placeable({instance for _, instance in added})
    return [
        Issue(
            pointer("ops", index, "instance"),
            "unknown widget instance, or no access to it",
        )
        for index, instance in added
        if instance not in allowed
    ]


class ApplyCanvasOperationsCommand(BaseCommand):
    """
    Apply operations to the latest definition, as long as no change made since
    ``base_revision`` touched the same nodes and field groups.
    """

    def __init__(
        self, canvas_id_or_uuid: int | str, base_revision: int, ops: list[Operation]
    ) -> None:
        self._canvas_ref = str(canvas_id_or_uuid)
        self._canvas_id = 0
        self._base_revision = base_revision
        self._ops = ops

    def run(self) -> ApplyResult:
        canvas = CanvasDAO.find_by_id_or_uuid(self._canvas_ref)
        if canvas is None:
            raise CanvasNotFoundError()
        self._canvas_id = canvas.id
        result = self._apply()
        publish_canvas_changed(self._canvas_id)
        return result

    @transaction(on_error=partial(on_error, reraise=CanvasUpdateFailedError))
    def _apply(self) -> ApplyResult:
        self.validate()
        canvas = CanvasDAO.lock(self._canvas_id)
        current = canvas.revision
        if self._base_revision != current:
            self._check_overlap(current, named_touches(self._ops))

        try:
            definition, applied = apply_operations(CanvasDAO.load(canvas), self._ops)
        except OperationError as ex:
            raise DefinitionInvalidError(
                str(ex),
                issues=[Issue(pointer("ops", ex.index), ex.message)],
                operation_index=ex.index,
            ) from ex
        except DefinitionValidationError as ex:
            raise DefinitionInvalidError(
                "The operations produce an invalid definition", issues=ex.issues
            ) from ex

        if self._base_revision != current:
            self._check_overlap(current, applied_touches(applied))

        revision = current + 1
        canvas.definition = json.dumps(definition)
        canvas.definition_version = definition["version"]
        canvas.revision = revision
        CanvasDAO.log(canvas.id, revision, applied, get_user_id())
        CanvasDAO.prune(canvas.id, revision - OP_LOG_RETAINED_REVISIONS)
        return ApplyResult(
            revision=revision,
            ops=[a.op for a in applied],
            scopes=resolve_scopes(definition),
            render_context=render_context(definition),
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
        if issues := placement_issues(self._ops):
            raise DefinitionInvalidError(
                "The operations add widgets that cannot be placed", issues=issues
            )


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
