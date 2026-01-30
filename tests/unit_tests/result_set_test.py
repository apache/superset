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
from superset.result_set import normalize_column_name, stringify_values, SupersetResultSet
from superset.superset_typing import DbapiResult


def test_normalize_column_name_with_valid_string() -> None:
    """Test that valid string column names are preserved."""
    assert normalize_column_name("user_id", 0) == "user_id"
    assert normalize_column_name("COUNT(*)", 1) == "COUNT(*)"
    assert normalize_column_name("my column", 2) == "my column"


def test_normalize_column_name_with_bytes() -> None:
    """Test that byte column names are decoded."""
    assert normalize_column_name(b"column_name", 0) == "column_name"


def test_normalize_column_name_with_none() -> None:
    """Test that None column names get positional fallback."""
    assert normalize_column_name(None, 0) == "_col0"
    assert normalize_column_name(None, 5) == "_col5"


def test_normalize_column_name_with_empty_string() -> None:
    """Test that empty string column names get positional fallback."""
    assert normalize_column_name("", 0) == "_col0"
    assert normalize_column_name("", 3) == "_col3"


def test_normalize_column_name_with_whitespace() -> None:
    """Test that whitespace-only column names get positional fallback."""
    assert normalize_column_name("   ", 0) == "_col0"
    assert normalize_column_name("\t\n", 1) == "_col1"


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


def test_unnamed_columns_get_fallback_names() -> None:
    """
    Test that unnamed columns (empty string or None) get deterministic fallback names.

    This addresses issue #23848 where MSSQL returns empty strings for unnamed columns
    (e.g., SELECT COUNT(*) without an alias), causing failures in SQL Lab, alerts,
    and dimension creation.
    """
    # Simulate MSSQL behavior: empty string for unnamed column
    data = [(42,), (100,)]
    description = [("", "int", None, None, None, None, None)]  # Empty column name

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    # Should have generated a fallback name
    assert result_set.columns[0]["column_name"] == "_col0"
    assert result_set.columns[0]["name"] == "_col0"

    # Data should be accessible
    df = result_set.to_pandas_df()
    assert df.columns.tolist() == ["_col0"]
    assert df["_col0"].tolist() == [42, 100]


def test_none_column_name_gets_fallback() -> None:
    """
    Test that None column names get deterministic fallback names.
    """
    data = [("value1",), ("value2",)]
    description = [(None, "varchar", None, None, None, None, None)]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    assert result_set.columns[0]["column_name"] == "_col0"
    df = result_set.to_pandas_df()
    assert df["_col0"].tolist() == ["value1", "value2"]


def test_whitespace_only_column_name_gets_fallback() -> None:
    """
    Test that whitespace-only column names get deterministic fallback names.
    """
    data = [(1,), (2,)]
    description = [("   ", "int", None, None, None, None, None)]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    assert result_set.columns[0]["column_name"] == "_col0"


def test_mixed_named_and_unnamed_columns() -> None:
    """
    Test that named columns are preserved while unnamed columns get fallback names.

    Simulates: SELECT id, COUNT(*), name FROM table
    where COUNT(*) has no alias on MSSQL.
    """
    data = [(1, 42, "Alice"), (2, 17, "Bob")]
    description = [
        ("id", "int", None, None, None, None, None),
        ("", "int", None, None, None, None, None),  # COUNT(*) without alias
        ("name", "varchar", None, None, None, None, None),
    ]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    # Named columns should be preserved exactly
    assert result_set.columns[0]["column_name"] == "id"
    assert result_set.columns[2]["column_name"] == "name"

    # Unnamed column should get positional fallback
    assert result_set.columns[1]["column_name"] == "_col1"

    # Verify data integrity
    df = result_set.to_pandas_df()
    assert df.columns.tolist() == ["id", "_col1", "name"]
    assert df["id"].tolist() == [1, 2]
    assert df["_col1"].tolist() == [42, 17]
    assert df["name"].tolist() == ["Alice", "Bob"]


def test_multiple_unnamed_columns() -> None:
    """
    Test that multiple unnamed columns each get unique fallback names.

    Simulates: SELECT COUNT(*), SUM(x), AVG(y) FROM table
    without any aliases on MSSQL.
    """
    data = [(10, 100, 5.5)]
    description = [
        ("", "int", None, None, None, None, None),
        ("", "int", None, None, None, None, None),
        ("", "float", None, None, None, None, None),
    ]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    # Each unnamed column should get a unique positional name
    # Note: dedup() will handle any collisions, but since we use position-based
    # names, there shouldn't be collisions
    column_names = [col["column_name"] for col in result_set.columns]
    assert column_names == ["_col0", "_col1", "_col2"]

    # Verify data is accessible
    df = result_set.to_pandas_df()
    assert df["_col0"].tolist() == [10]
    assert df["_col1"].tolist() == [100]
    assert df["_col2"].tolist() == [5.5]


def test_named_columns_not_modified() -> None:
    """
    Test that explicitly named columns are never modified.

    This ensures the fix doesn't accidentally change behavior for well-formed queries.
    """
    data = [(1, "test", 3.14)]
    description = [
        ("user_id", "int", None, None, None, None, None),
        ("username", "varchar", None, None, None, None, None),
        ("score", "float", None, None, None, None, None),
    ]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    column_names = [col["column_name"] for col in result_set.columns]
    assert column_names == ["user_id", "username", "score"]


def test_empty_result_with_unnamed_columns() -> None:
    """
    Test that empty results with unnamed columns still work correctly.

    This is important for SQL Lab's display of column headers even when
    the query returns no rows.
    """
    data: DbapiResult = []
    description = [
        ("", "int", None, None, None, None, None),
        ("named_col", "varchar", None, None, None, None, None),
    ]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    column_names = [col["column_name"] for col in result_set.columns]
    assert column_names == ["_col0", "named_col"]


def test_aliased_expression_preserved() -> None:
    """
    Test that explicitly aliased expressions (e.g., SELECT COUNT(*) AS total)
    preserve the alias name exactly.

    This verifies the fix for #23848 doesn't accidentally affect properly
    aliased columns.
    """
    # Simulates: SELECT COUNT(*) AS total FROM table
    # The database returns "total" as the column name
    data = [(42,)]
    description = [("total", "int", None, None, None, None, None)]

    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    # Alias must be preserved exactly
    assert result_set.columns[0]["column_name"] == "total"
    assert result_set.columns[0]["name"] == "total"

    df = result_set.to_pandas_df()
    assert df.columns.tolist() == ["total"]
    assert df["total"].tolist() == [42]
