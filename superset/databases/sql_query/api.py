import logging
from typing import Any, cast, Optional
from urllib import parse

from flask import request, Response
from flask_appbuilder import permission_name
from flask_appbuilder.api import expose, protect, rison, safe
from marshmallow import ValidationError

from superset.jinja_context import get_template_processor
from superset import app, is_feature_enabled
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.extensions import event_logger
from superset.superset_typing import FlaskResponse
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics
from superset.sql.sql_execution_context import SqlJsonExecutionContext
from superset.sql.sql_json_executer import SqlJsonExecutor, ASynchronousSqlJsonExecutor, SynchronousSqlJsonExecutor 
from superset.sql.execution_context_convertor import ExecutionContextConvertor
from superset.daos.query import QueryDAO
from superset.daos.database import DatabaseDAO

from superset.commands.sql_lab.execute import CommandResult, ExecuteSqlCommand
from superset.sqllab.validators import CanAccessQueryValidatorImpl
from superset.sqllab.query_render import SqlQueryRenderImpl
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sql_lab import get_sql_results

from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.views.base import json_success
from superset.databases.sql_query.schemas import ExecutePayloadSchema
config = app.config

class SqlQueryRestApi(BaseSupersetApi):
    
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    execute_model_schema = ExecutePayloadSchema()
    resource_name = "database"

    @expose("/sql_query/execute/", methods=("POST",))
    @statsd_metrics
    @requires_json
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_results",
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
        sql_json_executor = SqlQueryRestApi._create_sql_json_executor(
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
