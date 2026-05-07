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


import pandas as pd
import pyarrow as pa
import pytest  # noqa: F401
from pandas.api.types import is_datetime64_any_dtype

from superset.utils import csv, json
from superset.utils.core import GenericDataType
from superset.utils.csv import (
    df_to_escaped_csv,
    get_chart_dataframe,
)


def test_escape_value():
    result = csv.escape_value("value")
    assert result == "value"

    result = csv.escape_value("-10")
    assert result == "-10"

    result = csv.escape_value("@value")
    assert result == "'@value"

    result = csv.escape_value("+value")
    assert result == "'+value"

    result = csv.escape_value("-value")
    assert result == "'-value"

    result = csv.escape_value("=value")
    assert result == "'=value"

    result = csv.escape_value("|value")
    assert result == r"'\|value"

    result = csv.escape_value("%value")
    assert result == "'%value"

    result = csv.escape_value("=cmd|' /C calc'!A0")
    assert result == r"'=cmd\|' /C calc'!A0"

    result = csv.escape_value('""=10+2')
    assert result == '\'""=10+2'

    result = csv.escape_value(" =10+2")
    assert result == "' =10+2"


def fake_get_chart_csv_data_none(chart_url, auth_cookies=None):
    return None


def fake_get_chart_csv_data_empty(chart_url, auth_cookies=None):
    # Return JSON with empty data so that the resulting DataFrame is empty
    fake_result = {
        "result": [{"data": {}, "coltypes": [], "colnames": [], "indexnames": []}]
    }
    return json.dumps(fake_result).encode("utf-8")


def fake_get_chart_csv_data_valid(chart_url, auth_cookies=None):
    # Return JSON with non-temporal data and valid indexnames so that they are used.
    fake_result = {
        "result": [
            {
                "data": {"col1": [1, 2], "col2": ["a", "b"]},
                "coltypes": [GenericDataType.NUMERIC, GenericDataType.STRING],
                "colnames": ["col1", "col2"],
                # Provide two index names so that a MultiIndex is built.
                "indexnames": ["idx1", "idx2"],
            }
        ]
    }
    return json.dumps(fake_result).encode("utf-8")


def fake_get_chart_csv_data_temporal(chart_url, auth_cookies=None):
    """
    Return JSON with a temporal column and valid indexnames
    so that a MultiIndex is built.
    """
    fake_result = {
        "result": [
            {
                "data": {"date": [1609459200000, 1612137600000], "val": [10, 20]},
                "coltypes": [GenericDataType.TEMPORAL, GenericDataType.NUMERIC],
                "colnames": ["date", "val"],
                # Provide two index names so a MultiIndex is built.
                "indexnames": [0, 1],
            }
        ]
    }
    return json.dumps(fake_result).encode("utf-8")


def fake_get_chart_csv_data_hierarchical(chart_url, auth_cookies=None):
    # Return JSON with hierarchical column (list-based) and matching index names.
    fake_result = {
        "result": [
            {
                "data": {"a": [1, 2]},
                "coltypes": [GenericDataType.NUMERIC],
                "colnames": [["level1", "a"]],
                # Provide two index tuples for two rows
                "indexnames": [["idx"], ["idx"]],
            }
        ]
    }
    return json.dumps(fake_result).encode("utf-8")


def test_df_to_escaped_csv():
    df = pd.DataFrame(
        data={
            "value": [
                "a",
                "col_a",
                "=func()",
                "-10",
                "=cmd|' /C calc'!A0",
                '""=b',
                " =a",
                "\x00",
            ]
        }
    )

    escaped_csv_str = df_to_escaped_csv(
        df,
        encoding="utf8",
        index=False,
        header=False,
    )

    escaped_csv_rows = [row.split(",") for row in escaped_csv_str.strip().split("\n")]

    assert escaped_csv_rows == [
        ["a"],
        ["col_a"],
        ["'=func()"],
        ["-10"],
        [r"'=cmd\\|' /C calc'!A0"],
        ['"\'""""=b"'],
        ["' =a"],
        ["\x00"],
    ]

    df = pa.array([1, None]).to_pandas(integer_object_nulls=True).to_frame()
    assert df_to_escaped_csv(df, encoding="utf8", index=False) == '0\n1\n""\n'


