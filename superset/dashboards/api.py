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
# pylint: disable=too-many-lines
import functools
import logging
from datetime import datetime
from io import BytesIO
from typing import Any, Callable, cast, Optional
from zipfile import is_zipfile, ZipFile

from flask import g, redirect, request, Response, send_file, url_for
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext, ngettext
from marshmallow import ValidationError
from werkzeug.wrappers import Response as WerkzeugResponse
from werkzeug.wsgi import FileWrapper

from superset import db, is_feature_enabled, thumbnail_cache
from superset.charts.schemas import ChartEntityResponseSchema
from superset.commands.dashboard.copy import CopyDashboardCommand
from superset.commands.dashboard.create import CreateDashboardCommand
from superset.commands.dashboard.delete import (
    DeleteDashboardCommand,
    DeleteEmbeddedDashboardCommand,
)
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardCopyError,
    DashboardCreateFailedError,
    DashboardDeleteFailedError,
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardNotFoundError,
    DashboardUpdateFailedError,
)
from superset.commands.dashboard.export import ExportDashboardsCommand
from superset.commands.dashboard.fave import AddFavoriteDashboardCommand
from superset.commands.dashboard.importers.dispatcher import ImportDashboardsCommand
from superset.commands.dashboard.permalink.create import CreateDashboardPermalinkCommand
from superset.commands.dashboard.unfave import DelFavoriteDashboardCommand
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.commands.database.exceptions import DatasetValidationError
from superset.commands.exceptions import TagForbiddenError
from superset.commands.importers.exceptions import NoValidFilesFoundError
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.dashboard import DashboardDAO, EmbeddedDashboardDAO
from superset.dashboards.filters import (
    DashboardAccessFilter,
    DashboardCertifiedFilter,
    DashboardCreatedByMeFilter,
    DashboardFavoriteFilter,
    DashboardHasCreatedByFilter,
    DashboardTagIdFilter,
    DashboardTagNameFilter,
    DashboardTitleOrSlugFilter,
    FilterRelatedRoles,
)
from superset.dashboards.permalink.types import DashboardPermalinkState
from superset.dashboards.schemas import (
    CacheScreenshotSchema,
    DashboardCacheScreenshotResponseSchema,
    DashboardCopySchema,
    DashboardDatasetSchema,
    DashboardGetResponseSchema,
    DashboardPostSchema,
    DashboardPutSchema,
    EmbeddedDashboardConfigSchema,
    EmbeddedDashboardResponseSchema,
    get_delete_ids_schema,
    get_export_ids_schema,
    get_fav_star_ids_schema,
    GetFavStarIdsSchema,
    openapi_spec_methods_override,
    screenshot_query_schema,
    TabsPayloadSchema,
    thumbnail_query_schema,
)
from superset.extensions import event_logger
from superset.models.dashboard import Dashboard
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.security.guest_token import GuestUser
from superset.tasks.thumbnails import (
    cache_dashboard_screenshot,
    cache_dashboard_thumbnail,
)
from superset.tasks.utils import get_current_user
from superset.utils import json
from superset.utils.pdf import build_pdf_from_screenshots
from superset.utils.screenshots import (
    DashboardScreenshot,
    DEFAULT_DASHBOARD_WINDOW_SIZE,
)
from superset.utils.urls import get_url_path
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_form_data,
    requires_json,
    statsd_metrics,
)
from superset.views.error_handling import handle_api_exception
from superset.views.filters import (
    BaseFilterRelatedRoles,
    BaseFilterRelatedUsers,
    FilterRelatedOwners,
)

logger = logging.getLogger(__name__)


def with_dashboard(
    f: Callable[[BaseSupersetModelRestApi, Dashboard], Response],
) -> Callable[[BaseSupersetModelRestApi, str], Response]:
    """
    A decorator that looks up the dashboard by id or slug and passes it to the api.
    Route must include an <id_or_slug> parameter.
    Responds with 403 or 404 without calling the route, if necessary.
    """

    def wraps(self: BaseSupersetModelRestApi, id_or_slug: str) -> Response:
        try:
            dash = DashboardDAO.get_by_id_or_slug(id_or_slug)
            return f(self, dash)
        except DashboardAccessDeniedError:
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    return functools.update_wrapper(wraps, f)


