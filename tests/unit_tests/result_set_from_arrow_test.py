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
"""SupersetResultSet.from_arrow compared with the existing row constructor."""

import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

import pyarrow as pa
import pytest
from pytest_mock import MockerFixture

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.duckdb import DuckDBEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.result_set import SupersetResultSet
from superset.superset_typing import DbapiDescription
from superset.utils import json

_BIG = 2**64 - 1


def _desc(*columns: tuple[Any, ...]) -> DbapiDescription:
    """A short cursor description; the row constructor reads name and type."""
    return cast(DbapiDescription, list(columns))


def _same(left: list[Any], right: list[Any]) -> None:
    assert len(left) == len(right)
    for got, expected in zip(left, right, strict=True):
        if isinstance(got, float) and isinstance(expected, float):
            if math.isnan(got) and math.isnan(expected):
                continue
        assert got == expected


def _assert_matches_row(
    type_code: str,
    values: list[Any],
    arrow_column: pa.Array | list[Any] | None = None,
    spec: type[BaseEngineSpec] = BaseEngineSpec,
    *,
    compare_generic: bool = True,
) -> None:
    """from_arrow output equals the row constructor for one column."""
    column = values if arrow_column is None else arrow_column
    row_rs = SupersetResultSet(
        [(value,) for value in values], _desc(("c", type_code)), spec
    )
    arrow_rs = SupersetResultSet.from_arrow(pa.table({"c": column}), spec)
    _same(
        arrow_rs.pa_table.column("c").to_pylist(),
        row_rs.pa_table.column("c").to_pylist(),
    )
    # Decimals are not named by convert_pa_dtype. Without driver metadata the
    # row path also leaves the generic type empty when the cursor type does
    # not map, so a cursor type string of "numeric" is not copied onto the
    # Arrow side. Compare values only in that case.
    if compare_generic:
        assert arrow_rs.columns[0]["type_generic"] == row_rs.columns[0]["type_generic"]
        assert bool(arrow_rs.columns[0]["is_dttm"]) == bool(
            row_rs.columns[0]["is_dttm"]
        )


def test_from_arrow_accepts_a_plain_table_without_adbc() -> None:
    """The constructor takes a Table. No driver, no fetch."""
    table = pa.table({"a": pa.array([1, None, 0])})
    result = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result.pa_table.column("a").to_pylist() == [1, None, 0]
    assert BaseEngineSpec.supports_arrow_result is False


def test_timestamps_match_row_path() -> None:
    offset = timezone(timedelta(hours=5, minutes=45))
    _assert_matches_row(
        "timestamp",
        [datetime(2024, 1, 2, 3, 4, 5), None],
    )
    _assert_matches_row(
        "timestamptz",
        [datetime(2023, 1, 1, tzinfo=timezone.utc), None],
    )
    _assert_matches_row(
        "timestamptz",
        [datetime(2024, 6, 1, 12, 30, tzinfo=offset), None],
    )
    _assert_matches_row(
        "timestamp",
        [datetime(9999, 12, 31, 23, 59, 59)],
    )
    _assert_matches_row(
        "timestamptz",
        [datetime(3118, 1, 1, tzinfo=timezone.utc)],
    )


@pytest.mark.parametrize("zone", ["UTC", "Asia/Tbilisi", "America/New_York"])
def test_duckdb_session_timezone_matches_row_path(zone: str) -> None:
    """Both paths annotate TIMESTAMPTZ with the DuckDB session TimeZone."""
    duckdb = pytest.importorskip("duckdb")
    sql = (
        "SELECT TIMESTAMP '2024-03-31 01:30:00.123456' AS ts, "
        "TIMESTAMPTZ '2024-10-27 05:30:00+00' AS ts_tz"
    )
    cursor = duckdb.connect().cursor()
    cursor.execute(f"SET TimeZone='{zone}'")
    cursor.execute(sql)
    row_rs = SupersetResultSet(cursor.fetchall(), cursor.description, DuckDBEngineSpec)
    cursor.execute(sql)
    arrow_rs = SupersetResultSet.from_arrow(
        DuckDBEngineSpec.fetch_arrow(cursor), DuckDBEngineSpec
    )
    assert arrow_rs.pa_table.schema == row_rs.pa_table.schema
    assert str(arrow_rs.pa_table.schema.field("ts_tz").type) == (
        f"timestamp[us, tz={zone}]"
    )
    assert arrow_rs.pa_table.to_pylist() == row_rs.pa_table.to_pylist()
    assert arrow_rs.to_pandas_df().equals(row_rs.to_pandas_df())


