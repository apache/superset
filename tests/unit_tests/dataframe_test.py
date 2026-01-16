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
# pylint: disable=unused-argument, import-outside-toplevel
from datetime import datetime

import pytest
from pandas import Timestamp
from pandas._libs.tslibs import NaT

from superset.dataframe import df_to_records
from superset.superset_typing import DbapiDescription


def test_df_to_records() -> None:
    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    data = [("a1", "b1", "c1"), ("a2", "b2", "c2")]
    cursor_descr: DbapiDescription = [
        (column, "string", None, None, None, None, False) for column in ("a", "b", "c")
    ]
    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"a": "a1", "b": "b1", "c": "c1"},
        {"a": "a2", "b": "b2", "c": "c2"},
    ]


def test_df_to_records_NaT_type() -> None:  # noqa: N802
    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    data = [(NaT,), (Timestamp("2023-01-06 20:50:31.749000+0000", tz="UTC"),)]
    cursor_descr: DbapiDescription = [
        ("date", "timestamp with time zone", None, None, None, None, False)
    ]
    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"date": None},
        {"date": "2023-01-06 20:50:31.749000+00:00"},
    ]


def test_df_to_records_mixed_emoji_type() -> None:
    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    data = [
        ("What's up?", "This is a string text", 1),
        ("What's up?", "This is a string with an 😍 added", 2),
        ("What's up?", NaT, 3),
        ("What's up?", "Last emoji 😁", 4),
    ]

    cursor_descr: DbapiDescription = [
        ("question", "varchar", None, None, None, None, False),
        ("response", "varchar", None, None, None, None, False),
        ("count", "integer", None, None, None, None, False),
    ]

    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"question": "What's up?", "response": "This is a string text", "count": 1},
        {
            "question": "What's up?",
            "response": "This is a string with an 😍 added",
            "count": 2,
        },
        {
            "question": "What's up?",
            "response": None,
            "count": 3,
        },
        {
            "question": "What's up?",
            "response": "Last emoji 😁",
            "count": 4,
        },
    ]


def test_df_to_records_mixed_accent_type() -> None:
    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    data = [
        ("What's up?", "This is a string text", 1),
        ("What's up?", "This is a string with áccent", 2),
        ("What's up?", NaT, 3),
        ("What's up?", "móre áccent", 4),
    ]

    cursor_descr: DbapiDescription = [
        ("question", "varchar", None, None, None, None, False),
        ("response", "varchar", None, None, None, None, False),
        ("count", "integer", None, None, None, None, False),
    ]

    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"question": "What's up?", "response": "This is a string text", "count": 1},
        {
            "question": "What's up?",
            "response": "This is a string with áccent",
            "count": 2,
        },
        {
            "question": "What's up?",
            "response": None,
            "count": 3,
        },
        {
            "question": "What's up?",
            "response": "móre áccent",
            "count": 4,
        },
    ]


def test_js_max_int() -> None:
    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    data = [(1, 1239162456494753670, "c1"), (2, 100, "c2")]
    cursor_descr: DbapiDescription = [
        ("a", "int", None, None, None, None, False),
        ("b", "int", None, None, None, None, False),
        ("c", "string", None, None, None, None, False),
    ]
    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"a": 1, "b": "1239162456494753670", "c": "c1"},
        {"a": 2, "b": 100, "c": "c2"},
    ]


@pytest.mark.parametrize(
    "input_, expected",
    [
        pytest.param(
            [
                (datetime.strptime("1677-09-22 00:12:43", "%Y-%m-%d %H:%M:%S"), 1),
                (datetime.strptime("2262-04-11 23:47:17", "%Y-%m-%d %H:%M:%S"), 2),
            ],
            [
                {
                    "a": datetime.strptime("1677-09-22 00:12:43", "%Y-%m-%d %H:%M:%S"),
                    "b": 1,
                },
                {
                    "a": datetime.strptime("2262-04-11 23:47:17", "%Y-%m-%d %H:%M:%S"),
                    "b": 2,
                },
            ],
            id="timestamp conversion fail",
        ),
        pytest.param(
            [
                (datetime.strptime("1677-09-22 00:12:44", "%Y-%m-%d %H:%M:%S"), 1),
                (datetime.strptime("2262-04-11 23:47:16", "%Y-%m-%d %H:%M:%S"), 2),
            ],
            [
                {"a": Timestamp("1677-09-22 00:12:44"), "b": 1},
                {"a": Timestamp("2262-04-11 23:47:16"), "b": 2},
            ],
            id="timestamp conversion success",
        ),
    ],
)
def test_max_pandas_timestamp(input_, expected) -> None:
    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    cursor_descr: DbapiDescription = [
        ("a", "datetime", None, None, None, None, False),
        ("b", "int", None, None, None, None, False),
    ]
    results = SupersetResultSet(input_, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == expected


def test_df_to_records_with_nan_from_division_by_zero() -> None:
    """Test that NaN values from division by zero are converted to None."""
    import numpy as np

    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    # Simulate Athena query: select 0.00 / 0.00 as test
    data = [(np.nan,), (5.0,), (np.nan,)]
    cursor_descr: DbapiDescription = [("test", "double", None, None, None, None, False)]
    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"test": None},
        {"test": 5.0},
        {"test": None},
    ]


def test_df_to_records_with_mixed_nan_and_valid_values() -> None:
    """Test that NaN values are properly handled alongside valid numeric data."""
    import numpy as np

    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    # Simulate a query with multiple columns containing NaN values
    data = [
        ("row1", 10.5, np.nan, 100),
        ("row2", np.nan, 20.3, 200),
        ("row3", 30.7, 40.2, np.nan),
        ("row4", np.nan, np.nan, np.nan),
    ]
    cursor_descr: DbapiDescription = [
        ("name", "varchar", None, None, None, None, False),
        ("value1", "double", None, None, None, None, False),
        ("value2", "double", None, None, None, None, False),
        ("value3", "int", None, None, None, None, False),
    ]
    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    assert df_to_records(df) == [
        {"name": "row1", "value1": 10.5, "value2": None, "value3": 100},
        {"name": "row2", "value1": None, "value2": 20.3, "value3": 200},
        {"name": "row3", "value1": 30.7, "value2": 40.2, "value3": None},
        {"name": "row4", "value1": None, "value2": None, "value3": None},
    ]


def test_df_to_records_with_inf_and_nan() -> None:
    """Test that both NaN and infinity values are handled correctly."""
    import numpy as np

    from superset.db_engine_specs import BaseEngineSpec
    from superset.result_set import SupersetResultSet

    # Test various edge cases: NaN, positive infinity, negative infinity
    data = [
        (np.nan, "division by zero"),
        (np.inf, "positive infinity"),
        (-np.inf, "negative infinity"),
        (0.0, "zero"),
        (42.5, "normal value"),
    ]
    cursor_descr: DbapiDescription = [
        ("result", "double", None, None, None, None, False),
        ("description", "varchar", None, None, None, None, False),
    ]
    results = SupersetResultSet(data, cursor_descr, BaseEngineSpec)
    df = results.to_pandas_df()

    records = df_to_records(df)

    # NaN should be converted to None
    assert records[0]["result"] is None
    assert records[0]["description"] == "division by zero"

    # Infinity values should remain as-is (they're valid JSON)
    assert records[1]["result"] == np.inf
    assert records[2]["result"] == -np.inf

    # Normal values should remain unchanged
    assert records[3]["result"] == 0.0
    assert records[4]["result"] == 42.5