# pylint: disable=too-many-public-methods
class DashboardRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Dashboard)

    @before_request(only=["thumbnail"])
    def ensure_thumbnails_enabled(self) -> Optional[Response]:
        if not is_feature_enabled("THUMBNAILS"):
            return self.response_404()
        return None

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
        "favorite_status",
        "add_favorite",
        "remove_favorite",
        "get_charts",
        "get_datasets",
        "get_tabs",
        "get_embedded",
        "set_embedded",
        "delete_embedded",
        "thumbnail",
        "copy_dash",
        "cache_dashboard_screenshot",
        "screenshot",
    }
    resource_name = "dashboard"
    allow_browser_login = True

    class_permission_name = "Dashboard"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_columns = [
        "id",
        "published",
        "status",
        "slug",
        "url",
        "css",
        "position_json",
        "json_metadata",
        "thumbnail_url",
        "certified_by",
        "certification_details",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_by.id",
        "changed_by_name",
        "changed_on_utc",
        "changed_on_delta_humanized",
        "created_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "dashboard_title",
        "owners.id",
        "owners.first_name",
        "owners.last_name",
        "roles.id",
        "roles.name",
        "is_managed_externally",
        "tags.id",
        "tags.name",
        "tags.type",
    ]

    list_select_columns = list_columns + ["changed_on", "created_on", "changed_by_fk"]
    order_columns = [
        "changed_by.first_name",
        "changed_on_delta_humanized",
        "created_by.first_name",
        "dashboard_title",
        "published",
        "changed_on",
    ]

    add_columns = [
        "certified_by",
        "certification_details",
        "dashboard_title",
        "slug",
        "owners",
        "roles",
        "position_json",
        "css",
        "json_metadata",
        "published",
    ]
    edit_columns = add_columns

    search_columns = (
        "created_by",
        "changed_by",
        "dashboard_title",
        "id",
        "owners",
        "published",
        "roles",
        "slug",
        "tags",
    )
    search_filters = {
        "dashboard_title": [DashboardTitleOrSlugFilter],
        "id": [DashboardFavoriteFilter, DashboardCertifiedFilter],
        "created_by": [DashboardCreatedByMeFilter, DashboardHasCreatedByFilter],
        "tags": [DashboardTagIdFilter, DashboardTagNameFilter],
    }

    base_order = ("changed_on", "desc")

    add_model_schema = DashboardPostSchema()
    edit_model_schema = DashboardPutSchema()
    chart_entity_response_schema = ChartEntityResponseSchema()
    dashboard_get_response_schema = DashboardGetResponseSchema()
    dashboard_dataset_schema = DashboardDatasetSchema()
    tab_schema = TabsPayloadSchema()
    embedded_response_schema = EmbeddedDashboardResponseSchema()
    embedded_config_schema = EmbeddedDashboardConfigSchema()

    base_filters = [
        ["id", DashboardAccessFilter, lambda: []],
    ]

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
        "roles": ("name", "asc"),
    }
    base_related_field_filters = {
        "owners": [["id", BaseFilterRelatedUsers, lambda: []]],
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "roles": [["id", BaseFilterRelatedRoles, lambda: []]],
    }

    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "roles": RelatedFieldFilter("name", FilterRelatedRoles),
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    allowed_rel_fields = {"owners", "roles", "created_by", "changed_by"}

    openapi_spec_tag = "Dashboards"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = (
        ChartEntityResponseSchema,
        DashboardCacheScreenshotResponseSchema,
        DashboardCopySchema,
        DashboardGetResponseSchema,
        DashboardDatasetSchema,
        TabsPayloadSchema,
        GetFavStarIdsSchema,
        EmbeddedDashboardResponseSchema,
    )
    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
        "get_export_ids_schema": get_export_ids_schema,
        "thumbnail_query_schema": thumbnail_query_schema,
        "get_fav_star_ids_schema": get_fav_star_ids_schema,
    }
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    def __repr__(self) -> str:
        """Deterministic string representation of the API instance for etag_cache."""
        # pylint: disable=consider-using-f-string
        return "Superset.dashboards.api.DashboardRestApi@v{}{}".format(
            self.appbuilder.app.config["VERSION_STRING"],
            self.appbuilder.app.config["VERSION_SHA"],
        )

    @expose("/<id_or_slug>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @with_dashboard
    @event_logger.log_this_with_extra_payload
    # pylint: disable=arguments-differ,arguments-renamed
    def get(
        self,
        dash: Dashboard,
        add_extra_log_payload: Callable[..., None] = lambda **kwargs: None,
    ) -> Response:
        """Get a dashboard.
        ---
        get:
          summary: Get a dashboard
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: Either the id of the dashboard, or its slug
          responses:
            200:
              description: Dashboard
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/DashboardGetResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        result = self.dashboard_get_response_schema.dump(dash)
        add_extra_log_payload(
            dashboard_id=dash.id, action=f"{self.__class__.__name__}.get"
        )
        return self.response(200, result=result)

    @expose("/<id_or_slug>/datasets", methods=("GET",))
    @protect()
    @handle_api_exception
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_datasets",
        log_to_statsd=False,
    )
    def get_datasets(self, id_or_slug: str) -> Response:
        """Get dashboard's datasets.
        ---
        get:
          summary: Get dashboard's datasets
          description: >-
            Returns a list of a dashboard's datasets. Each dataset includes only
            the information necessary to render the dashboard's charts.
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: Either the id of the dashboard, or its slug
          responses:
            200:
              description: Dashboard dataset definitions
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/DashboardDatasetSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            datasets = DashboardDAO.get_datasets_for_dashboard(id_or_slug)
            result = [
                self.dashboard_dataset_schema.dump(dataset) for dataset in datasets
            ]
            return self.response(200, result=result)
        except (TypeError, ValueError) as err:
            raise DatasetValidationError(err) from err

    @expose("/<id_or_slug>/tabs", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_tabs",
        log_to_statsd=False,
    )
    def get_tabs(self, id_or_slug: str) -> Response:
        """Get dashboard's tabs.
        ---
        get:
          summary: Get dashboard's tabs
          description: >-
            Returns a list of a dashboard's tabs and dashboard's nested tree structure for associated tabs.
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: Either the id of the dashboard, or its slug
          responses:
            200:
              description: Dashboard tabs
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        items:
                          $ref: '#/components/schemas/TabsPayloadSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            tabs = DashboardDAO.get_tabs_for_dashboard(id_or_slug)
            result = self.tab_schema.dump(tabs)
            return self.response(200, result=result)

        except (TypeError, ValueError) as err:
            return self.response_400(
                message=gettext(
                    "Tab schema is invalid, caused by: %(error)s", error=str(err)
                )
            )
        except DashboardAccessDeniedError:
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    @expose("/<id_or_slug>/charts", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_charts",
        log_to_statsd=False,
    )
    def get_charts(self, id_or_slug: str) -> Response:
        """Get a dashboard's chart definitions.
        ---
        get:
          summary: Get a dashboard's chart definitions.
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
          responses:
            200:
              description: Dashboard chart definitions
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/ChartEntityResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            charts = DashboardDAO.get_charts_for_dashboard(id_or_slug)
            result = [self.chart_entity_response_schema.dump(chart) for chart in charts]
            return self.response(200, result=result)
        except DashboardAccessDeniedError:
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Create a new dashboard.
        ---
        post:
          summary: Create a new dashboard
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
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateDashboardCommand(item).run()
            return self.response(201, id=new_model.id, result=item)
        except DashboardInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DashboardCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a dashboard.
        ---
        put:
          summary: Update a dashboard
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
                      last_modified_time:
                        type: number
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
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdateDashboardCommand(pk, item).run()
            last_modified_time = changed_model.changed_on.replace(
                microsecond=0
            ).timestamp()
            response = self.response(
                200,
                id=changed_model.id,
                result=item,
                last_modified_time=last_modified_time,
            )
        except DashboardNotFoundError:
            response = self.response_404()
        except DashboardForbiddenError:
            response = self.response_403()
        except TagForbiddenError as ex:
            response = self.response(403, message=str(ex))
        except DashboardInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DashboardUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))
        return response

    @expose("/<pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a dashboard.
        ---
        delete:
          summary: Delete a dashboard
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
            DeleteDashboardCommand([pk]).run()
            return self.response(200, message="OK")
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete dashboards.
        ---
        delete:
          summary: Bulk delete dashboards
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
            DeleteDashboardCommand(item_ids).run()
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
        except DashboardDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/export/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_export_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.export",
        log_to_statsd=False,
    )
    def export(self, **kwargs: Any) -> Response:
        """Download multiple dashboards as YAML files.
        ---
        get:
          summary: Download multiple dashboards as YAML files
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
                        fp.write(file_content().encode())
            except DashboardNotFoundError:
                return self.response_404()
        buf.seek(0)

        response = send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name=filename,
        )
        if token := request.args.get("token"):
            response.set_cookie(token, "done", max_age=600)
        return response

    @expose("/<pk>/thumbnail/<digest>/", methods=("GET",))
    @protect()
    @safe
    @rison(thumbnail_query_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.thumbnail",
        log_to_statsd=False,
    )
    def thumbnail(self, pk: int, digest: str, **kwargs: Any) -> WerkzeugResponse:
        """Compute async or get already computed dashboard thumbnail from cache.
        ---
        get:
          summary: Get dashboard's thumbnail
          description: >-
            Computes async or get already computed dashboard thumbnail from cache.
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
            302:
              description: Redirects to the current digest
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        dashboard = cast(Dashboard, self.datamodel.get(pk, self._base_filters))
        if not dashboard:
            return self.response_404()

        dashboard_url = get_url_path(
            "Superset.dashboard", dashboard_id_or_slug=dashboard.id
        )
        # If force, request a screenshot from the workers
        current_user = get_current_user()
        if kwargs["rison"].get("force", False):
            cache_dashboard_thumbnail.delay(
                current_user=current_user,
                dashboard_id=dashboard.id,
                force=True,
            )
            return self.response(202, message="OK Async")
        # fetch the dashboard screenshot using the current user and cache if set
        screenshot = DashboardScreenshot(
            dashboard_url, dashboard.digest
        ).get_from_cache(cache=thumbnail_cache)
        # If the screenshot does not exist, request one from the workers
        if not screenshot:
            self.incr_stats("async", self.thumbnail.__name__)
            cache_dashboard_thumbnail.delay(
                current_user=current_user,
                dashboard_id=dashboard.id,
                force=True,
            )
            return self.response(202, message="OK Async")
        # If digests
        if dashboard.digest != digest:
            self.incr_stats("redirect", self.thumbnail.__name__)
            return redirect(
                url_for(
                    f"{self.__class__.__name__}.thumbnail",
                    pk=pk,
                    digest=dashboard.digest,
                )
            )
        self.incr_stats("from_cache", self.thumbnail.__name__)
        return Response(
            FileWrapper(screenshot), mimetype="image/png", direct_passthrough=True
        )

    @expose("/<pk>/cache_dashboard_screenshot/", methods=("POST",))
    @protect()
    @rison(screenshot_query_schema)
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".cache_dashboard_screenshot",
        log_to_statsd=False,
    )
    def cache_dashboard_screenshot(self, pk: int, **kwargs: Any) -> WerkzeugResponse:
        """Compute and cache a screenshot.
        ---
        post:
          summary: Compute and cache a screenshot
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            content:
              application/json:
                  schema:
                    $ref: '#/components/schemas/DashboardScreenshotPostSchema'
          responses:
            202:
              description: Dashboard async result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/DashboardCacheScreenshotResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            payload = CacheScreenshotSchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        dashboard = cast(Dashboard, self.datamodel.get(pk, self._base_filters))
        if not dashboard:
            return self.response_404()

        window_size = (
            kwargs["rison"].get("window_size") or DEFAULT_DASHBOARD_WINDOW_SIZE
        )
        # Don't shrink the image if thumb_size is not specified
        thumb_size = kwargs["rison"].get("thumb_size") or window_size

        dashboard_state: DashboardPermalinkState = {
            "dataMask": payload.get("dataMask", {}),
            "activeTabs": payload.get("activeTabs", []),
            "anchor": payload.get("anchor", ""),
            "urlParams": payload.get("urlParams", []),
        }

        permalink_key = CreateDashboardPermalinkCommand(
            dashboard_id=str(dashboard.id),
            state=dashboard_state,
        ).run()

        dashboard_url = get_url_path("Superset.dashboard_permalink", key=permalink_key)
        screenshot_obj = DashboardScreenshot(dashboard_url, dashboard.digest)
        cache_key = screenshot_obj.cache_key(window_size, thumb_size, dashboard_state)
        image_url = get_url_path(
            "DashboardRestApi.screenshot", pk=dashboard.id, digest=cache_key
        )

        def trigger_celery() -> WerkzeugResponse:
            logger.info("Triggering screenshot ASYNC")
            cache_dashboard_screenshot.delay(
                username=get_current_user(),
                guest_token=g.user.guest_token
                if get_current_user() and isinstance(g.user, GuestUser)
                else None,
                dashboard_id=dashboard.id,
                dashboard_url=dashboard_url,
                cache_key=cache_key,
                force=True,
                thumb_size=thumb_size,
                window_size=window_size,
            )
            return self.response(
                202,
                cache_key=cache_key,
                dashboard_url=dashboard_url,
                image_url=image_url,
            )

        return trigger_celery()

    @expose("/<pk>/screenshot/<digest>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.screenshot",
        log_to_statsd=False,
    )
    def screenshot(self, pk: int, digest: str) -> WerkzeugResponse:
        """Get a computed dashboard screenshot from cache.
        ---
        get:
          summary: Get a computed screenshot from cache
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: digest
          responses:
            200:
              description: Dashboard thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        dashboard = self.datamodel.get(pk, self._base_filters)

        # Making sure the dashboard still exists
        if not dashboard:
            return self.response_404()

        download_format = request.args.get("download_format", "png")

        # fetch the dashboard screenshot using the current user and cache if set

        if img := DashboardScreenshot.get_from_cache_key(thumbnail_cache, digest):
            if download_format == "pdf":
                pdf_img = img.getvalue()
                # Convert the screenshot to PDF
                pdf_data = build_pdf_from_screenshots([pdf_img])

                return Response(
                    pdf_data,
                    mimetype="application/pdf",
                    headers={"Content-Disposition": "inline; filename=dashboard.pdf"},
                    direct_passthrough=True,
                )
            if download_format == "png":
                return Response(
                    FileWrapper(img),
                    mimetype="image/png",
                    direct_passthrough=True,
                )

        return self.response_404()

    @expose("/favorite_status/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_fav_star_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".favorite_status",
        log_to_statsd=False,
    )
    def favorite_status(self, **kwargs: Any) -> Response:
        """Check favorited dashboards for current user.
        ---
        get:
          summary: Check favorited dashboards for current user
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

        favorited_dashboard_ids = DashboardDAO.favorited_ids(dashboards)
        res = [
            {"id": request_id, "value": request_id in favorited_dashboard_ids}
            for request_id in requested_ids
        ]
        return self.response(200, result=res)

    @expose("/<pk>/favorites/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".add_favorite",
        log_to_statsd=False,
    )
    def add_favorite(self, pk: int) -> Response:
        """Mark the dashboard as favorite for the current user.
        ---
        post:
          summary: Mark the dashboard as favorite for the current user
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dashboard added to favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            AddFavoriteDashboardCommand(pk).run()

        except DashboardNotFoundError:
            return self.response_404()
        except DashboardAccessDeniedError:
            return self.response_403()

        return self.response(200, result="OK")

    @expose("/<pk>/favorites/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".remove_favorite",
        log_to_statsd=False,
    )
    def remove_favorite(self, pk: int) -> Response:
        """Remove the dashboard from the user favorite list.
        ---
        delete:
          summary: Remove the dashboard from the user favorite list
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dashboard removed from favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DelFavoriteDashboardCommand(pk).run()
        except DashboardNotFoundError:
            return self.response_404()
        except DashboardAccessDeniedError:
            return self.response_403()

        return self.response(200, result="OK")

    @expose("/import/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        """Import dashboard(s) with associated charts/datasets/databases.
        ---
        post:
          summary: Import dashboard(s) with associated charts/datasets/databases
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    formData:
                      description: upload file (ZIP or JSON)
                      type: string
                      format: binary
                    passwords:
                      description: >-
                        JSON map of passwords for each featured database in the
                        ZIP file. If the ZIP includes a database config in the path
                        `databases/MyDatabase.yaml`, the password should be provided
                        in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
                    overwrite:
                      description: overwrite existing dashboards?
                      type: boolean
                    ssh_tunnel_passwords:
                      description: >-
                        JSON map of passwords for each ssh_tunnel associated to a
                        featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the password should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
                    ssh_tunnel_private_keys:
                      description: >-
                        JSON map of private_keys for each ssh_tunnel associated to a
                        featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the private_key should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_private_key"}`.
                      type: string
                    ssh_tunnel_private_key_passwords:
                      description: >-
                        JSON map of private_key_passwords for each ssh_tunnel associated
                        to a featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the private_key should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_private_key_password"}`.
                      type: string
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
        if is_zipfile(upload):
            with ZipFile(upload) as bundle:
                contents = get_contents_from_bundle(bundle)
        else:
            upload.seek(0)
            contents = {upload.filename: upload.read()}

        if not contents:
            raise NoValidFilesFoundError()

        passwords = (
            json.loads(request.form["passwords"])
            if "passwords" in request.form
            else None
        )
        overwrite = request.form.get("overwrite") == "true"

        ssh_tunnel_passwords = (
            json.loads(request.form["ssh_tunnel_passwords"])
            if "ssh_tunnel_passwords" in request.form
            else None
        )
        ssh_tunnel_private_keys = (
            json.loads(request.form["ssh_tunnel_private_keys"])
            if "ssh_tunnel_private_keys" in request.form
            else None
        )
        ssh_tunnel_priv_key_passwords = (
            json.loads(request.form["ssh_tunnel_private_key_passwords"])
            if "ssh_tunnel_private_key_passwords" in request.form
            else None
        )

        command = ImportDashboardsCommand(
            contents,
            passwords=passwords,
            overwrite=overwrite,
            ssh_tunnel_passwords=ssh_tunnel_passwords,
            ssh_tunnel_private_keys=ssh_tunnel_private_keys,
            ssh_tunnel_priv_key_passwords=ssh_tunnel_priv_key_passwords,
        )
        command.run()
        return self.response(200, message="OK")

    @expose("/<id_or_slug>/embedded", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_embedded",
        log_to_statsd=False,
    )
    @with_dashboard
    def get_embedded(self, dashboard: Dashboard) -> Response:
        """Get the dashboard's embedded configuration.
        ---
        get:
          summary: Get the dashboard's embedded configuration
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: The dashboard id or slug
          responses:
            200:
              description: Result contains the embedded dashboard config
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/EmbeddedDashboardResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        if not dashboard.embedded:
            return self.response(404)
        embedded: EmbeddedDashboard = dashboard.embedded[0]
        result = self.embedded_response_schema.dump(embedded)
        return self.response(200, result=result)

    @expose("/<id_or_slug>/embedded", methods=["POST", "PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.set_embedded",
        log_to_statsd=False,
    )
    @with_dashboard
    def set_embedded(self, dashboard: Dashboard) -> Response:
        """Set a dashboard's embedded configuration.
        ---
        post:
          summary: Set a dashboard's embedded configuration
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: The dashboard id or slug
          requestBody:
            description: The embedded configuration to set
            required: true
            content:
              application/json:
                schema: EmbeddedDashboardConfigSchema
          responses:
            200:
              description: Successfully set the configuration
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/EmbeddedDashboardResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        put:
          description: >-
            Sets a dashboard's embedded configuration.
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: The dashboard id or slug
          requestBody:
            description: The embedded configuration to set
            required: true
            content:
              application/json:
                schema: EmbeddedDashboardConfigSchema
          responses:
            200:
              description: Successfully set the configuration
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/EmbeddedDashboardResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            body = self.embedded_config_schema.load(request.json)

            with db.session.begin_nested():
                embedded = EmbeddedDashboardDAO.upsert(
                    dashboard,
                    body["allowed_domains"],
                )

            result = self.embedded_response_schema.dump(embedded)
            return self.response(200, result=result)
        except ValidationError as error:
            return self.response_400(message=error.messages)

    @expose("/<id_or_slug>/embedded", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("set_embedded")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self,
        *args,
        **kwargs: f"{self.__class__.__name__}.delete_embedded",
        log_to_statsd=False,
    )
    @with_dashboard
    def delete_embedded(self, dashboard: Dashboard) -> Response:
        """Delete a dashboard's embedded configuration.
        ---
        delete:
          summary: Delete a dashboard's embedded configuration
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: The dashboard id or slug
          responses:
            200:
              description: Successfully removed the configuration
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        DeleteEmbeddedDashboardCommand(dashboard).run()
        return self.response(200, message="OK")

    @expose("/<id_or_slug>/copy/", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.copy_dash",
        log_to_statsd=False,
    )
    @with_dashboard
    def copy_dash(self, original_dash: Dashboard) -> Response:
        """Create a copy of an existing dashboard.
        ---
        post:
          summary: Create a copy of an existing dashboard
          parameters:
          - in: path
            schema:
              type: string
            name: id_or_slug
            description: The dashboard id or slug
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/DashboardCopySchema'
          responses:
            200:
              description: Id of new dashboard and last modified time
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      last_modified_time:
                        type: number
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            data = DashboardCopySchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            dash = CopyDashboardCommand(original_dash, data).run()
        except DashboardForbiddenError:
            return self.response_403()
        except DashboardCopyError:
            return self.response_400()

        return self.response(
            200,
            result={
                "id": dash.id,
                "last_modified_time": dash.changed_on.replace(
                    microsecond=0
                ).timestamp(),
            },
        )
