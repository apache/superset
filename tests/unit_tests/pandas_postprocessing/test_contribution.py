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
from decimal import Decimal

import pytest
from numpy import nan
from numpy.testing import assert_array_equal
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import DTTM_ALIAS, PostProcessingContributionOrientation
from superset.utils.pandas_postprocessing import contribution

df_template = DataFrame(
    {
        DTTM_ALIAS: [
            datetime(2020, 7, 16, 14, 49),
            datetime(2020, 7, 16, 14, 50),
            datetime(2020, 7, 16, 14, 51),
        ],
        "a": [1, 3, nan],
        "b": [1, 9, nan],
        "c": [nan, nan, nan],
    }
)


def test_non_numeric_columns():
    with pytest.raises(InvalidPostProcessingError, match="not numeric"):
        contribution(df_template.copy(), columns=[DTTM_ALIAS])


def test_rename_should_have_same_length():
    with pytest.raises(InvalidPostProcessingError, match="same length"):
        contribution(df_template.copy(), columns=["a"], rename_columns=["aa", "bb"])


def test_cell_contribution_across_row():
    processed_df = contribution(
        df_template.copy(),
        orientation=PostProcessingContributionOrientation.ROW,
    )
    assert processed_df.columns.tolist() == [DTTM_ALIAS, "a", "b", "c"]
    assert_array_equal(processed_df["a"].tolist(), [0.5, 0.25, nan])
    assert_array_equal(processed_df["b"].tolist(), [0.5, 0.75, nan])
    assert_array_equal(processed_df["c"].tolist(), [nan, nan, nan])


def test_cell_contribution_across_column_without_temporal_column():
    df = df_template.copy()
    df.pop(DTTM_ALIAS)
    processed_df = contribution(
        df, orientation=PostProcessingContributionOrientation.COLUMN
    )
    assert processed_df.columns.tolist() == ["a", "b", "c"]
    assert_array_equal(processed_df["a"].tolist(), [0.25, 0.75, 0])
    assert_array_equal(processed_df["b"].tolist(), [0.1, 0.9, 0])
    assert_array_equal(processed_df["c"].tolist(), [nan, nan, nan])


def test_contribution_on_selected_columns():
    df = df_template.copy()
    df.pop(DTTM_ALIAS)
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.COLUMN,
        columns=["a"],
        rename_columns=["pct_a"],
    )
    assert processed_df.columns.tolist() == ["a", "b", "c", "pct_a"]
    assert_array_equal(processed_df["a"].tolist(), [1, 3, nan])
    assert_array_equal(processed_df["b"].tolist(), [1, 9, nan])
    assert_array_equal(processed_df["c"].tolist(), [nan, nan, nan])
    assert processed_df["pct_a"].tolist() == [0.25, 0.75, 0]


def test_contribution_with_time_shift_columns():
    df = DataFrame(
        {
            DTTM_ALIAS: [
                datetime(2020, 7, 16, 14, 49),
                datetime(2020, 7, 16, 14, 50),
            ],
            "a": [3, 6],
            "b": [3, 3],
            "c": [6, 3],
            "a__1 week ago": [2, 2],
            "b__1 week ago": [1, 1],
            "c__1 week ago": [1, 1],
        }
    )
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.ROW,
        time_shifts=["1 week ago"],
    )
    assert processed_df.columns.tolist() == [
        DTTM_ALIAS,
        "a",
        "b",
        "c",
        "a__1 week ago",
        "b__1 week ago",
        "c__1 week ago",
    ]
    assert_array_equal(processed_df["a"].tolist(), [0.25, 0.5])
    assert_array_equal(processed_df["b"].tolist(), [0.25, 0.25])
    assert_array_equal(processed_df["c"].tolist(), [0.50, 0.25])
    assert_array_equal(processed_df["a__1 week ago"].tolist(), [0.5, 0.5])
    assert_array_equal(processed_df["b__1 week ago"].tolist(), [0.25, 0.25])
    assert_array_equal(processed_df["c__1 week ago"].tolist(), [0.25, 0.25])


