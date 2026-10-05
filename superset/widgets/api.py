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

import logging
from typing import Any

from flask import make_response, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_babel import gettext as _

from superset.extensions import event_logger
from superset.utils import json
from superset.views.base_api import BaseSupersetApi, statsd_metrics
from superset.widgets.registry import registry
from superset.widgets.schema_tools import get_subtrees, SchemaPathError

logger = logging.getLogger(__name__)


class WidgetControlsRestApi(BaseSupersetApi):
    """
    Schema-driven controls for Dashboard V2 widgets (experimental).

    Serves the backend-owned control JSON Schema that drives both the dashboard
    Inspector's control panel and read-only MCP progressive disclosure. Widget
    data is fetched separately via the v1 chart-data path on the frontend, so
    there is no data endpoint here. The resource name ``widgets`` is
    a placeholder (see ``WIDGET_FRAMEWORK.md``).
    """

    resource_name = "widgets"
    allow_browser_login = True
    # Read-only schema serving; reuse the existing Chart permission so no new
    # permission is introduced.
    class_permission_name = "Chart"
    method_permission_name = {
        "types": "read",
        "control_schema": "read",
        "validate": "read",
    }
    openapi_spec_tag = "Dashboard Controls (experimental)"

    @expose("/types", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.types",
        log_to_statsd=False,
    )
    def types(self) -> Response:
        """List registered building-widget control sets.
        ---
        get:
          summary: List widget types that have a schema-driven control panel
          responses:
            200:
              description: A list of widget types
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          type: object
            401:
              $ref: '#/components/responses/401'
        """
        result = [
            {"id": cls.widget_type, "name": cls.name, "description": cls.description}
            for cls in registry.values()
        ]
        return self.response(200, result=result)

    @expose("/type/<widget_type>/control-schema", methods=("GET", "POST"))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.control_schema"
        ),
        log_to_statsd=False,
    )
    def control_schema(self, widget_type: str) -> Response:
        """Return the control JSON Schema for a widget type (progressive
        disclosure).

        ``GET`` returns the base schema (no enrichment) — enough to discover a
        type's fields and required props without a CSRF-bearing request. ``POST``
        additionally accepts ``control_values``/``series`` to enrich x-dynamic
        fields, and an optional ``paths`` array to return just those subtrees
        (a ``{path: schema}`` map) instead of the whole schema.
        ---
        get:
          summary: Get the base control schema for a widget type
          parameters:
            - in: path
              name: widget_type
              required: true
              schema:
                type: string
          responses:
            200:
              description: Control JSON Schema
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            404:
              $ref: '#/components/responses/404'
        post:
          summary: Get the enriched control schema (or requested subtrees)
          parameters:
            - in: path
              name: widget_type
              required: true
              schema:
                type: string
          requestBody:
            required: false
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    control_values:
                      type: object
                    series:
                      type: array
                      items:
                        type: string
                    paths:
                      type: array
                      items:
                        type: string
                      description: >-
                        When given, return a `{path: schema}` map of just these
                        drill-in subtrees instead of the whole schema.
          responses:
            200:
              description: Control JSON Schema, or a `{path: schema}` map
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                      warning:
                        type: string
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        widget = registry.get(widget_type)
        if widget is None:
            return self.response_404()
        # GET carries no body (and no CSRF); tolerate a missing/non-JSON body so
        # the base schema is returned for a plain read. A body that IS present
        # must be a JSON object.
        body = request.get_json(silent=True) or {}
        if not isinstance(body, dict):
            return self.response_400(message="Request body must be a JSON object.")
        control_values = body.get("control_values")
        series = body.get("series")
        paths = body.get("paths")
        if paths is not None and (
            not isinstance(paths, list)
            or not all(isinstance(path, str) for path in paths)
        ):
            return self.response_400(message="'paths' must be an array of strings.")

        warning: str | None = None
        try:
            schema = widget.get_control_schema(control_values, series)
        except Exception:  # pylint: disable=broad-except
            # Enrichment can fail (e.g. malformed dynamic values); showing the
            # base form is better than a hard error — mirror the Semantic Layer.
            warning = str(
                _(
                    "Could not enrich the controls for this widget; showing the "
                    "default form. See the server logs for details."
                )
            )
            logger.exception(
                "Error enriching control schema for widget type %s", widget_type
            )
            schema = widget.get_control_schema(None, None)

        # `paths` narrows the response to just those drill-in subtrees; without
        # it the whole (enriched) schema is returned.
        if paths:
            try:
                result: dict[str, Any] = get_subtrees(schema, paths)
            except SchemaPathError as ex:
                return self.response_400(message=str(ex))
        else:
            result = schema

        payload: dict[str, Any] = {"result": result}
        if warning:
            payload["warning"] = warning
        resp = make_response(json.dumps(payload, sort_keys=False), 200)
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        return resp

    @expose("/type/<widget_type>/validate", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.validate",
        log_to_statsd=False,
    )
    def validate(self, widget_type: str) -> Response:
        """Validate control values against a widget type's model.

        The commit-time gate: runs the widget's full model validation (including
        cross-field rules declared on the control model) and returns any errors
        as ``{"errors": [{"loc", "message"}]}`` (empty list when valid), so a
        caller can reject a bad edit with an actionable message rather than
        writing a silently-broken widget. Widget-agnostic — the rules live on
        each widget's control model, not here.

        On success also returns ``values``: the candidate as Pydantic actually
        parsed it (coerced, alias-keyed) rather than the raw request body — the
        same normalization the ``set_widget_control_values`` MCP tool commits,
        so a REST caller that commits its own raw candidate instead can end up
        storing something subtly different from what this endpoint validated
        (e.g. a numeric field coerced from a string).
        ---
        post:
          summary: Validate control values for a widget type
          parameters:
            - in: path
              name: widget_type
              required: true
              schema:
                type: string
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    control_values:
                      type: object
          responses:
            200:
              description: Validation result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          errors:
                            type: array
                            items:
                              type: object
                          values:
                            type: object
                            nullable: true
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        widget = registry.get(widget_type)
        if widget is None:
            return self.response_404()
        body = request.get_json(silent=True) or {}
        if not isinstance(body, dict):
            return self.response_400(message="Request body must be a JSON object.")
        control_values = body.get("control_values")
        if errors := widget.validate_control_values(control_values):
            return self.response(200, result={"errors": errors, "values": None})
        values = (
            widget.controls_class.model_validate(control_values).model_dump(
                by_alias=True
            )
            if control_values is not None
            else None
        )
        return self.response(200, result={"errors": [], "values": values})
