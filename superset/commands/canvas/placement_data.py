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
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from superset_core.canvas import StoredWidget
from superset_core.widgets import QueryRequest, Widget, WidgetQueryRefusedError

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.definition.registry import (
    get_widget_resolver,
    get_widget_types,
    widget_type_available,
)
from superset.canvas.query_errors import canvas_query_error, CanvasQueryFailedError
from superset.canvas.versions import version_snapshot
from superset.commands.base import BaseCommand
from superset.commands.canvas.draft import load_draft
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasNotFoundError,
    CanvasPlacementNotFoundError,
    CanvasPlacementUnboundError,
    WidgetTypeUnavailableError,
)
from superset.daos.canvas import CanvasDAO


@dataclass(frozen=True)
class StoredPlacement:
    """A placement's widget type and props, as stored."""

    # ``None`` for a widget entity that no longer resolves.
    widget_type: str | None
    props: dict[str, Any]
    # The UUID of the saved widget the placement shows; ``None`` for a widget
    # stored on the placement itself, such as a container or text.
    widget_id: str | None = None
    # That saved widget's content, as the canvas or draft resolves it.
    widget: StoredWidget | None = None


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
            widget_type=widget.widget_type,
            props=widget.props,
            widget_id=widget_id,
            widget=widget,
        )
    return StoredPlacement(
        widget_type=node.get("widgetType"), props=node.get("props") or {}
    )


class GetPlacementDataCommand(BaseCommand):
    """
    Run a placement's queries as the caller. They come from the stored
    definition, the caller's draft of the canvas, or a version of it, as the
    widget type builds them (``widget_queries``); the caller only adds runtime
    filters. Reading needs access to the canvas and to each query's dataset,
    which the chart data pipeline checks. A placement whose widget type isn't
    registered here, or that the host turned off, serves no data.
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
        placement = load_placement(
            self._id_or_uuid,
            self._placement_id,
            self._draft_token,
            self._version_uuid,
        )
        self._bindings = widget_queries(
            placement.widget_type,
            QueryRequest(
                self._id_or_uuid,
                self._placement_id,
                placement.props,
                draft_token=self._draft_token or None,
                widget_id=placement.widget_id,
            ),
        )
        if not self._bindings:
            raise CanvasPlacementUnboundError()


def widget_queries(
    widget_type: str | None, request: QueryRequest
) -> dict[str, dict[str, Any]]:
    """
    The bindings a data request for a widget runs, by the name of the dataset
    each answers, as its widget type builds them. A query whose binding names
    no dataset isn't bound yet and is left out. Every binding a type builds
    gets the same checks, and runs the same way, as the caller.

    Raises ``WidgetTypeUnavailableError`` for a type that isn't registered
    here, such as one whose extension was removed, or that the host turned
    off: what such a type stored was never checked by this host, and no page
    renders it. Raises ``CanvasQueryFailedError`` for a type that refuses the
    request (``WidgetQueryRefusedError``), with the type's code and message,
    and ``ValueError`` for a type that builds two queries of one name: each
    name is a dataset of the answer.
    """
    if widget_type is not None and not widget_type_available(widget_type):
        raise WidgetTypeUnavailableError()
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
