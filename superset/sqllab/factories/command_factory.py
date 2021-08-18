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
from typing import Any, Dict, Optional, TYPE_CHECKING
from superset.sqllab.commands.execute_sql_json_command import ExecuteSqlJsonCommand
from superset.sqllab.execution_context import SqlJsonExecutionContext

if TYPE_CHECKING:
    from superset.sqllab.factories.sql_json_executor_factory import \
        SqlJsonExecutorFactory
    from superset.sqllab.factories.execution_context_convertor_factory import \
        ExecutionContextConvertorFactory
    from superset.sqllab.factories.sql_query_render_factory import SqlQueryRenderFactory
    from superset.sqllab.factories.validators_factory import \
        CanAccessQueryValidatorFactory
    from superset.sqllab.factories.dao_factories import DaoFactory


class ExecuteSqlJsonCommandFactory:
    _can_access_validator_factory: CanAccessQueryValidatorFactory
    _execution_context_convertor_factory: ExecutionContextConvertorFactory
    _sql_query_render_factory: SqlQueryRenderFactory
    _query_dao_factory: DaoFactory
    _database_dao_factory: DaoFactory
    _sql_json_executor_factory: SqlJsonExecutorFactory
    _app_configurations: Dict[str, Any]

    def __init__(self,
                 can_access_validator_factory: CanAccessQueryValidatorFactory,
                 execution_context_convertor_factory: ExecutionContextConvertorFactory,
                 sql_query_render_factory: SqlQueryRenderFactory,
                 query_dao_factory: DaoFactory,
                 database_dao_factory: DaoFactory,
                 sql_json_executor_factory: SqlJsonExecutorFactory,
                 app_configurations: Dict[str, Any]
    ):
        self._can_access_validator_factory = can_access_validator_factory
        self._execution_context_convertor_factory = execution_context_convertor_factory
        self._sql_query_render_factory = sql_query_render_factory
        self._query_dao_factory = query_dao_factory
        self._database_dao_factory = database_dao_factory
        self._sql_json_executor_factory = sql_json_executor_factory
        self._app_configurations = app_configurations

    def create(self, query_params: Dict[str, Any],
               log_params: Optional[Dict[str, Any]] = None) -> ExecuteSqlJsonCommand:
        context = SqlJsonExecutionContext(query_params)
        sql_json_executor = self._sql_json_executor_factory.create(
            context.is_should_run_asynchronous())
        return ExecuteSqlJsonCommand(self._can_access_validator_factory.create(),
                                     self._execution_context_convertor_factory.create(),
                                     self._sql_query_render_factory.create(),
                                     self._query_dao_factory.create(),
                                     self._database_dao_factory.create(),
                                     sql_json_executor,
                                     context,
                                     self._app_configurations.get(
                                         "SQLLAB_CTAS_NO_LIMIT"),
                                     log_params)
