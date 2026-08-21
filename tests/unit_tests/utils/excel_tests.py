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

import io
from datetime import datetime, timezone

import pandas as pd
from openpyxl import load_workbook
from pandas.api.types import is_numeric_dtype

from superset.utils.core import GenericDataType
from superset.utils.excel import (
    apply_column_types,
    df_to_excel,
    NEUTRAL_TIMESTAMP,
    quote_formulas,
)


def test_timezone_conversion() -> None:
    """
    Test that columns with timezones are converted to a string.
    """
    df = pd.DataFrame({"dt": [datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc)]})
    apply_column_types(df, [GenericDataType.TEMPORAL])
    contents = df_to_excel(df)
    assert pd.read_excel(contents)["dt"][0] == "2023-01-01 00:00:00+00:00"


def test_quote_formulas() -> None:
    """
    Test that formulas are quoted in Excel.
    """
    df = pd.DataFrame({"formula": ["=SUM(A1:A2)", "normal", "@SUM(A1:A2)"]})
    contents = df_to_excel(df)
    assert pd.read_excel(contents)["formula"].tolist() == [
        "'=SUM(A1:A2)",
        "normal",
        "'@SUM(A1:A2)",
    ]


def test_quote_formulas_in_headers_and_index() -> None:
    """
    Test that formulas in column headers and index labels are quoted too.

    Pivot exports promote data values into the column MultiIndex and row
    index, so hostile warehouse strings can end up there.
    """
    df = pd.DataFrame(
        {"=SUM(A1:A2)": ["normal"]},
        index=pd.Index(['=cmd|" /C calc"!A0'], name="label"),
    )
    contents = df_to_excel(df)
    result = pd.read_excel(contents, index_col=0)
    assert result.columns.tolist() == ["'=SUM(A1:A2)"]
    assert result.index.tolist() == ['\'=cmd|" /C calc"!A0']


def test_quote_formulas_in_axis_names() -> None:
    """
    Test that formula-triggering axis *names* are quoted too, not just axis
    labels/values. Pivot exports can promote a warehouse-controlled column
    name to ``df.index.name`` (or a MultiIndex level name), and pandas
    writes those names into the sheet as header cells. ``rename`` alone
    leaves these untouched since they are a separate attribute from the
    axis labels/values, so this is asserted directly against the
    ``quote_formulas`` output rather than round-tripped through
    ``read_excel``, whose header parsing doesn't reliably preserve the
    columns-axis name.
    """
    df = pd.DataFrame(
        {"value": ["normal"]},
        index=pd.Index(["row"], name="=SUM(A1:A2)"),
    )
    df.columns.name = "+cmd"
    result = quote_formulas(df)
    assert result.index.name == "'=SUM(A1:A2)"
    assert result.columns.name == "'+cmd"

    # exercised end-to-end to confirm it doesn't error when the axis names
    # are written out as sheet header cells
    df_to_excel(df)


def test_document_properties_are_neutral() -> None:
    """
    Test that exported workbooks do not carry identifying document properties.
    """
    df = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
    contents = df_to_excel(df, index=False)

    workbook = load_workbook(io.BytesIO(contents))
    properties = workbook.properties

    # Authoring/descriptive fields are cleared.
    for field in (
        "creator",
        "lastModifiedBy",
        "title",
        "subject",
        "description",
        "keywords",
        "category",
    ):
        value = getattr(properties, field)
        assert value in (None, ""), f"{field} should be empty, got {value!r}"

    # Timestamps are pinned to a fixed, neutral value rather than the
    # actual generation time.
    assert properties.created == NEUTRAL_TIMESTAMP
    assert properties.modified == NEUTRAL_TIMESTAMP


def test_column_data_types_with_one_numeric_column():
    df = pd.DataFrame(
        {
            "col0": ["123", "1", "2", "3"],
            "col1": ["456", "5.67", "0", ".45"],
            "col2": [
                datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc),
                datetime(2023, 1, 2, 0, 0, tzinfo=timezone.utc),
                datetime(2023, 1, 3, 0, 0, tzinfo=timezone.utc),
                datetime(2023, 1, 4, 0, 0, tzinfo=timezone.utc),
            ],
            "col3": ["True", "False", "True", "False"],
        }
    )
    coltypes: list[GenericDataType] = [
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
        GenericDataType.TEMPORAL,
        GenericDataType.BOOLEAN,
    ]

    # only col1 should be converted to numeric, according to coltypes definition
    assert not is_numeric_dtype(df["col1"])
    apply_column_types(df, coltypes)
    assert not is_numeric_dtype(df["col0"])
    assert is_numeric_dtype(df["col1"])
    assert not is_numeric_dtype(df["col2"])
    assert not is_numeric_dtype(df["col3"])


def test_column_data_types_with_failing_conversion():
    df = pd.DataFrame(
        {
            "col0": ["123", "1", "2", "3"],
            "col1": ["456", "non_numeric_value", "0", ".45"],
            "col2": [
                datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc),
                datetime(2023, 1, 2, 0, 0, tzinfo=timezone.utc),
                datetime(2023, 1, 3, 0, 0, tzinfo=timezone.utc),
                datetime(2023, 1, 4, 0, 0, tzinfo=timezone.utc),
            ],
            "col3": ["True", "False", "True", "False"],
        }
    )
    coltypes: list[GenericDataType] = [
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
        GenericDataType.TEMPORAL,
        GenericDataType.BOOLEAN,
    ]

    # should not fail neither convert
    assert not is_numeric_dtype(df["col1"])
    apply_column_types(df, coltypes)
    assert not is_numeric_dtype(df["col0"])
    assert not is_numeric_dtype(df["col1"])
    assert not is_numeric_dtype(df["col2"])
    assert not is_numeric_dtype(df["col3"])


def test_column_data_types_with_large_numeric_values():
    df = pd.DataFrame(
        {
            "big_number": [
                10**14,
                999999999999999,
                10**15 + 1,
                10**16,
                1100108628127863,
                2**54,
            ],
        }
    )
    apply_column_types(df, [GenericDataType.NUMERIC])
    assert df["big_number"].tolist() == [
        100000000000000,
        999999999999999,
        "1000000000000001",
        "10000000000000000",
        "1100108628127863",
        "18014398509481984",
    ]
