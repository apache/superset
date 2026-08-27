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
"""REST API for dashboard folders."""

import logging
from typing import Any
from uuid import UUID

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext
from marshmallow import ValidationError

from superset.commands.dashboard_folder.create import CreateDashboardFolderCommand
from superset.commands.dashboard_folder.delete import DeleteDashboardFolderCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderDashboardNotFoundError,
    DashboardFolderForbiddenError,
    DashboardFolderInvalidError,
    DashboardFolderNotFoundError,
    DashboardFolderOperationFailedError,
)
from superset.commands.dashboard_folder.move_dashboard import (
    MoveDashboardToFolderCommand,
)
from superset.commands.dashboard_folder.update import UpdateDashboardFolderCommand
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.dashboard_folders.schemas import (
    DashboardFolderMoveDashboardSchema,
    DashboardFolderPostSchema,
    DashboardFolderPutSchema,
)
from superset.models.dashboard_folder import DashboardFolder
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class DashboardFolderRestApi(BaseSupersetModelRestApi):
    """Manage hierarchical dashboard folders."""

    datamodel = SQLAInterface(DashboardFolder)
    resource_name = "dashboard_folder"
    allow_browser_login = True
    class_permission_name = "DashboardFolder"
    method_permission_name = {
        "get_list": "read",
        "post": "create",
        "put": "rename",
        "delete": "delete",
        "move_dashboard": "move_dashboard",
    }
    include_route_methods = {"get_list", "post", "put", "delete", "move_dashboard"}
    openapi_spec_tag = "Dashboard Folders"

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_list(self) -> Response:
        """Get the visible dashboard folder tree and access-scoped counts.
        ---
        get:
          summary: Get the visible dashboard folder tree
          responses:
            200:
              description: Dashboard folders and access-scoped dashboard counts
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: string
                              format: uuid
                            name:
                              type: string
                            description:
                              type: string
                              nullable: true
                            parent_id:
                              type: string
                              format: uuid
                              nullable: true
                            editors:
                              type: array
                              items:
                                type: object
                            viewers:
                              type: array
                              items:
                                type: object
                            dashboard_count:
                              type: integer
                            can_create:
                              type: boolean
                            can_rename:
                              type: boolean
                            can_delete:
                              type: boolean
                            can_move_dashboard:
                              type: boolean
                      count:
                        type: integer
                      total_dashboards:
                        type: integer
                      uncategorized_dashboards:
                        type: integer
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        return self.response(200, **DashboardFolderDAO.get_visible_tree())

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Create a dashboard folder.
        ---
        post:
          summary: Create a dashboard folder
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required:
                  - name
                  properties:
                    name:
                      type: string
                      minLength: 1
                      maxLength: 100
                    description:
                      type: string
                      maxLength: 500
                      nullable: true
                    parent_id:
                      type: string
                      format: uuid
                      nullable: true
                    editors:
                      type: array
                      items:
                        type: integer
                    viewers:
                      type: array
                      items:
                        type: integer
          responses:
            201:
              description: Dashboard folder created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: string
                        format: uuid
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            data = DashboardFolderPostSchema().load(request.json or {})
            folder = CreateDashboardFolderCommand(data).run()
            return self.response(201, id=str(folder.id))
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        except DashboardFolderForbiddenError:
            return self.response_403()
        except DashboardFolderInvalidError as ex:
            return self.response_422(message=ex.normalized_messages() or str(ex))
        except DashboardFolderOperationFailedError as ex:
            logger.exception("Dashboard folder creation failed")
            return self.response_422(message=str(ex))

    @expose("/<uuid:folder_id>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put(self, folder_id: UUID) -> Response:
        """Update a dashboard folder.
        ---
        put:
          summary: Update a dashboard folder
          parameters:
          - in: path
            name: folder_id
            required: true
            schema:
              type: string
              format: uuid
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    name:
                      type: string
                      minLength: 1
                      maxLength: 100
                    description:
                      type: string
                      maxLength: 500
                      nullable: true
                    parent_id:
                      type: string
                      format: uuid
                      nullable: true
                    editors:
                      type: array
                      items:
                        type: integer
                    viewers:
                      type: array
                      items:
                        type: integer
          responses:
            200:
              description: Dashboard folder updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: string
                        format: uuid
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
            data = DashboardFolderPutSchema().load(request.json or {})
            folder = UpdateDashboardFolderCommand(folder_id, data).run()
            return self.response(200, id=str(folder.id))
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        except DashboardFolderNotFoundError:
            return self.response_404()
        except DashboardFolderForbiddenError:
            return self.response_403()
        except DashboardFolderInvalidError as ex:
            return self.response_422(message=ex.normalized_messages() or str(ex))
        except DashboardFolderOperationFailedError as ex:
            logger.exception("Dashboard folder update failed for %s", folder_id)
            return self.response_422(message=str(ex))

    @expose("/<uuid:folder_id>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, folder_id: UUID) -> Response:
        """Delete a folder tree and uncategorize its dashboards.
        ---
        delete:
          summary: Delete a dashboard folder tree
          parameters:
          - in: path
            name: folder_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: Dashboard folder deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
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
            DeleteDashboardFolderCommand(folder_id).run()
            return self.response(200, message=gettext("Dashboard folder deleted"))
        except DashboardFolderNotFoundError:
            return self.response_404()
        except DashboardFolderForbiddenError:
            return self.response_403()
        except DashboardFolderOperationFailedError as ex:
            logger.exception("Dashboard folder deletion failed for %s", folder_id)
            return self.response_422(message=str(ex))

    @expose("/dashboard/<int:dashboard_id>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def move_dashboard(self, dashboard_id: int) -> Response:
        """Move a dashboard to a folder or the uncategorized root.
        ---
        put:
          summary: Move a dashboard to a folder
          parameters:
          - in: path
            name: dashboard_id
            required: true
            schema:
              type: integer
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required:
                  - folder_id
                  properties:
                    folder_id:
                      type: string
                      format: uuid
                      nullable: true
          responses:
            200:
              description: Dashboard moved
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      folder_id:
                        type: string
                        format: uuid
                        nullable: true
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
            data: dict[str, Any] = DashboardFolderMoveDashboardSchema().load(
                request.json or {}
            )
            dashboard = MoveDashboardToFolderCommand(
                dashboard_id, data["folder_id"]
            ).run()
            return self.response(
                200,
                id=dashboard.id,
                folder_id=str(dashboard.folder_id) if dashboard.folder_id else None,
            )
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        except (DashboardFolderNotFoundError, DashboardFolderDashboardNotFoundError):
            return self.response_404()
        except DashboardFolderForbiddenError:
            return self.response_403()
        except DashboardFolderOperationFailedError as ex:
            logger.exception("Dashboard move failed for %s", dashboard_id)
            return self.response_422(message=str(ex))