def test_dates_bools_blobs_and_nulls_match_row_path() -> None:
    _assert_matches_row("date", [date(2020, 1, 2), None])
    _assert_matches_row("bool", [True, False, None])
    _assert_matches_row("bytea", [b"abc", None, b""])
    _assert_matches_row("int", [1, None, 0, -3])
    # An untyped all-null array is Arrow's null type. The row path still has
    # the cursor type. Pass an int64 array so both sides report a numeric type.
    _assert_matches_row("int", [None, None], pa.array([None, None], type=pa.int64()))


def test_finite_decimals_match_row_path() -> None:
    _assert_matches_row(
        "numeric",
        [Decimal("1.50"), Decimal("-0.0001"), None],
        compare_generic=False,
    )
    wide = Decimal("123456789012345678901234567890.123456789")
    _assert_matches_row("numeric", [wide, None], compare_generic=False)


def test_non_finite_floats_match_row_path() -> None:
    _assert_matches_row(
        "float8",
        [float("nan"), float("inf"), float("-inf"), 1.5, 0.0, None],
    )


def test_uint64_above_int64_matches_row_stringification() -> None:
    """BIGINT UNSIGNED above 2**63-1 is stringified on the row path."""
    values = [1, _BIG, 0, None]
    _assert_matches_row(
        "int",
        values,
        pa.array(values, type=pa.uint64()),
    )


def test_uint64_that_fits_int64_keeps_values() -> None:
    values = [1, 2, None]
    arrow_rs = SupersetResultSet.from_arrow(
        pa.table({"c": pa.array(values, type=pa.uint64())}),
        BaseEngineSpec,
    )
    row_rs = SupersetResultSet(
        [(value,) for value in values], _desc(("c", "int")), BaseEngineSpec
    )
    _same(
        arrow_rs.pa_table.column("c").to_pylist(),
        row_rs.pa_table.column("c").to_pylist(),
    )
    # Width stays uint64. The row path infers int64. Same known difference
    # as an int32 column, and values are equal.
    assert pa.types.is_uint64(arrow_rs.pa_table.schema.field("c").type)


def test_integers_inside_int64_are_not_stringified() -> None:
    """2**53+1 fits in int64. The row path does not stringify it."""
    value = 2**53 + 1
    _assert_matches_row("int", [value, -value, None])
    result = SupersetResultSet.from_arrow(
        pa.table({"c": pa.array([value, -value, None])}),
        BaseEngineSpec,
    )
    assert pa.types.is_integer(result.pa_table.schema.field("c").type)


def test_from_arrow_names_match_row_path() -> None:
    table = pa.table(
        [pa.array([1]), pa.array([2]), pa.array([3])], names=["a", "a", ""]
    )
    arrow_rs = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    row_rs = SupersetResultSet(
        [(1, 2, 3)], _desc(("a",), ("a",), ("",)), BaseEngineSpec
    )
    assert arrow_rs.pa_table.column_names == row_rs.pa_table.column_names


def test_nested_list_and_struct_match_row_path() -> None:
    table = pa.table({"l": pa.array([[1, 2], None]), "s": pa.array([{"a": 1}, None])})
    arrow_rs = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    row_rs = SupersetResultSet(
        [([1, 2], {"a": 1}), (None, None)],
        _desc(("l",), ("s",)),
        BaseEngineSpec,
    )
    _same(
        arrow_rs.pa_table.column("l").to_pylist(),
        row_rs.pa_table.column("l").to_pylist(),
    )
    _same(
        arrow_rs.pa_table.column("s").to_pylist(),
        row_rs.pa_table.column("s").to_pylist(),
    )
    assert arrow_rs.nested_columns == row_rs.nested_columns


