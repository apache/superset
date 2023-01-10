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
from typing import Any, cast, Dict, Optional

from flask import request, Response
from flask_appbuilder.api import BaseApi, expose, protect, safe

from superset import conf, event_logger, is_feature_enabled
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.databases.dao import DatabaseDAO
from superset.jinja_context import get_template_processor
from superset.queries.dao import QueryDAO
from superset.sql_lab import get_sql_results
from superset.sqllab.command import CommandResult, ExecuteSqlCommand
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.execution_context_convertor import ExecutionContextConvertor
from superset.sqllab.query_render import SqlQueryRenderImpl
from superset.sqllab.sql_json_executer import (
    ASynchronousSqlJsonExecutor,
    SqlJsonExecutor,
    SynchronousSqlJsonExecutor,
)
from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext
from superset.sqllab.tabs import _get_sqllab_tabs
from superset.sqllab.validators import CanAccessQueryValidatorImpl
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.utils.core import get_user_id
from superset.views.base import json_error_response, json_success
from superset.views.sql_lab.schemas import SqlJsonPayloadSchema

logger = logging.getLogger(__name__)


class SqlLabRestApi(BaseApi):
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "SqlLab"
    resource_name = "sqllab"
    openapi_spec_tag = "SqlLab"

    @expose("/", methods=["GET"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=True,
    )
    def get(self) -> Response:
        """Assembles SqlLab related information (defaultDbId, tab_state_ids, active_tab)
        in a single endpoint.
        """
        payload = {
            "defaultDbId": conf["SQLLAB_DEFAULT_DBID"],
            **_get_sqllab_tabs(get_user_id()),
        }

        bootstrap_data = json.dumps(
            payload, default=utils.pessimistic_json_iso_dttm_ser
        )
        return json_success(bootstrap_data, 200)

    @expose("/execute/sql/", methods=["POST"])
    @protect()
    @safe
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.execute",
        log_to_statsd=False,
    )
    def execute_sql(self) -> Response:
        """
        Execute the SQL query and return dataframe.
        """
        errors = SqlJsonPayloadSchema().validate(request.json)
        if errors:
            return json_error_response(status=400, payload=errors)

        try:
            log_params = {
                "user_agent": cast(Optional[str], request.headers.get("USER_AGENT"))
            }
            execution_context = SqlJsonExecutionContext(request.json)
            command = _create_sql_json_command(execution_context, log_params)
            command_result: CommandResult = command.run()
            return _create_response_from_execution_context(command_result)
        except SqlLabException as ex:
            logger.error(ex.message)
            _set_http_status_into_sql_lab_exception(ex)
            payload = {"errors": [ex.to_dict()]}
            return json_error_response(status=ex.status, payload=payload)


def _create_sql_json_command(
    execution_context: SqlJsonExecutionContext, log_params: Optional[Dict[str, Any]]
) -> ExecuteSqlCommand:
    query_dao = QueryDAO()
    sql_json_executor = _create_sql_json_executor(execution_context, query_dao)
    execution_context_convertor = ExecutionContextConvertor()
    execution_context_convertor.set_max_row_in_display(int(conf.get("DISPLAY_MAX_ROW")))
    return ExecuteSqlCommand(
        execution_context,
        query_dao,
        DatabaseDAO(),
        CanAccessQueryValidatorImpl(),
        SqlQueryRenderImpl(get_template_processor),
        sql_json_executor,
        execution_context_convertor,
        conf.get("SQLLAB_CTAS_NO_LIMIT"),
        log_params,
    )


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
            conf.get("SQLLAB_TIMEOUT"),
            is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"),
        )
    return sql_json_executor


def _set_http_status_into_sql_lab_exception(ex: SqlLabException) -> None:
    if isinstance(ex, QueryIsForbiddenToAccessException):
        ex.status = 403


def _create_response_from_execution_context(
    command_result: CommandResult,
) -> FlaskResponse:

    status_code = 200
    if command_result["status"] == SqlJsonExecutionStatus.QUERY_IS_RUNNING:
        status_code = 202
    return json_success(command_result["payload"], status_code)
