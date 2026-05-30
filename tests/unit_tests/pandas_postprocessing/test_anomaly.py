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

import numpy as np
import pandas as pd
import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import DTTM_ALIAS
from superset.utils.pandas_postprocessing import anomaly_detection

anomaly_df = pd.DataFrame(
    {
        DTTM_ALIAS: [datetime(2020, 1, i) for i in range(1, 21)],
        "a": [
            10,
            11,
            10,
            12,
            11,
            10,
            11,
            10,
            100,
            11,
            10,
            12,
            11,
            10,
            11,
            10,
            12,
            11,
            10,
            11,
        ],
        "b": [
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
            5,
            6,
        ],
    }
)


def test_anomaly_detection_zscore():
    df = anomaly_detection(
        df=anomaly_df.copy(),
        method="zscore",
        rolling_window=7,
        sensitivity=2.0,
    )
    columns = set(df.columns)
    assert "a__anomaly" in columns
    assert "b__anomaly" in columns
    assert DTTM_ALIAS in columns
    assert len(df) == 20

    # The spike at index 8 (value=100) should be detected as an anomaly
    assert not np.isnan(df["a__anomaly"].iloc[8])
    assert df["a__anomaly"].iloc[8] == 100

    # All non-anomaly points should be NaN
    normal_indices = [i for i in range(20) if i != 8]
    nan_count = df["a__anomaly"].iloc[normal_indices].isna().sum()
    assert nan_count == len(normal_indices)


def test_anomaly_detection_mad():
    df = anomaly_detection(
        df=anomaly_df.copy(),
        method="mad",
        rolling_window=5,
        sensitivity=2.0,
    )
    columns = set(df.columns)
    assert "a__anomaly" in columns
    assert "b__anomaly" in columns
    assert len(df) == 20

    # The spike at index 8 (value=100) should be detected as an anomaly
    assert not np.isnan(df["a__anomaly"].iloc[8])
    assert df["a__anomaly"].iloc[8] == 100


def test_anomaly_detection_invalid_method():
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="invalid",
            rolling_window=5,
            sensitivity=2.0,
        )


def test_anomaly_detection_rolling_window_too_small():
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="zscore",
            rolling_window=2,
            sensitivity=2.0,
        )


def test_anomaly_detection_invalid_sensitivity():
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="zscore",
            rolling_window=5,
            sensitivity=-1.0,
        )

    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="zscore",
            rolling_window=5,
            sensitivity=0,
        )


def test_anomaly_detection_missing_temporal_column():
    df = anomaly_df.drop(DTTM_ALIAS, axis=1)
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=df.copy(),
            method="zscore",
            rolling_window=5,
            sensitivity=2.0,
        )


def test_anomaly_detection_no_series():
    df = anomaly_df[[DTTM_ALIAS]].copy()
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=df,
            method="zscore",
            rolling_window=5,
            sensitivity=2.0,
        )


def test_anomaly_detection_custom_index():
    df = pd.DataFrame(
        {
            "my_time": [datetime(2020, 1, i) for i in range(1, 21)],
            "val": [1, 2, 1, 2, 1, 2, 1, 2, 1, 50, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        }
    )
    result = anomaly_detection(
        df=df,
        method="zscore",
        rolling_window=5,
        sensitivity=1.5,
        index="my_time",
    )
    assert "val__anomaly" in result.columns
    assert not np.isnan(result["val__anomaly"].iloc[9])
    assert result["val__anomaly"].iloc[9] == 50


def test_anomaly_detection_preserves_original_columns():
    df = anomaly_df.copy()
    original_columns = list(df.columns)
    result = anomaly_detection(
        df=df,
        method="zscore",
        rolling_window=5,
        sensitivity=2.0,
    )
    for col in original_columns:
        assert col in result.columns
    assert len(result.columns) == len(original_columns) + 2


def test_anomaly_detection_prophet():
    """Test Prophet-based anomaly detection with seasonality awareness."""
    try:
        import prophet  # noqa: F401
    except ModuleNotFoundError:
        pytest.skip("prophet not installed")

    # Create data with a clear seasonal pattern and one anomaly
    dates = pd.date_range("2020-01-01", periods=60, freq="D")
    # Sine wave pattern (weekly-ish) with one obvious outlier
    values = [10 + 5 * np.sin(2 * np.pi * i / 7) for i in range(60)]
    values[30] = 100  # obvious anomaly far outside any reasonable confidence band

    df = pd.DataFrame({DTTM_ALIAS: dates, "metric": values})
    result = anomaly_detection(
        df=df,
        method="prophet",
        confidence_interval=0.8,
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=False,
    )
    assert "metric__anomaly" in result.columns
    assert len(result) == 60
    # The spike at index 30 (value=100) should be detected
    assert not np.isnan(result["metric__anomaly"].iloc[30])
    assert result["metric__anomaly"].iloc[30] == 100


def test_anomaly_detection_prophet_invalid_confidence():
    """Test that invalid confidence interval raises error."""
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="prophet",
            confidence_interval=0,
        )
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="prophet",
            confidence_interval=1.0,
        )
    with pytest.raises(InvalidPostProcessingError):
        anomaly_detection(
            df=anomaly_df.copy(),
            method="prophet",
            confidence_interval=1.5,
        )


def test_anomaly_detection_with_forecast_columns():
    """Test that anomaly detection processes __yhat and skips bounds automatically."""
    df = pd.DataFrame(
        {
            DTTM_ALIAS: [datetime(2020, 1, i) for i in range(1, 21)],
            "metric": [1, 2, 1, 2, 1, 2, 1, 2, 1, 50, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
            "metric__yhat": [
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                80,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
                1.5,
            ],
            "metric__yhat_lower": [0.5] * 20,
            "metric__yhat_upper": [2.5] * 20,
        }
    )
    result = anomaly_detection(
        df=df,
        method="zscore",
        rolling_window=5,
        sensitivity=1.5,
    )
    # Should process both original AND forecast prediction (__yhat) columns
    assert "metric__anomaly" in result.columns
    assert "metric__yhat__anomaly" in result.columns
    # Should skip confidence bounds
    assert "metric__yhat_lower__anomaly" not in result.columns
    assert "metric__yhat_upper__anomaly" not in result.columns
    # The spike in __yhat should be detected
    assert not np.isnan(result["metric__yhat__anomaly"].iloc[9])


def test_anomaly_detection_skips_null_columns_from_forecast():
    """Test that columns with NaN (from forecast future periods) are skipped."""
    df = pd.DataFrame(
        {
            DTTM_ALIAS: [datetime(2020, 1, i) for i in range(1, 25)],
            # Original metric has NaN for future periods (as prophet produces)
            "metric": [1, 2, 1, 2, 1, 2, 1, 2, 1, 50, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
            + [np.nan] * 4,
            # __yhat is complete for all dates
            "metric__yhat": [1.5] * 24,
            "metric__yhat_lower": [0.5] * 24,
            "metric__yhat_upper": [2.5] * 24,
        }
    )
    result = anomaly_detection(
        df=df,
        method="zscore",
        rolling_window=5,
        sensitivity=1.5,
    )
    # Original metric has NaN so it should be skipped
    assert "metric__anomaly" not in result.columns
    # __yhat is complete so it should be processed
    assert "metric__yhat__anomaly" in result.columns
    # Bounds still skipped
    assert "metric__yhat_lower__anomaly" not in result.columns
    assert "metric__yhat_upper__anomaly" not in result.columns
