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
import datetime
from unittest.mock import MagicMock

import pandas as pd

from superset.common.utils import dataframe_utils


def test_is_datetime_series():
    assert not dataframe_utils.is_datetime_series(None)
    assert not dataframe_utils.is_datetime_series(pd.DataFrame({"foo": [1]}))
    assert not dataframe_utils.is_datetime_series(pd.Series([1, 2, 3]))
    assert not dataframe_utils.is_datetime_series(pd.Series(["1", "2", "3"]))
    assert not dataframe_utils.is_datetime_series(pd.Series())
    assert not dataframe_utils.is_datetime_series(pd.Series([None, None]))
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.date(2018, 1, 1), datetime.date(2018, 1, 2), None])
    )
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.date(2018, 1, 1), datetime.date(2018, 1, 2)])
    )
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.datetime(2018, 1, 1), datetime.datetime(2018, 1, 2), None])
    )
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.datetime(2018, 1, 1), datetime.datetime(2018, 1, 2)])
    )
    assert dataframe_utils.is_datetime_series(
        pd.date_range(datetime.date(2018, 1, 1), datetime.date(2018, 2, 1)).to_series()
    )
    assert dataframe_utils.is_datetime_series(
        pd.date_range(
            datetime.datetime(2018, 1, 1), datetime.datetime(2018, 2, 1)
        ).to_series()
    )


def test_df_metrics_to_num_converts_string_numerics():
    """Test that string-encoded numeric columns (e.g. from ClickHouse) are converted."""
    query_object = MagicMock()
    query_object.metric_names = ["sum_col", "mixed_col", "text_col"]
    df = pd.DataFrame(
        {
            "sum_col": pd.Series(["100", "200", "300"], dtype=object),
            "mixed_col": pd.Series(["1", "not_a_number", "3"], dtype=object),
            "text_col": pd.Series(["foo", "bar", "baz"], dtype=object),
            "dim_col": pd.Series(["a", "b", "c"], dtype=object),
        }
    )
    dataframe_utils.df_metrics_to_num(df, query_object)
    # sum_col: all numeric strings -> should be converted to numeric
    assert pd.api.types.is_numeric_dtype(df["sum_col"]), "sum_col should be numeric"
    assert df["sum_col"].tolist() == [100.0, 200.0, 300.0]
    # mixed_col: has non-numeric value -> should NOT be converted
    assert df["mixed_col"].dtype == object, "mixed_col should remain object"
    # text_col: all non-numeric -> should NOT be converted
    assert df["text_col"].dtype == object, "text_col should remain object"
    # dim_col: not in metric_names -> should NOT be touched
    assert df["dim_col"].dtype == object, "dim_col should not be touched"
