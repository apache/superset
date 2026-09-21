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

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import ValidationError

from superset.commands.dashboard_v2.exceptions import DashboardV2InvalidError
from superset.commands.dashboard_v2.get import GetDashboardV2Command
from superset.commands.dashboard_v2.save import (
    CreateDashboardV2Command,
    UpdateDashboardV2Command,
)
from superset.commands.exceptions import CommandException
from superset.dashboard_v2.schemas import (
    DashboardV2PostSchema,
    DashboardV2PutSchema,
    DashboardV2ResponseSchema,
)
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, statsd_metrics


def command_error_response(api: BaseSupersetApi, ex: CommandException) -> Response:
    payload: dict[str, Any] = {"message": str(ex.message)}
    if isinstance(ex, DashboardV2InvalidError) and ex.errors:
        payload["errors"] = ex.errors
    return api.response(ex.status, **payload)


class DashboardV2RestApi(BaseSupersetApi):
    """Persisted Dashboard v2 documents (experimental)."""

    resource_name = "dashboard_v2"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "post": "write",
        "put": "write",
        "get": "read",
        "get_by_embedded": "read",
    }
    openapi_spec_tag = "Dashboard v2 (experimental)"
    openapi_spec_component_schemas = (
        DashboardV2PostSchema,
        DashboardV2PutSchema,
        DashboardV2ResponseSchema,
    )

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Create a Dashboard v2 from a document.
        ---
        post:
          summary: Create a Dashboard v2
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DashboardV2PostSchema'
          responses:
            201:
              description: Dashboard v2 created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      result:
                        $ref: '#/components/schemas/DashboardV2ResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            body = DashboardV2PostSchema().load(request.get_json(silent=True) or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            dashboard = CreateDashboardV2Command(body).run()
            result = GetDashboardV2Command(str(dashboard.id)).run()
        except CommandException as ex:
            return command_error_response(self, ex)
        return self.response(
            201, id=result["id"], result=DashboardV2ResponseSchema().dump(result)
        )

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int) -> Response:
        """Replace a Dashboard v2's document.
        ---
        put:
          summary: Update a Dashboard v2
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
                  $ref: '#/components/schemas/DashboardV2PutSchema'
          responses:
            200:
              description: Dashboard v2 updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      result:
                        $ref: '#/components/schemas/DashboardV2ResponseSchema'
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            body = DashboardV2PutSchema().load(request.get_json(silent=True) or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            UpdateDashboardV2Command(pk, body).run()
            result = GetDashboardV2Command(str(pk)).run()
        except CommandException as ex:
            return command_error_response(self, ex)
        return self.response(
            200, id=result["id"], result=DashboardV2ResponseSchema().dump(result)
        )

    @expose("/<ref>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, ref: str) -> Response:
        """Get a Dashboard v2 with its document.
        ---
        get:
          summary: Get a Dashboard v2
          parameters:
          - in: path
            schema:
              type: string
            name: ref
            description: Embedded dashboard uuid, dashboard uuid, or dashboard id
          responses:
            200:
              description: Dashboard v2
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/DashboardV2ResponseSchema'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            result = GetDashboardV2Command(ref).run()
        except CommandException as ex:
            return command_error_response(self, ex)
        return self.response(200, result=DashboardV2ResponseSchema().dump(result))

    @expose("/embedded/<uuid>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: (
            f"{self.__class__.__name__}.get_by_embedded"
        ),
        log_to_statsd=False,
    )
    def get_by_embedded(self, uuid: str) -> Response:
        """Get a Dashboard v2 by its embedded uuid (guest token friendly).
        ---
        get:
          summary: Get a Dashboard v2 by embedded uuid
          parameters:
          - in: path
            schema:
              type: string
            name: uuid
          responses:
            200:
              description: Dashboard v2
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/DashboardV2ResponseSchema'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            result = GetDashboardV2Command(uuid).run()
        except CommandException as ex:
            return command_error_response(self, ex)
        return self.response(200, result=DashboardV2ResponseSchema().dump(result))
