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

# pylint: disable=import-outside-toplevel, unused-argument

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from numpy.core.multiarray import array
from pytest_mock import MockerFixture

from superset.db_engine_specs.base import BaseEngineSpec
from superset.result_set import (
    stringify_extension_columns,
    stringify_values,
    SupersetResultSet,
)
from superset.superset_typing import DbapiResult
from superset.utils import json as superset_json


def test_column_names_as_bytes() -> None:
    """
    Test that we can handle column names as bytes.
    """
    from superset.db_engine_specs.redshift import RedshiftEngineSpec
    from superset.result_set import SupersetResultSet

    data = (
        [
            "2016-01-26",
            392.002014,
            397.765991,
            390.575012,
            392.153015,
            392.153015,
            58147000,
        ],
        [
            "2016-01-27",
            392.444,
            396.842987,
            391.782013,
            394.971985,
            394.971985,
            47424400,
        ],
    )
    description = [
        (b"date", 1043, None, None, None, None, None),
        (b"open", 701, None, None, None, None, None),
        (b"high", 701, None, None, None, None, None),
        (b"low", 701, None, None, None, None, None),
        (b"close", 701, None, None, None, None, None),
        (b"adj close", 701, None, None, None, None, None),
        (b"volume", 20, None, None, None, None, None),
    ]
    result_set = SupersetResultSet(data, description, RedshiftEngineSpec)  # type: ignore

    assert (
        result_set.to_pandas_df().to_markdown()
        == """
|    | date       |    open |    high |     low |   close |   adj close |   volume |
|---:|:-----------|--------:|--------:|--------:|--------:|------------:|---------:|
|  0 | 2016-01-26 | 392.002 | 397.766 | 390.575 | 392.153 |     392.153 | 58147000 |
|  1 | 2016-01-27 | 392.444 | 396.843 | 391.782 | 394.972 |     394.972 | 47424400 |
    """.strip()
    )


def test_stringify_with_null_integers():
    """
    Test that we can safely handle type errors when an integer column has a null value
    """

    data = [
        ("foo", "bar", pd.NA, None),
        ("foo", "bar", pd.NA, True),
        ("foo", "bar", pd.NA, None),
    ]
    numpy_dtype = [
        ("id", "object"),
        ("value", "object"),
        ("num", "object"),
        ("bool", "object"),
    ]

    array2 = np.array(data, dtype=numpy_dtype)
    column_names = ["id", "value", "num", "bool"]

    result_set = np.array([stringify_values(array2[column]) for column in column_names])

    expected = np.array(
        [
            array(["foo", "foo", "foo"], dtype=object),
            array(["bar", "bar", "bar"], dtype=object),
            array([None, None, None], dtype=object),
            array([None, "True", None], dtype=object),
        ]
    )

    assert np.array_equal(result_set, expected)


def test_stringify_with_null_timestamps():
    """
    Test that we can safely handle type errors when a timestamp column has a null value
    """

    data = [
        ("foo", "bar", pd.NaT, None),
        ("foo", "bar", pd.NaT, True),
        ("foo", "bar", pd.NaT, None),
    ]
    numpy_dtype = [
        ("id", "object"),
        ("value", "object"),
        ("num", "object"),
        ("bool", "object"),
    ]

    array2 = np.array(data, dtype=numpy_dtype)
    column_names = ["id", "value", "num", "bool"]

    result_set = np.array([stringify_values(array2[column]) for column in column_names])

    expected = np.array(
        [
            array(["foo", "foo", "foo"], dtype=object),
            array(["bar", "bar", "bar"], dtype=object),
            array([None, None, None], dtype=object),
            array([None, "True", None], dtype=object),
        ]
    )

    assert np.array_equal(result_set, expected)


def test_timezone_series(mocker: MockerFixture) -> None:
    """
    Test that we can handle timezone-aware datetimes correctly.

    This covers a regression that happened when upgrading from Pandas 1.5.3 to 2.0.3.
    """
    logger = mocker.patch("superset.result_set.logger")

    data = [[datetime(2023, 1, 1, tzinfo=timezone.utc)]]
    description = [(b"__time", "datetime", None, None, None, None, False)]
    result_set = SupersetResultSet(
        data,
        description,  # type: ignore
        BaseEngineSpec,
    )
    assert result_set.to_pandas_df().values.tolist() == [
        [pd.Timestamp("2023-01-01 00:00:00+0000", tz="UTC")]
    ]
    logger.exception.assert_not_called()


