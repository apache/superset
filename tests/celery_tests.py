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
# isort:skip_file
"""Unit tests for Superset Celery worker"""
import datetime
import json
import string
import random
from typing import Optional

import pytest
import time
import unittest.mock as mock

import flask
from flask import current_app

from tests.base_tests import login
from tests.conftest import CTAS_SCHEMA_NAME
from tests.test_app import app
from superset import db, sql_lab
from superset.result_set import SupersetResultSet
from superset.db_engine_specs.base import BaseEngineSpec
from superset.extensions import celery_app
from superset.models.helpers import QueryStatus
from superset.models.sql_lab import Query
from superset.sql_parse import ParsedQuery, CtasMethod
from superset.utils.core import get_example_database, backend

CELERY_SLEEP_TIME = 6
QUERY = "SELECT name FROM birth_names LIMIT 1"
TEST_SYNC = "test_sync"
TEST_ASYNC_LOWER_LIMIT = "test_async_lower_limit"
TEST_SYNC_CTA = "test_sync_cta"
TEST_ASYNC_CTA = "test_async_cta"
TEST_ASYNC_CTA_CONFIG = "test_async_cta_config"
TMP_TABLES = [
    TEST_SYNC,
    TEST_SYNC_CTA,
    TEST_ASYNC_CTA,
    TEST_ASYNC_CTA_CONFIG,
    TEST_ASYNC_LOWER_LIMIT,
]


test_client = app.test_client()


def get_query_by_id(id: int):
    db.session.commit()
    query = db.session.query(Query).filter_by(id=id).first()
    return query


@pytest.fixture(autouse=True, scope="module")
def setup_sqllab():
    with app.app_context():
        yield

        db.session.query(Query).delete()
        db.session.commit()
        for tbl in TMP_TABLES:
            drop_table_if_exists(f"{tbl}_{CtasMethod.TABLE.lower()}", CtasMethod.TABLE)
            drop_table_if_exists(f"{tbl}_{CtasMethod.VIEW.lower()}", CtasMethod.VIEW)
            drop_table_if_exists(
                f"{CTAS_SCHEMA_NAME}.{tbl}_{CtasMethod.TABLE.lower()}", CtasMethod.TABLE
            )
            drop_table_if_exists(
                f"{CTAS_SCHEMA_NAME}.{tbl}_{CtasMethod.VIEW.lower()}", CtasMethod.VIEW
            )


def run_sql(
    sql, cta=False, ctas_method=CtasMethod.TABLE, tmp_table="tmp", async_=False
):
    login(test_client, username="admin")
    db_id = get_example_database().id
    resp = test_client.post(
        "/superset/sql_json/",
        json=dict(
            database_id=db_id,
            sql=sql,
            runAsync=async_,
            select_as_cta=cta,
            tmp_table_name=tmp_table,
            client_id="".join(random.choice(string.ascii_lowercase) for i in range(5)),
            ctas_method=ctas_method,
        ),
    )
    test_client.get("/logout/", follow_redirects=True)
    return json.loads(resp.data)


def drop_table_if_exists(table_name: str, table_type: CtasMethod) -> None:
    """Drop table if it exists, works on any DB"""
    sql = f"DROP {table_type} IF EXISTS  {table_name}"
    get_example_database().get_sqla_engine().execute(sql)


def quote_f(value: Optional[str]):
    if not value:
        return value
    return get_example_database().inspector.engine.dialect.identifier_preparer.quote_identifier(
        value
    )


def cta_result(ctas_method: CtasMethod):
    if backend() != "presto":
        return [], []
    if ctas_method == CtasMethod.TABLE:
        return [{"rows": 1}], [{"name": "rows", "type": "BIGINT", "is_date": False}]
    return [{"result": True}], [{"name": "result", "type": "BOOLEAN", "is_date": False}]


# TODO(bkyryliuk): quote table and schema names for all databases
def get_select_star(table: str, schema: Optional[str] = None):
    if backend() in {"presto", "hive"}:
        schema = quote_f(schema)
        table = quote_f(table)
    if schema:
        return f"SELECT *\nFROM {schema}.{table}"
    return f"SELECT *\nFROM {table}"


@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_sync_query_dont_exist(setup_sqllab, ctas_method):
    sql_dont_exist = "SELECT name FROM table_dont_exist"
    result = run_sql(sql_dont_exist, cta=True, ctas_method=ctas_method)
    if backend() == "sqlite" and ctas_method == CtasMethod.VIEW:
        assert QueryStatus.SUCCESS == result["status"], result
    else:
        assert QueryStatus.FAILED == result["status"], result


