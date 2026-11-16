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

import math
import zoneinfo
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, cast

import pandas as pd
import pyarrow as pa
import pytest
from pytest_mock import MockerFixture

from superset.db_engine_specs.base import BaseEngineSpec
from superset.result_set import SupersetResultSet
from superset.superset_typing import DbapiDescription

_BIG = 2**64 - 1


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
        [(value,) for value in values], cast(DbapiDescription, [("c", type_code)]), spec
    )
    arrow_rs = SupersetResultSet.from_arrow(pa.table({"c": column}), spec)
    _same(
        arrow_rs.pa_table.column("c").to_pylist(),
        row_rs.pa_table.column("c").to_pylist(),
    )
    # Decimals have no generic type on the Arrow side without driver metadata.
    if compare_generic:
        assert arrow_rs.columns[0]["type_generic"] == row_rs.columns[0]["type_generic"]
        assert bool(arrow_rs.columns[0]["is_dttm"]) == bool(
            row_rs.columns[0]["is_dttm"]
        )


def test_from_arrow_accepts_a_plain_table() -> None:
    table = pa.table({"a": pa.array([1, None, 0])})
    result = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result.pa_table.column("a").to_pylist() == [1, None, 0]


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


def test_dates_bools_blobs_and_nulls_match_row_path() -> None:
    _assert_matches_row("date", [date(2020, 1, 2), None])
    _assert_matches_row("bool", [True, False, None])
    _assert_matches_row("bytea", [b"abc", None, b""])
    _assert_matches_row("int", [1, None, 0, -3])
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
    # The row path's type comes from the cursor; DuckDB's is covered in test_duckdb.
    _assert_matches_row(
        "int",
        values,
        pa.array(values, type=pa.uint64()),
        compare_generic=False,
    )


def test_uint64_that_fits_int64_keeps_values() -> None:
    values = [1, 2, None]
    arrow_rs = SupersetResultSet.from_arrow(
        pa.table({"c": pa.array(values, type=pa.uint64())}),
        BaseEngineSpec,
    )
    row_rs = SupersetResultSet(
        [(value,) for value in values],
        cast(DbapiDescription, [("c", "int")]),
        BaseEngineSpec,
    )
    _same(
        arrow_rs.pa_table.column("c").to_pylist(),
        row_rs.pa_table.column("c").to_pylist(),
    )
    # Pinned difference: the row path infers int64.
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
        [(1, 2, 3)], cast(DbapiDescription, [("a",), ("a",), ("",)]), BaseEngineSpec
    )
    assert arrow_rs.pa_table.column_names == row_rs.pa_table.column_names


