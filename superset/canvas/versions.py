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
"""Reading canvas versions: the saves captured by version history."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from superset import is_feature_enabled, security_manager
from superset.canvas.definition.registry import get_widget_resolver
from superset.canvas.definition.schemas import RemoveOp
from superset.commands.canvas.apply_ops import apply_or_raise
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasVersionNotFoundError,
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.versioning.queries import get_version


def version_definition(canvas: Canvas, raw: str) -> tuple[dict[str, Any], list[str]]:
    """
    A version's definition, as the user may see or restore it, and the
    placements left out of it.

    A canvas grants read access to the widgets it places, but not to widgets
    only an earlier version placed: those must still exist and be placeable by
    the user, as if they were added again.
    """
    definition = CanvasDAO.parse(raw)
    placed = {
        node["widgetId"]
        for node in CanvasDAO.load(canvas)["nodes"].values()
        if node.get("widgetId")
    }
    wanted = {
        node_id: node["widgetId"]
        for node_id, node in definition["nodes"].items()
        if node.get("widgetId")
    }
    resolver = get_widget_resolver()
    existing = set(resolver.widget_types(set(wanted.values())))
    returning = set(wanted.values()) - placed
    allowed = resolver.placeable(returning) if returning else set()
    skipped = sorted(
        node_id
        for node_id, widget_id in wanted.items()
        if widget_id not in existing
        or (widget_id in returning and widget_id not in allowed)
    )
    definition, _ = apply_or_raise(
        definition, [RemoveOp(op="remove", id=node_id) for node_id in skipped]
    )
    return definition, skipped


def version_snapshot(canvas: Canvas, version_uuid: UUID) -> dict[str, Any]:
    """
    The canvas as ``version_uuid`` saved it, its definition parsed and limited
    by ``version_definition``. Like the rest of version history, only the
    canvas' editors may read it.
    """
    if not is_feature_enabled("VERSION_HISTORY"):
        raise CanvasVersionNotFoundError()
    try:
        security_manager.raise_for_editorship(canvas)
    except SupersetSecurityException as ex:
        raise CanvasForbiddenError() from ex
    snapshot = get_version(Canvas, canvas.uuid, version_uuid, entity=canvas)
    if snapshot is None or snapshot.get("definition") is None:
        raise CanvasVersionNotFoundError()
    definition, skipped = version_definition(canvas, snapshot["definition"])
    snapshot["definition"] = definition
    snapshot["skippedPlacements"] = skipped
    return snapshot