def test_from_arrow_decodes_dictionary() -> None:
    table = pa.table({"c": pa.array(["x", "y", "x"]).dictionary_encode()})
    result_set = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result_set.pa_table.schema.field("c").type == pa.string()
    assert result_set.pa_table.column("c").to_pylist() == ["x", "y", "x"]


def test_opaque_numeric_nulls_non_finite_and_keeps_decimal() -> None:
    opaque = pa.opaque(pa.string(), "numeric", "PostgreSQL")
    storage = pa.array(["1.50", "NaN", None, "-0.0001", "Infinity"])
    table = pa.table({"n": pa.ExtensionArray.from_storage(opaque, storage)})
    result_set = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result_set.pa_table.column("n").to_pylist() == [
        Decimal("1.5000"),
        None,
        None,
        Decimal("-0.0001"),
        None,
    ]


def test_json_extension_is_lazy() -> None:
    storage = pa.array(['{"a": 1}', None, "5"])
    table = pa.table({"j": pa.ExtensionArray.from_storage(pa.json_(), storage)})
    result_set = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result_set.pa_table.column("j").to_pylist() == ['{"a": 1}', None, "5"]
    assert result_set.to_pandas_df()["j"].tolist() == [{"a": 1}, None, 5]


@pytest.mark.parametrize(
    "values",
    [[5, 7, None], ["a", "b"], [5, "a", True], [1.5, 2.25]],
)
def test_scalar_json_matches_the_row_path(values: list[Any]) -> None:
    rows = SupersetResultSet(
        [(value,) for value in values],
        _desc(("j", "json")),
        BaseEngineSpec,
    )
    storage = pa.array(
        [None if value is None else json.dumps(value) for value in values]
    )
    table = pa.table({"j": pa.ExtensionArray.from_storage(pa.json_(), storage)})
    arrow = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    expected = rows.to_pandas_df()["j"].tolist()
    assert arrow.to_pandas_df()["j"].tolist() == expected
    assert arrow.pa_table.column("j").type == rows.pa_table.column("j").type
    assert arrow.nested_columns == {}


def test_uuid_extension_is_stringified() -> None:
    value = UUID("c4ca4238-a0b9-2382-0dcc-509a6f75849b")
    table = pa.table({"u": pa.array([value, None], type=pa.uuid())})
    result_set = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result_set.pa_table.column("u").to_pylist() == [str(value), None]


def test_duration_is_not_rewritten_like_the_postgres_interval_mutator() -> None:
    """
    The Postgres mutator is not the default. ``BaseEngineSpec`` leaves a
    duration column as a duration. ``PostgresEngineSpec`` is tested separately.
    """
    table = pa.table({"iv": pa.array([1_000_000], type=pa.duration("us"))})
    arrow_rs = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    row_rs = SupersetResultSet([(1000.0,)], _desc(("iv", "interval")), BaseEngineSpec)
    assert pa.types.is_duration(arrow_rs.pa_table.schema.field("iv").type)
    assert row_rs.pa_table.column("iv").to_pylist() == [1000.0]
    assert (
        arrow_rs.pa_table.column("iv").to_pylist()
        != row_rs.pa_table.column("iv").to_pylist()
    )


