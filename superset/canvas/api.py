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
"""REST API for canvases."""

from __future__ import annotations

import logging
from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison as parse_rison, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError
from pydantic import TypeAdapter, ValidationError as PydanticValidationError
from superset_core.canvas import GridPlacement
from superset_core.widgets import Widget

from superset import is_feature_enabled, security_manager
from superset.canvas.definition.registry import get_widget_types
from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import (
    ApplyOperationsRequest,
    CanvasDefinition,
    DEFINITION_VERSION,
    Operation,
)
from superset.canvas.definition.scopes import resolve_scopes
from superset.canvas.definition.validation import request_pointer
from superset.canvas.definition.versions import DefinitionVersionError
from superset.canvas.filters import (
    CanvasAccessFilter,
    CanvasAllTextFilter,
    CanvasEditableFilter,
)
from superset.canvas.schemas import (
    CanvasPostSchema,
    CanvasPutSchema,
    get_delete_ids_schema,
)
from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
from superset.commands.canvas.create import CreateCanvasCommand
from superset.commands.canvas.delete import DeleteCanvasCommand
from superset.commands.canvas.exceptions import (
    CanvasCreateFailedError,
    CanvasDeleteFailedError,
    CanvasForbiddenError,
    CanvasInvalidError,
    CanvasNotFoundError,
    CanvasUpdateFailedError,
    DefinitionConflictError,
    DefinitionInvalidError,
)
from superset.commands.canvas.update import UpdateCanvasCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.models.canvas import Canvas
from superset.subjects.filters import FilterRelatedSubjects, subject_type_filter
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedUsers

logger = logging.getLogger(__name__)


def _handle_canvas_errors(
    f: Callable[..., Response],
) -> Callable[..., Response]:
    @wraps(f)
    def wrapped(self: CanvasRestApi, *args: Any, **kwargs: Any) -> Response:
        try:
            return f(self, *args, **kwargs)
        except CanvasNotFoundError:
            return self.response_404()
        except CanvasForbiddenError:
            return self.response_403()
        except CanvasInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except (DefinitionConflictError, DefinitionInvalidError) as ex:
            return self.response(ex.status, **ex.to_payload())
        except DefinitionVersionError as ex:
            return self.response_422(message=str(ex))
        except (
            CanvasCreateFailedError,
            CanvasUpdateFailedError,
            CanvasDeleteFailedError,
        ) as ex:
            logger.exception("Canvas write failed")
            return self.response_422(message=str(ex))

    return wrapped


def _pydantic_errors(ex: PydanticValidationError) -> list[dict[str, Any]]:
    """Request errors as JSON-pointer paths into the request body."""
    return [
        {"path": request_pointer(error["loc"]), "message": error["msg"]}
        for error in ex.errors()
    ]


def describe_widget(widget: type[Widget]) -> dict[str, Any]:
    """How a widget takes part in a canvas: nesting, child layout, roles."""

    def names(types: frozenset[str] | None) -> list[str] | None:
        return sorted(types) if types is not None else None

    behavior, ui = widget.behavior, widget.ui
    return {
        "id": widget.widget_type,
        "name": widget.name,
        "schemaVersion": widget.schema_version,
        "container": behavior.container,
        "acceptedChildren": names(behavior.accepted_children),
        "allowedParents": names(behavior.allowed_parents),
        "gridColumns": behavior.grid_columns,
        "childLayout": behavior.child_layout_model.model_json_schema(by_alias=True)
        if behavior.child_layout_model is not None
        else None,
        "filter": behavior.filter,
        "emitsFilters": behavior.emits_filters,
        "customization": behavior.customization,
        "filterable": behavior.filterable,
        "boundsFilterScope": behavior.bounds_filter_scope,
        "defaultSize": list(ui.default_size) if ui.default_size else None,
        "colSpan": {"min": ui.min_col_span, "max": ui.max_col_span},
        "rowSpan": {"min": ui.min_row_span, "max": ui.max_row_span},
    }


def _can_edit(canvas: Canvas) -> bool:
    """
    Whether the current user may change ``canvas``.

    Both gates the write route applies: the route-level ``can_write`` on
    Canvas that ``@protect()`` enforces, and the object-level editorship
    ``ApplyCanvasOperationsCommand.validate`` enforces. Checking only
    editorship would advertise editing to a role the route itself refuses.
    """
    if not security_manager.can_access("can_write", "Canvas"):
        return False
    try:
        security_manager.raise_for_editorship(canvas)
    except SupersetSecurityException:
        return False
    return True


def _get_canvas(id_or_uuid: str) -> Canvas:
    canvas = CanvasDAO.find_by_id_or_uuid(id_or_uuid)
    if canvas is None:
        raise CanvasNotFoundError()
    return canvas


class CanvasRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Canvas)

    @before_request
    def ensure_canvas_enabled(self) -> Response | None:
        if not is_feature_enabled("CANVAS"):
            return self.response_404()
        return None

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",
        "get_definition",
        "get_definition_changes",
        "apply_definition_operations",
        "get_schema",
    }
    resource_name = "canvas"
    allow_browser_login = True
    class_permission_name = "Canvas"
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "get_definition": "read",
        "get_definition_changes": "read",
        "apply_definition_operations": "write",
        "get_schema": "read",
    }
    openapi_spec_tag = "Canvases"

    base_filters = [["id", CanvasAccessFilter, lambda: []]]

    _subject_columns = ["editors.id", "editors.label", "editors.type"]
    _viewer_columns = ["viewers.id", "viewers.label", "viewers.type"]
    _audit_columns = [
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
    ]
    _metadata_columns = [
        "slug",
        "css",
        "theme_id",
        "certified_by",
        "certification_details",
        "is_managed_externally",
        "external_url",
    ]
    show_columns = [
        "id",
        "uuid",
        "title",
        "description",
        "revision",
        "url",
        *_metadata_columns,
        "theme.id",
        "theme.theme_name",
        "theme.json_data",
        *_subject_columns,
        *_viewer_columns,
        *_audit_columns,
    ]
    list_columns = [
        "id",
        "uuid",
        "title",
        "description",
        "url",
        "slug",
        "certified_by",
        "certification_details",
        "changed_on",
        *_subject_columns,
        *_audit_columns,
    ]
    list_select_columns = list_columns + ["changed_by_fk", "created_on"]
    add_columns = [
        "title",
        "description",
        "editors",
        "viewers",
        *_metadata_columns,
        "definition",
    ]
    edit_columns = ["title", "description", "editors", "viewers", *_metadata_columns]
    order_columns = ["title", "changed_on"]
    search_columns = ["title", "id", "slug"]
    search_filters = {"title": [CanvasAllTextFilter], "id": [CanvasEditableFilter]}

    add_model_schema = CanvasPostSchema()
    edit_model_schema = CanvasPutSchema()
    apispec_parameter_schemas = {"get_delete_ids_schema": get_delete_ids_schema}

    allowed_rel_fields = {"created_by", "changed_by", "editors", "viewers"}
    order_rel_fields = {"editors": ("label", "asc"), "viewers": ("label", "asc")}
    text_field_rel_fields = {"editors": "label", "viewers": "label"}
    extra_fields_rel_fields = {
        "editors": ["type", "active", "secondary_label", "img"],
        "viewers": ["type", "active", "secondary_label", "img"],
    }
    related_field_filters = {
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedUsers),
        "editors": RelatedFieldFilter("label", FilterRelatedSubjects),
        "viewers": RelatedFieldFilter("label", FilterRelatedSubjects),
    }
    base_related_field_filters = {
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "editors": [
            ["type", subject_type_filter("SUBJECTS_RELATED_TYPES_CANVASES"), lambda: []]
        ],
        "viewers": [
            ["type", subject_type_filter("SUBJECTS_RELATED_TYPES_CANVASES"), lambda: []]
        ],
    }

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @_handle_canvas_errors
    def post(self) -> Response:
        """Create a canvas.
        ---
        post:
          summary: Create a canvas
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Canvas created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      uuid:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            item = self.add_model_schema.load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        canvas = CreateCanvasCommand(item).run()
        return self.response(201, id=canvas.id, uuid=str(canvas.uuid))

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @_handle_canvas_errors
    def put(self, pk: int) -> Response:
        """Update a canvas' title, description and sharing.
        ---
        put:
          summary: Update a canvas' title, description and sharing
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Canvas updated
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            item = self.edit_model_schema.load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        canvas = UpdateCanvasCommand(pk, item).run()
        return self.response(200, id=canvas.id)

    @expose("/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    @_handle_canvas_errors
    def delete(self, pk: int) -> Response:
        """Delete a canvas.
        ---
        delete:
          summary: Delete a canvas
          description: >-
            Deletes the canvas, its inline widget instances and its operation
            log. Persisted widget instances it placed are separate entities and
            are not deleted.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Canvas deleted
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        DeleteCanvasCommand([pk]).run()
        return self.response(200, message="OK")

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    @parse_rison(get_delete_ids_schema)
    @_handle_canvas_errors
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete canvases.
        ---
        delete:
          summary: Delete canvases
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Canvases deleted
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        ids = kwargs["rison"]
        DeleteCanvasCommand(ids).run()
        return self.response(
            200,
            message=ngettext(
                "Deleted %(num)d canvas", "Deleted %(num)d canvases", num=len(ids)
            ),
        )

    @expose("/<id_or_uuid>/definition", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_definition"
        ),
        log_to_statsd=False,
    )
    @_handle_canvas_errors
    def get_definition(self, id_or_uuid: str) -> Response:
        """Get a canvas' definition.
        ---
        get:
          summary: Get a canvas' definition
          parameters:
          - in: path
            schema:
              type: string
              description: The canvas id or UUID
            name: id_or_uuid
          responses:
            200:
              description: The definition, its revision and resolved filter scopes
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          version:
                            type: integer
                          revision:
                            type: integer
                          definition:
                            type: object
                          filterScopes:
                            type: object
                            description: >-
                              The node ids each filter drives, resolved from
                              the tree and the definition's scope overrides
                          crossFilterScopes:
                            type: object
                            description: >-
                              The node ids each cross-filter source drives;
                              empty while cross-filters are turned off
                          customizationScopes:
                            type: object
                            description: The node ids each customization drives
                          placements:
                            type: object
                            description: >-
                              Resolved grid position of every node on a grid,
                              auto-placed nodes included
                          widgetTypes:
                            type: object
                            description: The widget type of each resolvable node
                          gridColumns:
                            type: object
                            description: The column count of each grid container
                          layoutConstraints:
                            type: object
                            description: >-
                              The span limits each node's widget declares, for
                              a client that lets the user resize
                          canEdit:
                            type: boolean
                            description: >-
                              Whether the current user may apply operations to
                              this canvas
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        canvas = _get_canvas(id_or_uuid)
        definition = CanvasDAO.load(canvas)
        return self.response(
            200,
            result={
                "version": canvas.definition_version,
                "revision": canvas.revision,
                "definition": definition,
                "canEdit": _can_edit(canvas),
                **resolve_scopes(definition),
                **render_context(definition),
            },
        )

    @expose("/<id_or_uuid>/definition/changes", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_definition_changes"
        ),
        log_to_statsd=False,
    )
    @_handle_canvas_errors
    def get_definition_changes(self, id_or_uuid: str) -> Response:
        """Get the operations applied to a canvas' definition since a revision.
        ---
        get:
          summary: Get a canvas' definition changes since a revision
          description: >-
            Returns every operation applied after `since`, grouped by revision.
            Responds 409 with `stale` when `since` predates the retained
            operation log; the client should reload the whole definition.
          parameters:
          - in: path
            schema:
              type: string
              description: The canvas id or UUID
            name: id_or_uuid
          - in: query
            schema:
              type: integer
              minimum: 0
            name: since
            required: true
          responses:
            200:
              description: Operations applied since the given revision
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            409:
              description: The operation log no longer covers `since`
        """
        since = request.args.get("since", type=int)
        if since is None or since < 0:
            return self.response_400(message="`since` must be a revision number")

        canvas = _get_canvas(id_or_uuid)
        current = canvas.revision
        if since >= current:
            return self.response(200, result={"revision": current, "changes": []})

        oldest = CanvasDAO.oldest_logged_revision(canvas.id)
        if oldest is None or oldest > since + 1:
            raise DefinitionConflictError(current, [], stale=True)

        changes: dict[int, list[dict[str, Any]]] = {}
        for row in CanvasDAO.ops_since(canvas.id, since):
            changes.setdefault(row.revision, []).append(row.op_dict)
        return self.response(
            200,
            result={
                "revision": current,
                "changes": [
                    {"revision": revision, "ops": ops}
                    for revision, ops in changes.items()
                ],
            },
        )

    @expose("/<id_or_uuid>/definition", methods=("PATCH",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.apply_definition_operations"
        ),
        log_to_statsd=False,
    )
    @_handle_canvas_errors
    def apply_definition_operations(self, id_or_uuid: str) -> Response:
        """Apply operations to a canvas' definition.
        ---
        patch:
          summary: Apply operations to a canvas' definition
          description: >-
            Applies `ops` in order to the latest definition, atomically. Changes
            made since `base_revision` are merged unless they touched the same
            node and field group (layout, a scope kind, or a settings
            section), or moved or removed an edited node; then the whole
            request is rejected with 409 and the conflicting node ids.
          parameters:
          - in: path
            schema:
              type: string
              description: The canvas id or UUID
            name: id_or_uuid
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required: [base_revision, ops]
                  properties:
                    base_revision:
                      type: integer
                    ops:
                      type: array
                      items:
                        type: object
          responses:
            200:
              description: The new revision, the applied operations and scopes
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: Conflicting or stale write
            422:
              description: An operation failed or produced an invalid definition
        """
        try:
            body = ApplyOperationsRequest.model_validate(request.get_json(silent=True))
        except PydanticValidationError as ex:
            return self.response(400, message=_pydantic_errors(ex))
        result = ApplyCanvasOperationsCommand(
            id_or_uuid, body.base_revision, body.ops
        ).run()
        return self.response(
            200,
            result={
                "revision": result.revision,
                "ops": result.ops,
                **result.scopes,
                **result.render_context,
            },
        )

    @expose("/schema", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_schema",
        log_to_statsd=False,
    )
    def get_schema(self) -> Response:
        """Get the canvas definition contract.
        ---
        get:
          summary: Get the canvas definition schema and widget behavior
          description: >-
            JSON Schemas for the definition, its operations and grid placement,
            plus how each registered widget takes part in a canvas: nesting,
            child layout and filter roles. A widget's props schema is served
            by the widget API.
          responses:
            200:
              description: The canvas contract
            401:
              $ref: '#/components/responses/401'
        """
        return self.response(
            200,
            result={
                "version": DEFINITION_VERSION,
                "definition": CanvasDefinition.model_json_schema(by_alias=True),
                "operation": TypeAdapter(Operation).json_schema(by_alias=True),
                "gridPlacement": GridPlacement.model_json_schema(by_alias=True),
                "widgets": [describe_widget(w) for w in get_widget_types().values()],
            },
        )
