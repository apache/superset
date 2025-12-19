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

import pytest  # noqa: F401
from pytest_mock import MockerFixture
from sqlglot import parse_one
from sqlglot.errors import ParseError

from superset.constants import TimeGrain
from superset.sql.parse import Table


def test_epoch_to_dttm() -> None:
    """
    Test the `epoch_to_dttm` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    assert (
        Db2EngineSpec.epoch_to_dttm().format(col="epoch_dttm")
        == "(TIMESTAMP('1970-01-01', '00:00:00') + epoch_dttm SECONDS)"
    )


def test_get_table_comment(mocker: MockerFixture):
    """
    Test the `get_table_comment` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    mock_inspector = mocker.MagicMock()
    mock_inspector.get_table_comment.return_value = {
        "text": ("This is a table comment",)
    }

    assert (
        Db2EngineSpec.get_table_comment(mock_inspector, Table("my_table", "my_schema"))
        == "This is a table comment"
    )


def test_get_table_comment_empty(mocker: MockerFixture):
    """
    Test the `get_table_comment` method
    when no comment is returned.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    mock_inspector = mocker.MagicMock()
    mock_inspector.get_table_comment.return_value = {}

    assert (
        Db2EngineSpec.get_table_comment(mock_inspector, Table("my_table", "my_schema"))
        is None
    )


def test_get_prequeries(mocker: MockerFixture) -> None:
    """
    Test the ``get_prequeries`` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    database = mocker.MagicMock()

    assert Db2EngineSpec.get_prequeries(database) == []
    assert Db2EngineSpec.get_prequeries(database, schema="my_schema") == [
        'set current_schema "my_schema"'
    ]


@pytest.mark.parametrize(
    ("grain", "expected_expression"),
    [
        (None, "my_col"),
        (
            TimeGrain.SECOND,
            "CAST(my_col as TIMESTAMP) - MICROSECOND(my_col) MICROSECONDS",
        ),
        (
            TimeGrain.MINUTE,
            "CAST(my_col as TIMESTAMP)"
            " - SECOND(my_col) SECONDS - MICROSECOND(my_col) MICROSECONDS",
        ),
        (
            TimeGrain.HOUR,
            "CAST(my_col as TIMESTAMP)"
            " - MINUTE(my_col) MINUTES"
            " - SECOND(my_col) SECONDS - MICROSECOND(my_col) MICROSECONDS ",
        ),
        (TimeGrain.DAY, "DATE(my_col)"),
        (TimeGrain.WEEK, "my_col - (DAYOFWEEK(my_col)) DAYS"),
        (TimeGrain.MONTH, "my_col - (DAY(my_col)-1) DAYS"),
        (
            TimeGrain.QUARTER,
            "my_col - (DAY(my_col)-1) DAYS"
            " - (MONTH(my_col)-1) MONTHS + ((QUARTER(my_col)-1) * 3) MONTHS",
        ),
        (
            TimeGrain.YEAR,
            "my_col - (DAY(my_col)-1) DAYS - (MONTH(my_col)-1) MONTHS",
        ),
    ],
)
def test_time_grain_expressions(grain: TimeGrain, expected_expression: str) -> None:
    """
    Test that time grain expressions generate the expected SQL.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    actual = Db2EngineSpec._time_grain_expressions[grain].format(col="my_col")
    assert actual == expected_expression


def test_time_grain_day_parseable() -> None:
    """
    Test that the DAY time grain expression generates valid SQL
    that can be parsed by sqlglot.

    This test addresses the bug where the previous expression
    "CAST({col} as TIMESTAMP) - HOUR({col}) HOURS - ..."
    could not be parsed by sqlglot.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    expression = Db2EngineSpec._time_grain_expressions[TimeGrain.DAY].format(
        col="my_timestamp_col",
    )
    sql = f"SELECT {expression} FROM my_table"  # noqa: S608

    # This should not raise a ParseError
    try:
        parsed = parse_one(sql)
        assert parsed is not None
    except ParseError as e:
        pytest.fail(f"Failed to parse DAY time grain SQL: {e}")
