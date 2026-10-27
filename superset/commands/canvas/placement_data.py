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

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.definition.registry import get_widget_resolver
from superset.commands.base import BaseCommand
from superset.commands.canvas.draft import load_draft
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasNotFoundError,
    CanvasPlacementNotFoundError,
    CanvasPlacementUnboundError,
)
from superset.daos.canvas import CanvasDAO


class GetPlacementDataCommand(BaseCommand):
    """
    Run a placement's query as the caller. The query comes from the stored
    definition, or from the caller's draft of the canvas; the caller only adds
    runtime filters. Reading needs access to the canvas and to the binding's
    dataset, which the chart data pipeline checks.
    """

    def __init__(
        self,
        id_or_uuid: str,
        placement_id: str,
        runtime_filters: list[RuntimeFilter],
        draft_token: str | None = None,
    ) -> None:
        self._id_or_uuid = id_or_uuid
        self._placement_id = placement_id
        self._runtime_filters = runtime_filters
        self._draft_token = draft_token
        self._binding: dict[str, Any] = {}

    def run(self) -> PlacementData:
        self.validate()
        return run_binding(self._binding, self._runtime_filters)

    def validate(self) -> None:
        canvas = CanvasDAO.find_by_id_or_uuid(self._id_or_uuid)
        if canvas is None:
            raise CanvasNotFoundError()
        resolver = get_widget_resolver()
        if self._draft_token:
            draft = load_draft(self._draft_token)
            if draft.canvas_id != canvas.id:
                raise CanvasDraftNotFoundError()
            definition = draft.definition
            resolver = draft.resolver()
        else:
            definition = CanvasDAO.load(canvas)
        node = definition["nodes"].get(self._placement_id)
        if node is None:
            raise CanvasPlacementNotFoundError()
        props = node.get("props") or {}
        if widget_id := node.get("widgetId"):
            widget = resolver.widgets({widget_id}).get(widget_id)
            props = widget.props if widget is not None else {}
        binding = props.get("dataBinding")
        if not isinstance(binding, dict) or not isinstance(
            binding.get("datasetId"), int
        ):
            raise CanvasPlacementUnboundError()
        self._binding = binding
