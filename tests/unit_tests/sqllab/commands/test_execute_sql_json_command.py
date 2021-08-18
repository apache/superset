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
from typing import Dict, Any, TYPE_CHECKING
from unittest.mock import Mock

from pytest import fixture, mark
from superset.sqllab.factories.command_factory import ExecuteSqlJsonCommandFactory
from superset.sqllab.commands.execute_sql_json_command import ExecuteSqlJsonCommand, \
    CanAccessQueryValidator, ExecutionContextConvertor, SqlQueryRender
from superset.sqllab.sql_json_executer import SqlJsonExecutor
from superset.sqllab.execution_context import SqlJsonExecutionContext

if TYPE_CHECKING:
    from superset.models.sql_lab import Query
    from superset.databases.dao import DatabaseDAO
    from superset.queries.dao import QueryDAO


@fixture
def execute_sql_json_command_factory(
    can_access_validator: CanAccessQueryValidator,
    execution_context_convertor: ExecutionContextConvertor,
    sql_query_render: SqlQueryRender,
    query_dao: QueryDAO,
    database_dao: DatabaseDAO,
    sql_json_executor: SqlJsonExecutor,
    app_configurations: Dict[str, Any]
) -> ExecuteSqlJsonCommandFactory:
    mock = Mock(ExecuteSqlJsonCommandFactory)
    mock.create.side_effect = lambda context: ExecuteSqlJsonCommand(
        can_access_validator,
        execution_context_convertor,
        sql_query_render,
        query_dao,
        database_dao,
        sql_json_executor,
        context,
        app_configurations.get("SQLLAB_CTAS_NO_LIMIT"))
    return mock


@fixture
def command_factory(execute_sql_json_command_factory: ExecuteSqlJsonCommandFactory) -> ExecuteSqlJsonCommandFactory:
    return execute_sql_json_command_factory


@fixture
def query_params() -> Dict[str, Any]:
    return {"queryLimit": 1000, "client_id": "aaa"}

@fixture
def mocked_query() -> Mock:
    return Mock()


@fixture
def running_query(mocked_query: Mock) -> Mock:
    mocked_query.is_running.return_value = True
    return mocked_query


@fixture
def not_running_query(mocked_query: Mock) -> Mock:
    mocked_query.is_running.return_value = False
    return mocked_query


@mark.ofek
class TestRunExecuteSqlJsonCommand:
    def test_when_there_is_existing_running_query__context_contains_the_running_query(
        self,
        command_factory: ExecuteSqlJsonCommandFactory,
        query_dao: QueryDAO,
        running_query: Query,
        execution_context_convertor: Mock
    ):
        # arrange
        context: SqlJsonExecutionContext = Mock(SqlJsonExecutionContext)
        query_dao.find_one_or_none.return_value = running_query
        command = command_factory.create(context)

        # call
        command.run()

        # assert
        execution_context_convertor.to_payload.assert_called_once_with(context)
        assert context.query == running_query

    def test_when_there_is_existing_not_running_query__context_contains_other_query(
        self,
        command_factory: ExecuteSqlJsonCommandFactory,
        query_dao: QueryDAO,
        not_running_query: Query,
        execution_context_convertor: Mock
    ):
        # arrange
        context: SqlJsonExecutionContext = Mock(SqlJsonExecutionContext)
        query_dao.find_one_or_none.return_value = not_running_query
        command = command_factory.create(context)

        # call
        command.run()

        # assert
        execution_context_convertor.to_payload.assert_called_once_with(context)
        assert context.query is not None and context.query != running_query
