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
from typing import Any, Optional

from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, rison, safe
from flask_appbuilder.api.schemas import get_item_schema, get_list_schema
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import is_feature_enabled
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.reports.logs.schemas import openapi_spec_methods_override
from superset.reports.models import ReportExecutionLog
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class ReportExecutionLogRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(ReportExecutionLog)

    @before_request
    def ensure_alert_reports_enabled(self) -> Optional[Response]:
        if not is_feature_enabled("ALERT_REPORTS"):
            return self.response_404()
        return None

    include_route_methods = {RouteMethod.GET, RouteMethod.GET_LIST}
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    class_permission_name = "ReportSchedule"
    resource_name = "report"
    allow_browser_login = True

    show_columns = [
        "id",
        "scheduled_dttm",
        "end_dttm",
        "start_dttm",
        "value",
        "value_row_json",
        "state",
        "error_message",
        "uuid",
    ]
    list_columns = [
        "id",
        "scheduled_dttm",
        "end_dttm",
        "start_dttm",
        "value",
        "value_row_json",
        "state",
        "error_message",
        "uuid",
    ]
    order_columns = [
        "state",
        "value",
        "error_message",
        "end_dttm",
        "start_dttm",
        "scheduled_dttm",
    ]
    openapi_spec_tag = "Report Schedules"
    openapi_spec_methods = openapi_spec_methods_override

    @staticmethod
    def _apply_layered_relation_to_rison(  # pylint: disable=invalid-name
        layer_id: int, rison_parameters: dict[str, Any]
    ) -> None:
        if "filters" not in rison_parameters:
            rison_parameters["filters"] = []
        rison_parameters["filters"].append(
            {"col": "report_schedule", "opr": "rel_o_m", "value": layer_id}
        )

    @expose("/<int:pk>/log/", methods=("GET",))
    @protect()
    @safe
    @permission_name("get")
    @rison(get_list_schema)
    def get_list(  # pylint: disable=arguments-differ
        self, pk: int, **kwargs: Any
    ) -> Response:
        """Get a list of report schedule logs.
        ---
        get:
          summary: Get a list of report schedule logs
          parameters:
          - in: path
            schema:
              type: integer
            description: The report schedule id for these logs
            name: pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: Items from logs
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        description: >-
                          A list of log ids
                        type: array
                        items:
                          type: string
                      count:
                        description: >-
                          The total record count on the backend
                        type: number
                      result:
                        description: >-
                          The result from the get list query
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get_list'  # pylint: disable=line-too-long
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        self._apply_layered_relation_to_rison(pk, kwargs["rison"])
        return self.get_list_headless(**kwargs)

    @expose("/<int:pk>/log/<int:log_id>", methods=("GET",))
    @protect()
    @safe
    @permission_name("get")
    @rison(get_item_schema)
    def get(  # pylint: disable=arguments-differ
        self, pk: int, log_id: int, **kwargs: Any
    ) -> Response:
        """Get a report schedule log.
        ---
        get:
          summary: Get a report schedule log
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The report schedule pk for log
          - in: path
            schema:
              type: integer
            name: log_id
            description: The log pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_item_schema'
          responses:
            200:
              description: Item log
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        description: The log id
                        type: string
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
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
        self._apply_layered_relation_to_rison(pk, kwargs["rison"])
        return self.get_headless(log_id, **kwargs)
