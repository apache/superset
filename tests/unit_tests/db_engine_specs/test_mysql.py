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

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from unittest.mock import Mock, patch

import pytest
from sqlalchemy import column, types
from sqlalchemy.dialects.mysql import (
    BIT,
    DECIMAL,
    DOUBLE,
    FLOAT,
    INTEGER,
    LONGTEXT,
    MEDIUMINT,
    MEDIUMTEXT,
    TINYINT,
    TINYTEXT,
)
from sqlalchemy.engine.url import make_url, URL  # noqa: F401

from superset.constants import TimeGrain
from superset.db_engine_specs.base import TimestampExpression
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("TINYINT", TINYINT, None, GenericDataType.NUMERIC, False),
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("MEDIUMINT", MEDIUMINT, None, GenericDataType.NUMERIC, False),
        ("INT", INTEGER, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("FLOAT", FLOAT, None, GenericDataType.NUMERIC, False),
        ("DOUBLE", DOUBLE, None, GenericDataType.NUMERIC, False),
        ("BIT", BIT, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TINYTEXT", TINYTEXT, None, GenericDataType.STRING, False),
        ("MEDIUMTEXT", MEDIUMTEXT, None, GenericDataType.STRING, False),
        ("LONGTEXT", LONGTEXT, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("DATETIME", types.DateTime, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "STR_TO_DATE('2019-01-02', '%Y-%m-%d')"),
        (
            "DateTime",
            "STR_TO_DATE('2019-01-02 03:04:05.678900', '%Y-%m-%d %H:%i:%s.%f')",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "sqlalchemy_uri,error",
    [
        ("mysql://user:password@host/db1?local_infile=1", True),
        ("mysql+mysqlconnector://user:password@host/db1?allow_local_infile=1", True),
        ("mysql://user:password@host/db1?local_infile=0", True),
        ("mysql+mysqlconnector://user:password@host/db1?allow_local_infile=0", True),
        ("mysql://user:password@host/db1", False),
        ("mysql+mysqlconnector://user:password@host/db1", False),
    ],
)
def test_validate_database_uri(sqlalchemy_uri: str, error: bool) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    url = make_url(sqlalchemy_uri)
    if error:
        with pytest.raises(ValueError):  # noqa: PT011
            MySQLEngineSpec.validate_database_uri(url)
        return
    MySQLEngineSpec.validate_database_uri(url)


@pytest.mark.parametrize(
    "sqlalchemy_uri,connect_args,returns",
    [
        ("mysql://user:password@host/db1", {"local_infile": 1}, {"local_infile": 0}),
        (
            "mysql+mysqlconnector://user:password@host/db1",
            {"allow_local_infile": 1},
            {"allow_local_infile": 0},
        ),
        ("mysql://user:password@host/db1", {"local_infile": -1}, {"local_infile": 0}),
        (
            "mysql+mysqlconnector://user:password@host/db1",
            {"allow_local_infile": -1},
            {"allow_local_infile": 0},
        ),
        ("mysql://user:password@host/db1", {"local_infile": 0}, {"local_infile": 0}),
        (
            "mysql+mysqlconnector://user:password@host/db1",
            {"allow_local_infile": 0},
            {"allow_local_infile": 0},
        ),
        (
            "mysql://user:password@host/db1",
            {"param1": "some_value"},
            {"local_infile": 0, "param1": "some_value"},
        ),
        (
            "mysql+mysqlconnector://user:password@host/db1",
            {"param1": "some_value"},
            {"allow_local_infile": 0, "param1": "some_value"},
        ),
        (
            "mysql://user:password@host/db1",
            {"local_infile": 1, "param1": "some_value"},
            {"local_infile": 0, "param1": "some_value"},
        ),
        (
            "mysql+mysqlconnector://user:password@host/db1",
            {"allow_local_infile": 1, "param1": "some_value"},
            {"allow_local_infile": 0, "param1": "some_value"},
        ),
    ],
)
def test_adjust_engine_params(
    sqlalchemy_uri: str, connect_args: dict[str, Any], returns: dict[str, Any]
) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    url = make_url(sqlalchemy_uri)
    returned_url, returned_connect_args = MySQLEngineSpec.adjust_engine_params(
        url, connect_args
    )
    assert returned_connect_args == returns


@patch("sqlalchemy.engine.Engine.connect")
def test_get_cancel_query_id(engine_mock: Mock) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    cursor_mock.fetchone.return_value = ["123"]
    assert MySQLEngineSpec.get_cancel_query_id(cursor_mock, query) == "123"


@patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query(engine_mock: Mock) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.return_value.__enter__.return_value
    assert MySQLEngineSpec.cancel_query(cursor_mock, query, "123") is True


@patch("sqlalchemy.engine.Engine.connect")
def test_cancel_query_failed(engine_mock: Mock) -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.models.sql_lab import Query

    query = Query()
    cursor_mock = engine_mock.raiseError.side_effect = Exception()
    assert MySQLEngineSpec.cancel_query(cursor_mock, query, "123") is False


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    assert (
        MySQLEngineSpec.get_schema_from_engine_params(
            make_url("mysql://user:password@host/db1"), {}
        )
        == "db1"
    )


@pytest.mark.parametrize(
    "data,description,expected_result",
    [
        (
            [("1.23456", "abc")],
            [("dec", "decimal(12,6)"), ("str", "varchar(3)")],
            [(Decimal("1.23456"), "abc")],
        ),
        (
            [(Decimal("1.23456"), "abc")],
            [("dec", "decimal(12,6)"), ("str", "varchar(3)")],
            [(Decimal("1.23456"), "abc")],
        ),
        (
            [(None, "abc")],
            [("dec", "decimal(12,6)"), ("str", "varchar(3)")],
            [(None, "abc")],
        ),
        (
            [("1.23456", "abc")],
            [("dec", "varchar(255)"), ("str", "varchar(3)")],
            [("1.23456", "abc")],
        ),
    ],
)
def test_column_type_mutator(
    data: list[tuple[Any, ...]],
    description: list[Any],
    expected_result: list[tuple[Any, ...]],
):
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    mock_cursor = Mock()
    mock_cursor.fetchall.return_value = data
    mock_cursor.description = description

    assert spec.fetch_data(mock_cursor) == expected_result


@pytest.mark.parametrize(
    ("grain", "expected_expression"),
    [
        (None, "my_col"),
        (
            TimeGrain.SECOND,
            "DATE_ADD(DATE(my_col), "
            "INTERVAL (HOUR(my_col)*60*60 + MINUTE(my_col)*60"
            " + SECOND(my_col)) SECOND)",
        ),
        (
            TimeGrain.MINUTE,
            "DATE_ADD(DATE(my_col), "
            "INTERVAL (HOUR(my_col)*60 + MINUTE(my_col)) MINUTE)",
        ),
        (
            TimeGrain.HOUR,
            "DATE_ADD(CAST(DATE(my_col) AS DATETIME), INTERVAL HOUR(my_col) HOUR)",
        ),
        (TimeGrain.DAY, "DATE(my_col)"),
        (
            TimeGrain.WEEK,
            "DATE(DATE_SUB(my_col, INTERVAL DAYOFWEEK(my_col) - 1 DAY))",
        ),
        (
            TimeGrain.MONTH,
            "DATE(DATE_SUB(my_col, INTERVAL DAYOFMONTH(my_col) - 1 DAY))",
        ),
        (
            TimeGrain.QUARTER,
            "MAKEDATE(YEAR(my_col), 1) "
            "+ INTERVAL QUARTER(my_col) QUARTER - INTERVAL 1 QUARTER",
        ),
        (
            TimeGrain.YEAR,
            "DATE(DATE_SUB(my_col, INTERVAL DAYOFYEAR(my_col) - 1 DAY))",
        ),
        (
            TimeGrain.WEEK_STARTING_MONDAY,
            "DATE(DATE_SUB(my_col, "
            "INTERVAL DAYOFWEEK(DATE_SUB(my_col, "
            "INTERVAL 1 DAY)) - 1 DAY))",
        ),
    ],
)
def test_time_grain_expressions(
    grain: Optional[TimeGrain], expected_expression: str
) -> None:
    """
    Test that MySQL time grain expression templates produce the expected SQL.
    Guards against the DATE() function being dropped in the HOUR grain.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    actual = MySQLEngineSpec._time_grain_expressions[grain].replace("{col}", "my_col")
    assert actual == expected_expression


def test_compile_timegrain_expression_preserves_date_function() -> None:
    """
    Test that compile_timegrain_expression preserves the DATE() wrapper in the
    MySQL HOUR time grain expression.

    Regression test for: ECharts HOUR grain generates invalid SQL (DATE() dropped).
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    col = column("my_col")
    template = MySQLEngineSpec._time_grain_expressions[TimeGrain.HOUR]
    expr = TimestampExpression(template, col)

    compiled = str(expr)
    assert (
        compiled
        == "DATE_ADD(CAST(DATE(my_col) AS DATETIME), INTERVAL HOUR(my_col) HOUR)"
    ), f"DATE() wrapper was dropped or CAST lost. Got: {compiled}"
