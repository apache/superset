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
from superset.result_set import SupersetResultSet, stringify_values
from superset.superset_typing import DbapiResult


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


# ---------------------------------------------------------------------------
# DruidEngineSpec column normalization tests
#
# pydruid infers column types from the first row value, which causes two
# related problems:
#
#   Case 1 – Mixed IEEE special-float strings and numbers:
#     Druid cannot represent NaN/Infinity in JSON, so pydruid emits them as
#     the strings "NaN", "Infinity", or "-Infinity".  When these appear in a
#     numeric column, pa.array() raises ArrowInvalid on the mixed str/float
#     list and the column falls back to string serialisation.
#
#   Case 2 – None as the first value:
#     pydruid's get_type(None) returns Type.STRING, so any nullable numeric
#     column whose first row is null gets labelled STRING in the cursor
#     description.  pa.array() succeeds (producing float64) but
#     data_type() used to return STRING because the cursor description won.
#
# DruidEngineSpec overrides normalize_column_values and resolve_column_type
# to handle both cases.  BaseEngineSpec preserves the original behaviour.
# ---------------------------------------------------------------------------


def test_druid_ieee_special_floats_preserved_as_numeric() -> None:
    """
    Case 1, DruidEngineSpec: columns that mix IEEE special-float strings with
    real numbers must keep their numeric type (specials become null).
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [("NaN",), (1.5,), ("Infinity",), (2.3,), ("-Infinity",), (None,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "FLOAT"

    df = result_set.to_pandas_df()
    assert pd.isna(df["metric"].iloc[0])  # "NaN" → null
    assert df["metric"].iloc[1] == 1.5
    assert pd.isna(df["metric"].iloc[2])  # "Infinity" → null
    assert df["metric"].iloc[3] == 2.3
    assert pd.isna(df["metric"].iloc[4])  # "-Infinity" → null
    assert pd.isna(df["metric"].iloc[5])  # None → null


def test_base_spec_ieee_special_floats_stringified() -> None:
    """
    Case 1, BaseEngineSpec: without Druid's override, columns with mixed
    special-float strings and numbers fall through to string serialisation.
    """
    data = [("NaN",), (1.5,), ("Infinity",)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "STRING"

    df = result_set.to_pandas_df()
    assert df["metric"].iloc[0] == "NaN"
    assert df["metric"].iloc[1] == "1.5"
    assert df["metric"].iloc[2] == "Infinity"


def test_druid_none_first_value_reports_numeric_type() -> None:
    """
    Case 2, DruidEngineSpec: when the cursor description says STRING (pydruid's
    first-row None inference) but PyArrow correctly infers float64, the column
    must be reported as FLOAT, not STRING.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [(None,), (1.5,), (2.3,), (None,), (4.7,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "FLOAT"

    df = result_set.to_pandas_df()
    assert pd.isna(df["metric"].iloc[0])
    assert df["metric"].iloc[1] == 1.5
    assert df["metric"].iloc[4] == 4.7


def test_base_spec_none_first_value_reports_string_type() -> None:
    """
    Case 2, BaseEngineSpec: the cursor-description STRING type must continue
    to win over PyArrow's float64 inference for non-Druid engines.
    """
    data = [(None,), (1.5,), (2.3,)]
    description = [("metric", "STRING", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, BaseEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "STRING"


def test_non_string_cursor_type_unaffected_by_druid_spec() -> None:
    """
    Columns with a non-STRING cursor description type must not be affected by
    DruidEngineSpec's resolve_column_type override.
    """
    from superset.db_engine_specs.druid import DruidEngineSpec

    data = [(1,), (2,), (3,)]
    description = [("count", "INT", None, None, None, None, None)]
    result_set = SupersetResultSet(data, description, DruidEngineSpec)  # type: ignore

    col = result_set.columns[0]
    assert col["type"] == "INT"