@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_sync_query_cta(setup_sqllab, ctas_method):
    tmp_table_name = f"{TEST_SYNC}_{ctas_method.lower()}"
    result = run_sql(QUERY, tmp_table=tmp_table_name, cta=True, ctas_method=ctas_method)
    assert QueryStatus.SUCCESS == result["query"]["state"], result
    assert cta_result(ctas_method) == (result["data"], result["columns"])

    # Check the data in the tmp table.
    select_query = get_query_by_id(result["query"]["serverId"])
    results = run_sql(select_query.select_sql)
    assert QueryStatus.SUCCESS == results["status"], results
    assert len(results["data"]) > 0


def test_run_sync_query_cta_no_data(setup_sqllab):
    sql_empty_result = "SELECT * FROM birth_names WHERE name='random'"
    result = run_sql(sql_empty_result)
    assert QueryStatus.SUCCESS == result["query"]["state"]
    assert ([], []) == (result["data"], result["columns"])

    query = get_query_by_id(result["query"]["serverId"])
    assert QueryStatus.SUCCESS == query.status


@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
@mock.patch(
    "superset.views.core.get_cta_schema_name", lambda d, u, s, sql: CTAS_SCHEMA_NAME
)
def test_run_sync_query_cta_config(setup_sqllab, ctas_method):
    if backend() == "sqlite":
        # sqlite doesn't support schemas
        return
    tmp_table_name = f"{TEST_SYNC_CTA}_{ctas_method.lower()}"
    result = run_sql(QUERY, cta=True, ctas_method=ctas_method, tmp_table=tmp_table_name)
    assert QueryStatus.SUCCESS == result["query"]["state"], result
    assert cta_result(ctas_method) == (result["data"], result["columns"])

    query = get_query_by_id(result["query"]["serverId"])
    assert (
        f"CREATE {ctas_method} {CTAS_SCHEMA_NAME}.{tmp_table_name} AS \n{QUERY}"
        == query.executed_sql
    )

    assert query.select_sql == get_select_star(tmp_table_name, schema=CTAS_SCHEMA_NAME)
    time.sleep(CELERY_SLEEP_TIME)
    results = run_sql(query.select_sql)
    assert QueryStatus.SUCCESS == results["status"], result


@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
@mock.patch(
    "superset.views.core.get_cta_schema_name", lambda d, u, s, sql: CTAS_SCHEMA_NAME
)
def test_run_async_query_cta_config(setup_sqllab, ctas_method):
    if backend() == "sqlite":
        # sqlite doesn't support schemas
        return
    tmp_table_name = f"{TEST_ASYNC_CTA_CONFIG}_{ctas_method.lower()}"
    result = run_sql(
        QUERY, cta=True, ctas_method=ctas_method, async_=True, tmp_table=tmp_table_name,
    )

    time.sleep(CELERY_SLEEP_TIME)

    query = get_query_by_id(result["query"]["serverId"])
    assert QueryStatus.SUCCESS == query.status
    assert get_select_star(tmp_table_name, schema=CTAS_SCHEMA_NAME) == query.select_sql
    assert (
        f"CREATE {ctas_method} {CTAS_SCHEMA_NAME}.{tmp_table_name} AS \n{QUERY}"
        == query.executed_sql
    )


@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_async_cta_query(setup_sqllab, ctas_method):
    table_name = f"{TEST_ASYNC_CTA}_{ctas_method.lower()}"
    result = run_sql(
        QUERY, cta=True, ctas_method=ctas_method, async_=True, tmp_table=table_name
    )

    time.sleep(CELERY_SLEEP_TIME)

    query = get_query_by_id(result["query"]["serverId"])
    assert QueryStatus.SUCCESS == query.status
    assert get_select_star(table_name) in query.select_sql

    assert f"CREATE {ctas_method} {table_name} AS \n{QUERY}" == query.executed_sql
    assert QUERY == query.sql
    assert query.rows == (1 if backend() == "presto" else 0)
    assert query.select_as_cta
    assert query.select_as_cta_used


@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_async_cta_query_with_lower_limit(setup_sqllab, ctas_method):
    tmp_table = f"{TEST_ASYNC_LOWER_LIMIT}_{ctas_method.lower()}"
    result = run_sql(
        QUERY, cta=True, ctas_method=ctas_method, async_=True, tmp_table=tmp_table
    )
    time.sleep(CELERY_SLEEP_TIME)

    query = get_query_by_id(result["query"]["serverId"])
    assert QueryStatus.SUCCESS == query.status

    assert get_select_star(tmp_table) == query.select_sql
    assert f"CREATE {ctas_method} {tmp_table} AS \n{QUERY}" == query.executed_sql
    assert QUERY == query.sql
    assert query.rows == (1 if backend() == "presto" else 0)
    assert query.limit is None
    assert query.select_as_cta
    assert query.select_as_cta_used