def test_postgres_interval_matches_the_fetch_data_mutator() -> None:
    """
    ``1 day 02:03:04`` is 93784000.0 ms on the row path. A year is 365 days
    and a month is 30, which is how psycopg2 builds the timedelta
    ``fetch_data`` mutates. DuckDB does not get that rewrite.
    """
    from superset.db_engine_specs.postgres import _normalize_interval

    nanos = (2 * 3600 + 3 * 60 + 4) * 1_000_000_000
    values = [(0, 1, nanos), (14, 3, 0), (-14, 0, -1_000_000_000), None]
    array = pa.array(values, type=pa.month_day_nano_interval())
    field = pa.field(
        "iv",
        pa.month_day_nano_interval(),
        metadata={b"POSTGRESQL:type": b"interval"},
    )
    table = pa.Table.from_arrays([array], schema=pa.schema([field]))
    arrow_rs = SupersetResultSet.from_arrow(table, PostgresEngineSpec)
    expected = [
        93784000.0,
        _normalize_interval(timedelta(days=365 + 30 * 2 + 3)),
        _normalize_interval(timedelta(days=-(365 + 30 * 2), microseconds=-1_000_000)),
        None,
    ]
    assert arrow_rs.pa_table.column("iv").to_pylist() == expected
    assert arrow_rs.columns[0]["type"] == PostgresEngineSpec.get_datatype(1186)
    row_rs = SupersetResultSet(
        [(value,) for value in expected],
        _desc(("iv", arrow_rs.columns[0]["type"])),
        PostgresEngineSpec,
    )
    assert (
        arrow_rs.pa_table.column("iv").to_pylist()
        == row_rs.pa_table.column("iv").to_pylist()
    )

    duration = pa.table({"iv": pa.array([1_000_000, None], type=pa.duration("us"))})
    duration_rs = SupersetResultSet.from_arrow(duration, PostgresEngineSpec)
    assert duration_rs.pa_table.column("iv").to_pylist() == [1000.0, None]

    duck = SupersetResultSet.from_arrow(
        pa.table({"iv": pa.array([(0, 1, 0)], type=pa.month_day_nano_interval())}),
        DuckDBEngineSpec,
    )
    assert pa.types.is_interval(duck.pa_table.schema.field("iv").type)


def test_empty_table_keeps_column_names() -> None:
    table = pa.table({"a": pa.array([], type=pa.int64())})
    result_set = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result_set.size == 0
    assert [column["column_name"] for column in result_set.columns] == ["a"]


def test_engine_opt_in_is_per_spec_and_defaults_off() -> None:
    assert BaseEngineSpec.supports_arrow_result is False
    assert DuckDBEngineSpec.supports_arrow_result is True
    assert PostgresEngineSpec.supports_arrow_result is True

    class _Cursor:
        description = [("a", "int")]

        def fetch_record_batch(self) -> pa.Table:
            return pa.table({"a": [1, 2, 3]})

    assert BaseEngineSpec.fetch_arrow(_Cursor()) is None
    assert DuckDBEngineSpec.fetch_arrow(_Cursor()).num_rows == 3


def test_fetch_arrow_accepts_table_without_record_batches() -> None:
    """DuckDB-style cursor: a Table, no ADBC ``fetch_record_batch``."""

    class _Cursor:
        description = [("a", pa.int64())]

        def to_arrow_table(self) -> pa.Table:
            return pa.table({"a": pa.array([1, 2, 3, 4, 5])})

    table = DuckDBEngineSpec.fetch_arrow(_Cursor())
    assert table is not None
    assert table.column("a").to_pylist() == [1, 2, 3, 4, 5]


def test_fetch_arrow_limit_without_reader_falls_back_to_rows() -> None:
    """A table-only fetch would materialize every row, so ``limit`` skips it."""

    class _Cursor:
        description = [("a", pa.int64())]
        arrow_reads = 0

        def to_arrow_table(self) -> pa.Table:
            self.arrow_reads += 1
            return pa.table({"a": pa.array([1, 2, 3, 4, 5])})

    cursor = _Cursor()
    assert DuckDBEngineSpec.fetch_arrow(cursor, limit=2) is None
    assert cursor.arrow_reads == 0


def test_fetch_arrow_limit_on_record_batches() -> None:
    batches = [
        pa.record_batch({"a": pa.array(range(i * 10, i * 10 + 10))}) for i in range(5)
    ]

    class _Reader:
        schema = batches[0].schema

        def __iter__(self) -> Any:
            return iter(batches)

        def read_all(self) -> pa.Table:
            return pa.Table.from_batches(batches)

    class _Cursor:
        description = [("a", pa.int64())]

        def fetch_record_batch(self) -> _Reader:
            return _Reader()

    limited = DuckDBEngineSpec.fetch_arrow(_Cursor(), limit=25)
    assert limited is not None
    assert limited.num_rows == 25
    entire = DuckDBEngineSpec.fetch_arrow(_Cursor())
    assert entire is not None
    assert entire.num_rows == 50


