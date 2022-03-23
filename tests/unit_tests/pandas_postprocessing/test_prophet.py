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
from importlib.util import find_spec

import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import DTTM_ALIAS
from superset.utils.pandas_postprocessing import prophet
from tests.unit_tests.fixtures.dataframes import prophet_df


def test_prophet_valid():
    pytest.importorskip("prophet")

    df = prophet(df=prophet_df, time_grain="P1M", periods=3, confidence_interval=0.9)
    columns = {column for column in df.columns}
    assert columns == {
        DTTM_ALIAS,
        "a__yhat",
        "a__yhat_upper",
        "a__yhat_lower",
        "a",
        "b__yhat",
        "b__yhat_upper",
        "b__yhat_lower",
        "b",
    }
    assert df[DTTM_ALIAS].iloc[0].to_pydatetime() == datetime(2018, 12, 31)
    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 3, 31)
    assert len(df) == 7

    df = prophet(df=prophet_df, time_grain="P1M", periods=5, confidence_interval=0.9)
    assert df[DTTM_ALIAS].iloc[0].to_pydatetime() == datetime(2018, 12, 31)
    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 5, 31)
    assert len(df) == 9


def test_prophet_valid_zero_periods():
    pytest.importorskip("prophet")

    df = prophet(df=prophet_df, time_grain="P1M", periods=0, confidence_interval=0.9)
    columns = {column for column in df.columns}
    assert columns == {
        DTTM_ALIAS,
        "a__yhat",
        "a__yhat_upper",
        "a__yhat_lower",
        "a",
        "b__yhat",
        "b__yhat_upper",
        "b__yhat_lower",
        "b",
    }
    assert df[DTTM_ALIAS].iloc[0].to_pydatetime() == datetime(2018, 12, 31)
    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2021, 12, 31)
    assert len(df) == 4


def test_prophet_import():
    dynamic_module = find_spec("prophet")
    if dynamic_module is None:
        with pytest.raises(InvalidPostProcessingError):
            prophet(df=prophet_df, time_grain="P1M", periods=3, confidence_interval=0.9)


def test_prophet_missing_temporal_column():
    df = prophet_df.drop(DTTM_ALIAS, axis=1)

    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=df, time_grain="P1M", periods=3, confidence_interval=0.9,
        )


def test_prophet_incorrect_confidence_interval():
    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df, time_grain="P1M", periods=3, confidence_interval=0.0,
        )

    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df, time_grain="P1M", periods=3, confidence_interval=1.0,
        )


def test_prophet_incorrect_periods():
    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df, time_grain="P1M", periods=-1, confidence_interval=0.8,
        )


def test_prophet_incorrect_time_grain():
    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df, time_grain="yearly", periods=10, confidence_interval=0.8,
        )
