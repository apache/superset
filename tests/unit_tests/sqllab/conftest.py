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
from __future__ import annotations
from pytest import fixture
from typing import Type, TYPE_CHECKING, Dict, Any, Optional
from unittest.mock import Mock

from superset.sqllab.execution_context import SqlJsonExecutionContext
from superset.sqllab.factories.command_factory import ExecuteSqlJsonCommandFactory
from superset.sqllab.factories.execution_context_convertor_factory import ExecutionContextConvertorFactory
from superset.sqllab.factories.sql_json_executor_factory import SqlJsonExecutorFactory
from superset.sqllab.factories.dao_factories import DaoFactory
from superset.sqllab.factories.sql_query_render_factory import SqlQueryRenderFactory
from superset.sqllab.factories.validators_factory import CanAccessQueryValidatorFactory
from superset.sqllab.commands.execute_sql_json_command import ExecuteSqlJsonCommand, \
    CanAccessQueryValidator, ExecutionContextConvertor, SqlQueryRender
from superset.sqllab.sql_json_executer import SqlJsonExecutor
if TYPE_CHECKING:
    from superset.databases.dao import DatabaseDAO
    from superset.models.sql_lab import Query
    from superset.sqllab.sql_json_executer import GetSqlResultsTask
    from superset.queries.dao import QueryDAO


@fixture
def query_model_class() -> Type[Query]:
    return Mock()


@fixture(autouse=True)
def set_query_model(query_model_class: Type[Query]):
    SqlJsonExecutionContext.set_query_model(query_model_class)


@fixture
def query_dao() -> QueryDAO:
    return Mock()


@fixture
def query_dao_factory(query_dao: QueryDAO) -> DaoFactory:
    mock = Mock(spec=DaoFactory)
    mock.create.return_value = query_dao
    return mock


@fixture
def get_sql_results_task() -> GetSqlResultsTask:
    return Mock()


@fixture
def database_dao() -> DatabaseDAO:
    return Mock()


@fixture
def database_dao_factory(database_dao: DatabaseDAO) -> DaoFactory:
    mock = Mock(spec=DaoFactory)
    mock.create.return_value = database_dao
    return mock


@fixture
def sql_json_executor() -> SqlJsonExecutor:
    return Mock(SqlJsonExecutor)


@fixture
def sql_json_executor_factory(sql_json_executor: SqlJsonExecutor) -> SqlJsonExecutorFactory:
    mock = Mock(SqlJsonExecutorFactory)
    mock.create.return_value = sql_json_executor
    return mock


@fixture
def can_access_validator() -> CanAccessQueryValidator:
    return Mock(spec=CanAccessQueryValidator)


@fixture
def can_access_validator_factory(can_access_validator: CanAccessQueryValidator) -> \
    CanAccessQueryValidatorFactory:
    mock = Mock(spec=CanAccessQueryValidatorFactory)
    mock.create.return_value = can_access_validator
    return mock


@fixture
def execution_context_convertor() -> ExecutionContextConvertor:
    return Mock(spec=ExecutionContextConvertor)


@fixture
def execution_context_convertor_factory(execution_context_convertor: ExecutionContextConvertor) -> \
    ExecutionContextConvertorFactory:
    mock = Mock(spec=ExecutionContextConvertorFactory)
    mock.create.return_value = execution_context_convertor
    return mock


@fixture
def sql_query_render() -> SqlQueryRender:
    return Mock(spec=SqlQueryRender)


@fixture
def sql_query_render_factory(sql_query_render: SqlQueryRender) -> SqlQueryRenderFactory:
    mock = Mock(spec=SqlQueryRenderFactory)
    mock.create.return_value = sql_query_render
    return mock


@fixture
def execute_sql_json_command() -> ExecuteSqlJsonCommand:
    return Mock(ExecuteSqlJsonCommand)


@fixture
def execute_sql_json_command_factory(execute_sql_json_command: ExecuteSqlJsonCommand) -> \
    ExecuteSqlJsonCommandFactory:
    mock = Mock(SqlJsonExecutorFactory)
    mock.create.return_value = execute_sql_json_command
    return mock


@fixture
def query_params() -> Dict[str, Any]:
    return {"queryLimit": 1000, "client_id": "aaa"}


@fixture
def log_params() -> Optional[Dict[str, Any]]:
    return {}


@fixture
def app_configurations() -> Dict[str, Any]:
    return {
        "SQLLAB_CTAS_NO_LIMIT": True,
        "DISPLAY_MAX_ROW": True
    }
