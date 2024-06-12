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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, too-many-locals

import pytest

from superset.sqllab.sqllab_execution_context import (
    CreateTableAsSelect,
    SqlJsonExecutionContext,
)
from tests.unit_tests.conftest import with_feature_flags


@pytest.fixture
def query_params():
    return {
        "database_id": 1,
        "catalog": "default",
        "schema": "public",
        "sql": "SELECT * FROM table",
        "templateParams": "{}",
        "runAsync": False,
        "queryLimit": 1000,
        "status": "success",
        "select_as_cta": False,
        "client_id": "client123",
        "sql_editor_id": "editor123",
        "tab": "tab123",
        "expand_data": False,
    }


def test_sql_json_execution_context_init(query_params):
    context = SqlJsonExecutionContext(query_params)
    assert context.database_id == 1
    assert context.catalog == "default"
    assert context.schema == "public"
    assert context.sql == "SELECT * FROM table"
    assert context.template_params == {}
    assert context.async_flag is False
    assert context.limit == 1000
    assert context.status == "success"
    assert context.client_id == "client123"
    assert context.sql_editor_id == "editor123"
    assert context.tab_name == "tab123"
    assert context.expand_data is False


@with_feature_flags(SQLLAB_FORCE_RUN_ASYNC=True)
@pytest.mark.parametrize("runAsync, expected_async_flag", [(True, True), (False, True)])
def test_sql_json_execution_context_feature_flag_false(
    mocker, query_params, runAsync, expected_async_flag
):
    query_params["runAsync"] = runAsync
    context = SqlJsonExecutionContext(query_params)
    assert context.async_flag == expected_async_flag
    assert context.is_run_asynchronous() == expected_async_flag


@with_feature_flags(SQLLAB_FORCE_RUN_ASYNC=False)
@pytest.mark.parametrize(
    "runAsync, expected_async_flag", [(True, True), (False, False)]
)
def test_sql_json_execution_context_feature_flag_true(
    mocker, query_params, runAsync, expected_async_flag
):
    query_params["runAsync"] = runAsync
    context = SqlJsonExecutionContext(query_params)
    assert context.async_flag == expected_async_flag
    assert context.is_run_asynchronous() == expected_async_flag


def test_create_table_as_select():
    query_params = {
        "ctas_method": "TABLE",
        "schema": "public",
        "tmp_table_name": "temp_table",
    }
    ctas = CreateTableAsSelect.create_from(query_params)
    assert ctas.ctas_method == "TABLE"
    assert ctas.target_schema_name == "public"
    assert ctas.target_table_name == "temp_table"
