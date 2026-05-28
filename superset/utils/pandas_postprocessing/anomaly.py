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
from typing import Optional

import numpy as np
import pandas as pd
from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import DTTM_ALIAS


def _detect_anomalies_zscore(
    series: pd.Series,
    rolling_window: int,
    sensitivity: float,
) -> pd.Series:
    """
    Detect anomalies using rolling Z-score method.

    Points are flagged as anomalies if their Z-score (based on a rolling
    mean and standard deviation) exceeds the sensitivity threshold.

    :param series: numeric series to analyze
    :param rolling_window: window size for rolling statistics
    :param sensitivity: Z-score threshold for anomaly detection
    :return: boolean series indicating anomaly positions
    """
    rolling_mean = series.rolling(window=rolling_window, center=True).mean()
    rolling_std = series.rolling(window=rolling_window, center=True).std()

    # Avoid division by zero
    rolling_std = rolling_std.replace(0, np.nan)

    z_scores = (series - rolling_mean) / rolling_std
    return z_scores.abs() > sensitivity


def _detect_anomalies_mad(
    series: pd.Series,
    rolling_window: int,
    sensitivity: float,
) -> pd.Series:
    """
    Detect anomalies using rolling Median Absolute Deviation (MAD) method.

    Points are flagged as anomalies if their modified Z-score (based on
    rolling median and MAD) exceeds the sensitivity threshold.

    :param series: numeric series to analyze
    :param rolling_window: window size for rolling statistics
    :param sensitivity: modified Z-score threshold for anomaly detection
    :return: boolean series indicating anomaly positions
    """
    rolling_median = series.rolling(window=rolling_window, center=True).median()

    def rolling_mad(s: pd.Series) -> pd.Series:
        return s.rolling(window=rolling_window, center=True).apply(
            lambda x: np.median(np.abs(x - np.median(x))), raw=True
        )

    mad = rolling_mad(series)
    # Use the consistency constant for normal distribution
    mad_scaled = mad * 1.4826
    # Avoid division by zero
    mad_scaled = mad_scaled.replace(0, np.nan)

    modified_z_scores = (series - rolling_median) / mad_scaled
    return modified_z_scores.abs() > sensitivity


def anomaly_detection(
    df: DataFrame,
    method: str = "zscore",
    rolling_window: int = 14,
    sensitivity: float = 3.0,
    index: Optional[str] = None,
) -> DataFrame:
    """
    Detect anomalies in each numeric series of a timeseries dataframe.
    For each series, the operation creates a new column with the column name
    suffixed with `__anomaly` containing the original value where an anomaly
    is detected, and NaN elsewhere.

    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param method: Detection algorithm - 'zscore' for Z-score based detection,
           'mad' for Median Absolute Deviation based detection
    :param rolling_window: Window size for rolling statistics computation
    :param sensitivity: Threshold for anomaly detection (higher = fewer anomalies)
    :param index: the name of the column containing the x-axis data
    :return: DataFrame with anomaly columns appended
    """
    index = index or DTTM_ALIAS

    # validate inputs
    if method not in ("zscore", "mad"):
        raise InvalidPostProcessingError(
            _(
                "Invalid anomaly detection method: %(method)s. "
                "Must be 'zscore' or 'mad'",
                method=method,
            )
        )
    if not isinstance(rolling_window, int) or rolling_window < 3:
        raise InvalidPostProcessingError(_("Rolling window must be an integer >= 3"))
    if not isinstance(sensitivity, (int, float)) or sensitivity <= 0:
        raise InvalidPostProcessingError(_("Sensitivity must be a positive number"))
    if index not in df.columns:
        raise InvalidPostProcessingError(_("DataFrame must include temporal column"))
    if len(df.columns) < 2:
        raise InvalidPostProcessingError(
            _("DataFrame must include at least one series")
        )

    detect_fn = (
        _detect_anomalies_zscore if method == "zscore" else _detect_anomalies_mad
    )

    for column in [
        col
        for col in df.columns
        if col != index and pd.to_numeric(df[col], errors="coerce").notnull().all()
    ]:
        series = df[column].astype(float)
        is_anomaly = detect_fn(series, rolling_window, sensitivity)
        # Store the original value where anomaly is detected, NaN otherwise
        df[f"{column}__anomaly"] = series.where(is_anomaly, other=np.nan)

    return df