def test_fetch_arrow_none_for_row_cursor() -> None:
    class _RowCursor:
        description = [("a", 23)]

    assert PostgresEngineSpec.fetch_arrow(_RowCursor()) is None


def test_postgres_arrow_field_type_matches_psycopg2_names() -> None:
    field = pa.field("x", pa.int64(), metadata={b"POSTGRESQL:type": b"int8"})
    assert PostgresEngineSpec.get_datatype_from_arrow_field(field) == (
        PostgresEngineSpec.get_datatype(20)
    )


def test_maybe_fetch_arrow_requires_the_feature_flag(mocker: MockerFixture) -> None:
    class _Cursor:
        description = [("a", "int")]
        consumed = False

        def fetch_record_batch(self) -> pa.Table:
            self.consumed = True
            return pa.table({"a": [1]})

    cursor = _Cursor()
    mocker.patch("superset.is_feature_enabled", return_value=False)
    assert DuckDBEngineSpec.maybe_fetch_arrow(cursor) is None
    assert cursor.consumed is False

    mocker.patch("superset.is_feature_enabled", return_value=True)
    table = DuckDBEngineSpec.maybe_fetch_arrow(cursor)
    assert table is not None
    assert table.num_rows == 1
    assert cursor.consumed is True


@pytest.mark.parametrize(
    "spec",
    [BaseEngineSpec, DuckDBEngineSpec, PostgresEngineSpec],
)
def test_row_constructor_still_builds_without_arrow(
    spec: type[BaseEngineSpec],
) -> None:
    result = SupersetResultSet(
        [(1, datetime(2024, 1, 1))],
        _desc(("n", "int"), ("ts", "timestamp")),
        spec,
    )
    assert result.size == 1
    assert result.pa_table.column("n").to_pylist() == [1]


class _Query:
    def __init__(self, limit: int | None) -> None:
        self.limit = limit
        self.limiting_factor = "QUERY"


class _ArrowCursor:
    """Cursor with both an Arrow reader and a consuming row fetch."""

    def __init__(self, values: list[int]) -> None:
        self.description = _desc(("a", "int"))
        self.values = values
        self.arrow_reads = 0
        self._rows: list[tuple[int, ...]] = [(value,) for value in values]

    def to_arrow_reader(self) -> pa.Table:
        self.arrow_reads += 1
        return pa.table({"a": pa.array(self.values, type=pa.int64())})

    def fetchmany(self, size: int | None = None) -> list[tuple[int, ...]]:
        if size is None:
            size = len(self._rows)
        batch = self._rows[:size]
        self._rows = self._rows[size:]
        return batch

    def fetchall(self) -> list[tuple[int, ...]]:
        return self.fetchmany(len(self._rows))


def _records(result: SupersetResultSet) -> list[dict[str, Any]]:
    """The JSON shape SQL Lab returns when msgpack/IPC storage is off."""
    from superset.dataframe import df_to_records

    return df_to_records(result.to_pandas_df(), convert_decimals=True) or []


def test_sqllab_uses_rows_when_the_flag_is_off(mocker: MockerFixture) -> None:
    from superset.sql_lab import _read_sqllab_payload

    cursor = _ArrowCursor([1, 2, 3])
    query: Any = _Query(limit=2)
    mocker.patch("superset.is_feature_enabled", return_value=False)
    table, rows = _read_sqllab_payload(query, cursor, DuckDBEngineSpec)
    assert table is None
    assert cursor.arrow_reads == 0
    assert rows == [(1,), (2,)]
    assert query.limiting_factor == "QUERY"

    result = SupersetResultSet(rows, cursor.description, DuckDBEngineSpec)
    assert _records(result) == [{"a": 1}, {"a": 2}]