def test_out_of_bounds_datetime_coerced_to_nat(mocker: MockerFixture) -> None:
    """
    Dates beyond ~2262-04-11 overflow pandas' int64 nanosecond representation.
    SupersetResultSet must coerce them to NaT rather than raising OutOfBoundsDatetime
    and logging an ERROR (which would surface as noise in observability tooling).
    """
    logger = mocker.patch("superset.result_set.logger")

    data = [[datetime(3118, 1, 1, tzinfo=timezone.utc)]]
    description = [(b"dt", "datetime", None, None, None, None, False)]
    result_set = SupersetResultSet(
        data,
        description,  # type: ignore
        BaseEngineSpec,
    )
    df = result_set.to_pandas_df()
    assert pd.isna(df["dt"].iloc[0])
    logger.exception.assert_not_called()


def test_get_column_description_from_empty_data_using_cursor_description(
    mocker: MockerFixture,
) -> None:
    """
    Test that we can handle get_column_decription from the cursor description
    when data is empty
    """
    logger = mocker.patch("superset.result_set.logger")

    data: DbapiResult = []
    description = [(b"__time", "datetime", None, None, None, None, 1, 0, 255)]
    result_set = SupersetResultSet(
        data,
        description,  # type: ignore
        BaseEngineSpec,
    )
    assert any(col.get("column_name") == "__time" for col in result_set.columns)
    logger.exception.assert_not_called()


