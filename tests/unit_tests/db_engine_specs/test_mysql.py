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

import builtins
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import Mock, patch

import pandas as pd
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
from sqlalchemy.engine import Engine
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
        ("var_string", types.VARCHAR, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("DATETIME", types.DateTime, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        # Wire-protocol names
        ("VAR_STRING", types.VARCHAR, None, GenericDataType.STRING, False),
        ("NEWDECIMAL", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("TINY", TINYINT, None, GenericDataType.NUMERIC, False),
        ("SHORT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("BLOB", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        ("YEAR", types.Integer, None, GenericDataType.NUMERIC, False),
        ("ENUM", types.String, None, GenericDataType.STRING, False),
        ("SET", types.String, None, GenericDataType.STRING, False),
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


def test_fetch_data_mutates_decimal_rows_in_tuple_results() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    newdecimal, var_string = 246, 253
    cursor = Mock()
    cursor.description = [("amount", newdecimal), ("label", var_string)]
    cursor.fetchall.return_value = (("10.50", "Ships"), ("22.30", "Planes"))

    # Stub the type_code_map so this test doesn't depend on MySQLdb or
    # pymysql being importable in the test environment.
    original_type_code_map = spec.type_code_map
    spec.type_code_map = {newdecimal: "NEWDECIMAL", var_string: "VAR_STRING"}

    try:
        data = spec.fetch_data(cursor)
    finally:
        spec.type_code_map = original_type_code_map

    assert data == [(Decimal("10.50"), "Ships"), (Decimal("22.30"), "Planes")]


def test_fetch_data_mutates_duplicate_decimal_column_names() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    newdecimal, var_string = 246, 253
    cursor = Mock()
    cursor.description = [
        ("amount", newdecimal),
        ("amount", var_string),
        ("amount", newdecimal),
    ]
    cursor.fetchall.return_value = [("10.50", "not a decimal", "22.30")]

    original_type_code_map = spec.type_code_map
    spec.type_code_map = {newdecimal: "NEWDECIMAL", var_string: "VAR_STRING"}

    try:
        data = spec.fetch_data(cursor)
    finally:
        spec.type_code_map = original_type_code_map

    assert data == [(Decimal("10.50"), "not a decimal", Decimal("22.30"))]


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


def test_get_datatype_pymysql_fallback() -> None:
    """get_datatype() falls back to pymysql when MySQLdb is not installed."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    # Reset cached type_code_map so the import path is exercised
    original_type_code_map = MySQLEngineSpec.type_code_map
    MySQLEngineSpec.type_code_map = {}

    try:
        # Build a fake pymysql module with constants.FIELD_TYPE
        fake_field_type = SimpleNamespace(TINY=1, VARCHAR=15)
        fake_constants = SimpleNamespace(FIELD_TYPE=fake_field_type)
        fake_pymysql = SimpleNamespace(constants=fake_constants)

        original_import = builtins.__import__

        def mock_import(name: str, *args: Any, **kwargs: Any) -> Any:
            if name == "MySQLdb":
                raise ImportError("No module named 'MySQLdb'")
            if name == "pymysql":
                return fake_pymysql
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            assert MySQLEngineSpec.get_datatype(1) == "TINY"
            assert MySQLEngineSpec.get_datatype(15) == "VARCHAR"
            assert MySQLEngineSpec.get_datatype("BIGINT") == "BIGINT"
            assert MySQLEngineSpec.get_datatype(999) is None
    finally:
        # Restore original state
        MySQLEngineSpec.type_code_map = original_type_code_map


def test_get_datatype_mysqlconnector_fallback() -> None:
    """get_datatype() supports mysql-connector-python without PyMySQL."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    original_type_code_map = MySQLEngineSpec.type_code_map
    MySQLEngineSpec.type_code_map = {}

    try:
        fake_field_type = SimpleNamespace(NEWDECIMAL=246)
        fake_constants = SimpleNamespace(FieldType=fake_field_type)
        original_import = builtins.__import__

        def mock_import(name: str, *args: Any, **kwargs: Any) -> Any:
            if name in {"MySQLdb", "pymysql"}:
                raise ImportError(f"No module named '{name}'")
            if name == "mysql.connector.constants":
                return fake_constants
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            assert MySQLEngineSpec.get_datatype(246) == "NEWDECIMAL"
    finally:
        MySQLEngineSpec.type_code_map = original_type_code_map


@pytest.mark.parametrize(
    ("grain", "expected_expression"),
    [
        (None, "my_col"),
        (
            TimeGrain.SECOND,
            "DATE_FORMAT(my_col, '%Y-%m-%d %H:%i:%s')",
        ),
        (
            TimeGrain.MINUTE,
            "DATE_FORMAT(my_col, '%Y-%m-%d %H:%i:00')",
        ),
        (
            TimeGrain.HOUR,
            "DATE_FORMAT(my_col, '%Y-%m-%d %H:00:00')",
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
    Guards against the bare DATE() call being dropped by SQLGlot sanitization
    or SQLAlchemy proxying for the SECOND/MINUTE/HOUR grains, which used to
    truncate to a bare `DATE({col})`.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    actual = MySQLEngineSpec._time_grain_expressions[grain].replace("{col}", "my_col")
    assert actual == expected_expression


def test_compile_timegrain_expression_preserves_date_truncation() -> None:
    """
    Test that compile_timegrain_expression preserves the full DATE_FORMAT
    truncation in the MySQL HOUR time grain expression, including when the
    expression is proxied through a subquery (series-limit path).

    Regression test for: ECharts HOUR grain generates invalid SQL (DATE()
    dropped by sanitization/proxying).
    """
    from sqlalchemy import select

    from superset.db_engine_specs.mysql import MySQLEngineSpec

    col = column("my_col")
    template = MySQLEngineSpec._time_grain_expressions[TimeGrain.HOUR]
    expr = TimestampExpression(template, col)
    expected = "DATE_FORMAT(my_col, '%Y-%m-%d %H:00:00')"

    compiled = str(expr)
    assert compiled == expected, f"DATE_FORMAT truncation was dropped. Got: {compiled}"

    proxied = str(select(select(expr.label("bucket")).subquery().c.bucket))
    assert expected in proxied, (
        f"DATE_FORMAT truncation was dropped in proxied expression. Got: {proxied}"
    )


def test_identifier_quote_uses_backticks() -> None:
    """MySQL/MariaDB quote identifiers with backticks."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    assert MySQLEngineSpec.get_public_information()["identifier_quote"] == {
        "start": "`",
        "end": "`",
        "escape_by_doubling": True,
    }


def test_extended_aggregation_func_stddev_var_sample() -> None:
    """
    Verified against a live mysql:8.0 instance, including under GROUP BY ...
    WITH ROLLUP: these produce the correct database-wide sample statistic, and
    match the same-input results from postgres/duckdb exactly.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    col = column("sales")

    stddev_expr = spec.get_extended_aggregation_func("STDDEV_SAMP")
    assert stddev_expr is not None
    assert (
        str(stddev_expr(col).compile(compile_kwargs={"literal_binds": True}))
        == "stddev_samp(sales)"
    )

    var_expr = spec.get_extended_aggregation_func("VAR_SAMP")
    assert var_expr is not None
    assert (
        str(var_expr(col).compile(compile_kwargs={"literal_binds": True}))
        == "var_samp(sales)"
    )


def test_extended_aggregation_func_median_unsupported() -> None:
    """
    MySQL has neither a MEDIAN function nor PERCENTILE_CONT (confirmed against
    a live mysql:8.0 instance: both error). Must not silently fall back to
    a guessed expression.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec as spec  # noqa: N813

    assert spec.get_extended_aggregation_func("MEDIAN") is None


def _upload_requiring_primary_key(
    engine: Engine,
    df: pd.DataFrame,
    *,
    table_name: str = "my_table",
    index: bool = False,
) -> None:
    """
    Run ``MySQLEngineSpec.df_to_sql`` against ``engine`` with the server
    reporting ``sql_require_primary_key = ON`` -- the setup every
    primary-key test below shares.
    """
    from superset.db_engine_specs.mysql import MySQLEngineSpec
    from superset.sql.parse import Table

    with (
        patch.object(MySQLEngineSpec, "get_engine") as mock_get_engine,
        patch.object(MySQLEngineSpec, "_requires_primary_key", return_value=True),
    ):
        mock_get_engine.return_value.__enter__.return_value = engine
        mock_get_engine.return_value.__exit__.return_value = False

        MySQLEngineSpec.df_to_sql(
            database=Mock(),
            table=Table(table=table_name),
            df=df,
            to_sql_kwargs={"if_exists": "fail", "index": index},
        )


def test_df_to_sql_adds_primary_key_when_mysql_requires_one() -> None:
    """
    apache/superset#37399: uploading a CSV/Excel/columnar file creates the
    table via ``pandas.DataFrame.to_sql``, which never declares a primary
    key. A MySQL server configured with ``sql_require_primary_key = ON``
    rejects such a ``CREATE TABLE`` with error 3750.

    No live MySQL server is available in this environment, so an in-memory
    SQLite engine stands in for the target database, with a SQLAlchemy event
    listener reproducing MySQL's documented enforcement: any executed
    ``CREATE TABLE`` lacking a primary key raises the same error 3750 seen
    in the issue.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine, event
    from sqlalchemy.exc import OperationalError

    engine = create_engine("sqlite://")

    @event.listens_for(engine, "before_cursor_execute")
    def _enforce_sql_require_primary_key(  # pylint: disable=unused-argument
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        if (
            statement.strip().upper().startswith("CREATE TABLE")
            and "PRIMARY KEY" not in statement.upper()
        ):
            raise OperationalError(
                statement,
                parameters,
                Exception(
                    '(3750, "Unable to create or change a table without a '
                    "primary key, when the system variable "
                    "'sql_require_primary_key' is set.\")"
                ),
            )

    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})

    _upload_requiring_primary_key(engine, df)

    with engine.connect() as conn:
        rows = conn.execute(sa.text("SELECT a, b FROM my_table ORDER BY a")).fetchall()
    assert [tuple(row) for row in rows] == [(1, "x"), (2, "y"), (3, "z")]

    pk = sa.inspect(engine).get_pk_constraint("my_table")
    assert pk["constrained_columns"], (
        "expected the created table to have a primary key so MySQL's "
        "sql_require_primary_key would accept the CREATE TABLE"
    )


def test_df_to_sql_promotes_pandas_index_to_primary_key() -> None:
    """
    The literal scenario reported in apache/superset#37399: the "Dataframe
    index" upload option is enabled, so pandas writes an extra ``index``
    column -- the reporter's CREATE TABLE showed this column present but
    never marked PRIMARY KEY. When MySQL requires one, that pandas index
    column should be promoted to the primary key instead of adding a
    redundant second column.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})

    _upload_requiring_primary_key(engine, df, index=True)

    with engine.connect() as conn:
        rows = conn.execute(
            sa.text('SELECT "index", a, b FROM my_table ORDER BY "index"')
        ).fetchall()
    assert [tuple(row) for row in rows] == [(0, 1, "x"), (1, 2, "y"), (2, 3, "z")]

    pk = sa.inspect(engine).get_pk_constraint("my_table")
    assert pk["constrained_columns"] == ["index"], (
        "expected the pandas index column to become the primary key, not "
        "an extra synthesized column"
    )


def test_df_to_sql_disables_autoincrement_on_synthesized_primary_key() -> None:
    """
    pandas declares the primary key via a table-level PrimaryKeyConstraint
    (never Column(primary_key=True)), but SQLAlchemy's MySQL DDL compiler
    still infers AUTO_INCREMENT for a lone integer primary-key column by
    default. The synthesized key values here are explicit (the promoted
    index, or the 1..n range for the synthesized "id" column), not
    DB-generated -- and pandas' default RangeIndex starts at 0, so inserting
    0 into an AUTO_INCREMENT column asks MySQL to generate a value instead
    of storing 0 literally, colliding with the row whose key is 1.

    No live MySQL server is available in this environment; compile the
    exact table ``SQLTable.create()`` would hand to MySQL against
    SQLAlchemy's MySQL dialect directly and assert AUTO_INCREMENT never
    appears.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.dialects import mysql
    from sqlalchemy.schema import CreateTable

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    captured_tables: list[Any] = []

    def _capture_instead_of_create(self: Any) -> None:
        captured_tables.append(self.table)

    with (
        patch.object(pd.io.sql.SQLTable, "create", _capture_instead_of_create),
        patch.object(pd.io.sql.SQLTable, "insert"),
    ):
        _upload_requiring_primary_key(engine, df)

    assert len(captured_tables) == 1
    ddl = str(CreateTable(captured_tables[0]).compile(dialect=mysql.dialect()))
    assert "AUTO_INCREMENT" not in ddl.upper()


def test_df_to_sql_falls_back_to_synthesized_key_for_non_unique_index() -> None:
    """
    apache/superset#37399: the "Dataframe index" upload option promotes the
    DataFrame's index straight to PRIMARY KEY, but a CSV/Excel upload can
    point that option at a column that repeats values or contains missing
    ones -- neither of which a primary key can hold. When the index isn't
    unique (or has NaNs), fall back to the synthesized key used for the
    ``index=False`` path instead of letting MySQL reject the INSERT with a
    duplicate-key or NOT-NULL error.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]}, index=[0, 0, 1])

    _upload_requiring_primary_key(engine, df, index=True)

    with engine.connect() as conn:
        rows = conn.execute(
            sa.text("SELECT id, a, b FROM my_table ORDER BY id")
        ).fetchall()
    assert [tuple(row) for row in rows] == [(1, 1, "x"), (2, 2, "y"), (3, 3, "z")]

    columns = {col["name"] for col in sa.inspect(engine).get_columns("my_table")}
    assert "index" not in columns, (
        "the non-unique pandas index should not also be written as a redundant column"
    )

    pk = sa.inspect(engine).get_pk_constraint("my_table")
    assert pk["constrained_columns"] == ["id"], (
        "expected the synthesized key to be used since the pandas index is not unique"
    )


def test_df_to_sql_falls_back_to_synthesized_key_for_index_with_missing_values() -> (
    None
):
    """
    The other half of the same guard: an index whose values are all
    distinct still cannot become a PRIMARY KEY if any of them is missing,
    because MySQL rejects NULL in a key column (error 1048). Pointing the
    "Dataframe index" upload option at a column with a blank cell produces
    exactly that -- ``is_unique`` stays True while ``hasnans`` is True --
    so only the NaN half of the guard keeps it off the primary key.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]}, index=[1.0, 2.0, None])
    df.index.name = "key"
    assert df.index.is_unique, "the fixture's index values must all be distinct"
    assert df.index.hasnans, (
        "the fixture must contain a missing index value to exercise the "
        "hasnans half of the guard"
    )

    _upload_requiring_primary_key(engine, df, index=True)

    with engine.connect() as conn:
        rows = conn.execute(
            sa.text("SELECT id, a, b FROM my_table ORDER BY id")
        ).fetchall()
    assert [tuple(row) for row in rows] == [(1, 1, "x"), (2, 2, "y"), (3, 3, "z")]

    columns = {col["name"] for col in sa.inspect(engine).get_columns("my_table")}
    assert "key" not in columns, (
        "the NaN-containing pandas index should not also be written as a "
        "redundant column"
    )

    pk = sa.inspect(engine).get_pk_constraint("my_table")
    assert pk["constrained_columns"] == ["id"], (
        "expected the synthesized key to be used since the pandas index "
        "contains a missing value"
    )


def test_df_to_sql_synthesized_key_avoids_case_insensitive_collision() -> None:
    """
    MySQL compares column identifiers case-insensitively, so an existing
    "ID" column would collide with a lowercase synthesized "id" primary key
    at the MySQL level even though Python sees them as different strings.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"ID": [10, 20, 30], "b": ["x", "y", "z"]})

    _upload_requiring_primary_key(engine, df)

    columns = [col["name"] for col in sa.inspect(engine).get_columns("my_table")]
    assert "_id" in columns, (
        "the synthesized key should be renamed to avoid the case-"
        "insensitive collision with the existing 'ID' column"
    )

    pk = sa.inspect(engine).get_pk_constraint("my_table")
    assert pk["constrained_columns"] == ["_id"]


def test_df_to_sql_promoted_index_name_collision_falls_back_to_synthesized_key() -> (
    None
):
    """
    The pandas index is unique and NaN-free, so it would normally be
    promoted straight to PRIMARY KEY. But its name ("ID") collides
    case-insensitively with an existing "id" column, and pandas'
    ``SQLTable`` only rejects exact (case-sensitive) name clashes when
    resetting the index -- so promoting it would produce a CREATE TABLE
    with two columns MySQL sees as the same identifier (error 1060). Fall
    back to the synthesized key instead, the same as a non-unique index.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"id": [1, 2, 3], "b": ["x", "y", "z"]})
    df.index.name = "ID"

    _upload_requiring_primary_key(engine, df, index=True)

    columns = [col["name"] for col in sa.inspect(engine).get_columns("my_table")]
    assert "ID" not in columns, (
        "the colliding index name should not be promoted to a column"
    )
    assert "_id" in columns, (
        "the synthesized key should be renamed to avoid the case-"
        "insensitive collision with the existing 'id' column"
    )

    pk = sa.inspect(engine).get_pk_constraint("my_table")
    assert pk["constrained_columns"] == ["_id"]


def test_df_to_sql_constraint_name_within_mysql_identifier_limit() -> None:
    """
    MySQL caps identifiers at 64 characters; pandas names the primary key
    constraint ``f"{table_name}_pk"``, which overflows for a long (but
    otherwise valid) MySQL table name and would make the CREATE TABLE fail.
    MySQL renames PRIMARY KEY constraints to "PRIMARY" internally regardless
    of the name given in DDL, so a short fixed name is safe to force.
    """
    from sqlalchemy import create_engine

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    long_table_name = "t" * 64  # valid MySQL length; +"_pk" would overflow
    captured_tables: list[Any] = []

    def _capture_instead_of_create(self: Any) -> None:
        captured_tables.append(self.table)

    with (
        patch.object(pd.io.sql.SQLTable, "create", _capture_instead_of_create),
        patch.object(pd.io.sql.SQLTable, "insert"),
    ):
        _upload_requiring_primary_key(engine, df, table_name=long_table_name)

    assert len(captured_tables) == 1
    assert len(captured_tables[0].primary_key.name) <= 64


def test_df_to_sql_when_server_does_not_expose_sql_require_primary_key() -> None:
    """
    ``sql_require_primary_key`` only exists in MySQL 8.0.13+. Older servers and
    the MySQL-compatible engines that subclass this spec (MariaDB, Doris,
    StarRocks, OceanBase) error out on the probe query, and they do not enforce
    the requirement -- the upload must still go through the plain
    ``pandas.DataFrame.to_sql`` path rather than propagating that error.
    """
    import sqlalchemy as sa
    from sqlalchemy import create_engine

    from superset.db_engine_specs.mariadb import MariaDBEngineSpec
    from superset.sql.parse import Table

    engine = create_engine("sqlite://")
    df = pd.DataFrame({"a": [1, 2, 3]})

    with patch.object(MariaDBEngineSpec, "get_engine") as mock_get_engine:
        mock_get_engine.return_value.__enter__.return_value = engine
        mock_get_engine.return_value.__exit__.return_value = False

        MariaDBEngineSpec.df_to_sql(
            database=Mock(),
            table=Table(table="my_table"),
            df=df,
            to_sql_kwargs={"if_exists": "fail", "index": False},
        )

    with engine.connect() as conn:
        rows = conn.execute(sa.text("SELECT a FROM my_table ORDER BY a")).fetchall()
    assert [row[0] for row in rows] == [1, 2, 3]


@pytest.mark.parametrize(
    "client_info,expected_mode",
    [
        ("3.3.17", "VERIFY_CA"),
        ("5.7.44", "REQUIRED"),
        ("8.4.6", "REQUIRED"),
        ("9.4.0", "REQUIRED"),
        ("unknown", "VERIFY_CA"),
    ],
)
@pytest.mark.parametrize("driver", ["mysql", "mysql+mysqldb"])
@pytest.mark.parametrize("source", ["uri", "toggle", "connect_args"])
def test_ssl_request_requires_tls(
    driver: str, source: str, client_info: str, expected_mode: str
) -> None:
    """The SSL toggle and legacy URI flag must require, not prefer, TLS."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url(f"{driver}://user:pass@localhost/db")
    args: dict[str, Any] = {}
    if source == "toggle":
        uri = make_url(
            MySQLEngineSpec.build_sqlalchemy_uri(
                {
                    "username": "user",
                    "password": "pass",
                    "host": "localhost",
                    "port": 3306,
                    "database": "db",
                    "encryption": True,
                },
                {},
            )
        ).set(drivername=driver)
    elif source == "uri":
        uri = uri.update_query_dict({"ssl": "1"})
    else:
        args = {"ssl": True}
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = client_info
        url, connect_args = MySQLEngineSpec.adjust_engine_params(uri, args)
    options = dict(url.query, **connect_args)
    assert options["ssl_mode"] == expected_mode
    assert "ssl" not in options


@pytest.mark.parametrize("driver", ["mysql+mysqlconnector", "mysql+pymysql"])
def test_ssl_request_requires_verification(driver: str) -> None:
    """The alternate drivers must not use opportunistic TLS."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url(f"{driver}://localhost/db?ssl=1&ssl_ca=/ca.pem")
    url, args = MySQLEngineSpec.adjust_engine_params(uri, {})
    assert args["ssl_verify_cert"] is True
    assert "ssl" not in url.query
    _, options = url.get_dialect()().create_connect_args(url)
    options.update(args)
    assert options["ssl_ca"] == "/ca.pem"


@pytest.mark.parametrize("mode", ["VERIFY_CA", "VERIFY_IDENTITY"])
def test_ssl_request_preserves_stronger_mode(mode: str) -> None:
    """Do not weaken an explicit verification mode or lose the selected schema."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url(f"mysql://localhost/db?ssl=1&ssl_mode={mode}")
    url, args = MySQLEngineSpec.adjust_engine_params(uri, {}, schema="other")
    assert args["ssl_mode"] == mode
    assert url.database == "other"


@pytest.mark.parametrize(
    "driver, options",
    [
        ("mysql", {"ssl_mode": "DISABLED"}),
        ("mysql+mysqldb", {"ssl_mode": "PREFERRED"}),
        ("mysql+mysqlconnector", {"ssl_disabled": True}),
        ("mysql+pymysql", {"ssl_verify_cert": False}),
    ],
)
def test_ssl_request_rejects_conflicting_options(
    driver: str, options: dict[str, Any]
) -> None:
    """Advanced options must not silently cancel the SSL request."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="MySQL SSL request"):
        MySQLEngineSpec.adjust_engine_params(
            make_url(f"{driver}://localhost/db?ssl=1"), options
        )


def test_ssl_request_does_not_change_other_engines() -> None:
    """MySQL-compatible engines keep their own transport handling."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    class OtherEngineSpec(MySQLEngineSpec):
        engine = "other"

    uri = make_url("mysql://localhost/db?ssl=1")
    url, args = OtherEngineSpec.adjust_engine_params(uri, {})
    assert url == uri
    assert "ssl_mode" not in args


@pytest.mark.parametrize(
    "client_info,expected_mode",
    [("3.3.17", "VERIFY_CA"), ("8.4.6", "REQUIRED")],
)
@pytest.mark.parametrize("source", ["uri", "connect_args"])
def test_ssl_request_upgrades_required_mode(
    client_info: str, expected_mode: str, source: str
) -> None:
    """MariaDB Connector/C maps mysqlclient REQUIRED to opportunistic TLS."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url("mysql://localhost/db?ssl=1")
    options = {}
    if source == "uri":
        uri = uri.update_query_dict({"ssl_mode": "REQUIRED"})
    else:
        options["ssl_mode"] = "REQUIRED"
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = client_info
        _, args = MySQLEngineSpec.adjust_engine_params(uri, options)
    assert args["ssl_mode"] == expected_mode


def test_pymysql_hostname_verification_survives() -> None:
    """A URL ssl_check_hostname becomes PyMySQL's ssl_verify_identity."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    url, args = MySQLEngineSpec.adjust_engine_params(
        make_url("mysql+pymysql://localhost/db?ssl=1&ssl_check_hostname=true"), {}
    )
    assert args["ssl_verify_identity"] is True
    assert "ssl_check_hostname" not in url.query


@pytest.mark.parametrize("option", ["ssl_capath", "ssl_cipher"])
def test_pymysql_unsupported_ssl_options_fail_closed(option: str) -> None:
    """SSL options PyMySQL cannot honor are rejected instead of ignored."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="Unsupported PyMySQL SSL option"):
        MySQLEngineSpec.adjust_engine_params(
            make_url(f"mysql+pymysql://localhost/db?ssl=1&{option}=test"), {}
        )


@pytest.mark.parametrize("driver", ["mysql+mysqlconnector", "mysql+pymysql"])
@pytest.mark.parametrize("value", ["false", "0", False])
def test_ssl_request_drops_non_disabling_ssl_disabled(
    driver: str, value: str | bool
) -> None:
    """A false ssl_disabled must not reach drivers that test it for truthiness."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url(f"{driver}://localhost/db?ssl=1")
    if isinstance(value, str):
        uri = uri.update_query_dict({"ssl_disabled": value})
        args: dict[str, Any] = {}
    else:
        args = {"ssl_disabled": value}
    url, connect_args = MySQLEngineSpec.adjust_engine_params(uri, args)
    assert "ssl_disabled" not in url.query
    assert "ssl_disabled" not in connect_args
    assert connect_args["ssl_verify_cert"] is True


@pytest.mark.parametrize("value", ["true", "1"])
def test_ssl_request_rejects_url_ssl_disabled(value: str) -> None:
    """A truthy URL ssl_disabled conflicts with the SSL request."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="conflicts with ssl_disabled"):
        MySQLEngineSpec.adjust_engine_params(
            make_url(f"mysql+mysqlconnector://localhost/db?ssl=1&ssl_disabled={value}"),
            {},
        )


def test_ssl_request_aurora_data_api_uses_https() -> None:
    """The HTTPS-only Data API driver must not receive an ssl argument."""
    from superset.db_engine_specs.aurora import AuroraMySQLDataAPI

    uri = make_url(
        AuroraMySQLDataAPI.build_sqlalchemy_uri(
            {
                "username": "user",
                "password": "pass",
                "host": "",
                "port": 3306,
                "database": "db",
                "encryption": True,
            },
            {},
        )
    ).update_query_dict({"aurora_cluster_arn": "arn"})
    assert uri.get_driver_name() == "auroradataapi"
    url, args = AuroraMySQLDataAPI.adjust_engine_params(uri, {})
    assert "ssl" not in url.query
    assert url.query["aurora_cluster_arn"] == "arn"
    assert args == {}


def test_pymysql_blank_hostname_check_is_unset() -> None:
    """A blank ssl_check_hostname must not crash boolean parsing."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url("mysql+pymysql://localhost/db?ssl=1").update_query_dict(
        {"ssl_check_hostname": ""}
    )
    url, args = MySQLEngineSpec.adjust_engine_params(uri, {})
    assert "ssl_check_hostname" not in url.query
    assert "ssl_verify_identity" not in args
    assert args["ssl_verify_cert"] is True


def test_pymysql_hostname_check_conflict_fails_closed() -> None:
    """A connect_arg must not silently cancel URL hostname verification."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="conflicts with ssl_verify_identity"):
        MySQLEngineSpec.adjust_engine_params(
            make_url("mysql+pymysql://localhost/db?ssl=1&ssl_check_hostname=true"),
            {"ssl_verify_identity": False},
        )


@pytest.mark.parametrize(
    "client_info,expected_mode",
    [("3.3.17", "VERIFY_CA"), ("8.4.6", "REQUIRED")],
)
@pytest.mark.parametrize("source", ["uri", "connect_args"])
def test_saved_required_mode_is_a_tls_request(
    source: str, client_info: str, expected_mode: str
) -> None:
    """A bare ssl_mode=REQUIRED is enforced without also needing ssl=1."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url("mysql://localhost/db")
    args: dict[str, Any] = {}
    if source == "uri":
        uri = uri.update_query_dict({"ssl_mode": "REQUIRED"})
    else:
        args = {"ssl_mode": "REQUIRED"}
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = client_info
        _, connect_args = MySQLEngineSpec.adjust_engine_params(uri, args)
    assert connect_args["ssl_mode"] == expected_mode


@pytest.mark.parametrize("mode", ["DISABLED", "PREFERRED"])
def test_non_required_mode_is_not_a_tls_request(mode: str) -> None:
    """Modes that do not require TLS are left to the driver without a request."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url(f"mysql://localhost/db?ssl_mode={mode}")
    url, args = MySQLEngineSpec.adjust_engine_params(uri, {})
    assert url == uri
    assert "ssl_mode" not in args


def test_require_mysql_tls_uses_explicit_driver() -> None:
    """Compatible dialects select options by driver, not by URL backend."""
    from superset.db_engine_specs.mysql import require_mysql_tls

    uri = make_url("doris://localhost/db?ssl=1")
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = "3.3.17"
        url, args = require_mysql_tls(uri, {}, driver="mysqldb")
    assert url.drivername == "doris"
    assert "ssl" not in url.query
    assert args["ssl_mode"] == "VERIFY_CA"


@pytest.mark.parametrize("source", ["uri", "connect_args"])
def test_mysqlclient_ssl_request_rejects_ssl_disabled(source: str) -> None:
    """ssl_disabled=True cannot cancel a mysqlclient SSL request."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url("mysql://localhost/db?ssl=1")
    args: dict[str, Any] = {}
    if source == "uri":
        uri = uri.update_query_dict({"ssl_disabled": "true"})
    else:
        args = {"ssl_disabled": True}
    with pytest.raises(ValueError, match="conflicts with ssl_disabled"):
        MySQLEngineSpec.adjust_engine_params(uri, args)


@pytest.mark.parametrize("value", ["false", "0", False])
def test_mysqlclient_ssl_request_drops_false_ssl_disabled(value: str | bool) -> None:
    """A false ssl_disabled is dropped; REQUIRED is upgraded for MariaDB clients."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url("mysql://localhost/db?ssl_mode=REQUIRED")
    if isinstance(value, str):
        uri = uri.update_query_dict({"ssl_disabled": value})
        args: dict[str, Any] = {}
    else:
        args = {"ssl_disabled": value}
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = "3.3.17"
        url, connect_args = MySQLEngineSpec.adjust_engine_params(uri, args)
    assert "ssl_disabled" not in url.query
    assert "ssl_disabled" not in connect_args
    assert connect_args["ssl_mode"] == "VERIFY_CA"


def test_pymysql_old_version_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """PyMySQL before 1.2 must not reach its silent cleartext fallback."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    monkeypatch.setattr("pymysql.VERSION", (1, 1, 1))
    with pytest.raises(ValueError, match="requires PyMySQL >= 1.2"):
        MySQLEngineSpec.adjust_engine_params(
            make_url("mysql+pymysql://localhost/db?ssl=1"), {}
        )


@pytest.mark.parametrize("host", ["cluster.rds.amazonaws.com", "127.0.0.1"])
def test_aurora_mysql_tls_preserves_ca(host: str) -> None:
    """Standard Aurora and tunneled hosts keep verification and the RDS CA."""
    from superset.db_engine_specs.aurora import AuroraMySQLEngineSpec

    uri = make_url(f"mysql://{host}/db?ssl=1&ssl_ca=/certs/rds-ca.pem")
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        module.return_value.get_client_info.return_value = "3.3.17"
        url, args = AuroraMySQLEngineSpec.adjust_engine_params(uri, {})
    assert url.host == host
    assert url.query["ssl_ca"] == "/certs/rds-ca.pem"
    assert args["ssl_mode"] == "VERIFY_CA"


@pytest.mark.parametrize("driver", ["mysql", "mysql+pymysql"])
@pytest.mark.parametrize("host", ["localhost", "127.0.0.1"])
def test_native_tls_without_toggle_is_unchanged(driver: str, host: str) -> None:
    """The documented native TLS recovery path bypasses toggle enforcement."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    uri = make_url(f"{driver}://{host}/db")
    options = {"ssl": {"ca": "/certs/ca.pem"}}
    with patch("superset.db_engine_specs.mysql.import_module") as module:
        url, args = MySQLEngineSpec.adjust_engine_params(uri, options)
    module.assert_not_called()
    assert url == uri
    assert args["ssl"] == options["ssl"]
    assert "ssl_mode" not in args
    assert "ssl_verify_cert" not in args


def test_pymysql_nested_ssl_dict_fails_closed() -> None:
    """PyMySQL discards a nested ssl dictionary once ssl_verify_cert is set."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="individual ssl_ca/ssl_cert/ssl_key"):
        MySQLEngineSpec.adjust_engine_params(
            make_url("mysql+pymysql://localhost/db?ssl=1"),
            {"ssl": {"ca": "/certs/ca.pem"}},
        )


@pytest.mark.parametrize("value", [["1"], 1.5])
def test_ssl_request_rejects_invalid_ssl_value(value: Any) -> None:
    """An ssl value that is neither a flag nor a native dictionary fails closed."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="Invalid MySQL ssl option"):
        MySQLEngineSpec.adjust_engine_params(
            make_url("mysql://localhost/db"), {"ssl": value}
        )


@pytest.mark.parametrize("driver", ["mysql+cymysql", "mysql+aiomysql"])
def test_ssl_request_unsupported_driver_fails_closed(driver: str) -> None:
    """Drivers without known fail-closed TLS options must not receive ssl=1."""
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    with pytest.raises(ValueError, match="Unsupported driver"):
        MySQLEngineSpec.adjust_engine_params(
            make_url(f"{driver}://localhost/db?ssl=1"), {}
        )
