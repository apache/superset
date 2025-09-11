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
import random
import string
import time
import unittest.mock as mock
from typing import Optional
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_data,  # noqa: F401
)

import pytest

import flask  # noqa: F401
from flask import current_app, has_app_context  # noqa: F401

from superset import db, sql_lab
from superset.common.db_query_status import QueryStatus
from superset.result_set import SupersetResultSet
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import ErrorLevel, SupersetErrorType
from superset.extensions import celery_app
from superset.models.sql_lab import Query
from superset.sql_parse import ParsedQuery, CtasMethod
from superset.utils.core import backend
from superset.utils.database import get_example_database
from tests.integration_tests.conftest import CTAS_SCHEMA_NAME
from tests.integration_tests.test_app import app

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


def get_query_by_id(id: int):
    db.session.commit()
    query = db.session.query(Query).filter_by(id=id).first()
    return query


@pytest.fixture(autouse=True, scope="module")
def setup_sqllab():
    yield
    # clean up after all tests are done
    # use a new app context
    with app.app_context():
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
    test_client,
    sql,
    cta=False,
    ctas_method=CtasMethod.TABLE,
    tmp_table="tmp",
    async_=False,
):
    db_id = get_example_database().id
    return test_client.post(
        "/api/v1/sqllab/execute/",
        json=dict(
            database_id=db_id,
            sql=sql,
            runAsync=async_,
            select_as_cta=cta,
            tmp_table_name=tmp_table,
            client_id="".join(random.choice(string.ascii_lowercase) for i in range(5)),
            ctas_method=ctas_method,
        ),
    ).json


def drop_table_if_exists(table_name: str, table_type: CtasMethod) -> None:
    """Drop table if it exists, works on any DB"""
    sql = f"DROP {table_type} IF EXISTS {table_name}"
    database = get_example_database()
    with database.get_sqla_engine() as engine:
        engine.execute(sql)


def quote_f(value: Optional[str]):
    if not value:
        return value
    with get_example_database().get_inspector() as inspector:
        return inspector.engine.dialect.identifier_preparer.quote_identifier(value)


def cta_result(ctas_method: CtasMethod):
    if backend() != "presto":
        return [], []
    if ctas_method == CtasMethod.TABLE:
        return [{"rows": 1}], [{"name": "rows", "type": "BIGINT", "is_dttm": False}]
    return [{"result": True}], [{"name": "result", "type": "BOOLEAN", "is_dttm": False}]


# TODO(bkyryliuk): quote table and schema names for all databases
def get_select_star(table: str, limit: int, schema: Optional[str] = None):
    if backend() in {"presto", "hive"}:
        schema = quote_f(schema)
        table = quote_f(table)
    if schema:
        return f"SELECT\n  *\nFROM {schema}.{table}\nLIMIT {limit}"
    return f"SELECT\n  *\nFROM {table}\nLIMIT {limit}"


