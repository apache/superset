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

from superset.utils import json
from superset.utils.core import GenericDataType
from tests.conftest import with_config
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Text", "'2019-01-02 03:04:05.678900'"),
        ("DateTime", "'2019-01-02 03:04:05.678900'"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@with_config({"VERSION_STRING": "1.0.0"})
def test_get_extra_params(mocker: MockerFixture) -> None:
    """
    Test the ``get_extra_params`` method.
    """
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    database.extra = {}
    assert DuckDBEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {"config": {"custom_user_agent": "apache-superset/1.0.0"}}
        }
    }

    database.extra = json.dumps(
        {"engine_params": {"connect_args": {"config": {"custom_user_agent": "my-app"}}}}
    )
    assert DuckDBEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "config": {"custom_user_agent": "apache-superset/1.0.0 my-app"}
            }
        }
    }


def test_build_sqlalchemy_uri() -> None:
    """Test DuckDBEngineSpec.build_sqlalchemy_uri"""
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec, DuckDBParametersType

    # No database provided, default to :memory:
    parameters = DuckDBParametersType()
    uri = DuckDBEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///:memory:" == uri

    # Database provided
    parameters = DuckDBParametersType(database="/path/to/duck.db")
    uri = DuckDBEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:////path/to/duck.db" == uri


def test_md_build_sqlalchemy_uri() -> None:
    """Test MotherDuckEngineSpec.build_sqlalchemy_uri"""
    from superset.db_engine_specs.duckdb import (
        DuckDBParametersType,
        MotherDuckEngineSpec,
    )

    # No access token provided, throw ValueError
    parameters = DuckDBParametersType(database="my_db")
    with pytest.raises(ValueError):  # noqa: PT011
        MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)

    # No database provided, default to "md:"
    parameters = DuckDBParametersType(access_token="token")  # noqa: S106
    uri = MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///md:?motherduck_token=token"

    # Database and access_token provided
    parameters = DuckDBParametersType(database="my_db", access_token="token")  # noqa: S106
    uri = MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///md:my_db?motherduck_token=token" == uri


def test_get_parameters_from_uri() -> None:
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    uri = "duckdb:////path/to/duck.db"
    parameters = DuckDBEngineSpec.get_parameters_from_uri(uri)

    assert parameters["database"] == "/path/to/duck.db"

    uri = "duckdb:///md:my_db?motherduck_token=token"
    parameters = DuckDBEngineSpec.get_parameters_from_uri(uri)

    assert parameters["database"] == "md:my_db"
    assert parameters["access_token"] == "token"  # noqa: S105


def test_column_type_recognition() -> None:
    """Test that DuckDB column types are properly recognized as numeric."""
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    # Test standard float/double types
    numeric_types = [
        "FLOAT",
        "DOUBLE",
        "DOUBLE PRECISION",
        "REAL",
        "DECIMAL(10,2)",
        "NUMERIC(10,2)",
        "INTEGER",
        "BIGINT",
        "SMALLINT",
        "TINYINT",
        # DuckDB-specific unsigned types
        "HUGEINT",
        "UBIGINT",
        "UINTEGER",
        "USMALLINT",
        "UTINYINT",
    ]

    for type_str in numeric_types:
        col_spec = DuckDBEngineSpec.get_column_spec(type_str)
        assert col_spec is not None, f"Type {type_str} should be recognized"
        assert col_spec.generic_type == GenericDataType.NUMERIC, (
            f"Type {type_str} should be recognized as NUMERIC, "
            f"got {col_spec.generic_type}"
        )