def test_nested_list_and_struct_match_row_path() -> None:
    table = pa.table({"l": pa.array([[1, 2], None]), "s": pa.array([{"a": 1}, None])})
    arrow_rs = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    row_rs = SupersetResultSet(
        [([1, 2], {"a": 1}), (None, None)],
        cast(DbapiDescription, [("l",), ("s",)]),
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


def test_empty_table_keeps_column_names() -> None:
    table = pa.table({"a": pa.array([], type=pa.int64())})
    result_set = SupersetResultSet.from_arrow(table, BaseEngineSpec)
    assert result_set.size == 0
    assert [column["column_name"] for column in result_set.columns] == ["a"]


# DataFrame parity: the chart cache key does not record which path built the
# DataFrame, so to_pandas_df() must agree too.


def _cell_equal(left: Any, right: Any) -> bool:
    if left is None or right is None:
        return left is right
    if isinstance(left, float) and isinstance(right, float):
        return (math.isnan(left) and math.isnan(right)) or left == right
    if left is pd.NaT or right is pd.NaT:
        return left is right
    try:
        if pd.isna(left) and pd.isna(right):
            return True
    except (TypeError, ValueError):
        pass
    return left == right


def _pair(
    type_code: str, values: list[Any], arrow_column: Any = None
) -> tuple[SupersetResultSet, SupersetResultSet]:
    column = values if arrow_column is None else arrow_column
    row_rs = SupersetResultSet(
        [(value,) for value in values],
        cast(DbapiDescription, [("c", type_code)]),
        BaseEngineSpec,
    )
    return row_rs, SupersetResultSet.from_arrow(pa.table({"c": column}), BaseEngineSpec)


def _assert_df_parity(
    row_rs: SupersetResultSet, arrow_rs: SupersetResultSet, *, dtype: bool = True
) -> None:
    row_df, arrow_df = row_rs.to_pandas_df(), arrow_rs.to_pandas_df()
    assert list(arrow_df.columns) == list(row_df.columns)
    if dtype:
        assert arrow_df.dtypes.to_dict() == row_df.dtypes.to_dict()
    for name in row_df.columns:
        got, expected = arrow_df[name].tolist(), row_df[name].tolist()
        assert len(got) == len(expected)
        for left, right in zip(got, expected, strict=True):
            assert _cell_equal(left, right), (name, left, right)


def _assert_records_parity(
    row_rs: SupersetResultSet, arrow_rs: SupersetResultSet
) -> None:
    from superset.dataframe import df_to_records

    assert df_to_records(arrow_rs.to_pandas_df()) == df_to_records(
        row_rs.to_pandas_df()
    )


def _assert_columns_parity(
    row_rs: SupersetResultSet,
    arrow_rs: SupersetResultSet,
    keys: tuple[str, ...] = ("type_generic", "is_dttm"),
) -> None:
    for key in keys:
        arrow_column = cast(dict[str, Any], arrow_rs.columns[0])
        row_column = cast(dict[str, Any], row_rs.columns[0])
        assert arrow_column[key] == row_column[key], key


@pytest.mark.parametrize(
    "tz",
    [
        timezone.utc,
        timezone(timedelta(hours=5, minutes=45)),
        timezone(timedelta(hours=-3, minutes=-30)),
        zoneinfo.ZoneInfo("America/New_York"),
    ],
    ids=["utc", "plus0545", "minus0330", "new_york"],
)
def test_tz_aware_timestamps_dataframe_parity(tz: Any) -> None:
    values = [
        datetime(2024, 3, 10, 6, 59, tzinfo=tz),
        datetime(2024, 3, 10, 7, 1, tzinfo=tz),
        None,
        datetime(2024, 11, 3, 5, 30, tzinfo=tz),
    ]
    row_rs, arrow_rs = _pair("timestamptz", values)
    _assert_columns_parity(row_rs, arrow_rs)
    _assert_df_parity(row_rs, arrow_rs)


def test_naive_and_far_future_timestamps_dataframe_parity() -> None:
    for values in (
        [datetime(2024, 1, 2, 3, 4, 5, 123456), None],
        [datetime(9999, 12, 31, 23, 59, 59), None],
    ):
        row_rs, arrow_rs = _pair("timestamp", values)
        _assert_columns_parity(row_rs, arrow_rs)
        _assert_df_parity(row_rs, arrow_rs)


@pytest.mark.parametrize(
    "values",
    [
        [Decimal("1.50"), Decimal("-0.0001"), None],
        [Decimal(0), Decimal("-0"), Decimal("99999999999999.9999")],
        [Decimal("123456789012345678901234567890.123456789"), None],
    ],
    ids=["small", "zero_and_max18_4", "wider_than_38"],
)
def test_decimals_dataframe_parity(values: list[Any]) -> None:
    _assert_df_parity(*_pair("numeric", values))


def test_int64_boundaries_dataframe_parity() -> None:
    row_rs, arrow_rs = _pair("int8", [2**63 - 1, -(2**63), 0, None])
    _assert_columns_parity(row_rs, arrow_rs)
    _assert_df_parity(row_rs, arrow_rs)


@pytest.mark.parametrize("big", [2**63, 2**64 - 1], ids=["2_63", "uint64_max"])
def test_uint64_above_int64_dataframe_parity(big: int) -> None:
    values = [1, big, None]
    row_rs, arrow_rs = _pair("int", values, pa.array(values, type=pa.uint64()))
    _assert_df_parity(row_rs, arrow_rs)
    assert arrow_rs.columns[0]["type"] == "STRING"


def test_int32_width_is_a_pinned_dtype_difference() -> None:
    values = [1, -3, None]
    row_rs, arrow_rs = _pair("int4", values, pa.array(values, type=pa.int32()))
    _assert_df_parity(row_rs, arrow_rs, dtype=False)
    assert pa.types.is_int64(row_rs.pa_table.schema.field("c").type)
    assert pa.types.is_int32(arrow_rs.pa_table.schema.field("c").type)


@pytest.mark.parametrize(
    "arrow_type,type_code",
    [
        (pa.int64(), "int8"),
        (pa.float64(), "float8"),
        (pa.string(), "text"),
        (pa.bool_(), "bool"),
        (pa.date32(), "date"),
        (pa.timestamp("us", tz="UTC"), "timestamptz"),
    ],
    ids=["int", "float", "text", "bool", "date", "timestamptz"],
)
def test_all_null_columns_are_a_pinned_dtype_difference(
    arrow_type: pa.DataType, type_code: str
) -> None:
    """Records match; the row path's Arrow null column becomes object/None."""
    row_rs, arrow_rs = _pair(
        type_code, [None, None], pa.array([None, None], type=arrow_type)
    )
    _assert_records_parity(row_rs, arrow_rs)
    _assert_columns_parity(row_rs, arrow_rs, keys=("type_generic",))
    assert pa.types.is_null(row_rs.pa_table.schema.field("c").type)
    assert arrow_rs.pa_table.schema.field("c").type == arrow_type


def test_nullable_integers_stay_objects_with_none() -> None:
    row_rs, arrow_rs = _pair("int8", [1, None, 3])
    _assert_df_parity(row_rs, arrow_rs)
    assert arrow_rs.to_pandas_df()["c"].tolist()[1] is None


@pytest.mark.parametrize(
    "arrow_type", [pa.float64(), pa.float32()], ids=["float64", "float32"]
)
def test_non_finite_floats_dataframe_parity(arrow_type: pa.DataType) -> None:
    values = [float("nan"), float("inf"), float("-inf"), 1.5, None]
    row_rs, arrow_rs = _pair("float8", values, pa.array(values, type=arrow_type))
    _assert_df_parity(row_rs, arrow_rs, dtype=arrow_type == pa.float64())


def test_dates_dataframe_parity() -> None:
    values = [date(2020, 2, 29), date(1, 1, 1), date(9999, 12, 31), None]
    row_rs, arrow_rs = _pair("date", values)
    _assert_columns_parity(row_rs, arrow_rs)
    _assert_df_parity(row_rs, arrow_rs)
    row_rs, arrow_rs = _pair("date", values, pa.array(values, type=pa.date64()))
    _assert_df_parity(row_rs, arrow_rs, dtype=False)


@pytest.mark.parametrize(
    "values",
    [
        [[1, 2, None], [], None],
        [{"a": 1, "b": "x"}, {"a": None, "b": None}, None],
        [[{"k": [1, 2]}], [], None],
    ],
    ids=["list_with_nulls_and_empty", "struct_with_nulls", "list_of_struct_of_list"],
)
def test_nested_values_dataframe_parity(values: list[Any]) -> None:
    row_rs, arrow_rs = _pair("json", values)
    assert arrow_rs.nested_columns == row_rs.nested_columns
    _assert_df_parity(row_rs, arrow_rs)


class _TableCursor:
    def __init__(self, values: list[int]) -> None:
        self.description = [("a", "int")]
        self.values = values
        self.reads = 0

    def to_arrow_table(self) -> pa.Table:
        self.reads += 1
        return pa.table({"a": pa.array(self.values)})


class _ArrowSpec(BaseEngineSpec):
    supports_arrow_result = True


def test_fetch_arrow_result_leaves_the_cursor_when_the_flag_is_off(
    mocker: MockerFixture,
) -> None:
    from superset.result_set import fetch_arrow_result

    mocker.patch("superset.is_feature_enabled", return_value=False)
    cursor = _TableCursor([1, 2])
    assert fetch_arrow_result(_ArrowSpec, cursor, 1) == (None, False)
    assert cursor.reads == 0


def test_fetch_arrow_result_reports_truncation(mocker: MockerFixture) -> None:
    from superset.result_set import fetch_arrow_result

    mocker.patch("superset.is_feature_enabled", return_value=True)
    table, truncated = fetch_arrow_result(_ArrowSpec, _TableCursor([1, 2, 3]), 2)
    assert truncated is True
    assert table is not None
    assert table.column("a").to_pylist() == [1, 2]

    table, truncated = fetch_arrow_result(_ArrowSpec, _TableCursor([1, 2]), 2)
    assert truncated is False
    assert table is not None
    assert table.num_rows == 2

    assert fetch_arrow_result(BaseEngineSpec, _TableCursor([1]), None) == (None, False)
