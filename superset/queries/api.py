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
import simplejson
import logging

from flask import make_response, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.common.query_context import QueryContext
from superset.constants import RouteMethod
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger, security_manager
from superset.models.sql_lab import Query
from superset.queries.filters import QueryFilter
from superset.utils.core import json_int_dttm_ser
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class QueryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Query)

    resource_name = "query"
    allow_browser_login = True
    include_route_methods = {RouteMethod.GET, RouteMethod.GET_LIST, "exec"}

    class_permission_name = "QueryView"
    list_columns = [
        "user.username",
        "database.database_name",
        "status",
        "start_time",
        "end_time",
    ]
    show_columns = [
        "client_id",
        "tmp_table_name",
        "tmp_schema_name",
        "status",
        "tab_name",
        "sql_editor_id",
        "schema",
        "sql",
        "select_sql",
        "executed_sql",
        "limit",
        "select_as_cta",
        "select_as_cta_used",
        "progress",
        "rows",
        "error_message",
        "results_key",
        "start_time",
        "start_running_time",
        "end_time",
        "end_result_backend_time",
        "tracking_url",
        "changed_on",
    ]
    base_filters = [["id", QueryFilter, lambda: []]]
    base_order = ("changed_on", "desc")

    openapi_spec_tag = "Queries"

    @expose("/exec", methods=["POST"])
    @event_logger.log_this
    @protect()
    @safe
    def exec(self) -> Response:
        """
        Takes a query context constructed in the client and returns payload
        data response for the given query.
        ---
        post:
          description: >-
            Takes a query context constructed in the client and returns payload data
            response for the given query.
          requestBody:
            description: Query object schema
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    datasource:
                      type: object
                      description: The datasource where the query will run
                      properties:
                        id:
                          type: integer
                        type:
                          type: string
                    queries:
                      type: array
                      items:
                        type: object
                        properties:
                          granularity:
                            type: string
                          groupby:
                            type: array
                            items:
                              type: string
                          metrics:
                            type: array
                            items:
                              type: object
                          filters:
                            type: array
                            items:
                              type: string
                          row_limit:
                            type: integer
          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      type: object
                      properties:
                        cache_key:
                          type: string
                        cached_dttm:
                          type: string
                        cache_timeout:
                          type: integer
                        error:
                          type: string
                        is_cached:
                          type: boolean
                        query:
                          type: string
                        status:
                          type: string
                        stacktrace:
                          type: string
                        rowcount:
                          type: integer
                        data:
                          type: array
                          items:
                            type: object
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
            query_context = QueryContext(**request.json)
        except KeyError:
            return self.response_400(message="Request is incorrect")
        try:
            security_manager.assert_query_context_permission(query_context)
        except SupersetSecurityException:
            return self.response_401()
        payload_json = query_context.get_payload()
        response_data = simplejson.dumps(
            payload_json, default=json_int_dttm_ser, allow_nan=False
        )
        resp = make_response(response_data, 200)
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        return resp
