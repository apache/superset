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
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError
from pydantic import TypeAdapter, ValidationError as PydanticValidationError
from superset_core.canvas import CanvasLayoutRules, GridPlacement

from superset.canvas.definition.registry import layout_rules
from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import (
    ApplyOperationsRequest,
    CanvasDefinition,
    DEFINITION_VERSION,
    Operation,
)
from superset.canvas.definition.scopes import resolve_filter_scopes
from superset.canvas.definition.upgrades import DefinitionVersionError
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
    return [
        {"path": list(error["loc"]), "message": error["msg"]} for error in ex.errors()
    ]


def describe_rules(rules: type[CanvasLayoutRules]) -> dict[str, Any]:
    def names(types: frozenset[str] | None) -> list[str] | None:
        return sorted(types) if types is not None else None

    return {
        "type": rules.widget_type,
        "isContainer": rules.is_container,
        "acceptedChildren": names(rules.accepted_children),
        "allowedParents": names(rules.allowed_parents),
        "gridColumns": rules.grid_columns,
        "childLayout": rules.child_layout_model.model_json_schema(by_alias=True)
        if rules.child_layout_model is not None
        else None,
        "isFilter": rules.is_filter,
        "isFilterable": rules.is_filterable,
        "boundsFilterScope": rules.bounds_filter_scope,
        "colSpan": {"min": rules.min_col_span, "max": rules.max_col_span},
        "rowSpan": {"min": rules.min_row_span, "max": rules.max_row_span},
    }


def _get_canvas(pk: int) -> Canvas:
    canvas = CanvasDAO.find_by_id(pk)
    if canvas is None:
        raise CanvasNotFoundError()
    return canvas


class CanvasRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Canvas)

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
    show_columns = [
        "id",
        "uuid",
        "title",
        "description",
        "revision",
        "url",
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
        "changed_on",
        *_subject_columns,
        *_audit_columns,
    ]
    list_select_columns = list_columns + ["changed_by_fk", "created_on"]
    add_columns = ["title", "description", "editors", "viewers", "definition"]
    edit_columns = ["title", "description", "editors", "viewers"]
    order_columns = ["title", "changed_on"]
    search_columns = ["title", "id"]
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
            Deletes the canvas and its operation log. The widgets it placed are
            separate entities and are not deleted.
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

    @expose("/<int:pk>/definition", methods=("GET",))
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
    def get_definition(self, pk: int) -> Response:
        """Get a canvas' definition.
        ---
        get:
          summary: Get a canvas' definition
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
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
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        canvas = _get_canvas(pk)
        definition = CanvasDAO.load(canvas)
        return self.response(
            200,
            result={
                "version": canvas.definition_version,
                "revision": canvas.revision,
                "definition": definition,
                "filterScopes": resolve_filter_scopes(definition),
                **render_context(definition),
            },
        )

    @expose("/<int:pk>/definition/changes", methods=("GET",))
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
    def get_definition_changes(self, pk: int) -> Response:
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
              type: integer
            name: pk
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

        canvas = _get_canvas(pk)
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

    @expose("/<int:pk>/definition", methods=("PATCH",))
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
    def apply_definition_operations(self, pk: int) -> Response:
        """Apply operations to a canvas' definition.
        ---
        patch:
          summary: Apply operations to a canvas' definition
          description: >-
            Applies `ops` in order to the latest definition, atomically. Changes
            made since `base_revision` are merged unless they touched the same
            node and field group (layout or filter scope), or moved or removed
            an edited node; then the whole request is rejected with 409 and the
            conflicting node ids.
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
        result = ApplyCanvasOperationsCommand(pk, body.base_revision, body.ops).run()
        return self.response(
            200,
            result={
                "revision": result.revision,
                "ops": result.ops,
                "filterScopes": result.filter_scopes,
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
          summary: Get the canvas definition schema and layout rules
          description: >-
            JSON Schemas for the definition, its operations and grid placement,
            plus the layout rules registered for container, filter and
            filterable widget types. Widget types without rules are leaves.
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
                "widgetTypes": [describe_rules(rules) for rules in layout_rules],
            },
        )