def test_get_chart_dataframe_returns_none_when_no_content(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(csv, "get_chart_csv_data", fake_get_chart_csv_data_none)
    result = get_chart_dataframe("http://dummy-url")
    assert result is None


def test_get_chart_dataframe_returns_none_for_empty_data(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(csv, "get_chart_csv_data", fake_get_chart_csv_data_empty)
    result = get_chart_dataframe("http://dummy-url")
    # When data is empty, the function should return None
    assert result is None


def test_get_chart_dataframe_valid_non_temporal(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(csv, "get_chart_csv_data", fake_get_chart_csv_data_valid)
    df = get_chart_dataframe("http://dummy-url")
    assert df is not None

    expected_columns = pd.MultiIndex.from_tuples([("col1",), ("col2",)])
    pd.testing.assert_index_equal(df.columns, expected_columns)

    expected_index = pd.MultiIndex.from_tuples([("idx1",), ("idx2",)])
    pd.testing.assert_index_equal(df.index, expected_index)

    pd.testing.assert_series_equal(
        df[("col1",)], pd.Series([1, 2], name=("col1",), index=df.index)
    )
    pd.testing.assert_series_equal(
        df[("col2",)], pd.Series(["a", "b"], name=("col2",), index=df.index)
    )
    markdown_str = df.to_markdown()
    expected_markdown_str = """
|           |   ('col1',) | ('col2',)   |
|:----------|------------:|:------------|
| ('idx1',) |           1 | a           |
| ('idx2',) |           2 | b           |
"""
    assert markdown_str.strip() == expected_markdown_str.strip()


def test_get_chart_dataframe_valid_temporal(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(csv, "get_chart_csv_data", fake_get_chart_csv_data_temporal)
    df = get_chart_dataframe("http://dummy-url")
    expected_columns = pd.MultiIndex.from_tuples([("date",), ("val",)])
    assert df is not None
    pd.testing.assert_index_equal(df.columns, expected_columns)

    expected_index = pd.MultiIndex.from_tuples([(0,), (1,)])
    pd.testing.assert_index_equal(df.index, expected_index)

    assert is_datetime64_any_dtype(df[("date",)])
    expected_dates = pd.to_datetime([1609459200000, 1612137600000], unit="ms").astype(
        "datetime64[ms]"
    )
    actual_dates = df[("date",)].reset_index(drop=True)
    pd.testing.assert_series_equal(
        actual_dates, pd.Series(expected_dates, name=("date",)), check_names=False
    )
    pd.testing.assert_series_equal(
        df[("val",)], pd.Series([10, 20], name=("val",), index=df.index)
    )
    markdown_str = df.to_markdown()
    expected_markdown_str = """
|      | ('date',)           |   ('val',) |
|:-----|:--------------------|-----------:|
| (0,) | 2021-01-01 00:00:00 |         10 |
| (1,) | 2021-02-01 00:00:00 |         20 |
"""
    assert markdown_str.strip() == expected_markdown_str.strip()


def test_get_chart_dataframe_with_hierarchical_columns(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(csv, "get_chart_csv_data", fake_get_chart_csv_data_hierarchical)
    df = get_chart_dataframe("http://dummy-url")
    assert df is not None
    expected_columns = pd.MultiIndex.from_tuples([("level1", "a")])
    pd.testing.assert_index_equal(df.columns, expected_columns)

    expected_index = pd.MultiIndex.from_tuples([("idx",)] * len(df))
    pd.testing.assert_index_equal(df.index, expected_index)

    pd.testing.assert_series_equal(
        df[("level1", "a")], pd.Series([1, 2], name=("level1", "a"), index=df.index)
    )
    markdown_str = df.to_markdown()
    expected_markdown_str = """
|          |   ('level1', 'a') |
|:---------|------------------:|
| ('idx',) |                 1 |
| ('idx',) |                 2 |
"""
    assert markdown_str.strip() == expected_markdown_str.strip()
