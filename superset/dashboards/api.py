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
import logging
from typing import Any

from flask import g, make_response, request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext

from superset.constants import RouteMethod
from superset.dashboards.commands.bulk_delete import BulkDeleteDashboardCommand
from superset.dashboards.commands.create import CreateDashboardCommand
from superset.dashboards.commands.delete import DeleteDashboardCommand
from superset.dashboards.commands.exceptions import (
    DashboardBulkDeleteFailedError,
    DashboardCreateFailedError,
    DashboardDeleteFailedError,
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardNotFoundError,
    DashboardUpdateFailedError,
)
from superset.dashboards.commands.update import UpdateDashboardCommand
from superset.dashboards.filters import DashboardFilter, DashboardTitleOrSlugFilter
from superset.dashboards.schemas import (
    DashboardPostSchema,
    DashboardPutSchema,
    get_delete_ids_schema,
    get_export_ids_schema,
)
from superset.models.dashboard import Dashboard
from superset.views.base import generate_download_headers
from superset.views.base_api import BaseSupersetModelRestApi, RelatedFieldFilter
from superset.views.filters import FilterRelatedOwners

logger = logging.getLogger(__name__)


class DashboardRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dashboard)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    resource_name = "dashboard"
    allow_browser_login = True

    class_permission_name = "DashboardModelView"
    show_columns = [
        "id",
        "charts",
        "css",
        "dashboard_title",
        "json_metadata",
        "owners.id",
        "owners.username",
        "owners.first_name",
        "owners.last_name",
        "changed_by_name",
        "changed_by_url",
        "changed_by.username",
        "changed_on",
        "position_json",
        "published",
        "url",
        "slug",
        "table_names",
    ]
    order_columns = ["dashboard_title", "changed_on", "published", "changed_by_fk"]
    list_columns = [
        "changed_by_name",
        "changed_by_url",
        "changed_by.username",
        "changed_on",
        "dashboard_title",
        "id",
        "published",
        "slug",
        "url",
    ]
    edit_columns = [
        "dashboard_title",
        "slug",
        "owners",
        "position_json",
        "css",
        "json_metadata",
        "published",
    ]
    search_columns = ("dashboard_title", "slug", "owners", "published")
    search_filters = {"dashboard_title": [DashboardTitleOrSlugFilter]}
    add_columns = edit_columns
    base_order = ("changed_on", "desc")

    add_model_schema = DashboardPostSchema()
    edit_model_schema = DashboardPutSchema()

    base_filters = [["slice", DashboardFilter, lambda: []]]

    openapi_spec_tag = "Dashboards"
    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners)
    }
    allowed_rel_fields = {"owners"}

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self) -> Response:
        """Creates a new Dashboard
        ---
        post:
          description: >-
            Create a new Dashboard
          requestBody:
            description: Dashboard schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Dashboard added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_400(message=item.errors)
        try:
            new_model = CreateDashboardCommand(g.user, item.data).run()
            return self.response(201, id=new_model.id, result=item.data)
        except DashboardInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DashboardCreateFailedError as ex:
            logger.error(f"Error creating model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
        """Changes a Dashboard
        ---
        put:
          description: >-
            Changes a Dashboard
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Dashboard schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Dashboard changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
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
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_400(message=item.errors)
        try:
            changed_model = UpdateDashboardCommand(g.user, pk, item.data).run()
            return self.response(200, id=changed_model.id, result=item.data)
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DashboardUpdateFailedError as ex:
            logger.error(f"Error updating model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
        """Deletes a Dashboard
        ---
        delete:
          description: >-
            Deletes a Dashboard
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dashboard deleted
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
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeleteDashboardCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardDeleteFailedError as ex:
            logger.error(f"Error deleting model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @rison(get_delete_ids_schema)
    def bulk_delete(
        self, **kwargs: Any
    ) -> Response:  # pylint: disable=arguments-differ
        """Delete bulk Dashboards
        ---
        delete:
          description: >-
            Deletes multiple Dashboards in a bulk operation
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: Dashboard bulk delete
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
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            BulkDeleteDashboardCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    f"Deleted %(num)d dashboard",
                    f"Deleted %(num)d dashboards",
                    num=len(item_ids),
                ),
            )
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/export/", methods=["GET"])
    @protect()
    @safe
    @rison(get_export_ids_schema)
    def export(self, **kwargs: Any) -> Response:
        """Export dashboards
        ---
        get:
          description: >-
            Exports multiple Dashboards and downloads them as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: Dashboard export
              content:
                text/plain:
                  schema:
                    type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        query = self.datamodel.session.query(Dashboard).filter(
            Dashboard.id.in_(kwargs["rison"])
        )
        query = self._base_filters.apply_all(query)
        ids = [item.id for item in query.all()]
        if not ids:
            return self.response_404()
        export = Dashboard.export_dashboards(ids)
        resp = make_response(export, 200)
        resp.headers["Content-Disposition"] = generate_download_headers("json")[
            "Content-Disposition"
        ]
        return resp
