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

# pylint: disable=import-outside-toplevel

import json
from datetime import datetime
from typing import Optional
from unittest import mock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import make_url

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02')"),
        ("DateTime", "CAST('2019-01-02T03:04:05.678900' AS DATETIME)"),
        ("TimeStamp", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("TIMESTAMP_NTZ", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("TIMESTAMP_LTZ", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("TIMESTAMP_TZ", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("TIMESTAMPLTZ", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("TIMESTAMPNTZ", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("TIMESTAMPTZ", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        (
            "TIMESTAMP WITH LOCAL TIME ZONE",
            "TO_TIMESTAMP('2019-01-02T03:04:05.678900')",
        ),
        ("TIMESTAMP WITHOUT TIME ZONE", "TO_TIMESTAMP('2019-01-02T03:04:05.678900')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str, expected_result: Optional[str], dttm: datetime
) -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_database_connection_test_mutator() -> None:
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
    from superset.models.core import Database

    database = Database(sqlalchemy_uri="snowflake://abc")
    SnowflakeEngineSpec.mutate_db_for_connection_test(database)
    engine_params = json.loads(database.extra or "{}")

    assert {
        "engine_params": {"connect_args": {"validate_default_parameters": True}}
    } == engine_params


def test_extract_errors() -> None:
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

    msg = "syntax error line 1 at position 10 unexpected 'limited'."
    result = SnowflakeEngineSpec.extract_errors(Exception(msg))
    assert result == [
        SupersetError(
            message='Please check your query for syntax errors at or near "limited". Then, try running your query again.',
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


def test_get_extra_params(mocker: MockerFixture) -> None:
    """
    Test the ``get_extra_params`` method.
    """
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    database = mocker.MagicMock()

    database.extra = {}
    assert SnowflakeEngineSpec.get_extra_params(database) == {
        "engine_params": {"connect_args": {"application": "Apache Superset"}}
    }

    database.extra = json.dumps(
        {
            "engine_params": {
                "connect_args": {"application": "Custom user agent", "foo": "bar"}
            }
        }
    )
    assert SnowflakeEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {"application": "Custom user agent", "foo": "bar"}
        }
    }


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    assert (
        SnowflakeEngineSpec.get_schema_from_engine_params(
            make_url("snowflake://user:pass@account/database_name/default"),
            {},
        )
        == "default"
    )

    assert (
        SnowflakeEngineSpec.get_schema_from_engine_params(
            make_url("snowflake://user:pass@account/database_name"),
            {},
        )
        is None
    )

    assert (
        SnowflakeEngineSpec.get_schema_from_engine_params(
            make_url("snowflake://user:pass@account/"),
            {},
        )
        is None
    )
