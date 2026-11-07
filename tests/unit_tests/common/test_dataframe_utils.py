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
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest

from superset.common.chart_data import ChartDataResultType
from superset.common.query_object import QueryObject
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


@pytest.mark.parametrize("dtype", ["object", "str", "string"])
@pytest.mark.parametrize("nullable", [False, True])
def test_df_metrics_to_num_converts_string_numerics(dtype: str, nullable: bool) -> None:
    """Test that string-encoded numeric columns (e.g. from ClickHouse) are converted."""
    query_object = MagicMock()
    query_object.metric_names = ["sum_col", "mixed_col", "text_col"]
    df = pd.DataFrame(
        {
            "sum_col": pd.Series(
                ["100", "200", None if nullable else "300"], dtype=dtype
            ),
            "mixed_col": pd.Series(["1", "not_a_number", "3"], dtype=dtype),
            "text_col": pd.Series(["foo", "bar", "baz"], dtype=dtype),
            "dim_col": pd.Series(["10", "20", "30"], dtype=dtype),
        }
    )
    original = df.copy()
    dataframe_utils.df_metrics_to_num(df, query_object)
    # sum_col: all numeric strings -> should be converted to numeric
    assert pd.api.types.is_numeric_dtype(df["sum_col"]), "sum_col should be numeric"
    assert df["sum_col"].iloc[:2].tolist() == [100, 200]
    if nullable:
        assert pd.isna(df["sum_col"].iloc[2])
    else:
        assert df["sum_col"].iloc[2] == 300
    assert df.assign(group="group").groupby("group")["sum_col"].mean().iloc[0] == (
        150 if nullable else 200
    )
    # mixed_col: has non-numeric value -> should NOT be converted
    pd.testing.assert_series_equal(df["mixed_col"], original["mixed_col"])
    # text_col: all non-numeric -> should NOT be converted
    pd.testing.assert_series_equal(df["text_col"], original["text_col"])
    # dim_col: not in metric_names -> should NOT be touched
    pd.testing.assert_series_equal(df["dim_col"], original["dim_col"])


@pytest.mark.parametrize(
    "fields, expected",
    [
        pytest.param({}, True, id="plain"),
        pytest.param({"result_type": ChartDataResultType.FULL}, True, id="full"),
        pytest.param({"result_type": ChartDataResultType.RESULTS}, True, id="results"),
        pytest.param({"result_type": ChartDataResultType.SAMPLES}, True, id="samples"),
        pytest.param(
            {"result_type": ChartDataResultType.DRILL_DETAIL}, True, id="drill-detail"
        ),
        pytest.param({"result_type": None}, True, id="no-result-type"),
        pytest.param({"grouping_sets": [["a"], []]}, True, id="grouping-sets"),
        pytest.param(
            {"post_processing": [{"operation": "cum", "options": {}}]},
            False,
            id="post-processing",
        ),
        pytest.param({"time_offsets": ["1 week ago"]}, False, id="time-offsets"),
        pytest.param(
            {"result_type": ChartDataResultType.POST_PROCESSED},
            False,
            id="post-processed",
        ),
    ],
)
def test_can_keep_exact_integers(fields: dict[str, Any], expected: bool) -> None:
    query_object = QueryObject(datasource=MagicMock(), columns=["a"], **fields)

    assert dataframe_utils.can_keep_exact_integers(query_object) is expected


def test_lossy_integer_columns_lists_only_selected_dimensions() -> None:
    large = 2**60 + 1
    lossy = pd.Series([large, None], dtype=object)
    query_object = QueryObject(
        datasource=MagicMock(), columns=["dim", "small"], metrics=["metric"]
    )
    df = pd.DataFrame(
        {
            "dim": lossy,
            "small": pd.Series([7, None], dtype=object),
            "metric": lossy.copy(),
            "unselected": lossy.copy(),
        }
    )

    assert dataframe_utils.lossy_integer_columns(df, query_object) == ["dim"]
