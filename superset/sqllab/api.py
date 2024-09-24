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
from typing import Any, cast, Optional
from urllib import parse

from flask import request, Response
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import app, is_feature_enabled
from superset.commands.sql_lab.estimate import QueryEstimationCommand
from superset.commands.sql_lab.execute import CommandResult, ExecuteSqlCommand
from superset.commands.sql_lab.export import SqlResultExportCommand
from superset.commands.sql_lab.results import SqlExecutionResultsCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.database import DatabaseDAO
from superset.daos.query import QueryDAO
from superset.extensions import event_logger
from superset.jinja_context import get_template_processor
from superset.models.sql_lab import Query
from superset.sql.parse import SQLScript
from superset.sql_lab import get_sql_results
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.execution_context_convertor import ExecutionContextConvertor
from superset.sqllab.query_render import SqlQueryRenderImpl
from superset.sqllab.schemas import (
    EstimateQueryCostSchema,
    ExecutePayloadSchema,
    FormatQueryPayloadSchema,
    QueryExecutionResponseSchema,
    sql_lab_get_results_schema,
    SQLLabBootstrapSchema,
)
from superset.sqllab.sql_json_executer import (
    ASynchronousSqlJsonExecutor,
    SqlJsonExecutor,
    SynchronousSqlJsonExecutor,
)
from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext
from superset.sqllab.utils import bootstrap_sqllab_data
from superset.sqllab.validators import CanAccessQueryValidatorImpl
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils, json
from superset.views.base import CsvResponse, generate_download_headers, json_success
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

config = app.config
logger = logging.getLogger(__name__)


class SqlLabRestApi(BaseSupersetApi):
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    datamodel = SQLAInterface(Query)

    resource_name = "sqllab"
    allow_browser_login = True

    class_permission_name = "SQLLab"

    estimate_model_schema = EstimateQueryCostSchema()
    execute_model_schema = ExecutePayloadSchema()
    format_model_schema = FormatQueryPayloadSchema()

    apispec_parameter_schemas = {
        "sql_lab_get_results_schema": sql_lab_get_results_schema,
    }
    openapi_spec_tag = "SQL Lab"
    openapi_spec_component_schemas = (
        EstimateQueryCostSchema,
        ExecutePayloadSchema,
        QueryExecutionResponseSchema,
        SQLLabBootstrapSchema,
    )

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self) -> Response:
        """Get the bootstrap data for SqlLab
        ---
        get:
          summary: Get the bootstrap data for SqlLab page
          description: >-
            Assembles SQLLab bootstrap data (active_tab, databases, queries,
            tab_state_ids) in a single endpoint. The data can be assembled
            from the current user's id.
          responses:
            200:
              description: Returns the initial bootstrap data for SqlLab
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/SQLLabBootstrapSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        user_id = utils.get_user_id()
        # TODO: Replace with a command class once fully migrated to SPA
        result = bootstrap_sqllab_data(user_id)

        return json_success(
            json.dumps(
                {"result": result},
                default=json.json_iso_dttm_ser,
                ignore_nan=True,
            ),
            200,
        )

    @expose("/estimate/", methods=("POST",))
    @protect()
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".estimate_query_cost",
        log_to_statsd=False,
    )
    def estimate_query_cost(self) -> Response:
        """Estimate the SQL query execution cost.
        ---
        post:
          summary: Estimate the SQL query execution cost
          requestBody:
            description: SQL query and params
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/EstimateQueryCostSchema'
          responses:
            200:
              description: Query estimation result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            model = self.estimate_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        command = QueryEstimationCommand(model)
        result = command.run()
        return self.response(200, result=result)

    @expose("/format_sql/", methods=("POST",))
    @statsd_metrics
    @protect()
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".format",
        log_to_statsd=False,
    )
    def format_sql(self) -> FlaskResponse:
        """Format the SQL query.
        ---
        post:
          summary: Format SQL code
          requestBody:
            description: SQL query
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FormatQueryPayloadSchema'
          responses:
            200:
              description: Format SQL result
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
            403:
              $ref: '#/components/responses/403'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            model = self.format_model_schema.load(request.json)
            result = SQLScript(model["sql"], model.get("engine")).format()
            return self.response(200, result=result)
        except ValidationError as error:
            return self.response_400(message=error.messages)

    @expose("/export/<string:client_id>/")
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".export_csv",
        log_to_statsd=False,
    )
    def export_csv(self, client_id: str) -> CsvResponse:
        """Export the SQL query results to a CSV.
        ---
        get:
          summary: Export the SQL query results to a CSV
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
            "catalog": query.catalog,
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
        """Get the result of a SQL query execution.
        ---
        get:
          summary: Get the result of a SQL query execution
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

        # Using pessimistic json serialization since some database drivers can return
        # unserializeable types at times
        payload = json.dumps(
            result,
            default=json.pessimistic_json_iso_dttm_ser,
            ignore_nan=True,
        )
        return json_success(payload, 200)

    @expose("/execute/", methods=("POST",))
    @protect()
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_results",
        log_to_statsd=False,
    )
    def execute_sql_query(self) -> FlaskResponse:
        """Execute a SQL query.
        ---
        post:
          summary: Execute a SQL query
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
        execution_context: SqlJsonExecutionContext, log_params: Optional[dict[str, Any]]
    ) -> ExecuteSqlCommand:
        query_dao = QueryDAO()
        sql_json_executor = SqlLabRestApi._create_sql_json_executor(
            execution_context, query_dao
        )
        execution_context_convertor = ExecutionContextConvertor()
        execution_context_convertor.set_max_row_in_display(
            int(config.get("DISPLAY_MAX_ROW"))
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
                config.get("SQLLAB_TIMEOUT"),
                is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"),
            )
        return sql_json_executor
