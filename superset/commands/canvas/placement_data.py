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

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from superset_core.widgets import QueryRequest, Widget, WidgetQueryRefusedError

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.definition.registry import get_widget_resolver, get_widget_types
from superset.canvas.query_errors import canvas_query_error, CanvasQueryFailedError
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


class GetPlacementDataCommand(BaseCommand):
    """
    Run a placement's queries as the caller. They come from the stored
    definition, the caller's draft of the canvas, or a version of it, as the
    widget type builds them (``widget_queries``); the caller only adds runtime
    filters. Reading needs access to the canvas and to each query's dataset,
    which the chart data pipeline checks.
    """

    def __init__(
        self,
        id_or_uuid: str,
        placement_id: str,
        runtime_filters: list[RuntimeFilter],
        draft_token: str | None = None,
        version_uuid: UUID | None = None,
    ) -> None:
        self._id_or_uuid = id_or_uuid
        self._placement_id = placement_id
        self._runtime_filters = runtime_filters
        self._draft_token = draft_token
        self._version_uuid = version_uuid
        self._bindings: dict[str, dict[str, Any]] = {}

    def run(self) -> dict[str, PlacementData]:
        """Each query's data, by name; one failing query fails them all."""
        self.validate()
        try:
            return {
                name: run_binding(binding, self._runtime_filters)
                for name, binding in self._bindings.items()
            }
        except Exception as ex:  # pylint: disable=broad-except
            raise CanvasQueryFailedError(canvas_query_error(ex)) from ex

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
        elif self._version_uuid:
            definition = version_snapshot(canvas, self._version_uuid)["definition"]
        else:
            definition = CanvasDAO.load(canvas)
        node = definition["nodes"].get(self._placement_id)
        if node is None:
            raise CanvasPlacementNotFoundError()
        widget_type, props = node.get("widgetType"), node.get("props") or {}
        if widget_id := node.get("widgetId"):
            widget = resolver.widgets({widget_id}).get(widget_id)
            widget_type, props = (
                (widget.widget_type, widget.props) if widget is not None else (None, {})
            )
        self._bindings = widget_queries(
            widget_type,
            QueryRequest(
                self._id_or_uuid,
                self._placement_id,
                props,
                draft_token=self._draft_token or None,
                widget_id=widget_id or None,
            ),
        )
        if not self._bindings:
            raise CanvasPlacementUnboundError()


def widget_queries(
    widget_type: str | None, request: QueryRequest
) -> dict[str, dict[str, Any]]:
    """
    The bindings a data request for a widget runs, by the name of the dataset
    each answers, as its widget type builds them; a type this host doesn't
    know builds the default, its ``dataBinding``. A query whose binding names
    no dataset isn't bound yet and is left out. Every binding a type builds
    gets the same checks, and runs the same way, as the caller.

    Raises ``CanvasQueryFailedError`` for a type that refuses the request
    (``WidgetQueryRefusedError``), with the type's code and message, and
    ``ValueError`` for a type that builds two queries of one name: each name
    is a dataset of the answer.
    """
    widget_cls = get_widget_types().get(widget_type) if widget_type else None
    try:
        queries = (widget_cls or Widget).build_queries(request)
    except WidgetQueryRefusedError as ex:
        raise CanvasQueryFailedError(canvas_query_error(ex)) from ex
    names = [query.name for query in queries]
    if len(set(names)) != len(names):
        raise ValueError(f"widget type {widget_type!r} names a query twice: {names}")
    return {
        query.name: dict(query.binding)
        for query in queries
        if isinstance(query.binding, Mapping)
        and isinstance(query.binding.get("datasetId"), int)
    }
