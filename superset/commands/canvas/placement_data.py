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
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.definition.registry import get_widget_resolver
from superset.canvas.versions import version_snapshot
from superset.commands.base import BaseCommand
from superset.commands.canvas.draft import load_draft
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasNotFoundError,
    CanvasPlacementNotFoundError,
    CanvasPlacementUnboundError,
)
from superset.daos.canvas import CanvasDAO


@dataclass(frozen=True)
class StoredPlacement:
    """A placement's widget type and props, as stored."""

    # ``None`` for a widget entity that no longer resolves.
    widget_type: str | None
    props: dict[str, Any]


def load_placement(
    id_or_uuid: str,
    placement_id: str,
    draft_token: str | None = None,
    version_uuid: UUID | None = None,
) -> StoredPlacement:
    """
    A placement as stored on the canvas, in the caller's draft of it, or in one
    of its versions, which only its editors can read. A canvas the caller can't
    read looks the same as one that doesn't exist.

    Raises ``CanvasNotFoundError``, ``CanvasDraftNotFoundError`` and
    ``CanvasPlacementNotFoundError``, and what ``load_draft`` and
    ``version_snapshot`` raise.
    """
    canvas = CanvasDAO.find_by_id_or_uuid(id_or_uuid)
    if canvas is None:
        raise CanvasNotFoundError()
    resolver = get_widget_resolver()
    if draft_token:
        draft = load_draft(draft_token)
        if draft.canvas_id != canvas.id:
            raise CanvasDraftNotFoundError()
        definition = draft.definition
        resolver = draft.resolver()
    elif version_uuid:
        definition = version_snapshot(canvas, version_uuid)["definition"]
    else:
        definition = CanvasDAO.load(canvas)
    node = definition["nodes"].get(placement_id)
    if node is None:
        raise CanvasPlacementNotFoundError()
    if widget_id := node.get("widgetId"):
        widget = resolver.widgets({widget_id}).get(widget_id)
        if widget is None:
            return StoredPlacement(widget_type=None, props={})
        return StoredPlacement(widget_type=widget.widget_type, props=widget.props)
    return StoredPlacement(
        widget_type=node.get("widgetType"), props=node.get("props") or {}
    )


class GetPlacementDataCommand(BaseCommand):
    """
    Run a placement's query as the caller. The query comes from the stored
    definition, the caller's draft of the canvas, or a version of it; the
    caller only adds runtime filters. Reading needs access to the canvas and
    to the binding's dataset, which the chart data pipeline checks.
    """

    def __init__(
        self,
        id_or_uuid: str,
        placement_id: str,
        runtime_filters: list[RuntimeFilter],
        draft_token: str | None = None,
        version_uuid: UUID | None = None,
        binding_name: str | None = None,
    ) -> None:
        self._id_or_uuid = id_or_uuid
        self._placement_id = placement_id
        self._runtime_filters = runtime_filters
        self._draft_token = draft_token
        self._version_uuid = version_uuid
        self._binding_name = binding_name
        self._binding: dict[str, Any] = {}

    def run(self) -> PlacementData:
        self.validate()
        return run_binding(self._binding, self._runtime_filters)

    def validate(self) -> None:
        props = load_placement(
            self._id_or_uuid,
            self._placement_id,
            self._draft_token,
            self._version_uuid,
        ).props
        binding = props.get("dataBinding")
        if self._binding_name is not None:
            # A name the props don't declare is unbound: running another
            # binding instead would answer with data nobody asked for.
            named = props.get("bindings")
            binding = named.get(self._binding_name) if isinstance(named, dict) else None
        if not isinstance(binding, dict) or not isinstance(
            binding.get("datasetId"), int
        ):
            raise CanvasPlacementUnboundError()
        self._binding = binding
