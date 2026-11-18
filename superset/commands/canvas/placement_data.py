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

from typing import Any
from uuid import UUID

from superset_core.canvas.placements import StoredPlacement
from superset_core.widgets import BindingRequest

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.definition.registry import (
    get_widget_resolver,
    get_widget_types,
)
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
            return StoredPlacement(widget_type=None, props={}, widget_id=widget_id)
        return StoredPlacement(
            widget_type=widget.widget_type, props=widget.props, widget_id=widget_id
        )
    return StoredPlacement(
        widget_type=node.get("widgetType"), props=node.get("props") or {}
    )


class GetPlacementDataCommand(BaseCommand):
    """
    Run a placement's query as the caller. The query comes from the stored
    definition, the caller's draft of the canvas, or a version of it, and a
    named binding from the widget type's resolver when the type has one; the
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
        placement = load_placement(
            self._id_or_uuid,
            self._placement_id,
            self._draft_token,
            self._version_uuid,
        )
        binding = (
            placement.props.get("dataBinding")
            if self._binding_name is None
            else self._named_binding(placement, self._binding_name)
        )
        # A binding from the widget type's resolver gets the same checks as one
        # from the props, and runs the same way, as the caller.
        if not isinstance(binding, dict) or not isinstance(
            binding.get("datasetId"), int
        ):
            raise CanvasPlacementUnboundError()
        self._binding = binding

    def _named_binding(self, placement: StoredPlacement, name: str) -> Any:
        """
        Binding ``name`` of the placement: from its widget type's resolver when
        the type has one, otherwise from the props' ``bindings``. A name
        neither declares is unbound: running another binding instead would
        answer with data nobody asked for.
        """
        widget_cls = (
            get_widget_types().get(placement.widget_type)
            if placement.widget_type
            else None
        )
        if widget_cls is not None and widget_cls.binding_resolver is not None:
            return widget_cls.binding_resolver(
                BindingRequest(
                    canvas_id=self._id_or_uuid,
                    placement_id=self._placement_id,
                    props=placement.props,
                    name=name,
                    draft_token=self._draft_token or None,
                    widget_id=placement.widget_id,
                )
            )
        named = placement.props.get("bindings")
        return named.get(name) if isinstance(named, dict) else None
