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

    # Non-anomaly points should be NaN
    normal_indices = [i for i in range(20) if i != 8]
    nan_count = df["a__anomaly"].iloc[normal_indices].isna().sum()
    assert nan_count > 0


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
