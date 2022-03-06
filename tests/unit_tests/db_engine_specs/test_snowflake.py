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
import json
from datetime import datetime
from unittest import mock

import pytest
from flask.ctx import AppContext

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.unit_tests.fixtures.common import dttm


@pytest.mark.parametrize(
    "actual,expected",
    [
        ("DATE", "TO_DATE('2019-01-02')"),
        ("DATETIME", "CAST('2019-01-02T03:04:05.678900' AS DATETIME)"),
        ("TIMESTAMP", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
    ],
)
def test_convert_dttm(
    app_context: AppContext, actual: str, expected: str, dttm: datetime
) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    assert SnowflakeEngineSpec.convert_dttm(actual, dttm) == expected


def test_database_connection_test_mutator(app_context: AppContext) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.models.core import Database

    database = Database(sqlalchemy_uri="snowflake://abc")
    SnowflakeEngineSpec.mutate_db_for_connection_test(database)
    engine_params = json.loads(database.extra or "{}")

    assert {
        "engine_params": {"connect_args": {"validate_default_parameters": True}}
    } == engine_params


def test_extract_errors(app_context: AppContext) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    msg = "Object dumbBrick does not exist or not authorized."
    result = SnowflakeEngineSpec.extract_errors(Exception(msg))
    assert result == [
        SupersetError(
            message="dumbBrick does not exist in this database.",
            error_type=SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Snowflake",
                "issue_codes": [
                    {
                        "code": 1029,
                        "message": "Issue 1029 - The object does not exist in the given database.",
                    }
                ],
            },
        )
    ]

    msg = "syntax error line 1 at position 10 unexpected 'limmmited'."
    result = SnowflakeEngineSpec.extract_errors(Exception(msg))
    assert result == [
        SupersetError(
            message='Please check your query for syntax errors at or near "limmmited". Then, try running your query again.',
            error_type=SupersetErrorType.SYNTAX_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Snowflake",
                "issue_codes": [
                    {
                        "code": 1030,
                        "message": "Issue 1030 - The query has a syntax error.",
                    }
                ],
            },
        )
    ]


@mock.patch("sqlalchemy.engine.Engine.connect")
def test_get_cancel_query_id(engine_mock: mock.Mock) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    cursor_mock.fetchone.return_value = [123]
    assert SnowflakeEngineSpec.get_cancel_query_id(cursor_mock, query) == 123


@mock.patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query(engine_mock: mock.Mock) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    assert SnowflakeEngineSpec.cancel_query(cursor_mock, query, "123") is True


@mock.patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_failed(engine_mock: mock.Mock) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.raiseError.side_effect = Exception()
    assert SnowflakeEngineSpec.cancel_query(cursor_mock, query, "123") is False
