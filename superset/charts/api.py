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

import simplejson
from flask import g, make_response, redirect, request, Response, send_file, url_for
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as _, ngettext
from marshmallow import ValidationError
from werkzeug.wrappers import Response as WerkzeugResponse
from werkzeug.wsgi import FileWrapper

from superset import is_feature_enabled, thumbnail_cache
from superset.charts.commands.bulk_delete import BulkDeleteChartCommand
from superset.charts.commands.create import CreateChartCommand
from superset.charts.commands.delete import DeleteChartCommand
from superset.charts.commands.exceptions import (
    ChartBulkDeleteFailedError,
    ChartCreateFailedError,
    ChartDeleteFailedError,
    ChartForbiddenError,
    ChartInvalidError,
    ChartNotFoundError,
    ChartUpdateFailedError,
)
from superset.charts.commands.export import ExportChartsCommand
from superset.charts.commands.update import UpdateChartCommand
from superset.charts.dao import ChartDAO
from superset.charts.filters import ChartAllTextFilter, ChartFavoriteFilter, ChartFilter
from superset.charts.schemas import (
    CHART_SCHEMAS,
    ChartDataQueryContextSchema,
    ChartPostSchema,
    ChartPutSchema,
    get_delete_ids_schema,
    get_export_ids_schema,
    get_fav_star_ids_schema,
    openapi_spec_methods_override,
    screenshot_query_schema,
    thumbnail_query_schema,
)
from superset.constants import RouteMethod
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.models.slice import Slice
from superset.tasks.thumbnails import cache_chart_thumbnail
from superset.utils.core import ChartDataResultFormat, json_int_dttm_ser
from superset.utils.screenshots import ChartScreenshot
from superset.utils.urls import get_url_path
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.core import CsvResponse, generate_download_headers
from superset.views.filters import FilterRelatedOwners

logger = logging.getLogger(__name__)


class ChartRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Slice)

    resource_name = "chart"
    allow_browser_login = True

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
        "data",
        "favorite_status",
    }
    class_permission_name = "SliceModelView"
    show_columns = [
        "cache_timeout",
        "dashboards.dashboard_title",
        "dashboards.id",
        "description",
        "owners.first_name",
        "owners.id",
        "owners.last_name",
        "owners.username",
        "params",
        "slice_name",
        "viz_type",
    ]
    show_select_columns = show_columns + ["table.id"]
    list_columns = [
        "cache_timeout",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_by_name",
        "changed_by_url",
        "changed_on_delta_humanized",
        "changed_on_utc",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "datasource_id",
        "datasource_name_text",
        "datasource_type",
        "datasource_url",
        "description",
        "description_markeddown",
        "edit_url",
        "id",
        "owners.first_name",
        "owners.id",
        "owners.last_name",
        "owners.username",
        "params",
        "slice_name",
        "table.default_endpoint",
        "table.table_name",
        "thumbnail_url",
        "url",
        "viz_type",
    ]
    list_select_columns = list_columns + ["changed_by_fk", "changed_on"]
    order_columns = [
        "changed_by.first_name",
        "changed_on_delta_humanized",
        "datasource_id",
        "datasource_name",
        "slice_name",
        "viz_type",
    ]
    search_columns = [
        "created_by",
        "changed_by",
        "datasource_id",
        "datasource_name",
        "datasource_type",
        "description",
        "id",
        "owners",
        "slice_name",
        "viz_type",
    ]
    base_order = ("changed_on", "desc")
    base_filters = [["id", ChartFilter, lambda: []]]
    search_filters = {
        "id": [ChartFavoriteFilter],
        "slice_name": [ChartAllTextFilter],
    }

    # Will just affect _info endpoint
    edit_columns = ["slice_name"]
    add_columns = edit_columns

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    openapi_spec_tag = "Charts"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = CHART_SCHEMAS

    apispec_parameter_schemas = {
        "screenshot_query_schema": screenshot_query_schema,
        "get_delete_ids_schema": get_delete_ids_schema,
        "get_export_ids_schema": get_export_ids_schema,
        "get_fav_star_ids_schema": get_fav_star_ids_schema,
    }
    """ Add extra schemas to the OpenAPI components schema section """
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }

    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }

    allowed_rel_fields = {"owners", "created_by"}

    def __init__(self) -> None:
        if is_feature_enabled("THUMBNAILS"):
            self.include_route_methods = self.include_route_methods | {
                "thumbnail",
                "screenshot",
                "cache_screenshot",
            }
        super().__init__()

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Creates a new Chart
        ---
        post:
          description: >-
            Create a new Chart.
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Chart added
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
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateChartCommand(g.user, item).run()
            return self.response(201, id=new_model.id, result=item)
        except ChartInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except ChartCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    def put(self, pk: int) -> Response:
        """Changes a Chart
        ---
        put:
          description: >-
            Changes a Chart.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Chart schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Chart changed
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
            changed_model = UpdateChartCommand(g.user, pk, item).run()
            response = self.response(200, id=changed_model.id, result=item)
        except ChartNotFoundError:
            response = self.response_404()
        except ChartForbiddenError:
            response = self.response_403()
        except ChartInvalidError as ex:
            response = self.response_422(message=ex.normalized_messages())
        except ChartUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s", self.__class__.__name__, str(ex)
            )
            response = self.response_422(message=str(ex))

        return response

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:
        """Deletes a Chart
        ---
        delete:
          description: >-
            Deletes a Chart.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Chart delete
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
            DeleteChartCommand(g.user, pk).run()
            return self.response(200, message="OK")
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s", self.__class__.__name__, str(ex)
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Delete bulk Charts
        ---
        delete:
          description: >-
            Deletes multiple Charts in a bulk operation.
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Charts bulk delete
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
            BulkDeleteChartCommand(g.user, item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d chart", "Deleted %(num)d charts", num=len(item_ids)
                ),
            )
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartBulkDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/data", methods=["POST"])
    @event_logger.log_this
    @protect()
    @safe
    @statsd_metrics
    def data(self) -> Response:
        """
        Takes a query context constructed in the client and returns payload
        data response for the given query.
        ---
        post:
          description: >-
            Takes a query context constructed in the client and returns payload data
            response for the given query.
          requestBody:
            description: >-
              A query context consists of a datasource from which to fetch data
              and one or many query objects.
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/ChartDataQueryContextSchema"
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartDataResponseSchema"
            400:
              $ref: '#/components/responses/400'
            500:
              $ref: '#/components/responses/500'
        """
        if request.is_json:
            json_body = request.json
        elif request.form.get("form_data"):
            # CSV export submits regular form data
            json_body = json.loads(request.form["form_data"])
        else:
            return self.response_400(message="Request is not JSON")
        try:
            query_context = ChartDataQueryContextSchema().load(json_body)
        except KeyError:
            return self.response_400(message="Request is incorrect")
        except ValidationError as error:
            return self.response_400(
                message=_("Request is incorrect: %(error)s", error=error.messages)
            )
        try:
            query_context.raise_for_access()
        except SupersetSecurityException:
            return self.response_401()
        payload = query_context.get_payload()
        for query in payload:
            if query.get("error"):
                return self.response_400(message=f"Error: {query['error']}")
        result_format = query_context.result_format

        response = self.response_400(
            message=f"Unsupported result_format: {result_format}"
        )

        if result_format == ChartDataResultFormat.CSV:
            # return the first result
            result = payload[0]["data"]
            response = CsvResponse(
                result,
                status=200,
                headers=generate_download_headers("csv"),
                mimetype="application/csv",
            )

        if result_format == ChartDataResultFormat.JSON:
            response_data = simplejson.dumps(
                {"result": payload}, default=json_int_dttm_ser, ignore_nan=True
            )
            resp = make_response(response_data, 200)
            resp.headers["Content-Type"] = "application/json; charset=utf-8"
            response = resp

        return response

    @expose("/<pk>/cache_screenshot/", methods=["GET"])
    @protect()
    @rison(screenshot_query_schema)
    @safe
    @statsd_metrics
    def cache_screenshot(self, pk: int, **kwargs: Dict[str, bool]) -> WerkzeugResponse:
        """
        ---
        get:
          description: Compute and cache a screenshot.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/screenshot_query_schema'
          responses:
            200:
              description: Chart async result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/ChartCacheScreenshotResponseSchema"
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
        rison_dict = kwargs["rison"]
        window_size = rison_dict.get("window_size") or (800, 600)

        # Don't shrink the image if thumb_size is not specified
        thumb_size = rison_dict.get("thumb_size") or window_size

        chart = self.datamodel.get(pk, self._base_filters)
        if not chart:
            return self.response_404()

        chart_url = get_url_path("Superset.slice", slice_id=chart.id, standalone="true")
        screenshot_obj = ChartScreenshot(chart_url, chart.digest)
        cache_key = screenshot_obj.cache_key(window_size, thumb_size)
        image_url = get_url_path(
            "ChartRestApi.screenshot", pk=chart.id, digest=cache_key
        )

        def trigger_celery() -> WerkzeugResponse:
            logger.info("Triggering screenshot ASYNC")
            kwargs = {
                "url": chart_url,
                "digest": chart.digest,
                "force": True,
                "window_size": window_size,
                "thumb_size": thumb_size,
            }
            cache_chart_thumbnail.delay(**kwargs)
            return self.response(
                202, cache_key=cache_key, chart_url=chart_url, image_url=image_url
            )

        return trigger_celery()

    @expose("/<pk>/screenshot/<digest>/", methods=["GET"])
    @protect()
    @rison(screenshot_query_schema)
    @safe
    @statsd_metrics
    def screenshot(self, pk: int, digest: str) -> WerkzeugResponse:
        """Get Chart screenshot
        ---
        get:
          description: Get a computed screenshot from cache.
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
              description: Chart thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
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
        chart = self.datamodel.get(pk, self._base_filters)

        # Making sure the chart still exists
        if not chart:
            return self.response_404()

        # fetch the chart screenshot using the current user and cache if set
        img = ChartScreenshot.get_from_cache_key(thumbnail_cache, digest)
        if img:
            return Response(
                FileWrapper(img), mimetype="image/png", direct_passthrough=True
            )
        # TODO: return an empty image
        return self.response_404()

    @expose("/<pk>/thumbnail/<digest>/", methods=["GET"])
    @protect()
    @rison(thumbnail_query_schema)
    @safe
    @statsd_metrics
    def thumbnail(
        self, pk: int, digest: str, **kwargs: Dict[str, bool]
    ) -> WerkzeugResponse:
        """Get Chart thumbnail
        ---
        get:
          description: Compute or get already computed chart thumbnail from cache.
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
              description: Chart thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
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
        chart = self.datamodel.get(pk, self._base_filters)
        if not chart:
            return self.response_404()

        url = get_url_path("Superset.slice", slice_id=chart.id, standalone="true")
        if kwargs["rison"].get("force", False):
            logger.info(
                "Triggering thumbnail compute (chart id: %s) ASYNC", str(chart.id)
            )
            cache_chart_thumbnail.delay(url, chart.digest, force=True)
            return self.response(202, message="OK Async")
        # fetch the chart screenshot using the current user and cache if set
        screenshot = ChartScreenshot(url, chart.digest).get_from_cache(
            cache=thumbnail_cache
        )
        # If not screenshot then send request to compute thumb to celery
        if not screenshot:
            logger.info(
                "Triggering thumbnail compute (chart id: %s) ASYNC", str(chart.id)
            )
            cache_chart_thumbnail.delay(url, chart.digest, force=True)
            return self.response(202, message="OK Async")
        # If digests
        if chart.digest != digest:
            return redirect(
                url_for(
                    f"{self.__class__.__name__}.thumbnail", pk=pk, digest=chart.digest
                )
            )
        return Response(
            FileWrapper(screenshot), mimetype="image/png", direct_passthrough=True
        )

    @expose("/export/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_export_ids_schema)
    def export(self, **kwargs: Any) -> Response:
        """Export charts
        ---
        get:
          description: >-
            Exports multiple charts and downloads them as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
          responses:
            200:
              description: A zip file with chart(s), dataset(s) and database(s) as YAML
              content:
                application/zip:
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
        requested_ids = kwargs["rison"]
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"chart_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            try:
                for file_name, file_content in ExportChartsCommand(requested_ids).run():
                    with bundle.open(f"{root}/{file_name}", "w") as fp:
                        fp.write(file_content.encode())
            except ChartNotFoundError:
                return self.response_404()
        buf.seek(0)

        return send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            attachment_filename=filename,
        )

    @expose("/favorite_status/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_fav_star_ids_schema)
    def favorite_status(self, **kwargs: Any) -> Response:
        """Favorite stars for Charts
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
        charts = ChartDAO.find_by_ids(requested_ids)
        if not charts:
            return self.response_404()
        favorited_chart_ids = ChartDAO.favorited_ids(charts, g.user.id)
        res = [
            {"id": request_id, "value": request_id in favorited_chart_ids}
            for request_id in requested_ids
        ]
        return self.response(200, result=res)