@pytest.mark.usefixtures("login_as_admin")
@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_sync_query_dont_exist(test_client, ctas_method):
    examples_db = get_example_database()
    engine_name = examples_db.db_engine_spec.engine_name
    sql_dont_exist = "SELECT name FROM table_dont_exist"
    result = run_sql(test_client, sql_dont_exist, cta=True, ctas_method=ctas_method)
    if backend() == "sqlite" and ctas_method == CtasMethod.VIEW:
        assert QueryStatus.SUCCESS == result["status"], result
    elif backend() == "presto":
        assert (
            result["errors"][0]["error_type"]
            == SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR
        )
        assert result["errors"][0]["level"] == ErrorLevel.ERROR
        assert result["errors"][0]["extra"] == {
            "engine_name": "Presto",
            "issue_codes": [
                {
                    "code": 1003,
                    "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                },
                {
                    "code": 1005,
                    "message": "Issue 1005 - The table was deleted or renamed in the database.",
                },
            ],
        }
    else:
        assert (
            result["errors"][0]["error_type"]
            == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
        )
        assert result["errors"][0]["level"] == ErrorLevel.ERROR
        assert result["errors"][0]["extra"] == {
            "issue_codes": [
                {
                    "code": 1002,
                    "message": "Issue 1002 - The database returned an unexpected error.",
                }
            ],
            "engine_name": engine_name,
        }


@pytest.mark.usefixtures("load_birth_names_data", "login_as_admin")
@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_sync_query_cta(test_client, ctas_method):
    tmp_table_name = f"{TEST_SYNC}_{ctas_method.lower()}"
    result = run_sql(
        test_client, QUERY, tmp_table=tmp_table_name, cta=True, ctas_method=ctas_method
    )
    assert QueryStatus.SUCCESS == result["query"]["state"], result
    assert cta_result(ctas_method) == (result["data"], result["columns"])

    # Check the data in the tmp table.
    select_query = get_query_by_id(result["query"]["serverId"])
    results = run_sql(test_client, select_query.select_sql)
    assert QueryStatus.SUCCESS == results["status"], results
    assert len(results["data"]) > 0

    delete_tmp_view_or_table(tmp_table_name, ctas_method)


@pytest.mark.usefixtures("load_birth_names_data", "login_as_admin")
def test_run_sync_query_cta_no_data(test_client):
    sql_empty_result = "SELECT * FROM birth_names WHERE name='random'"
    result = run_sql(test_client, sql_empty_result)
    assert QueryStatus.SUCCESS == result["query"]["state"]
    assert ([], []) == (result["data"], result["columns"])

    query = get_query_by_id(result["query"]["serverId"])
    assert QueryStatus.SUCCESS == query.status


@pytest.mark.usefixtures("load_birth_names_data", "login_as_admin")
@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
@mock.patch(
    "superset.sqllab.sqllab_execution_context.get_cta_schema_name",
    lambda d, u, s, sql: CTAS_SCHEMA_NAME,
)
def test_run_sync_query_cta_config(test_client, ctas_method):
    if backend() == "sqlite":
        # sqlite doesn't support schemas
        return
    tmp_table_name = f"{TEST_SYNC_CTA}_{ctas_method.lower()}"
    result = run_sql(
        test_client, QUERY, cta=True, ctas_method=ctas_method, tmp_table=tmp_table_name
    )
    assert QueryStatus.SUCCESS == result["query"]["state"], result
    assert cta_result(ctas_method) == (result["data"], result["columns"])

    query = get_query_by_id(result["query"]["serverId"])
    assert (
        f"CREATE {ctas_method} {CTAS_SCHEMA_NAME}.{tmp_table_name} AS \n{QUERY}"
        == query.executed_sql
    )
    assert query.select_sql == get_select_star(
        tmp_table_name, limit=query.limit, schema=CTAS_SCHEMA_NAME
    )
    results = run_sql(test_client, query.select_sql)
    assert QueryStatus.SUCCESS == results["status"], result

    delete_tmp_view_or_table(f"{CTAS_SCHEMA_NAME}.{tmp_table_name}", ctas_method)


@pytest.mark.usefixtures("load_birth_names_data", "login_as_admin")
@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
@mock.patch(
    "superset.sqllab.sqllab_execution_context.get_cta_schema_name",
    lambda d, u, s, sql: CTAS_SCHEMA_NAME,
)
def test_run_async_query_cta_config(test_client, ctas_method):
    if backend() == "sqlite":
        # sqlite doesn't support schemas
        return
    tmp_table_name = f"{TEST_ASYNC_CTA_CONFIG}_{ctas_method.lower()}"
    result = run_sql(
        test_client,
        QUERY,
        cta=True,
        ctas_method=ctas_method,
        async_=True,
        tmp_table=tmp_table_name,
    )

    query = wait_for_success(result)

    assert QueryStatus.SUCCESS == query.status
    assert (
        get_select_star(tmp_table_name, limit=query.limit, schema=CTAS_SCHEMA_NAME)
        == query.select_sql
    )
    assert (
        f"CREATE {ctas_method} {CTAS_SCHEMA_NAME}.{tmp_table_name} AS \n{QUERY}"
        == query.executed_sql
    )

    delete_tmp_view_or_table(f"{CTAS_SCHEMA_NAME}.{tmp_table_name}", ctas_method)


@pytest.mark.usefixtures("load_birth_names_data", "login_as_admin")
@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_async_cta_query(test_client, ctas_method):
    table_name = f"{TEST_ASYNC_CTA}_{ctas_method.lower()}"
    result = run_sql(
        test_client,
        QUERY,
        cta=True,
        ctas_method=ctas_method,
        async_=True,
        tmp_table=table_name,
    )

    query = wait_for_success(result)

    assert QueryStatus.SUCCESS == query.status
    assert get_select_star(table_name, query.limit) in query.select_sql

    assert f"CREATE {ctas_method} {table_name} AS \n{QUERY}" == query.executed_sql
    assert QUERY == query.sql
    assert query.rows == (1 if backend() == "presto" else 0)
    assert query.select_as_cta
    assert query.select_as_cta_used

    delete_tmp_view_or_table(table_name, ctas_method)


@pytest.mark.usefixtures("load_birth_names_data", "login_as_admin")
@pytest.mark.parametrize("ctas_method", [CtasMethod.TABLE, CtasMethod.VIEW])
def test_run_async_cta_query_with_lower_limit(test_client, ctas_method):
    tmp_table = f"{TEST_ASYNC_LOWER_LIMIT}_{ctas_method.lower()}"
    result = run_sql(
        test_client,
        QUERY,
        cta=True,
        ctas_method=ctas_method,
        async_=True,
        tmp_table=tmp_table,
    )
    query = wait_for_success(result)
    assert QueryStatus.SUCCESS == query.status

    sqlite_select_sql = f"SELECT\n  *\nFROM {tmp_table}\nLIMIT {query.limit}\nOFFSET 0"
    assert query.select_sql == (
        sqlite_select_sql
        if backend() == "sqlite"
        else get_select_star(tmp_table, query.limit)
    )

    assert f"CREATE {ctas_method} {tmp_table} AS \n{QUERY}" == query.executed_sql
    assert QUERY == query.sql

    assert query.rows == (1 if backend() == "presto" else 0)
    assert query.limit == 50000
    assert query.select_as_cta
    assert query.select_as_cta_used

    delete_tmp_view_or_table(tmp_table, ctas_method)


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


@pytest.mark.usefixtures("load_birth_names_data")
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


@pytest.mark.usefixtures("load_birth_names_data")
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
    @celery_app.task(bind=True)
    def my_task(self):
        # Directly check if an app context is present
        return has_app_context()

    # Expect True within an app context
    with app.app_context():
        result = my_task.apply().get()
        assert (
            result is True
        ), "Task should have access to current_app within app context"

    # Expect True outside of an app context
    result = my_task.apply().get()
    assert (
        result is True
    ), "Task should have access to current_app outside of app context"


def delete_tmp_view_or_table(name: str, db_object_type: str):
    db.get_engine().execute(f"DROP {db_object_type} IF EXISTS {name}")


def wait_for_success(result):
    for _ in range(CELERY_SLEEP_TIME * 2):
        time.sleep(0.5)
        query = get_query_by_id(result["query"]["serverId"])
        if QueryStatus.SUCCESS == query.status:
            break
    return query
