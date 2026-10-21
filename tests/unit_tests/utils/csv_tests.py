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


from typing import Any
from unittest import mock

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from pandas.api.types import is_datetime64_any_dtype
from pytest_mock import MockerFixture

from superset.utils import csv, json
from superset.utils.core import GenericDataType
from superset.utils.csv import (
    df_to_escaped_csv,
    get_chart_csv_data,
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

    result = csv.escape_value('  ""=10+2')
    assert result == '\'  ""=10+2'

    # A leading tab or carriage return followed by a dangerous char was already
    # handled by \s{1,} in the pre-existing regex. The cases below test the
    # new behavior: tab/CR alone (not followed by a dangerous char) are now
    # also treated as dangerous prefixes because some spreadsheet software trims
    # leading whitespace and then evaluates the remaining content as a formula.
    result = csv.escape_value("\t10")
    assert result == "'\t10"

    result = csv.escape_value("\rfoo")
    assert result == "'\rfoo"


def fake_get_chart_csv_data_none(
    chart_url: str,
    auth_cookies: dict[str, str] | None = None,
    timeout: float | None = None,
) -> bytes | None:
    """Return ``None`` to mock a fetch that yields no payload."""
    return None


def fake_get_chart_csv_data_empty(
    chart_url: str,
    auth_cookies: dict[str, str] | None = None,
    timeout: float | None = None,
) -> bytes | None:
    """Return an encoded empty-result payload for dataframe-empty scenarios."""
    fake_result: dict[str, Any] = {
        "result": [{"data": {}, "coltypes": [], "colnames": [], "indexnames": []}]
    }
    return json.dumps(fake_result).encode("utf-8")


def fake_get_chart_csv_data_valid(
    chart_url: str,
    auth_cookies: dict[str, str] | None = None,
    timeout: float | None = None,
) -> bytes | None:
    """Return a non-temporal payload used to verify dataframe construction."""
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


def fake_get_chart_csv_data_temporal(
    chart_url: str,
    auth_cookies: dict[str, str] | None = None,
    timeout: float | None = None,
) -> bytes | None:
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


def fake_get_chart_csv_data_hierarchical(
    chart_url: str,
    auth_cookies: dict[str, str] | None = None,
    timeout: float | None = None,
) -> bytes | None:
    """Return hierarchical-column mock data for MultiIndex assertions."""
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


def fake_get_chart_csv_data_with_na_values(
    chart_url: str,
    auth_cookies: dict[str, str] | None = None,
    timeout: float | None = None,
) -> bytes | None:
    # Return JSON with data containing "NA" string value that will be treated as null
    fake_result = {
        "result": [
            {
                "data": {"first_name": ["Jeff", "Alice"], "last_name": ["Smith", "NA"]},
                "coltypes": [GenericDataType.STRING, GenericDataType.STRING],
                "colnames": ["first_name", "last_name"],
                "indexnames": ["idx1", "idx2"],
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


def test_df_to_escaped_csv_preserves_numeric_columns():
    """
    A string cell beginning with a dangerous prefix is escaped while genuinely
    numeric columns are left untouched.
    """
    df = pd.DataFrame(
        data={
            "formula": ["=cmd()", "safe"],
            "amount": [10, -20],
        }
    )

    escaped_csv_str = df_to_escaped_csv(
        df,
        encoding="utf8",
        index=False,
    )

    rows = [row.split(",") for row in escaped_csv_str.strip().split("\n")]

    # Header + 2 data rows.
    assert rows[0] == ["formula", "amount"]
    # Dangerous string cell is escaped with a leading single quote.
    assert rows[1] == ["'=cmd()", "10"]
    # Safe string is untouched; numeric values (including negatives) are not
    # escaped or quoted.
    assert rows[2] == ["safe", "-20"]


@pytest.mark.parametrize("scalar", [int, np.int64], ids=["python-int", "numpy-int64"])
def test_df_to_escaped_csv_object_big_integers(scalar: type) -> None:
    """Nullable big integers keep every digit; null and NaN rows are blank."""
    values = [scalar(2**53 + 1), None, scalar(7), float("nan"), scalar(-(2**63))]
    df = pd.DataFrame(
        {"value": pd.Series(values, dtype=object), "label": list("abcde")}
    )

    assert df_to_escaped_csv(df, encoding="utf8", index=False) == (
        "value,label\n9007199254740993,a\n,b\n7,c\n,d\n-9223372036854775808,e\n"
    )


def test_df_to_escaped_csv_non_default_index():
    """
    String cells are escaped against the correct rows even when the DataFrame
    has a non-default index, such as the flattened MultiIndex produced by
    pivot_table_v2 post-processing. A positional/label mismatch would otherwise
    create phantom rows and corrupt the output.
    """
    df = pd.DataFrame(
        data={"metric": ["=SUM(1+1)", "safe"]},
        index=["boy Edward", "girl Mary"],
    )

    escaped_csv_str = df_to_escaped_csv(df, encoding="utf8", index=True)

    rows = [row.split(",") for row in escaped_csv_str.strip().split("\n")]

    # Header + exactly two data rows (no duplicated/phantom rows).
    assert len(rows) == 3
    # The index labels are preserved and the dangerous cell is escaped in place.
    assert rows[1] == ["boy Edward", "'=SUM(1+1)"]
    assert rows[2] == ["girl Mary", "safe"]


def test_df_to_escaped_csv_escapes_index_labels():
    """
    Formulas in row labels are escaped too, not just cells and headers.

    Pivot post-processing promotes the row dimension's values into the index,
    and both export paths write the index out once it is no longer a
    RangeIndex, so a hostile warehouse string can reach the first column of
    the file.
    """
    df = pd.DataFrame(
        data={"SUM(num)": [10.0, 20.0]},
        index=pd.Index(['=cmd|" /C calc"!A0', "safe"], name="dim"),
    )

    rows = df_to_escaped_csv(df, encoding="utf8", index=True).strip().split("\n")

    assert rows[1].startswith("\"'=cmd")
    assert rows[2].startswith("safe,")
    # The caller's frame is left alone.
    assert df.index.tolist() == ['=cmd|" /C calc"!A0', "safe"]


def test_df_to_escaped_csv_escapes_multiindex_labels_and_axis_names():
    """
    Every level of a MultiIndex is escaped, and so are the axis *names*.

    Axis names are a separate attribute from the labels, so ``rename`` alone
    leaves them untouched while pandas still writes them out as header cells.
    A pivoted group-by puts a warehouse-controlled column name there.

    Both levels carry a hostile label, since a pivot on two dimensions can put
    one in either. Escaping only the innermost would leave the outer one in the
    first column of the file.
    """
    df = pd.DataFrame(
        data={"v": [1, 2]},
        index=pd.MultiIndex.from_tuples(
            [("=SUM(1+1)", '=cmd|" /C calc"!A0'), ("b", "safe")],
            names=["level", "+name"],
        ),
    )

    rows = df_to_escaped_csv(df, encoding="utf8", index=True).strip().split("\n")

    # Header row carries the escaped axis name.
    assert rows[0] == "level,'+name,v"
    # The outer level label is escaped in the first field.
    assert rows[1].split(",")[0] == "'=SUM(1+1)"
    # The inner level label is escaped, pipes included.
    assert "'=cmd" in rows[1]
    assert rows[2] == "b,safe,2"


def test_df_to_escaped_csv_escapes_column_axis_names():
    """
    The *column* axis names are escaped too.

    A pivot with grouped columns writes both column axis names out as their own
    header lines, ahead of the row labels, so a hostile warehouse column name
    lands in the first cell of the file.
    """
    df = pd.DataFrame(
        data=[[1]],
        index=pd.Index(["row"], name="dim"),
        columns=pd.MultiIndex.from_tuples([("outer", "v")], names=["=axis", "+inner"]),
    )

    rows = df_to_escaped_csv(df, encoding="utf8", index=True).strip().split("\n")

    assert rows[0] == "'=axis,outer"
    assert rows[1] == "'+inner,v"


def test_df_to_escaped_csv_escapes_colliding_index_labels():
    """
    Two labels can escape to the same text, and the export still works.

    ``escape_value`` is not injective: it prepends a quote, so a warehouse
    returning both ``=a`` and ``'=a`` in one row dimension has them both land
    on ``'=a``. Rebuilding a MultiIndex through ``set_levels`` rejects that
    with ``ValueError: Level values must be unique``, which would turn a CSV
    export into a 500, so the index is rebuilt from the level values instead,
    where repeated labels are ordinary.
    """
    df = pd.DataFrame(
        data={"v": [1, 2]},
        index=pd.MultiIndex.from_tuples(
            [("=a", "x"), ("'=a", "y")], names=["dim", "other"]
        ),
    )

    assert (
        df_to_escaped_csv(df, encoding="utf8", index=True)
        == "dim,other,v\n'=a,x,1\n'=a,y,2\n"
    )


def test_df_to_escaped_csv_keeps_a_numeric_index_dtype():
    """
    Escaping row labels does not widen a numeric row dimension.

    Rebuilding the index promotes ``float32`` to ``float64``, and the wider
    dtype prints the binary expansion of the stored value, so a label that
    read ``1.1`` would export as ``1.100000023841858``.
    """
    df = pd.DataFrame(
        data={"v": [1, 2]},
        index=pd.Index(np.array([1.1, 2.2], dtype="float32"), name="dim"),
    )

    assert df_to_escaped_csv(df, encoding="utf8", index=True) == "dim,v\n1.1,1\n2.2,2\n"


def test_df_to_escaped_csv_keeps_a_temporal_index_dtype():
    """
    Escaping row labels leaves ``date_format`` working.

    Rebuilding a ``datetime64`` index turns it into object dtype, and
    ``to_csv`` only applies ``date_format`` to a datetime index, so the
    configured ``CSV_EXPORT["date_format"]`` would quietly stop being honored.
    """
    df = pd.DataFrame(
        data={"v": [1]},
        index=pd.DatetimeIndex(
            np.array(["1500-01-01"], dtype="datetime64[s]"), name="dim"
        ),
    )

    escaped_csv_str = df_to_escaped_csv(
        df, encoding="utf8", index=True, date_format="%d/%m/%Y"
    )

    assert escaped_csv_str == "dim,v\n01/01/1500,1\n"


def test_df_to_escaped_csv_keeps_a_sibling_level_dtype():
    """
    A level that needs escaping is rebuilt without disturbing its siblings.

    A pivot on a dimension and a time grain puts both in the index, and the
    temporal level has to keep its dtype for ``date_format`` to reach it.
    """
    df = pd.DataFrame(
        data={"v": [1, 2]},
        index=pd.MultiIndex.from_arrays(
            [
                pd.Index(["=cmd()", "safe"]),
                pd.DatetimeIndex(
                    np.array(["1500-01-01", "1600-01-01"], dtype="datetime64[s]")
                ),
            ],
            names=["dim", "when"],
        ),
    )

    escaped_csv_str = df_to_escaped_csv(
        df, encoding="utf8", index=True, date_format="%d/%m/%Y"
    )

    rows = escaped_csv_str.strip().split("\n")

    assert rows[1] == "'=cmd(),01/01/1500,1"
    assert rows[2] == "safe,01/01/1600,2"


def test_df_to_escaped_csv_leaves_safe_index_alone():
    """
    A numeric index and a negative numeric label are not escaped, so ordinary
    exports are unchanged.
    """
    df = pd.DataFrame(data={"a": [1, 2]}, index=[-1, -2])

    assert df_to_escaped_csv(df, encoding="utf8", index=True) == ",a\n-1,1\n-2,2\n"


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


def test_get_chart_dataframe_preserves_na_string_values(
    monkeypatch: pytest.MonkeyPatch,
):
    """
    Test that get_chart_dataframe currently preserves rows containing "NA"
    string values.
    This test verifies the existing behavior before implementing custom NA handling.
    """
    monkeypatch.setattr(
        csv, "get_chart_csv_data", fake_get_chart_csv_data_with_na_values
    )
    df = get_chart_dataframe("http://dummy-url")
    assert df is not None

    # Verify the DataFrame structure
    expected_columns = pd.MultiIndex.from_tuples([("first_name",), ("last_name",)])
    pd.testing.assert_index_equal(df.columns, expected_columns)

    expected_index = pd.MultiIndex.from_tuples([("idx1",), ("idx2",)])
    pd.testing.assert_index_equal(df.index, expected_index)

    # Check that we have both rows initially
    assert len(df) == 2

    # Verify the data contains the "NA" string value (not converted to NaN)
    pd.testing.assert_series_equal(
        df[("first_name",)],
        pd.Series(["Jeff", "Alice"], name=("first_name",), index=df.index),
    )
    pd.testing.assert_series_equal(
        df[("last_name",)],
        pd.Series(["Smith", "NA"], name=("last_name",), index=df.index),
    )

    last_name_values = df[("last_name",)].values
    assert last_name_values[0] == "Smith"
    assert last_name_values[1] == "NA"


def test_get_chart_csv_data_passes_timeout_to_opener(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The timeout argument must reach the urllib opener's open() call."""
    # Without a timeout the request blocks forever when the webserver is
    # unreachable, wedging the report schedule in WORKING (issue #40047).
    mock_response = mock.Mock()
    mock_response.read.return_value = b"data"
    mock_response.getcode.return_value = 200
    mock_opener = mock.Mock()
    mock_opener.open.return_value = mock_response
    mock_opener.addheaders = []
    monkeypatch.setattr(
        "urllib.request.build_opener", mock.Mock(return_value=mock_opener)
    )

    get_chart_csv_data("http://dummy-url", auth_cookies={"session": "x"}, timeout=42)

    mock_opener.open.assert_called_once_with("http://dummy-url", timeout=42)


def test_get_chart_dataframe_forwards_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """get_chart_dataframe must forward its timeout down to get_chart_csv_data."""
    captured: dict[str, float | None] = {}

    def fake(
        chart_url: str,
        auth_cookies: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> bytes | None:
        captured["timeout"] = timeout
        return None

    monkeypatch.setattr(csv, "get_chart_csv_data", fake)
    get_chart_dataframe("http://dummy-url", timeout=99)
    assert captured["timeout"] == 99


@pytest.mark.parametrize("fail_read", [False, True])
def test_get_chart_csv_data_closes_response(
    mocker: MockerFixture, fail_read: bool
) -> None:
    """Release the legacy export connection on success and before retrying a read."""
    from superset.utils.csv import get_chart_csv_data

    response = mocker.patch(
        "urllib.request.build_opener"
    ).return_value.open.return_value
    response.getcode.return_value = 200
    response.read.return_value = b"csv"
    if fail_read:
        response.read.side_effect = TimeoutError()
        with pytest.raises(TimeoutError):
            get_chart_csv_data("https://localhost/chart", {"session": "cookie"}, 10)
    else:
        assert (
            get_chart_csv_data("https://localhost/chart", {"session": "cookie"}, 10)
            == b"csv"
        )
    response.close.assert_called_once()
