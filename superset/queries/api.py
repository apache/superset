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

import backoff
from flask_appbuilder.api import expose, protect, request, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import db, event_logger
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.databases.filters import DatabaseFilter
from superset.exceptions import SupersetException
from superset.models.sql_lab import Query
from superset.queries.dao import QueryDAO
from superset.queries.filters import QueryFilter
from superset.queries.schemas import (
    openapi_spec_methods_override,
    queries_get_updated_since_schema,
    QuerySchema,
    StopQuerySchema,
)
from superset.superset_typing import FlaskResponse
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_json,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)


class QueryRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Query)

    resource_name = "query"

    class_permission_name = "Query"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    allow_browser_login = True
    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
        RouteMethod.RELATED,
        RouteMethod.DISTINCT,
        "stop_query",
        "get_updated_since",
    }

    apispec_parameter_schemas = {
        "queries_get_updated_since_schema": queries_get_updated_since_schema,
    }

    list_columns = [
        "id",
        "changed_on",
        "database.database_name",
        "executed_sql",
        "rows",
        "schema",
        "sql",
        "sql_tables",
        "status",
        "tab_name",
        "user.first_name",
        "user.id",
        "user.last_name",
        "start_time",
        "end_time",
        "tmp_table_name",
        "tracking_url",
    ]
    show_columns = [
        "id",
        "changed_on",
        "client_id",
        "database.id",
        "end_result_backend_time",
        "end_time",
        "error_message",
        "executed_sql",
        "limit",
        "progress",
        "results_key",
        "rows",
        "schema",
        "select_as_cta",
        "select_as_cta_used",
        "select_sql",
        "sql",
        "sql_editor_id",
        "start_running_time",
        "start_time",
        "status",
        "tab_name",
        "tmp_schema_name",
        "tmp_table_name",
        "tracking_url",
    ]
    base_filters = [["id", QueryFilter, lambda: []]]
    base_order = ("changed_on", "desc")
    list_model_schema = QuerySchema()
    stop_query_schema = StopQuerySchema()

    openapi_spec_tag = "Queries"
    openapi_spec_methods = openapi_spec_methods_override
    openapi_spec_component_schemas = (StopQuerySchema,)

    order_columns = [
        "changed_on",
        "database.database_name",
        "rows",
        "schema",
        "start_time",
        "sql",
        "tab_name",
        "user.first_name",
    ]
    base_related_field_filters = {
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "user": [["id", BaseFilterRelatedUsers, lambda: []]],
        "database": [["id", DatabaseFilter, lambda: []]],
    }
    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "user": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }

    search_columns = ["changed_on", "database", "sql", "status", "user", "start_time"]

    allowed_rel_fields = {"database", "user"}
    allowed_distinct_fields = {"status"}

    @expose("/updated_since")
    @protect()
    @safe
    @rison(queries_get_updated_since_schema)
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_updated_since",
        log_to_statsd=False,
    )
    def get_updated_since(self, **kwargs: Any) -> FlaskResponse:
        """Get a list of queries that changed after last_updated_ms
        ---
        get:
          summary: Get a list of queries that changed after last_updated_ms
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/queries_get_updated_since_schema'
          responses:
            200:
              description: Queries list
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        description: >-
                          A List of queries that changed after last_updated_ms
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
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
            last_updated_ms = kwargs["rison"].get("last_updated_ms", 0)
            queries = QueryDAO.get_queries_changed_after(last_updated_ms)
            payload = [q.to_dict() for q in queries]
            return self.response(200, result=payload)
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/stop", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".stop_query",
        log_to_statsd=False,
    )
    @backoff.on_exception(
        backoff.constant,
        Exception,
        interval=1,
        on_backoff=lambda details: db.session.rollback(),
        on_giveup=lambda details: db.session.rollback(),
        max_tries=5,
    )
    @requires_json
    def stop_query(self) -> FlaskResponse:
        """Manually stop a query with client_id
        ---
        post:
          summary: Manually stop a query with client_id
          requestBody:
            description: Stop query schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/StopQuerySchema'
          responses:
            200:
              description: Query stopped
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        result:
                            type: string
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
            body = self.stop_query_schema.load(request.json)
            QueryDAO.stop_query(body["client_id"])
            return self.response(200, result="OK")
        except SupersetException as ex:
            return self.response(ex.status, message=ex.message)
