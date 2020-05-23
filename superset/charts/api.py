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
from typing import Any, Dict

import simplejson
from flask import g, make_response, redirect, request, Response, url_for
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as _, ngettext
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
from superset.charts.commands.update import UpdateChartCommand
from superset.charts.dao import ChartDAO
from superset.charts.filters import ChartFilter, ChartNameOrDescriptionFilter
from superset.charts.schemas import (
    CHART_DATA_SCHEMAS,
    ChartDataQueryContextSchema,
    ChartPostSchema,
    ChartPutSchema,
    get_delete_ids_schema,
    openapi_spec_methods_override,
    thumbnail_query_schema,
)
from superset.constants import RouteMethod
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger, security_manager
from superset.models.slice import Slice
from superset.tasks.thumbnails import cache_chart_thumbnail
from superset.utils.core import json_int_dttm_ser
from superset.utils.screenshots import ChartScreenshot
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
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
        "viz_types",
        "datasources",
    }
    class_permission_name = "SliceModelView"
    show_columns = [
        "slice_name",
        "description",
        "owners.id",
        "owners.username",
        "owners.first_name",
        "owners.last_name",
        "dashboards.id",
        "dashboards.dashboard_title",
        "viz_type",
        "params",
        "cache_timeout",
    ]
    list_columns = [
        "id",
        "slice_name",
        "url",
        "description",
        "changed_by_fk",
        "created_by_fk",
        "changed_by_name",
        "changed_by_url",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_on",
        "datasource_id",
        "datasource_type",
        "datasource_name_text",
        "datasource_url",
        "table.default_endpoint",
        "table.table_name",
        "viz_type",
        "params",
        "cache_timeout",
    ]
    order_columns = [
        "slice_name",
        "viz_type",
        "datasource_name",
        "changed_by_fk",
        "changed_on",
    ]
    search_columns = (
        "slice_name",
        "description",
        "viz_type",
        "datasource_name",
        "datasource_id",
        "datasource_type",
        "owners",
    )
    base_order = ("changed_on", "desc")
    base_filters = [["id", ChartFilter, lambda: []]]
    search_filters = {"slice_name": [ChartNameOrDescriptionFilter]}

    # Will just affect _info endpoint
    edit_columns = ["slice_name"]
    add_columns = edit_columns

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    openapi_spec_tag = "Charts"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = CHART_DATA_SCHEMAS
    """ Add extra schemas to the OpenAPI components schema section """
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }

    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners)
    }

    allowed_rel_fields = {"owners"}

    def __init__(self) -> None:
        if is_feature_enabled("THUMBNAILS"):
            self.include_route_methods = self.include_route_methods | {"thumbnail"}
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
        item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_400(message=item.errors)
        try:
            new_model = CreateChartCommand(g.user, item.data).run()
            return self.response(201, id=new_model.id, result=item.data)
        except ChartInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except ChartCreateFailedError as ex:
            logger.error(f"Error creating model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    def put(  # pylint: disable=too-many-return-statements, arguments-differ
        self, pk: int
    ) -> Response:
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
        item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
            return self.response_400(message=item.errors)
        try:
            changed_model = UpdateChartCommand(g.user, pk, item.data).run()
            return self.response(200, id=changed_model.id, result=item.data)
        except ChartNotFoundError:
            return self.response_404()
        except ChartForbiddenError:
            return self.response_403()
        except ChartInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except ChartUpdateFailedError as ex:
            logger.error(f"Error updating model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:  # pylint: disable=arguments-differ
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
            logger.error(f"Error deleting model {self.__class__.__name__}: {ex}")
            return self.response_422(message=str(ex))

    @expose("/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    def bulk_delete(
        self, **kwargs: Any
    ) -> Response:  # pylint: disable=arguments-differ
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
                  type: array
                  items:
                    type: integer
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
                    f"Deleted %(num)d chart",
                    f"Deleted %(num)d charts",
                    num=len(item_ids),
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
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            query_context, errors = ChartDataQueryContextSchema().load(request.json)
            if errors:
                return self.response_400(
                    message=_("Request is incorrect: %(error)s", error=errors)
                )
        except KeyError:
            return self.response_400(message="Request is incorrect")
        try:
            security_manager.assert_query_context_permission(query_context)
        except SupersetSecurityException:
            return self.response_401()
        payload_json = query_context.get_payload()
        response_data = simplejson.dumps(
            {"result": payload_json}, default=json_int_dttm_ser, ignore_nan=True
        )
        resp = make_response(response_data, 200)
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        return resp

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
            name: sha
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
        if kwargs["rison"].get("force", False):
            cache_chart_thumbnail.delay(chart.id, force=True)
            return self.response(202, message="OK Async")
        # fetch the chart screenshot using the current user and cache if set
        screenshot = ChartScreenshot(pk).get_from_cache(cache=thumbnail_cache)
        # If not screenshot then send request to compute thumb to celery
        if not screenshot:
            cache_chart_thumbnail.delay(chart.id, force=True)
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

    @expose("/datasources", methods=["GET"])
    @protect()
    @safe
    def datasources(self) -> Response:
        """Get available datasources
        ---
        get:
          description: Get available datasources.
          responses:
            200:
              description: charts unique datasource data
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                      result:
                        type: object
                        properties:
                          label:
                            type: string
                          value:
                            type: object
                            properties:
                              database_id:
                                type: integer
                              database_type:
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
        datasources = ChartDAO.fetch_all_datasources()
        if not datasources:
            return self.response(200, count=0, result=[])

        result = [
            {
                "label": str(ds),
                "value": {"datasource_id": ds.id, "datasource_type": ds.type},
            }
            for ds in datasources
        ]
        return self.response(200, count=len(result), result=result)