def test_sqllab_uses_arrow_when_opted_in_and_trims_the_extra_row(
    mocker: MockerFixture,
) -> None:
    from superset.sql_lab import _read_sqllab_payload
    from superset.sqllab.limiting_factor import LimitingFactor

    cursor = _ArrowCursor([1, 2, 3])
    query: Any = _Query(limit=2)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    table, rows = _read_sqllab_payload(query, cursor, DuckDBEngineSpec)
    assert rows is None
    assert cursor.arrow_reads == 1
    assert query.limiting_factor == "QUERY"
    result = SupersetResultSet.from_arrow(table, DuckDBEngineSpec)
    assert result.pa_table.column("a").to_pylist() == [1, 2]
    assert _records(result) == [{"a": 1}, {"a": 2}]

    fitting: Any = _Query(limit=10)
    table, rows = _read_sqllab_payload(fitting, _ArrowCursor([1, 2]), DuckDBEngineSpec)
    assert rows is None
    assert fitting.limiting_factor == LimitingFactor.NOT_LIMITED
    assert table.num_rows == 2


def test_sqllab_falls_back_to_rows_without_an_arrow_cursor(
    mocker: MockerFixture,
) -> None:
    """A psycopg2-style cursor has no Arrow fetch, even on an opted-in engine."""
    from superset.sql_lab import _read_sqllab_payload

    class _RowOnly:
        def __init__(self, values: list[int]) -> None:
            self.description = _desc(("a", "int"))
            self._rows: list[tuple[int, ...]] = [(value,) for value in values]

        def fetchmany(self, size: int | None = None) -> list[tuple[int, ...]]:
            if size is None:
                size = len(self._rows)
            batch = self._rows[:size]
            self._rows = self._rows[size:]
            return batch

        def fetchall(self) -> list[tuple[int, ...]]:
            return self.fetchmany(len(self._rows))

    cursor = _RowOnly([1, 2, 3])
    query: Any = _Query(limit=2)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    table, rows = _read_sqllab_payload(query, cursor, DuckDBEngineSpec)
    assert table is None
    assert rows == [(1,), (2,)]


def test_sqllab_falls_back_when_the_engine_has_not_opted_in(
    mocker: MockerFixture,
) -> None:
    from superset.sql_lab import _read_sqllab_payload
    from superset.sqllab.limiting_factor import LimitingFactor

    cursor = _ArrowCursor([7])
    query: Any = _Query(limit=None)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    table, rows = _read_sqllab_payload(query, cursor, BaseEngineSpec)
    assert table is None
    assert cursor.arrow_reads == 0
    assert rows == [(7,)]
    assert query.limiting_factor == LimitingFactor.NOT_LIMITED


def test_executor_arrow_sets_truncated_from_the_extra_row(
    mocker: MockerFixture,
) -> None:
    from superset.sql.execution.executor import _result_set_for_statement

    mocker.patch("superset.is_feature_enabled", return_value=True)
    truncated = _result_set_for_statement(
        DuckDBEngineSpec, _ArrowCursor([1, 2, 3]), row_limit=2
    )
    assert truncated.truncated is True
    assert truncated.pa_table.column("a").to_pylist() == [1, 2]
    assert _records(truncated) == [{"a": 1}, {"a": 2}]

    exact = _result_set_for_statement(
        DuckDBEngineSpec, _ArrowCursor([1, 2]), row_limit=2
    )
    assert exact.truncated is False
    assert exact.size == 2

    unlimited = _result_set_for_statement(
        DuckDBEngineSpec, _ArrowCursor([1, 2, 3]), row_limit=None
    )
    assert unlimited.truncated is False
    assert unlimited.size == 3


def test_executor_row_fallback_still_probes_truncation(
    mocker: MockerFixture,
) -> None:
    from superset.sql.execution.executor import _result_set_for_statement

    mocker.patch("superset.is_feature_enabled", return_value=False)
    cursor = _ArrowCursor([1, 2, 3])
    result = _result_set_for_statement(DuckDBEngineSpec, cursor, row_limit=2)
    assert cursor.arrow_reads == 0
    assert result.truncated is True
    assert result.pa_table.column("a").to_pylist() == [1, 2]

    short = _result_set_for_statement(DuckDBEngineSpec, _ArrowCursor([1]), row_limit=2)
    assert short.truncated is False
    assert short.pa_table.column("a").to_pylist() == [1]
