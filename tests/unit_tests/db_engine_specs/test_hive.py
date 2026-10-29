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
from typing import Optional

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import make_url

from superset.constants import TimeGrain
from superset.sql.parse import Table
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        (
            "TimeStamp",
            "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.hive import HiveEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    ("grain", "expected_expression"),
    [
        (
            TimeGrain.WEEK,
            "date_format(date_sub(my_col, "
            "CAST(from_unixtime(unix_timestamp(my_col),'u') as int)-1), "
            "'yyyy-MM-dd 00:00:00')",
        ),
    ],
)
def test_time_grain_expressions(grain: TimeGrain, expected_expression: str) -> None:
    """
    Test that time grain expressions generate the expected SQL.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    actual = HiveEngineSpec._time_grain_expressions[grain].format(col="my_col")
    assert actual == expected_expression


def test_week_time_grain_buckets_to_monday() -> None:
    """
    Evaluate the Hive ``WEEK`` grain expression and check that every day of a
    week maps to that week's Monday.

    The expression runs on SQLite with Python stand-ins for the Hive functions
    it uses, following Hive's semantics (``'u'`` is the ISO day of week).
    """
    import sqlite3
    from datetime import date, timedelta, timezone

    from superset.db_engine_specs.hive import HiveEngineSpec

    def unix_timestamp(value: str) -> int:
        day = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        return int(day.timestamp())

    def from_unixtime(seconds: int, fmt: str) -> str:
        # Assumes Java SimpleDateFormat semantics for ``'u'`` (ISO day of week,
        # Monday=1 ... Sunday=7), as used by Hive 2.x/3.x ``from_unixtime``.
        # Hive versions that format ``'u'`` differently are not covered here.
        assert fmt == "u"
        return str(datetime.fromtimestamp(seconds, timezone.utc).isoweekday())

    def date_sub(value: str, days: int) -> str:
        return (date.fromisoformat(value[:10]) - timedelta(days=days)).isoformat()

    def date_format(value: str, fmt: str) -> str:
        day = date.fromisoformat(value[:10])
        return (
            fmt.replace("yyyy", f"{day.year:04d}")
            .replace("MM", f"{day.month:02d}")
            .replace("dd", f"{day.day:02d}")
        )

    connection = sqlite3.connect(":memory:")
    connection.create_function("unix_timestamp", 1, unix_timestamp)
    connection.create_function("from_unixtime", 2, from_unixtime)
    connection.create_function("date_sub", 2, date_sub)
    connection.create_function("date_format", 2, date_format)

    expression = HiveEngineSpec._time_grain_expressions[TimeGrain.WEEK].format(col="d")
    monday = date(2025, 1, 6)
    for offset in range(14):
        day = monday + timedelta(days=offset)
        (bucket,) = connection.execute(
            f"SELECT {expression} FROM (SELECT ? AS d)",  # noqa: S608
            (day.isoformat(),),
        ).fetchone()
        expected = monday + timedelta(days=(offset // 7) * 7)
        assert bucket == f"{expected.isoformat()} 00:00:00", day


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    assert (
        HiveEngineSpec.get_schema_from_engine_params(
            make_url("hive://localhost:10000/default"), {}
        )
        == "default"
    )


@pytest.mark.parametrize(
    "catalog,schema",
    [
        (None, None),
        (None, "new_schema"),
        ("catalog", None),
        ("catalog", "new_schema"),
    ],
)
def test_adjust_engine_params(catalog: Optional[str], schema: Optional[str]) -> None:
    """
    Test that ``adjust_engine_params`` leaves the URI untouched.

    The URI database must not be rewritten to the selected schema: PyHive runs
    ``USE`` on it at connect time, and on Spark Thrift Server it can select a
    catalog, so overwriting it with the schema breaks table resolution (see
    issue #30208). Schema selection happens via ``get_prequeries`` instead.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    uri = make_url("hive://localhost:10000/default")
    connect_args = {"foo": "bar"}

    adjusted_uri, adjusted_connect_args = HiveEngineSpec.adjust_engine_params(
        uri,
        connect_args,
        catalog=catalog,
        schema=schema,
    )
    assert adjusted_uri is uri
    assert adjusted_connect_args is connect_args
    assert connect_args == {"foo": "bar"}


@pytest.mark.parametrize(
    "catalog,schema,expected",
    [
        (None, None, []),
        ("catalog", None, []),
        (None, "new_schema", ["USE `new_schema`"]),
        ("catalog", "new_schema", ["USE `new_schema`"]),
        (None, "evil`schema", ["USE `evil``schema`"]),
    ],
)
def test_get_prequeries(
    mocker: MockerFixture,
    catalog: Optional[str],
    schema: Optional[str],
    expected: list[str],
) -> None:
    """
    Test that ``get_prequeries`` selects the schema with a ``USE`` statement.

    Together with ``supports_dynamic_schema`` this implements per-query schema
    selection, so unqualified table names resolve in the schema Superset
    attributes the query to.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    assert HiveEngineSpec.supports_dynamic_schema

    database = mocker.MagicMock()
    assert (
        HiveEngineSpec.get_prequeries(database, catalog=catalog, schema=schema)
        == expected
    )


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    database = mocker.MagicMock()
    dialect = mocker.MagicMock()

    def quote_table(table: Table, dialect: Dialect) -> str:
        return ".".join(
            part for part in (table.catalog, table.schema, table.table) if part
        )

    mocker.patch.object(HiveEngineSpec, "quote_table", quote_table)

    HiveEngineSpec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        dialect=dialect,
        limit=100,
        show_cols=False,
        indent=True,
        latest_partition=False,
        cols=None,
    )

    query = database.compile_sqla_query.mock_calls[0][1][0]
    assert (
        str(query)
        == """
SELECT * \nFROM my_schema.my_table
 LIMIT :param_1
    """.strip()
    )


def test_get_view_names_escapes_schema(mocker: MockerFixture) -> None:
    """
    Test that ``get_view_names`` correctly escapes backticks in schema names
    within the SHOW VIEWS statement.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec

    database = mocker.MagicMock()
    inspector = mocker.MagicMock()

    conn = mocker.MagicMock()
    cursor = mocker.MagicMock()
    cursor.fetchall.return_value = []
    conn.__enter__ = mocker.MagicMock(return_value=conn)
    conn.__exit__ = mocker.MagicMock(return_value=False)
    conn.cursor.return_value = cursor
    database.get_raw_connection.return_value = conn

    HiveEngineSpec.get_view_names(database, inspector, schema="evil` UNION SELECT 1--")
    cursor.execute.assert_called_once()
    sql = cursor.execute.call_args[0][0]
    assert "IN `evil`` UNION SELECT 1--`" in sql


def test_df_to_sql_escapes_like_wildcards(mocker: MockerFixture) -> None:
    """
    Test that ``df_to_sql`` escapes ``%`` and ``_`` wildcard characters in the
    SHOW TABLES LIKE pattern used to detect table existence.
    """
    import pandas as pd

    from superset.db_engine_specs.hive import HiveEngineSpec
    from superset.exceptions import SupersetException
    from superset.sql.parse import Table

    database = mocker.MagicMock()
    # Simulate an existing table so df_to_sql raises before reaching the upload path
    database.get_df.return_value = pd.DataFrame({"name": ["sales_%_2024"]})

    with pytest.raises(SupersetException, match="Table already exists"):
        HiveEngineSpec.df_to_sql(
            database=database,
            table=Table("sales_%_2024", "my_schema"),
            df=pd.DataFrame({"a": [1]}),
            to_sql_kwargs={"if_exists": "fail"},
        )

    database.get_df.assert_called_once()
    sql = database.get_df.call_args[0][0]
    assert r"\%" in sql
    assert r"\_" in sql
    assert "ESCAPE" in sql


def test_partition_query_escapes_identifiers() -> None:
    """
    Test that ``_partition_query`` correctly backtick-quotes table and schema names
    in the SHOW PARTITIONS statement.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec
    from superset.sql.parse import Table

    result = HiveEngineSpec._partition_query(
        table=Table("my_table", "my_schema"),
        indexes=[],
        database=None,  # type: ignore
    )
    assert result == "SHOW PARTITIONS `my_schema`.`my_table`"

    result = HiveEngineSpec._partition_query(
        table=Table("evil`tbl", "evil`schema"),
        indexes=[],
        database=None,  # type: ignore
    )
    assert result == "SHOW PARTITIONS `evil``schema`.`evil``tbl`"

    result = HiveEngineSpec._partition_query(
        table=Table("no_schema_tbl"),
        indexes=[],
        database=None,  # type: ignore
    )
    assert result == "SHOW PARTITIONS `no_schema_tbl`"


def test_identifier_quote_uses_backticks() -> None:
    """HiveQL/Spark SQL quote identifiers with backticks, not ANSI double
    quotes, unlike the PrestoEngineSpec parent class it otherwise reuses."""
    from superset.db_engine_specs.hive import HiveEngineSpec

    assert HiveEngineSpec.get_public_information()["identifier_quote"] == {
        "start": "`",
        "end": "`",
        "escape_by_doubling": True,
    }


def test_spark_identifier_quote_uses_backticks() -> None:
    """SparkEngineSpec inherits the backtick quoting from HiveEngineSpec."""
    from superset.db_engine_specs.spark import SparkEngineSpec

    assert SparkEngineSpec.get_public_information()["identifier_quote"] == {
        "start": "`",
        "end": "`",
        "escape_by_doubling": True,
    }


def test_the_partition_transform_default_is_hive_syntax() -> None:
    """
    `unix_timestamp(:value)` only belongs on engines where it parses. The
    one-argument form takes the bound being mirrored; the zero-argument form
    means "now" on Hive and is rejected at save time.
    """
    from superset.db_engine_specs.hive import HiveEngineSpec
    from superset.db_engine_specs.spark import SparkEngineSpec

    assert HiveEngineSpec.partition_value_transform_default == "unix_timestamp(:value)"
    # Spark SQL inherits from Hive and shares the syntax.
    assert SparkEngineSpec.partition_value_transform_default == "unix_timestamp(:value)"


def test_the_partition_transform_default_is_not_inherited_by_presto() -> None:
    """
    HiveEngineSpec extends PrestoEngineSpec, so pin that the default did not
    travel up: Presto has no `unix_timestamp`.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.partition_value_transform_default is None
