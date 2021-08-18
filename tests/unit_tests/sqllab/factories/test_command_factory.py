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
from typing import TYPE_CHECKING, Dict, Any, Optional
from pytest import fixture, mark
from superset.sqllab.commands.execute_sql_json_command import ExecuteSqlJsonCommand
from superset.sqllab.factories.command_factory import ExecuteSqlJsonCommandFactory

if TYPE_CHECKING:
    from superset.sqllab.factories.dao_factories import DaoFactory
    from superset.sqllab.factories.execution_context_convertor_factory import \
        ExecutionContextConvertorFactory
    from superset.sqllab.factories.sql_json_executor_factory import \
        SqlJsonExecutorFactory
    from superset.sqllab.factories.sql_query_render_factory import SqlQueryRenderFactory
    from superset.sqllab.factories.validators_factory import \
        CanAccessQueryValidatorFactory


@fixture
def execute_sql_json_command_factory(
    can_access_validator_factory: CanAccessQueryValidatorFactory,
    execution_context_convertor_factory: ExecutionContextConvertorFactory,
    sql_query_render_factory: SqlQueryRenderFactory,
    query_dao_factory: DaoFactory,
    database_dao_factory: DaoFactory,
    sql_json_executor_factory: SqlJsonExecutorFactory,
    app_configurations: Dict[str, Any]) -> ExecuteSqlJsonCommandFactory:
    return ExecuteSqlJsonCommandFactory(can_access_validator_factory,
                                        execution_context_convertor_factory,
                                        sql_query_render_factory,
                                        query_dao_factory,
                                        database_dao_factory,
                                        sql_json_executor_factory,
                                        app_configurations)


@mark.ofek
class TestExecuteSqlJsonCommandFactory:
    def test_create(self,
                    execute_sql_json_command_factory: ExecuteSqlJsonCommandFactory,
                    query_params: Dict[str, Any],
                    log_params: Optional[Dict[str, Any]]):
        command: ExecuteSqlJsonCommand = execute_sql_json_command_factory.create(
            query_params, log_params)
        assert isinstance(command, ExecuteSqlJsonCommand)