def test_contribution_with_numeric_prefix_time_shifts():
    """Time shifts like '2 weeks ago' and '22 weeks ago' share a numeric suffix;
    columns must be grouped by their exact offset, not by suffix matching."""
    df = DataFrame(
        {
            DTTM_ALIAS: [
                datetime(2020, 7, 16, 14, 49),
                datetime(2020, 7, 16, 14, 50),
            ],
            "a": [3, 6],
            "b": [6, 3],
            "a__2 weeks ago": [1, 1],
            "b__2 weeks ago": [1, 1],
            "a__22 weeks ago": [2, 4],
            "b__22 weeks ago": [4, 2],
        }
    )
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.ROW,
        time_shifts=["2 weeks ago", "22 weeks ago"],
    )
    # Non-time-shift columns: a=3,b=6 -> a=1/3, b=2/3; a=6,b=3 -> a=2/3, b=1/3
    assert_array_equal(processed_df["a"].tolist(), [1 / 3, 2 / 3])
    assert_array_equal(processed_df["b"].tolist(), [2 / 3, 1 / 3])
    # "2 weeks ago" group: a=1,b=1 -> 0.5,0.5 each row
    assert_array_equal(processed_df["a__2 weeks ago"].tolist(), [0.5, 0.5])
    assert_array_equal(processed_df["b__2 weeks ago"].tolist(), [0.5, 0.5])
    # "22 weeks ago" group: a=2,b=4 -> 1/3,2/3; a=4,b=2 -> 2/3,1/3
    assert_array_equal(processed_df["a__22 weeks ago"].tolist(), [1 / 3, 2 / 3])
    assert_array_equal(processed_df["b__22 weeks ago"].tolist(), [2 / 3, 1 / 3])


def test_contribution_leaves_string_columns_untouched():
    """A non-numeric column alongside the metrics must not break the division.

    `select_dtypes(include=["number", Decimal])` resolved `Decimal` to plain
    `object`, so every string column was treated as a metric and the
    contribution arithmetic raised `TypeError: unsupported operand type(s)
    for /: 'str' and 'str'` -- surfacing as a 500 rather than a chart.
    """
    df = DataFrame({"label": ["x", "y"], "a": [1.0, 3.0]})
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.COLUMN,
    )
    assert processed_df.columns.tolist() == ["label", "a"]
    assert processed_df["label"].tolist() == ["x", "y"]
    assert processed_df["a"].tolist() == [0.25, 0.75]


def test_contribution_across_row_leaves_string_columns_untouched():
    df = DataFrame({"label": ["x", "y"], "a": [1.0, 3.0], "b": [3.0, 1.0]})
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.ROW,
    )
    assert processed_df["label"].tolist() == ["x", "y"]
    assert processed_df["a"].tolist() == [0.25, 0.75]
    assert processed_df["b"].tolist() == [0.75, 0.25]


def test_contribution_rejects_selected_string_column():
    """Selecting a string column is a validation error, not a crash.

    The "not numeric" guard was unreachable for string columns, because they
    were themselves being collected as numeric.
    """
    df = DataFrame({"label": ["x", "y"], "a": [1.0, 3.0]})
    with pytest.raises(InvalidPostProcessingError, match="not numeric"):
        contribution(df, columns=["label"])


def test_contribution_on_decimal_columns():
    """`Decimal` metrics (e.g. a psycopg2 NUMERIC column) still contribute.

    They are held in an object-dtype column, so they have to be recognised by
    value rather than by dtype.
    """
    df = DataFrame(
        {
            "label": ["x", "y"],
            "a": [Decimal("1"), Decimal("3")],
        }
    )
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.COLUMN,
    )
    assert processed_df["label"].tolist() == ["x", "y"]
    assert processed_df["a"].tolist() == [0.25, 0.75]


def test_contribution_ignores_columns_of_unsupported_objects():
    """Object columns that are neither numeric nor Decimal are passed through."""
    df = DataFrame({"payload": [{"k": 1}, {"k": 2}], "a": [1.0, 3.0]})
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.COLUMN,
    )
    assert processed_df["payload"].tolist() == [{"k": 1}, {"k": 2}]
    assert processed_df["a"].tolist() == [0.25, 0.75]


def test_contribution_keeps_all_null_object_columns():
    """An all-null object column carries no values, so filling it with zeros
    and dividing is harmless; keep it in the calculation as before."""
    df = DataFrame({"a": [1.0, 3.0], "empty": [None, None]})
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.COLUMN,
    )
    assert processed_df.columns.tolist() == ["a", "empty"]
    assert processed_df["a"].tolist() == [0.25, 0.75]
    assert_array_equal(processed_df["empty"].tolist(), [nan, nan])
