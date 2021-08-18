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
from typing import TYPE_CHECKING
from pytest import mark, fixture

from superset.sqllab.factories.sql_json_executor_factory import \
    SqlJsonExecutorFactory, SynchronousSqlJsonExecutor, ASynchronousSqlJsonExecutor

if TYPE_CHECKING:
    from superset.sqllab.factories.dao_factories import DaoFactory
    from superset.sqllab.sql_json_executer import SqlJsonExecutor, GetSqlResultsTask


@fixture
def sql_json_executor_factory(query_dao_factory: DaoFactory,
                              get_sql_results_task: GetSqlResultsTask) -> SqlJsonExecutorFactory:
    return SqlJsonExecutorFactory(query_dao_factory, get_sql_results_task)



@mark.ofek
class TestSqlJsonExecutorFactory:
    def test_create_with_async_true(self, sql_json_executor_factory:
    SqlJsonExecutorFactory):
        sql_json_executor: SqlJsonExecutor = sql_json_executor_factory.create(
            is_async=True)
        assert isinstance(sql_json_executor, ASynchronousSqlJsonExecutor)

    def test_create_with_async_false(self, sql_json_executor_factory:
    SqlJsonExecutorFactory):
        sql_json_executor: SqlJsonExecutor = sql_json_executor_factory.create(
            is_async=False)
        assert isinstance(sql_json_executor, SynchronousSqlJsonExecutor)
