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
import json
import logging
from datetime import datetime
from io import BytesIO
from typing import Any, Dict
from zipfile import ZipFile

from flask import g, make_response, redirect, request, Response, send_file, url_for
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError
from werkzeug.wrappers import Response as WerkzeugResponse
from werkzeug.wsgi import FileWrapper

from superset import is_feature_enabled, thumbnail_cache
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1.utils import remove_root
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.dashboards.commands.bulk_delete import BulkDeleteDashboardCommand
from superset.dashboards.commands.create import CreateDashboardCommand
from superset.dashboards.commands.delete import DeleteDashboardCommand
from superset.dashboards.commands.exceptions import (
    DashboardBulkDeleteFailedError,
    DashboardCreateFailedError,
    DashboardDeleteFailedError,
    DashboardForbiddenError,
    DashboardImportError,
    DashboardInvalidError,
    DashboardNotFoundError,
    DashboardUpdateFailedError,
)
from superset.dashboards.commands.export import ExportDashboardsCommand
from superset.dashboards.commands.importers.dispatcher import ImportDashboardsCommand
from superset.dashboards.commands.update import UpdateDashboardCommand
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.filters import (
    DashboardFavoriteFilter,
    DashboardFilter,
    DashboardTitleOrSlugFilter,
)
from superset.dashboards.schemas import (
    DashboardPostSchema,
    DashboardPutSchema,
    get_delete_ids_schema,
    get_export_ids_schema,
    get_fav_star_ids_schema,
    GetFavStarIdsSchema,
    openapi_spec_methods_override,
    thumbnail_query_schema,
)
from superset.extensions import event_logger
from superset.models.dashboard import Dashboard
from superset.tasks.thumbnails import cache_dashboard_thumbnail
from superset.utils.screenshots import DashboardScreenshot
from superset.utils.urls import get_url_path
from superset.views.base import generate_download_headers
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import FilterRelatedOwners

logger = logging.getLogger(__name__)


class DashboardRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dashboard)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
        "favorite_status",
    }
    resource_name = "dashboard"
    allow_browser_login = True

    class_permission_name = "Dashboard"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

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
        "thumbnail_url",
    ]
    list_columns = [
        "id",
        "published",
        "slug",
        "url",
        "css",
        "position_json",
        "json_metadata",
        "thumbnail_url",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_by.username",
        "changed_by.id",
        "changed_by_name",
        "changed_by_url",
        "changed_on_utc",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "dashboard_title",
        "owners.id",
        "owners.username",
        "owners.first_name",
        "owners.last_name",
    ]
    list_select_columns = list_columns + ["changed_on", "changed_by_fk"]
    order_columns = [
        "changed_by.first_name",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "dashboard_title",
        "published",
    ]

    add_columns = [
        "dashboard_title",
        "slug",
        "owners",
        "position_json",
        "css",
        "json_metadata",
        "published",
    ]
    edit_columns = add_columns

    search_columns = (
        "created_by",
        "dashboard_title",
        "id",
        "owners",
        "published",
        "slug",
        "changed_by",
    )
    search_filters = {
        "dashboard_title": [DashboardTitleOrSlugFilter],
        "id": [DashboardFavoriteFilter],
    }
    base_order = ("changed_on", "desc")

    add_model_schema = DashboardPostSchema()
    edit_model_schema = DashboardPutSchema()

    base_filters = [["slice", DashboardFilter, lambda: []]]

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    allowed_rel_fields = {"owners", "created_by"}

    openapi_spec_tag = "Dashboards"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = (GetFavStarIdsSchema,)
    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
        "get_export_ids_schema": get_export_ids_schema,
        "thumbnail_query_schema": thumbnail_query_schema,
        "get_fav_star_ids_schema": get_fav_star_ids_schema,
    }
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    def __init__(self) -> None:
        if is_feature_enabled("THUMBNAILS"):
            self.include_route_methods = self.include_route_methods | {"thumbnail"}
        super().__init__()

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(log_to_statsd=False)
    def post(self) -> Response:
        """Creates a new Dashboard
        ---
        post:
          description: >-
            Create a new Dashboard.
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
            302:
              description: Redirects to the current digest
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateDashboardCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except DashboardInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DashboardCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(log_to_statsd=False)
    def put(self, pk: int) -> Response:
        """Changes a Dashboard
        ---
        put:
          description: >-
            Changes a Dashboard.
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
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdateDashboardCommand(g.user, pk, item).run()
            response = self.response(200, id=changed_model.id, result=item)
        except DashboardNotFoundError:
            response = self.response_404()
        except DashboardForbiddenError:
            response = self.response_403()
        except DashboardInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DashboardUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s", self.__class__.__name__, str(ex)
            )
            response = self.response_422(message=str(ex))
        return response

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(log_to_statsd=False)
    def delete(self, pk: int) -> Response:
        """Deletes a Dashboard
        ---
        delete:
          description: >-
            Deletes a Dashboard.
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
            logger.error(
                "Error deleting model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(log_to_statsd=False)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Dashboards
        ---
        delete:
          description: >-
            Deletes multiple Dashboards in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
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
                    "Deleted %(num)d dashboard",
                    "Deleted %(num)d dashboards",
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
    @statsd_metrics
    @rison(get_export_ids_schema)
    @event_logger.log_this_with_context(log_to_statsd=False)
    def export(self, **kwargs: Any) -> Response:
        """Export dashboards
        ---
        get:
          description: >-
            Exports multiple Dashboards and downloads them as YAML files.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
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
        requested_ids = kwargs["rison"]

        if is_feature_enabled("VERSIONED_EXPORT"):
            timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
            root = f"dashboard_export_{timestamp}"
            filename = f"{root}.zip"

            buf = BytesIO()
            with ZipFile(buf, "w") as bundle:
                try:
                    for file_name, file_content in ExportDashboardsCommand(
                        requested_ids
                    ).run():
                        with bundle.open(f"{root}/{file_name}", "w") as fp:
                            fp.write(file_content.encode())
                except DashboardNotFoundError:
                    return self.response_404()
            buf.seek(0)

            return send_file(
                buf,
                mimetype="application/zip",
                as_attachment=True,
                attachment_filename=filename,
            )

        query = self.datamodel.session.query(Dashboard).filter(
            Dashboard.id.in_(requested_ids)
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

    @expose("/<pk>/thumbnail/<digest>/", methods=["GET"])
    @protect()
    @safe
    @rison(thumbnail_query_schema)
    @event_logger.log_this_with_context(log_to_statsd=False)
    def thumbnail(
        self, pk: int, digest: str, **kwargs: Dict[str, bool]
    ) -> WerkzeugResponse:
        """Get Dashboard thumbnail
        ---
        get:
          description: >-
            Compute async or get already computed dashboard thumbnail from cache.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            name: digest
            description: A hex digest that makes this dashboard unique
            schema:
              type: string
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/thumbnail_query_schema'
          responses:
            200:
              description: Dashboard thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
            202:
              description: Thumbnail does not exist on cache, fired async to compute
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        dashboard = self.datamodel.get(pk, self._base_filters)
        if not dashboard:
            return self.response_404()

        dashboard_url = get_url_path(
            "Superset.dashboard", dashboard_id_or_slug=dashboard.id
        )
        # If force, request a screenshot from the workers
        if kwargs["rison"].get("force", False):
            cache_dashboard_thumbnail.delay(dashboard_url, dashboard.digest, force=True)
            return self.response(202, message="OK Async")
        # fetch the dashboard screenshot using the current user and cache if set
        screenshot = DashboardScreenshot(
            dashboard_url, dashboard.digest
        ).get_from_cache(cache=thumbnail_cache)
        # If the screenshot does not exist, request one from the workers
        if not screenshot:
            cache_dashboard_thumbnail.delay(dashboard_url, dashboard.digest, force=True)
            return self.response(202, message="OK Async")
        # If digests
        if dashboard.digest != digest:
            return redirect(
                url_for(
                    f"{self.__class__.__name__}.thumbnail",
                    pk=pk,
                    digest=dashboard.digest,
                )
            )
        return Response(
            FileWrapper(screenshot), mimetype="image/png", direct_passthrough=True
        )

    @expose("/favorite_status/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_fav_star_ids_schema)
    @event_logger.log_this_with_context(log_to_statsd=False)
    def favorite_status(self, **kwargs: Any) -> Response:
        """Favorite Stars for Dashboards
        ---
        get:
          description: >-
            Check favorited dashboards for current user
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_fav_star_ids_schema'
          responses:
            200:
              description:
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/GetFavStarIdsSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]
        dashboards = DashboardDAO.find_by_ids(requested_ids)
        if not dashboards:
            return self.response_404()
        favorited_dashboard_ids = DashboardDAO.favorited_ids(dashboards, g.user.id)
        res = [
            {"id": request_id, "value": request_id in favorited_dashboard_ids}
            for request_id in requested_ids
        ]
        return self.response(200, result=res)

    @expose("/import/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    def import_(self) -> Response:
        """Import dashboard(s) with associated charts/datasets/databases
        ---
        post:
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    formData:
                      type: string
                      format: binary
                    passwords:
                      type: string
                    overwrite:
                      type: bool
          responses:
            200:
              description: Dashboard import result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        upload = request.files.get("formData")
        if not upload:
            return self.response_400()
        with ZipFile(upload) as bundle:
            contents = {
                remove_root(file_name): bundle.read(file_name).decode()
                for file_name in bundle.namelist()
            }

        passwords = (
            json.loads(request.form["passwords"])
            if "passwords" in request.form
            else None
        )
        overwrite = request.form.get("overwrite") == "true"

        command = ImportDashboardsCommand(
            contents, passwords=passwords, overwrite=overwrite
        )
        try:
            command.run()
            return self.response(200, message="OK")
        except CommandInvalidError as exc:
            logger.warning("Import dashboard failed")
            return self.response_422(message=exc.normalized_messages())
        except DashboardImportError as exc:
            logger.exception("Import dashboard failed")
            return self.response_500(message=str(exc))
