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

import pandas as pd
import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import DTTM_ALIAS
from superset.utils.pandas_postprocessing import prophet
from tests.unit_tests.fixtures.dataframes import prophet_df


def test_prophet_valid():
    df = prophet(df=prophet_df, time_grain="P1M", periods=3, confidence_interval=0.9)
    columns = {column for column in df.columns}  # noqa: C416
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

    df = prophet(
        df=pd.DataFrame(
            {
                "__timestamp": [datetime(2022, 1, 2), datetime(2022, 1, 9)],
                "x": [1, 1],
            }
        ),
        time_grain="P1W",
        periods=1,
        confidence_interval=0.9,
    )

    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 1, 16)
    assert len(df) == 3

    df = prophet(
        df=pd.DataFrame(
            {
                "__timestamp": [datetime(2022, 1, 2), datetime(2022, 1, 9)],
                "x": [1, 1],
            }
        ),
        time_grain="1969-12-28T00:00:00Z/P1W",
        periods=1,
        confidence_interval=0.9,
    )

    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 1, 16)
    assert len(df) == 3

    df = prophet(
        df=pd.DataFrame(
            {
                "__timestamp": [datetime(2022, 1, 3), datetime(2022, 1, 10)],
                "x": [1, 1],
            }
        ),
        time_grain="1969-12-29T00:00:00Z/P1W",
        periods=1,
        confidence_interval=0.9,
    )

    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 1, 17)
    assert len(df) == 3

    df = prophet(
        df=pd.DataFrame(
            {
                "__timestamp": [datetime(2022, 1, 8), datetime(2022, 1, 15)],
                "x": [1, 1],
            }
        ),
        time_grain="P1W/1970-01-03T00:00:00Z",
        periods=1,
        confidence_interval=0.9,
    )

    assert df[DTTM_ALIAS].iloc[-1].to_pydatetime() == datetime(2022, 1, 22)
    assert len(df) == 3


def test_prophet_valid_zero_periods():
    df = prophet(df=prophet_df, time_grain="P1M", periods=0, confidence_interval=0.9)
    columns = {column for column in df.columns}  # noqa: C416
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
            df=df,
            time_grain="P1M",
            periods=3,
            confidence_interval=0.9,
        )


def test_prophet_incorrect_confidence_interval():
    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df,
            time_grain="P1M",
            periods=3,
            confidence_interval=0.0,
        )

    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df,
            time_grain="P1M",
            periods=3,
            confidence_interval=1.0,
        )


def test_prophet_incorrect_periods():
    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df,
            time_grain="P1M",
            periods=-1,
            confidence_interval=0.8,
        )


def test_prophet_incorrect_time_grain():
    with pytest.raises(InvalidPostProcessingError):
        prophet(
            df=prophet_df,
            time_grain="yearly",
            periods=10,
            confidence_interval=0.8,
        )


def test_prophet_uncertainty_lower_bound_can_be_negative_for_negative_series():
    """
    Regression for #21734: when the input series contains negative values,
    the forecast's lower confidence bound (``__yhat_lower``) must be allowed
    to go below zero. The original bug claimed Superset clipped the lower
    bound at 0, hiding the natural shape of the uncertainty interval for
    series like temperatures or signed deltas.

    Superset's wrapper passes through Prophet's output unchanged (no
    clipping in ``superset/utils/pandas_postprocessing/prophet.py``); this
    test pins that contract end-to-end. If a future refactor introduces
    a ``max(0, lower)`` clamp, this test fails immediately.
    """
    if find_spec("prophet") is None:
        pytest.skip("prophet not installed")

    # All-negative monthly series — any reasonable forecast must predict
    # negative values (and therefore negative uncertainty bounds) too.
    negative_df = pd.DataFrame(
        {
            DTTM_ALIAS: [datetime(2020, m, 1) for m in range(1, 13)]
            + [datetime(2021, m, 1) for m in range(1, 13)],
            "temperature": [
                -5.0,
                -7.0,
                -3.0,
                1.0,
                8.0,
                14.0,
                17.0,
                16.0,
                11.0,
                5.0,
                -1.0,
                -4.0,
                -6.0,
                -8.0,
                -2.0,
                2.0,
                9.0,
                15.0,
                18.0,
                17.0,
                12.0,
                6.0,
                0.0,
                -3.0,
            ],
        }
    )

    result = prophet(
        df=negative_df,
        time_grain="P1M",
        periods=3,
        confidence_interval=0.9,
    )

    assert "temperature__yhat_lower" in result.columns
    # Restrict to the forecast horizon (the last `periods` rows). The full
    # output also contains historical fitted points, which can be negative
    # for in-sample data even if a future-only clamp were introduced — so
    # asserting on the whole frame would let a future-only clamp slip past.
    forecast_periods = 3
    forecast_lower = result["temperature__yhat_lower"].iloc[-forecast_periods:]
    assert (forecast_lower < 0).any(), (
        "Forecast (future) lower bound was non-negative everywhere despite "
        "a series with negative actuals — suggests an unexpected clamp at "
        "zero was reintroduced (regression of #21734)."
    )


def test_prophet_does_not_clamp_yhat_below_zero_for_negative_actuals():
    """
    Companion to the lower-bound test above: the central forecast
    (``__yhat``) must also be allowed to go negative.
    A bug that clamps the central forecast at zero would force the lower
    bound non-negative as a side effect, masking the wider issue.
    """
    if find_spec("prophet") is None:
        pytest.skip("prophet not installed")

    negative_df = pd.DataFrame(
        {
            DTTM_ALIAS: [datetime(2020, m, 1) for m in range(1, 13)],
            "balance": [
                -100.0,
                -110.0,
                -95.0,
                -120.0,
                -130.0,
                -125.0,
                -140.0,
                -135.0,
                -150.0,
                -145.0,
                -160.0,
                -155.0,
            ],
        }
    )

    result = prophet(
        df=negative_df,
        time_grain="P1M",
        periods=2,
        confidence_interval=0.8,
    )

    # Restrict to the forecast horizon — see lower-bound test above for the
    # rationale. A future-only clamp on `__yhat` could leave historical
    # in-sample fitted points negative and pass an unrestricted assertion.
    forecast_periods = 2
    forecast_yhat = result["balance__yhat"].iloc[-forecast_periods:]
    assert (forecast_yhat < 0).any()
