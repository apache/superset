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

from datetime import datetime, timezone

import pandas as pd
from pandas.api.types import is_numeric_dtype

from superset.utils.core import GenericDataType
from superset.utils.excel import apply_column_types, df_to_excel


def test_timezone_conversion() -> None:
    """
    Test that columns with timezones are converted to a string.
    """
    df = pd.DataFrame({"dt": [datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc)]})
    apply_column_types(df, [GenericDataType.TEMPORAL])
    contents = df_to_excel(df)
    assert pd.read_excel(contents)["dt"][0] == "2023-01-01 00:00:00+00:00"


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
