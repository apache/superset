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
from pandas import DataFrame

from superset.utils.pandas_postprocessing import histogram

data = DataFrame(
    {
        "group": ["A", "A", "B", "B", "A", "A", "B", "B", "A", "A"],
        "a": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "b": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    }
)

bins = 5


def test_histogram_no_groupby():
    data_with_no_groupings = DataFrame(
        {"a": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "b": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
    )
    result = histogram(data_with_no_groupings, "a", [], bins)
    assert result.shape == (1, bins)
    assert result.columns.tolist() == ["1 - 2", "2 - 4", "4 - 6", "6 - 8", "8 - 10"]
    assert result.values.tolist() == [[2, 2, 2, 2, 2]]


def test_histogram_with_groupby():
    result = histogram(data, "a", ["group"], bins)
    assert result.shape == (2, bins + 1)
    assert result.columns.tolist() == [
        "group",
        "1 - 2",
        "2 - 4",
        "4 - 6",
        "6 - 8",
        "8 - 10",
    ]
    assert result.values.tolist() == [["A", 2, 0, 2, 0, 2], ["B", 0, 2, 0, 2, 0]]


def test_histogram_with_groupby_and_normalize():
    result = histogram(data, "a", ["group"], bins, normalize=True)
    assert result.shape == (2, bins + 1)
    assert result.columns.tolist() == [
        "group",
        "1 - 2",
        "2 - 4",
        "4 - 6",
        "6 - 8",
        "8 - 10",
    ]
    assert result.values.tolist() == [
        ["A", 0.2, 0.0, 0.2, 0.0, 0.2],
        ["B", 0.0, 0.2, 0.0, 0.2, 0.0],
    ]


def test_histogram_with_groupby_and_cumulative():
    result = histogram(data, "a", ["group"], bins, cumulative=True)
    assert result.shape == (2, bins + 1)
    assert result.columns.tolist() == [
        "group",
        "1 - 2",
        "2 - 4",
        "4 - 6",
        "6 - 8",
        "8 - 10",
    ]
    assert result.values.tolist() == [["A", 2, 2, 4, 4, 6], ["B", 0, 2, 2, 4, 4]]


def test_histogram_with_groupby_and_cumulative_and_normalize():
    result = histogram(data, "a", ["group"], bins, cumulative=True, normalize=True)
    assert result.shape == (2, bins + 1)
    assert result.columns.tolist() == [
        "group",
        "1 - 2",
        "2 - 4",
        "4 - 6",
        "6 - 8",
        "8 - 10",
    ]
    assert result.values.tolist() == [
        [
            "A",
            0.06666666666666667,
            0.06666666666666667,
            0.13333333333333333,
            0.13333333333333333,
            0.2,
        ],
        [
            "B",
            0.0,
            0.06666666666666667,
            0.06666666666666667,
            0.13333333333333333,
            0.13333333333333333,
        ],
    ]


def test_histogram_with_non_numeric_column():
    try:
        histogram(data, "b", ["group"], bins)
    except ValueError as e:
        assert str(e) == "The column 'b' must be numeric."


# test histogram ignore null values
def test_histogram_ignore_null_values():
    data_with_null = DataFrame(
        {
            "group": ["A", "A", "B", "B", "A", "A", "B", "B", "A", "A"],
            "a": [1, 2, 3, 4, 5, 6, 7, 8, 9, None],
            "b": [1, 2, 3, 4, 5, 6, 7, 8, 9, None],
        }
    )
    result = histogram(data_with_null, "a", ["group"], bins)
    assert result.shape == (2, bins + 1)
    assert result.columns.tolist() == [
        "group",
        "1 - 2",
        "2 - 4",
        "4 - 5",
        "5 - 7",
        "7 - 9",
    ]
    assert result.values.tolist() == [["A", 2, 0, 1, 1, 1], ["B", 0, 2, 0, 1, 1]]
