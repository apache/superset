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
from typing import Any, cast, Dict, Optional
from urllib import parse

import simplejson as json
from flask import request
from flask_appbuilder.api import expose, protect, rison
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import app, is_feature_enabled
from superset.databases.dao import DatabaseDAO
from superset.extensions import event_logger
from superset.jinja_context import get_template_processor
from superset.models.sql_lab import Query
from superset.queries.dao import QueryDAO
from superset.sql_lab import get_sql_results
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.commands.execute import CommandResult, ExecuteSqlCommand
from superset.sqllab.commands.export import SqlResultExportCommand
from superset.sqllab.commands.results import SqlExecutionResultsCommand
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.execution_context_convertor import ExecutionContextConvertor
from superset.sqllab.query_render import SqlQueryRenderImpl
from superset.sqllab.schemas import (
    ExecutePayloadSchema,
    QueryExecutionResponseSchema,
    sql_lab_get_results_schema,
)
from superset.sqllab.sql_json_executer import (
    ASynchronousSqlJsonExecutor,
    SqlJsonExecutor,
    SynchronousSqlJsonExecutor,
)
from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext
from superset.sqllab.validators import CanAccessQueryValidatorImpl
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import CsvResponse, generate_download_headers, json_success
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

config = app.config
logger = logging.getLogger(__name__)


class SqlLabRestApi(BaseSupersetApi):
    datamodel = SQLAInterface(Query)

    resource_name = "sqllab"
    allow_browser_login = True

    class_permission_name = "SQLLab"

    execute_model_schema = ExecutePayloadSchema()

    apispec_parameter_schemas = {
        "sql_lab_get_results_schema": sql_lab_get_results_schema,
    }
    openapi_spec_tag = "SQL Lab"
    openapi_spec_component_schemas = (
        ExecutePayloadSchema,
        QueryExecutionResponseSchema,
    )

    @expose("/export/<string:client_id>/")
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".export_csv",
        log_to_statsd=False,
    )
    def export_csv(self, client_id: str) -> CsvResponse:
        """Exports the SQL query results to a CSV
        ---
        get:
          summary: >-
            Exports the SQL query results to a CSV
          parameters:
          - in: path
            schema:
              type: integer
            name: client_id
            description: The SQL query result identifier
          responses:
            200:
              description: SQL query results
              content:
                text/csv:
                  schema:
                    type: string
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
        result = SqlResultExportCommand(client_id=client_id).run()

        query, data, row_count = result["query"], result["data"], result["count"]

        quoted_csv_name = parse.quote(query.name)
        response = CsvResponse(
            data, headers=generate_download_headers("csv", quoted_csv_name)
        )
        event_info = {
            "event_type": "data_export",
            "client_id": client_id,
            "row_count": row_count,
            "database": query.database.name,
            "schema": query.schema,
            "sql": query.sql,
            "exported_format": "csv",
        }
        event_rep = repr(event_info)
        logger.debug(
            "CSV exported: %s", event_rep, extra={"superset_event": event_info}
        )
        return response

    @expose("/results/")
    @protect()
    @statsd_metrics
    @rison(sql_lab_get_results_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_results",
        log_to_statsd=False,
    )
    def get_results(self, **kwargs: Any) -> FlaskResponse:
        """Gets the result of a SQL query execution
        ---
        get:
          summary: >-
            Gets the result of a SQL query execution
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/sql_lab_get_results_schema'
          responses:
            200:
              description: SQL query execution result
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/QueryExecutionResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            410:
              $ref: '#/components/responses/410'
            500:
              $ref: '#/components/responses/500'
        """
        params = kwargs["rison"]
        key = params.get("key")
        rows = params.get("rows")
        result = SqlExecutionResultsCommand(key=key, rows=rows).run()
        # return the result without special encoding
        return json_success(
            json.dumps(
                result, default=utils.json_iso_dttm_ser, ignore_nan=True, encoding=None
            ),
            200,
        )

    @expose("/execute/", methods=["POST"])
    @protect()
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_results",
        log_to_statsd=False,
    )
    def execute_sql_query(self) -> FlaskResponse:
        """Executes a SQL query
        ---
        post:
          description: >-
            Starts the execution of a SQL query
          requestBody:
            description: SQL query and params
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ExecutePayloadSchema'
          responses:
            200:
              description: Query execution result
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/QueryExecutionResponseSchema'
            202:
              description: Query execution result, query still running
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/QueryExecutionResponseSchema'
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
            self.execute_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            log_params = {
                "user_agent": cast(Optional[str], request.headers.get("USER_AGENT"))
            }
            execution_context = SqlJsonExecutionContext(request.json)
            command = self._create_sql_json_command(execution_context, log_params)
            command_result: CommandResult = command.run()

            response_status = (
                202
                if command_result["status"] == SqlJsonExecutionStatus.QUERY_IS_RUNNING
                else 200
            )
            # return the execution result without special encoding
            return json_success(command_result["payload"], response_status)
        except SqlLabException as ex:
            payload = {"errors": [ex.to_dict()]}

            response_status = (
                403 if isinstance(ex, QueryIsForbiddenToAccessException) else ex.status
            )
            return self.response(response_status, **payload)

    @staticmethod
    def _create_sql_json_command(
        execution_context: SqlJsonExecutionContext, log_params: Optional[Dict[str, Any]]
    ) -> ExecuteSqlCommand:
        query_dao = QueryDAO()
        sql_json_executor = SqlLabRestApi._create_sql_json_executor(
            execution_context, query_dao
        )
        execution_context_convertor = ExecutionContextConvertor()
        execution_context_convertor.set_max_row_in_display(
            int(config.get("DISPLAY_MAX_ROW"))  # type: ignore
        )
        return ExecuteSqlCommand(
            execution_context,
            query_dao,
            DatabaseDAO(),
            CanAccessQueryValidatorImpl(),
            SqlQueryRenderImpl(get_template_processor),
            sql_json_executor,
            execution_context_convertor,
            config["SQLLAB_CTAS_NO_LIMIT"],
            log_params,
        )

    @staticmethod
    def _create_sql_json_executor(
        execution_context: SqlJsonExecutionContext, query_dao: QueryDAO
    ) -> SqlJsonExecutor:
        sql_json_executor: SqlJsonExecutor
        if execution_context.is_run_asynchronous():
            sql_json_executor = ASynchronousSqlJsonExecutor(query_dao, get_sql_results)
        else:
            sql_json_executor = SynchronousSqlJsonExecutor(
                query_dao,
                get_sql_results,
                config.get("SQLLAB_TIMEOUT"),  # type: ignore
                is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"),
            )
        return sql_json_executor