def test_empty_column_names_get_synthetic_names() -> None:
    """
    SQL Server returns an empty-string column name in cursor.description for
    any un-aliased expression (e.g. ``SELECT COUNT(*) FROM t``).  An empty
    field name is illegal in NumPy structured arrays and PyArrow tables.

    SupersetResultSet must replace empty column names with synthetic names
    so queries like ``SELECT COUNT(*) FROM t`` succeed on MSSQL.

    Regression test for https://github.com/apache/superset/issues/23848
    """
    data = [(42,)]
    description = [("", 3, None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    assert result_set.columns[0]["column_name"] == "_col_0"
    df = result_set.to_pandas_df()
    assert list(df.columns) == ["_col_0"]
    assert df["_col_0"].iloc[0] == 42


def test_multiple_empty_column_names_get_unique_synthetic_names() -> None:
    """
    When several columns have empty names (e.g. ``SELECT COUNT(*), SUM(x)``
    on MSSQL), each must receive a distinct synthetic name.
    """
    data = [(10, 20)]
    description = [
        ("", 3, None, None, None, None, None),
        ("", 3, None, None, None, None, None),
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col_names = [c["column_name"] for c in result_set.columns]
    assert len(col_names) == 2
    assert len(set(col_names)) == 2  # all unique
    df = result_set.to_pandas_df()
    assert df.iloc[0].tolist() == [10, 20]


def test_empty_column_names_do_not_rename_explicit_synthetic_names() -> None:
    """
    Synthetic names assigned to empty columns must not collide with explicit
    user-selected names that already look like Superset fallbacks.
    """
    data = [(10, 20)]
    description = [
        ("", 3, None, None, None, None, None),
        ("_col_0", 3, None, None, None, None, None),
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col_names = [c["column_name"] for c in result_set.columns]
    assert col_names == ["_col_1", "_col_0"]
    df = result_set.to_pandas_df()
    assert list(df.columns) == ["_col_1", "_col_0"]
    assert df.iloc[0].tolist() == [10, 20]


def test_json_data_type_preserved_as_objects() -> None:
    """
    Test that JSON/JSONB data is preserved as Python objects (dicts/lists)
    instead of being converted to strings.

    This is important for Handlebars templates and other features that need
    to access JSON data as objects rather than strings.

    See: https://github.com/apache/superset/issues/25125
    """
    # Simulate data from PostgreSQL JSONB column - psycopg2 returns dicts
    data = [
        (1, {"key": "value1", "nested": {"a": 1}}, "text1"),
        (2, {"key": "value2", "items": [1, 2, 3]}, "text2"),
        (3, None, "text3"),
        (4, {"mixed": "string"}, "text4"),
    ]
    description = [
        ("id", 23, None, None, None, None, None),  # INT
        ("json_col", 3802, None, None, None, None, None),  # JSONB
        ("text_col", 1043, None, None, None, None, None),  # VARCHAR
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore
    df = result_set.to_pandas_df()

    # JSON column should be preserved as Python objects, not strings
    assert df["json_col"].iloc[0] == {"key": "value1", "nested": {"a": 1}}
    assert isinstance(df["json_col"].iloc[0], dict)
    assert df["json_col"].iloc[1] == {"key": "value2", "items": [1, 2, 3]}
    assert df["json_col"].iloc[2] is None
    assert df["json_col"].iloc[3] == {"mixed": "string"}

    # Plain TEXT/VARCHAR columns must be left untouched as strings, even when
    # adjacent to a JSON column.
    assert df["text_col"].iloc[0] == "text1"
    assert df["text_col"].iloc[3] == "text4"

    # Verify the data can be serialized to JSON (as it would be for API response)
    records = df.to_dict(orient="records")
    json_output = superset_json.dumps(records)
    parsed = superset_json.loads(json_output)
    assert parsed[0]["json_col"]["key"] == "value1"
    assert parsed[0]["json_col"]["nested"]["a"] == 1
    assert parsed[1]["json_col"]["items"] == [1, 2, 3]


def test_json_formatted_string_in_text_column_stays_string() -> None:
    """
    A plain TEXT/VARCHAR column whose values happen to be JSON-formatted strings
    must be left unchanged as strings. There is no content-sniffing: only columns
    that the driver returns as actual nested Python objects (dicts/lists) are
    preserved as objects.

    See: https://github.com/apache/superset/issues/25125
    """
    data = [
        (1, '{"key": "val"}'),
        (2, "[1, 2, 3]"),
        (3, "not json at all"),
    ]
    description = [
        ("id", 23, None, None, None, None, None),  # INT
        ("text_col", 1043, None, None, None, None, None),  # VARCHAR
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore
    df = result_set.to_pandas_df()

    # Values stay as raw strings, never parsed into dict/list.
    assert df["text_col"].iloc[0] == '{"key": "val"}'
    assert isinstance(df["text_col"].iloc[0], str)
    assert df["text_col"].iloc[1] == "[1, 2, 3]"
    assert isinstance(df["text_col"].iloc[1], str)
    assert df["text_col"].iloc[2] == "not json at all"


def test_json_data_with_homogeneous_structure() -> None:
    """
    Test that JSON data with consistent structure is also preserved as objects.
    """
    # All rows have the same JSON structure
    data = [
        (1, {"name": "Alice", "age": 30}),
        (2, {"name": "Bob", "age": 25}),
        (3, {"name": "Charlie", "age": 35}),
    ]
    description = [
        ("id", 23, None, None, None, None, None),
        ("data", 3802, None, None, None, None, None),
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore
    df = result_set.to_pandas_df()

    # Should be preserved as dicts
    assert isinstance(df["data"].iloc[0], dict)
    assert df["data"].iloc[0]["name"] == "Alice"
    assert df["data"].iloc[1]["age"] == 25


def test_array_data_type_preserved() -> None:
    """
    Test that array data is also preserved as Python lists.
    """
    data = [
        (1, [1, 2, 3]),
        (2, [4, 5, 6]),
        (3, None),
    ]
    description = [
        ("id", 23, None, None, None, None, None),
        ("arr", 1007, None, None, None, None, None),  # INT ARRAY
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore
    df = result_set.to_pandas_df()

    # Arrays should be preserved as lists
    assert df["arr"].iloc[0] == [1, 2, 3]
    assert isinstance(df["arr"].iloc[0], list)
    assert df["arr"].iloc[2] is None


def test_uuid_column_is_stringified() -> None:
    """
    UUID columns must render as readable strings, not raw bytes.

    PyArrow >= 21 infers Python ``uuid.UUID`` values as the canonical ``uuid``
    extension type (16-byte binary) instead of raising while building the array.
    That bypasses the stringification fallback, so without explicit handling the
    values surface in the results grid as garbled bytes / ``[bytes]``.
    ``SupersetResultSet`` must stringify any Arrow extension type.

    Regression test for the pyarrow 20 -> 24 upgrade.
    """
    import uuid

    ids = [
        uuid.UUID("f4787a4f-2541-4f8a-9b5e-1e2d3c4b5a6f"),
        uuid.UUID("00000000-0000-0000-0000-000000000000"),
    ]
    data = [(ids[0],), (ids[1],)]
    description = [("uuid", "uuid", None, None, None, None, True)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    df = result_set.to_pandas_df()
    assert df["uuid"].tolist() == [str(i) for i in ids]
    # values are readable UUID strings, not raw bytes
    assert all(value is None or isinstance(value, str) for value in df["uuid"].tolist())


def test_stringify_extension_columns() -> None:
    """
    ``stringify_extension_columns`` converts Arrow extension columns (e.g. the
    canonical ``uuid`` type) to readable strings while leaving plain binary and
    other columns untouched. This is the shared helper used by both
    ``SupersetResultSet`` and the semantic-layers mapper.
    """
    import uuid

    import pyarrow as pa

    first = uuid.UUID("f4787a4f-2541-4f8a-9b5e-1e2d3c4b5a6f")
    uuid_col = pa.ExtensionArray.from_storage(
        pa.uuid(), pa.array([first.bytes, None], pa.binary(16))
    )
    table = pa.table(
        {
            "id": uuid_col,
            "blob": pa.array([b"\x89PNG", None], pa.binary()),
            "n": pa.array([1, 2]),
        }
    )

    result = stringify_extension_columns(table)

    # uuid extension -> readable string column
    assert pa.types.is_string(result.schema.field("id").type)
    assert result.column("id").to_pylist() == [str(first), None]
    # plain binary BLOBs and other types are left untouched
    assert pa.types.is_binary(result.schema.field("blob").type)
    assert pa.types.is_integer(result.schema.field("n").type)


def test_stringify_values_dict_and_list_produce_valid_json() -> None:
    """
    ClickHouse native JSON and Map types return Python dicts. When stringified for
    Arrow array storage they must produce valid double-quoted JSON strings, not
    Python's single-quoted repr. Single-quoted strings pass the cheap '{' prefix
    check in the frontend's safeJsonObjectParse but then fail JSONbig.parse(),
    so the SQL Lab cell viewer never activates.
    """
    data = np.array(
        [
            {"key": "value", "nested": {"a": 1}},
            # str() gives ['a', 'b'] (single-quoted, invalid JSON);
            # json.dumps gives ["a", "b"] (double-quoted, valid JSON).
            ["a", "b"],
            {"items": [1, 2, 3], "d": "Hello, World!"},
            None,
        ],
        dtype=object,
    )
    result = stringify_values(data)

    # Must be valid JSON strings (double-quoted), not Python repr (single-quoted)
    assert result[0] == '{"key": "value", "nested": {"a": 1}}'
    assert result[1] == '["a", "b"]'
    assert result[2] == '{"items": [1, 2, 3], "d": "Hello, World!"}'
    assert result[3] is None

    # Parseable by a JSON parser — confirms the frontend's JSON.parse would succeed
    parsed = superset_json.loads(result[0])
    assert parsed == {"key": "value", "nested": {"a": 1}}
    parsed = superset_json.loads(result[1])
    assert parsed == ["a", "b"]


def test_clickhouse_json_column_in_pa_table_is_valid_json() -> None:
    """
    Verify that ClickHouse-style heterogeneous dict columns produce valid JSON
    strings in the Arrow table used by the msgpack serialization path.

    When clickhouse-connect returns Python dicts for JSON/Map type columns,
    SupersetResultSet must serialize them with json.dumps (not str()) so that
    the SQL Lab grid's cell viewer can call JSON.parse on the value.
    """
    data = [
        (1, {"a": {"b": 42}, "c": [1, 2, 3], "d": "Hello, World!"}),
        (2, {"e": 5}),
        (3, None),
    ]
    description = [
        ("id", 3, None, None, None, None, None),
        ("json_col", None, None, None, None, None, None),
    ]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    df_from_pa = SupersetResultSet.convert_table_to_df(result_set.pa_table)

    val0 = df_from_pa["json_col"].iloc[0]
    val1 = df_from_pa["json_col"].iloc[1]

    # Values in pa_table must be valid JSON strings (parseable by JSON.parse)
    assert isinstance(val0, str)
    assert isinstance(val1, str)

    # Double-quoted JSON, not single-quoted Python repr
    parsed0 = superset_json.loads(val0)
    assert parsed0 == {"a": {"b": 42}, "c": [1, 2, 3], "d": "Hello, World!"}
    parsed1 = superset_json.loads(val1)
    assert parsed1 == {"e": 5}


def test_stringify_values_non_serializable_dict_falls_back_to_str() -> None:
    """
    When a dict/list contains a value that json.dumps cannot serialize (e.g. bytes),
    stringify_values must fall back to str() rather than raising TypeError and crashing
    the result-set construction path.
    """

    class _Unserializable:
        def __repr__(self) -> str:
            return "unserializable"

    data = np.array(
        [{"key": _Unserializable()}],
        dtype=object,
    )
    # Must not raise — falls back to str()
    result = stringify_values(data)
    assert result[0] == str({"key": _Unserializable()})