def test_motherduck_impersonation(mocker: MockerFixture) -> None:
    """
    Test ``impersonate_user`` embeds the username in the md: path.

    The hook lives on DuckDBEngineSpec because engine spec resolution is by
    backend name, so md: databases resolve to the DuckDB spec.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="md:my_db", query={"motherduck_token": "abc"})
    url, engine_kwargs = DuckDBEngineSpec.impersonate_user(
        database=database,
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url.database == "md:my_db?session_name=alice"
    assert url.username is None
    assert url.query["motherduck_token"] == "abc"  # noqa: S105
    assert engine_kwargs == {}


def test_duckdb_local_impersonation_is_a_noop(mocker: MockerFixture) -> None:
    """
    Test ``impersonate_user`` leaves local DuckDB URLs alone.

    The base implementation puts the username in the URL, which duckdb-engine
    forwards as a ``connect()`` kwarg that duckdb rejects.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="/path/to/duck.db")
    url, _ = DuckDBEngineSpec.impersonate_user(
        database=database,
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url == URL.create("duckdb", database="/path/to/duck.db")


def test_duckdb_impersonation_drops_configured_username(
    mocker: MockerFixture,
) -> None:
    """
    Test ``impersonate_user`` drops a username configured in the URI.

    duckdb-engine forwards it as a ``connect()`` kwarg that duckdb rejects.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    for db in ["md:my_db", "/path/to/duck.db"]:
        url, _ = DuckDBEngineSpec.impersonate_user(
            database=database,
            username="alice",
            user_token=None,
            url=URL.create("duckdb", username="configured", database=db),
            engine_kwargs={},
        )
        assert url.username is None


def test_motherduck_impersonation_escapes_structural_characters(
    mocker: MockerFixture,
) -> None:
    """
    Test ``impersonate_user`` escapes characters that would inject parameters.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import MotherDuckEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="md:my_db?attach_mode=single")
    url, _ = MotherDuckEngineSpec.impersonate_user(  # inherited from DuckDBEngineSpec
        database=database,
        username="a&host=evil",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url.database == "md:my_db?attach_mode=single&session_name=a%26host%3Devil"


def test_motherduck_impersonation_replaces_configured_session_name(
    mocker: MockerFixture,
) -> None:
    """
    Test ``impersonate_user`` replaces a session_name configured in the path.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import MotherDuckEngineSpec

    database = mocker.MagicMock()

    url = URL.create(
        "duckdb", database="md:my_db?session_name=fixed&attach_mode=single"
    )
    url, _ = MotherDuckEngineSpec.impersonate_user(
        database=database,
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url.database == "md:my_db?attach_mode=single&session_name=alice"


def test_motherduck_impersonation_without_username(mocker: MockerFixture) -> None:
    """
    Test ``impersonate_user`` leaves the URL alone when there is no username.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import MotherDuckEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="md:my_db")
    url, _ = MotherDuckEngineSpec.impersonate_user(
        database=database,
        username=None,
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url == URL.create("duckdb", database="md:my_db")


def test_fetch_data_preserves_cursor_description(mocker: MockerFixture) -> None:
    """
    DuckDBEngineSpec previously overrode fetch_data to capture and restore
    cursor.description around fetchall(), working around a duckdb-engine bug
    that no longer reproduces at current pinned versions (duckdb-engine
    0.17.0, duckdb 1.5.5 and 2.0.0). Confirm the inherited base fetch_data still works
    correctly against a real cursor now that the override is gone.
    """
    from sqlalchemy import create_engine

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    engine = create_engine("duckdb:///:memory:")
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        database = mocker.MagicMock()
        DuckDBEngineSpec.execute(cursor, "SELECT 1 AS col1, 2 AS col2", database)

        data = DuckDBEngineSpec.fetch_data(cursor)

        assert data == [(1, 2)]
        assert cursor.description is not None
        assert [col[0] for col in cursor.description] == ["col1", "col2"]
    finally:
        raw_conn.close()


def test_extended_aggregation_func_median_stddev_var_compiles() -> None:
    """
    MEDIAN/STDDEV_SAMP/VAR_SAMP compile to the expected DuckDB SQL function
    calls. See `test_extended_aggregation_func_median_stddev_var_executes`
    for verification against a live in-process DuckDB instance.
    """
    from sqlalchemy import column

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    col = column("sales")

    for aggregate, expected_sql in [
        ("MEDIAN", "median(sales)"),
        ("STDDEV_SAMP", "stddev_samp(sales)"),
        ("VAR_SAMP", "var_samp(sales)"),
    ]:
        func = DuckDBEngineSpec.get_extended_aggregation_func(aggregate)
        assert func is not None
        compiled = str(func(col).compile(compile_kwargs={"literal_binds": True}))
        assert compiled == expected_sql


def test_extended_aggregation_func_median_stddev_var_executes() -> None:
    """
    MEDIAN/STDDEV_SAMP/VAR_SAMP execute against a live in-process DuckDB
    instance and return values matching Python's `statistics` module
    (sample standard deviation/variance) for the same input.
    """
    import statistics

    from sqlalchemy import create_engine, literal_column, select, text

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    values = [1.0, 2.0, 4.0, 8.0, 16.0]

    engine = create_engine("duckdb:///:memory:")
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE t (sales DOUBLE)"))
        conn.execute(
            text("INSERT INTO t VALUES (:sales)"),
            [{"sales": v} for v in values],
        )

        expected = {
            "MEDIAN": statistics.median(values),
            "STDDEV_SAMP": statistics.stdev(values),
            "VAR_SAMP": statistics.variance(values),
        }

        for aggregate, expected_value in expected.items():
            func = DuckDBEngineSpec.get_extended_aggregation_func(aggregate)
            assert func is not None
            query = select(func(literal_column("sales"))).select_from(text("t"))
            result = conn.execute(query).scalar()
            assert result == pytest.approx(expected_value)


def test_live_reflection_and_types_roundtrip() -> None:
    """
    Compatibility check against the installed DuckDB (1.x or 2.x): schema,
    table and column reflection, plus date/time, decimal and null values
    round-tripping through a time grain and a ``convert_dttm`` filter.
    """
    from decimal import Decimal

    from sqlalchemy import create_engine, inspect, text

    from superset.constants import TimeGrain
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    engine = create_engine("duckdb:///:memory:")
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA s"))
        conn.execute(
            text(
                "CREATE TABLE s.t (ts TIMESTAMP, d DATE, amt DECIMAL(10, 2), "
                "name VARCHAR)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO s.t VALUES "
                "('2024-03-15 10:30:00', '2024-03-15', 12.34, 'a'), "
                "(NULL, NULL, NULL, NULL)"
            )
        )

        inspector = inspect(conn)
        assert "memory.s" in inspector.get_schema_names()
        assert inspector.get_table_names(schema="s") == ["t"]
        columns = {
            col["name"]: str(col["type"])
            for col in inspector.get_columns("t", schema="s")
        }
        assert columns == {
            "ts": "TIMESTAMP",
            "d": "DATE",
            "amt": "NUMERIC(10, 2)",
            "name": "VARCHAR",
        }

        month = DuckDBEngineSpec._time_grain_expressions[TimeGrain.MONTH]
        rows = conn.execute(
            text(f"SELECT {month.format(col='ts')}, d, amt, name FROM s.t")  # noqa: S608
        ).fetchall()
        assert rows == [
            (datetime(2024, 3, 1), datetime(2024, 3, 15).date(), Decimal("12.34"), "a"),
            (None, None, None, None),
        ]

        literal = DuckDBEngineSpec.convert_dttm("TIMESTAMP", datetime(2024, 3, 1))
        count = conn.execute(
            text(f"SELECT COUNT(*) FROM s.t WHERE ts >= {literal}")  # noqa: S608
        ).scalar()
        assert count == 1


def test_fetch_arrow_from_a_duckdb_engine_cursor() -> None:
    import pyarrow as pa
    from sqlalchemy import create_engine

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    assert DuckDBEngineSpec.supports_arrow_result is True
    connection = create_engine("duckdb:///:memory:").raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT range AS id, range * 1.5 AS x FROM range(5)")
        table = DuckDBEngineSpec.fetch_arrow(cursor, limit=3)
        assert isinstance(table, pa.Table)
        assert table.column_names == ["id", "x"]
        assert table.column("id").to_pylist() == [0, 1, 2]
    finally:
        connection.close()


DUCKDB_PARITY_SQL = [
    "SELECT INTERVAL 1 MONTH + INTERVAL 2 DAY + INTERVAL 3 HOUR AS v",
    "SELECT -INTERVAL 90 MINUTE AS v",
    "SELECT 170141183460469231731687303715884105727::HUGEINT AS v",
    "SELECT 12::HUGEINT AS v",
    "SELECT 5::UHUGEINT AS v",
    "SELECT * FROM (VALUES (1::HUGEINT), (NULL)) AS t(v)",
    "SELECT 18446744073709551615::UBIGINT AS v",
    "SELECT 1.50::DECIMAL(10, 2) AS v",
    "SELECT 'a'::ENUM('a', 'b') AS v",
    "SELECT '00000000-0000-0000-0000-000000000001'::UUID AS v",
    "SELECT TIME '01:02:03' AS v",
    "SELECT TIMESTAMPTZ '2024-01-01 00:00:00+00' AS v",
    "SELECT DATE '2024-02-29' AS v",
    "SELECT [1, NULL, 3] AS v",
    "SELECT {'k': 1} AS v",
    "SELECT '{\"a\": 1}'::JSON AS v",
    "SELECT 'nan'::DOUBLE AS v",
]


@pytest.mark.parametrize("sql", DUCKDB_PARITY_SQL)
def test_duckdb_arrow_result_matches_the_row_path(sql: str) -> None:
    from sqlalchemy import create_engine

    from superset.dataframe import df_to_records
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec
    from superset.result_set import SupersetResultSet

    connection = create_engine("duckdb:///:memory:").raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SET TimeZone = 'UTC'")
        cursor.execute(sql)
        rows = SupersetResultSet(
            DuckDBEngineSpec.fetch_data(cursor), cursor.description, DuckDBEngineSpec
        )
        cursor.execute(sql)
        table = DuckDBEngineSpec.fetch_arrow(cursor)
        assert table is not None
        arrow = SupersetResultSet.from_arrow(table, DuckDBEngineSpec)
    finally:
        connection.close()

    def comparable(result: SupersetResultSet) -> str:
        return json.dumps(
            df_to_records(result.to_pandas_df()),
            default=json.json_iso_dttm_ser,
            ignore_nan=True,
        )

    assert comparable(arrow) == comparable(rows)
    for key in ("type", "type_generic", "is_dttm"):
        assert arrow.columns[0][key] == rows.columns[0][key], key


def test_duckdb_decimal_38_0_is_a_pinned_difference() -> None:
    """DuckDB exports HUGEINT as decimal128(38, 0), so DECIMAL(38, 0) reads as int."""
    from sqlalchemy import create_engine

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec
    from superset.result_set import SupersetResultSet

    connection = create_engine("duckdb:///:memory:").raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT 12::DECIMAL(38, 0) AS v")
        table = DuckDBEngineSpec.fetch_arrow(cursor)
    finally:
        connection.close()
    assert table is not None
    arrow = SupersetResultSet.from_arrow(table, DuckDBEngineSpec)
    assert arrow.pa_table.column("v").to_pylist() == [12]
    assert arrow.columns[0]["type_generic"] == GenericDataType.NUMERIC


def test_duckdb_reader_batches_are_capped_by_the_limit() -> None:
    import pyarrow as pa

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    class _Cursor:
        description = [("a", "int")]
        batch_size: int | None = None

        def to_arrow_reader(self, batch_size: int = 1_000_000) -> pa.RecordBatchReader:
            self.batch_size = batch_size
            table = pa.table({"a": pa.array(range(10))})
            return pa.RecordBatchReader.from_batches(
                table.schema, table.to_batches(max_chunksize=batch_size)
            )

    cursor = _Cursor()
    table = DuckDBEngineSpec.fetch_arrow(cursor, limit=3)
    assert table is not None
    assert table.num_rows == 3
    assert cursor.batch_size == 3
