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
from superset.sqllab.sql_json_executer import \
    ASynchronousSqlJsonExecutor, SynchronousSqlJsonExecutor

if TYPE_CHECKING:
    from superset.sqllab.factories.dao_factories import DaoFactory
    from superset.sqllab.sql_json_executer import SqlJsonExecutor, GetSqlResultsTask


class SqlJsonExecutorFactory:
    _query_dao_factory: DaoFactory
    _get_sql_results_task: GetSqlResultsTask

    def __init__(self, query_dao_factory: DaoFactory, get_sql_results_task: GetSqlResultsTask):
        self._query_dao_factory = query_dao_factory
        self._get_sql_results_task = get_sql_results_task

    def create(self, is_async: bool) -> SqlJsonExecutor:
        if is_async:
            return ASynchronousSqlJsonExecutor(self._query_dao_factory.create(), self._get_sql_results_task)
        else:
            return SynchronousSqlJsonExecutor(self._query_dao_factory.create(), self._get_sql_results_task)


