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

from typing import Callable

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Dialect, make_url
from sqlalchemy.engine.default import DefaultDialect
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

    ibm_db_sa >= 0.4.1 returns the comment as a plain string (fixed in
    https://github.com/ibmdb/python-ibmdbsa/pull/135), not a tuple as it
    used to. Indexing into that string with `comment[0]` truncates every
    DB2 table comment to its first character; this guards against that.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    mock_inspector = mocker.MagicMock()
    mock_inspector.get_table_comment.return_value = {"text": "This is a table comment"}

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


def test_get_table_comment_unexpected_error(mocker: MockerFixture):
    """
    Test that `get_table_comment` returns `None` instead of raising
    when the inspector call fails unexpectedly.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    mock_inspector = mocker.MagicMock()
    mock_inspector.get_table_comment.side_effect = Exception("boom")

    assert (
        Db2EngineSpec.get_table_comment(mock_inspector, Table("my_table", "my_schema"))
        is None
    )


def _ibm_db_sa_dialect() -> Dialect:
    """The real DB2 dialect; building it needs ``ibm_db_sa`` but no server."""
    pytest.importorskip("ibm_db_sa")
    return make_url("db2+ibm_db://u:p@h/d").get_dialect()()


def _sqlalchemy_normalizing_dialect() -> Dialect:
    """
    SQLAlchemy's own name normalization, which ``ibm_db_sa`` matches. CI does
    not install ``ibm_db_sa`` (no Linux arm64 wheel), so this keeps the
    assertions running there.
    """
    dialect = DefaultDialect()
    dialect.requires_name_normalize = True
    return dialect


@pytest.mark.parametrize(
    "dialect_factory",
    [_ibm_db_sa_dialect, _sqlalchemy_normalizing_dialect],
    ids=["ibm_db_sa", "sqlalchemy"],
)
def test_get_prequeries(
    mocker: MockerFixture, dialect_factory: Callable[[], Dialect]
) -> None:
    """
    Test the ``get_prequeries`` method.
    """
    from superset.db_engine_specs.db2 import Db2EngineSpec

    database = mocker.MagicMock()
    database.get_dialect.return_value = dialect_factory()

    assert Db2EngineSpec.get_prequeries(database) == []
    assert Db2EngineSpec.get_prequeries(database, schema="my_schema") == [
        'set current_schema "MY_SCHEMA"'
    ]
    assert Db2EngineSpec.get_prequeries(database, schema="MixedCase") == [
        'set current_schema "MixedCase"'
    ]
    assert Db2EngineSpec.get_prequeries(database, schema='evil"; SELECT 1--') == [
        'set current_schema "evil""; SELECT 1--"'
    ]


def test_get_prequeries_without_name_normalization(mocker: MockerFixture) -> None:
    """Preserve schema names when the dialect does not request normalization."""
    from superset.db_engine_specs.db2 import Db2EngineSpec

    database = mocker.MagicMock()
    dialect = database.get_dialect.return_value
    dialect.requires_name_normalize = False

    assert Db2EngineSpec.get_prequeries(database, schema="my_schema") == [
        'set current_schema "my_schema"'
    ]
    dialect.denormalize_name.assert_not_called()


@pytest.mark.parametrize(
    ("grain", "expected_expression"),
    [
        (None, "my_col"),
        (TimeGrain.SECOND, "DATE_TRUNC('SECOND', my_col)"),
        (TimeGrain.MINUTE, "DATE_TRUNC('MINUTE', my_col)"),
        (TimeGrain.HOUR, "DATE_TRUNC('HOUR', my_col)"),
        (TimeGrain.DAY, "DATE_TRUNC('DAY', my_col)"),
        (TimeGrain.WEEK, "DATE_TRUNC('WEEK', my_col)"),
        (TimeGrain.MONTH, "DATE_TRUNC('MONTH', my_col)"),
        (TimeGrain.QUARTER, "DATE_TRUNC('QUARTER', my_col)"),
        (TimeGrain.YEAR, "DATE_TRUNC('YEAR', my_col)"),
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
