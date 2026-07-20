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
from unittest.mock import call, MagicMock

from pytest_mock import MockerFixture

from superset.commands.sql_lab.execute import ExecuteSqlCommand


def test_legacy_execute_persists_frozen_source_before_dispatch(
    mocker: MockerFixture,
) -> None:
    command = ExecuteSqlCommand.__new__(ExecuteSqlCommand)
    query = MagicMock(id=41)
    database = MagicMock()
    execution_context = MagicMock()
    execution_context.create_query.return_value = query
    execution_context.query = query
    execution_context.limit = 100
    execution_context.select_as_cta = False

    command._execution_context = execution_context
    mocker.patch.object(command, "_get_the_query_db", return_value=database)
    mocker.patch.object(command, "_save_new_query")
    mocker.patch.object(command, "_validate_access")
    mocker.patch.object(command, "_set_query_limit_if_required")
    command._query_dao = MagicMock()
    command._sql_query_render = MagicMock()
    command._sql_query_render.render.return_value = "SELECT 42 AS value"
    command._sql_json_executor = MagicMock()
    command._sql_json_executor.execute.return_value = MagicMock()
    command._log_params = None
    db = mocker.patch("superset.commands.sql_lab.execute.db")

    lifecycle = MagicMock()
    lifecycle.attach_mock(query.set_explore_source, "freeze")
    lifecycle.attach_mock(db.session.commit, "commit")
    lifecycle.attach_mock(command._sql_json_executor.execute, "dispatch")

    command._run_sql_json_exec_from_scratch()

    query.set_explore_source.assert_called_once_with("SELECT 42 AS value")
    assert lifecycle.mock_calls == [
        call.freeze("SELECT 42 AS value"),
        call.commit(),
        call.dispatch(execution_context, "SELECT 42 AS value", None),
    ]
