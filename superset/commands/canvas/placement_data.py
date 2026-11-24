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

from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID

from flask import current_app
from pydantic import ValidationError as PydanticValidationError
from superset_core.widgets import (
    BindingRequest,
    WidgetBinding,
    WidgetDataRefusedError,
)

from superset.canvas.data import PlacementData, run_binding, RuntimeFilter
from superset.canvas.definition.ops import bound_datasets, unreadable_datasets
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
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.widgets.controls import DataBinding


class GetPlacementDataCommand(BaseCommand):
    """
    Run a placement's queries as the caller. They come from the stored
    definition, the caller's draft of the canvas, or a version of it, as the
    widget type builds them (``widget_bindings``); the caller only adds runtime
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
        version: str | None = None
        if self._draft_token:
            draft = load_draft(self._draft_token)
            if draft.canvas_id != canvas.id:
                raise CanvasDraftNotFoundError()
            definition = draft.definition
            resolver = draft.resolver()
        elif self._version_uuid:
            definition = version_snapshot(canvas, self._version_uuid)["definition"]
            version = str(self._version_uuid)
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
        self._bindings = widget_bindings(
            widget_type,
            BindingRequest(
                self._id_or_uuid,
                self._placement_id,
                props,
                widget_id=widget_id or None,
                canvas_draft_token=self._draft_token or None,
                canvas_version=version,
            ),
        )
        if not self._bindings:
            raise CanvasPlacementUnboundError()


class WidgetBindingsError(ValueError):
    """Bindings a widget type built that this host won't run."""


def widget_bindings(
    widget_type: str | None, request: BindingRequest
) -> dict[str, dict[str, Any]]:
    """
    The bindings a data request for a widget runs, by the name of the dataset
    each answers: those its widget type builds (``Widget.build_bindings``),
    checked as a stored binding is checked when it is written, or by default,
    and for a type this host doesn't know, the props' ``dataBinding`` as
    ``main``, which was checked then. A binding that names no dataset isn't
    bound yet and is left out.

    Raises ``CanvasQueryFailedError``: with the type's code and message for a
    type that refuses the request (``WidgetDataRefusedError``); as a dataset
    the caller can't read, for a built binding whose dataset doesn't exist or
    that they can't read; and as a server error for built bindings this host
    won't run (``checked_bindings``).
    """
    widget_cls = get_widget_types().get(widget_type) if widget_type else None
    try:
        built = widget_cls.build_bindings(request) if widget_cls else None
    except WidgetDataRefusedError as ex:
        raise CanvasQueryFailedError(canvas_query_error(ex)) from ex
    if built is None:
        binding = request.props.get("dataBinding")
        if isinstance(binding, Mapping) and _plain_id(binding.get("datasetId")):
            return {"main": dict(binding)}
        return {}
    try:
        return checked_bindings(built)
    except (WidgetBindingsError, SupersetSecurityException) as ex:
        raise CanvasQueryFailedError(canvas_query_error(ex)) from ex


def _plain_id(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def checked_bindings(built: Sequence[WidgetBinding]) -> dict[str, dict[str, Any]]:
    """
    ``built``, the bindings a widget type built, by name, once each passes the
    checks a stored binding gets when it is written: a valid ``dataBinding``
    with a plain integer ``datasetId``, on a dataset that exists and the caller
    can read. A binding that names no dataset is left out.

    Raises ``WidgetBindingsError`` for more bindings than
    ``CANVAS_WIDGET_MAX_BINDINGS``, a name that isn't unique, or a binding
    that isn't a valid ``dataBinding``, and ``SupersetSecurityException`` for
    a dataset that doesn't exist or the caller can't read.
    """
    limit = current_app.config["CANVAS_WIDGET_MAX_BINDINGS"]
    if len(built) > limit:
        raise WidgetBindingsError(
            f"{len(built)} bindings, more than the {limit} one request runs"
        )
    names = [item.name for item in built]
    if len(set(names)) != len(names) or not all(
        isinstance(name, str) and name for name in names
    ):
        raise WidgetBindingsError(f"binding names must be unique strings: {names}")
    bindings: dict[str, dict[str, Any]] = {}
    for item in built:
        if not isinstance(item.binding, Mapping):
            raise WidgetBindingsError(f"binding {item.name!r} isn't a mapping")
        binding = dict(item.binding)
        if binding.get("datasetId") is None:
            continue
        try:
            bound_datasets({"dataBinding": binding})
            DataBinding.model_validate(binding)
        except (PydanticValidationError, ValueError) as ex:
            raise WidgetBindingsError(
                f"binding {item.name!r} isn't a valid dataBinding: {ex}"
            ) from ex
        bindings[item.name] = binding
    if unreadable_datasets(binding["datasetId"] for binding in bindings.values()):
        raise SupersetSecurityException(
            SupersetError(
                message="A widget binding names a dataset the user can't read",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
    return bindings