SERIALIZATION_DATA = [("a", 4, 4.0, datetime.datetime(2019, 8, 18, 16, 39, 16, 660000))]
CURSOR_DESCR = (
    ("a", "string"),
    ("b", "int"),
    ("c", "float"),
    ("d", "datetime"),
)


def test_default_data_serialization():
    db_engine_spec = BaseEngineSpec()
    results = SupersetResultSet(SERIALIZATION_DATA, CURSOR_DESCR, db_engine_spec)

    with mock.patch.object(
        db_engine_spec, "expand_data", wraps=db_engine_spec.expand_data
    ) as expand_data:
        data = sql_lab._serialize_and_expand_data(results, db_engine_spec, False, True)
        expand_data.assert_called_once()
    assert isinstance(data[0], list)


def test_new_data_serialization():
    db_engine_spec = BaseEngineSpec()
    results = SupersetResultSet(SERIALIZATION_DATA, CURSOR_DESCR, db_engine_spec)

    with mock.patch.object(
        db_engine_spec, "expand_data", wraps=db_engine_spec.expand_data
    ) as expand_data:
        data = sql_lab._serialize_and_expand_data(results, db_engine_spec, True)
        expand_data.assert_not_called()
    assert isinstance(data[0], bytes)


def test_default_payload_serialization():
    use_new_deserialization = False
    db_engine_spec = BaseEngineSpec()
    results = SupersetResultSet(SERIALIZATION_DATA, CURSOR_DESCR, db_engine_spec)
    query = {
        "database_id": 1,
        "sql": "SELECT * FROM birth_names LIMIT 100",
        "status": QueryStatus.PENDING,
    }
    (
        serialized_data,
        selected_columns,
        all_columns,
        expanded_columns,
    ) = sql_lab._serialize_and_expand_data(
        results, db_engine_spec, use_new_deserialization
    )
    payload = {
        "query_id": 1,
        "status": QueryStatus.SUCCESS,
        "state": QueryStatus.SUCCESS,
        "data": serialized_data,
        "columns": all_columns,
        "selected_columns": selected_columns,
        "expanded_columns": expanded_columns,
        "query": query,
    }

    serialized = sql_lab._serialize_payload(payload, use_new_deserialization)
    assert isinstance(serialized, str)


def test_msgpack_payload_serialization():
    use_new_deserialization = True
    db_engine_spec = BaseEngineSpec()
    results = SupersetResultSet(SERIALIZATION_DATA, CURSOR_DESCR, db_engine_spec)
    query = {
        "database_id": 1,
        "sql": "SELECT * FROM birth_names LIMIT 100",
        "status": QueryStatus.PENDING,
    }
    (
        serialized_data,
        selected_columns,
        all_columns,
        expanded_columns,
    ) = sql_lab._serialize_and_expand_data(
        results, db_engine_spec, use_new_deserialization
    )
    payload = {
        "query_id": 1,
        "status": QueryStatus.SUCCESS,
        "state": QueryStatus.SUCCESS,
        "data": serialized_data,
        "columns": all_columns,
        "selected_columns": selected_columns,
        "expanded_columns": expanded_columns,
        "query": query,
    }

    serialized = sql_lab._serialize_payload(payload, use_new_deserialization)
    assert isinstance(serialized, bytes)


def test_create_table_as():
    q = ParsedQuery("SELECT * FROM outer_space;")

    assert "CREATE TABLE tmp AS \nSELECT * FROM outer_space" == q.as_create_table("tmp")
    assert (
        "DROP TABLE IF EXISTS tmp;\nCREATE TABLE tmp AS \nSELECT * FROM outer_space"
        == q.as_create_table("tmp", overwrite=True)
    )

    # now without a semicolon
    q = ParsedQuery("SELECT * FROM outer_space")
    assert "CREATE TABLE tmp AS \nSELECT * FROM outer_space" == q.as_create_table("tmp")

    # now a multi-line query
    multi_line_query = "SELECT * FROM planets WHERE\n" "Luke_Father = 'Darth Vader'"
    q = ParsedQuery(multi_line_query)
    assert (
        "CREATE TABLE tmp AS \nSELECT * FROM planets WHERE\nLuke_Father = 'Darth Vader'"
        == q.as_create_table("tmp")
    )


def test_in_app_context():
    @celery_app.task()
    def my_task():
        assert current_app

    # Make sure we can call tasks with an app already setup
    my_task()

    # Make sure the app gets pushed onto the stack properly
    try:
        popped_app = flask._app_ctx_stack.pop()
        my_task()
    finally:
        flask._app_ctx_stack.push(popped_app)
