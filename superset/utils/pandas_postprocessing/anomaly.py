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
from typing import Optional, Union

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


def _detect_anomalies_prophet(
    df: DataFrame,
    column: str,
    index: str,
    confidence_interval: float,
    yearly_seasonality: Union[bool, str, int],
    weekly_seasonality: Union[bool, str, int],
    daily_seasonality: Union[bool, str, int],
) -> pd.Series:
    """
    Detect anomalies using Prophet's confidence intervals.

    Fits a Prophet model with the specified seasonality settings, then flags
    data points that fall outside the predicted confidence interval (yhat_lower,
    yhat_upper) as anomalies.

    :param df: DataFrame with temporal index and series column
    :param column: name of the numeric series column
    :param index: name of the temporal column
    :param confidence_interval: width of the confidence interval (0 to 1)
    :param yearly_seasonality: yearly seasonality setting for Prophet
    :param weekly_seasonality: weekly seasonality setting for Prophet
    :param daily_seasonality: daily seasonality setting for Prophet
    :return: boolean series indicating anomaly positions
    """
    try:
        from superset.utils.decorators import suppress_logging

        with suppress_logging("prophet.plot"):
            from prophet import Prophet  # pylint: disable=import-outside-toplevel
    except ModuleNotFoundError as ex:
        raise InvalidPostProcessingError(_("`prophet` package not installed")) from ex

    fit_df = df[[index, column]].copy()
    fit_df.columns = ["ds", "y"]
    if fit_df["ds"].dt.tz:
        fit_df["ds"] = fit_df["ds"].dt.tz_convert(None)

    model = Prophet(
        interval_width=confidence_interval,
        yearly_seasonality=yearly_seasonality,
        weekly_seasonality=weekly_seasonality,
        daily_seasonality=daily_seasonality,
    )
    model.fit(fit_df)

    forecast = model.predict(fit_df[["ds"]])
    is_anomaly = (fit_df["y"].values < forecast["yhat_lower"].values) | (
        fit_df["y"].values > forecast["yhat_upper"].values
    )
    return pd.Series(is_anomaly, index=df.index)


def _parse_seasonality(
    val: Optional[Union[bool, int]],
) -> Union[bool, str, int]:
    if val is None:
        return "auto"
    if isinstance(val, bool):
        return val
    try:
        return int(val)
    except (ValueError, TypeError):
        return val


def _validate_anomaly_inputs(
    df: DataFrame,
    method: str,
    rolling_window: int,
    sensitivity: float,
    confidence_interval: float,
    index: str,
) -> None:
    """Validate inputs for anomaly_detection."""
    if method not in ("zscore", "mad", "prophet"):
        raise InvalidPostProcessingError(
            _(
                "Invalid anomaly detection method: %(method)s. "
                "Must be 'zscore', 'mad', or 'prophet'",
                method=method,
            )
        )
    if method in ("zscore", "mad"):
        if not isinstance(rolling_window, int) or rolling_window < 3:
            raise InvalidPostProcessingError(
                _("Rolling window must be an integer >= 3")
            )
        if not isinstance(sensitivity, (int, float)) or sensitivity <= 0:
            raise InvalidPostProcessingError(_("Sensitivity must be a positive number"))
    if method == "prophet":
        if (
            not confidence_interval
            or confidence_interval <= 0
            or confidence_interval >= 1
        ):
            raise InvalidPostProcessingError(
                _("Confidence interval must be between 0 and 1 (exclusive)")
            )
    if index not in df.columns:
        raise InvalidPostProcessingError(_("DataFrame must include temporal column"))
    if len(df.columns) < 2:
        raise InvalidPostProcessingError(
            _("DataFrame must include at least one series")
        )


def anomaly_detection(
    df: DataFrame,
    method: str = "zscore",
    rolling_window: int = 14,
    sensitivity: float = 3.0,
    index: Optional[str] = None,
    confidence_interval: float = 0.8,
    yearly_seasonality: Optional[Union[bool, int]] = None,
    weekly_seasonality: Optional[Union[bool, int]] = None,
    daily_seasonality: Optional[Union[bool, int]] = None,
) -> DataFrame:
    """
    Detect anomalies in each numeric series of a timeseries dataframe.
    For each series, the operation creates a new column with the column name
    suffixed with `__anomaly` containing the original value where an anomaly
    is detected, and NaN elsewhere.

    When forecast columns are present (from Prophet post-processing), anomaly
    detection automatically runs on the forecast prediction (__yhat) columns
    and skips the original data columns (which contain NaN for future periods).
    Confidence bound columns (__yhat_lower, __yhat_upper) are always skipped.

    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param method: Detection algorithm - 'zscore' for Z-score based detection,
           'mad' for Median Absolute Deviation based detection,
           'prophet' for Prophet-based seasonality-aware detection
    :param rolling_window: Window size for rolling statistics computation
           (used by zscore and mad methods)
    :param sensitivity: Threshold for anomaly detection (higher = fewer anomalies)
           (used by zscore and mad methods)
    :param index: the name of the column containing the x-axis data
    :param confidence_interval: Width of the confidence interval for Prophet method
           (0 to 1, e.g., 0.8 means 80% confidence interval)
    :param yearly_seasonality: Should yearly seasonality be applied (Prophet method)
    :param weekly_seasonality: Should weekly seasonality be applied (Prophet method)
    :param daily_seasonality: Should daily seasonality be applied (Prophet method)
    :return: DataFrame with anomaly columns appended
    """
    index = index or DTTM_ALIAS
    _validate_anomaly_inputs(
        df, method, rolling_window, sensitivity, confidence_interval, index
    )

    detect_fn = (
        _detect_anomalies_zscore if method == "zscore" else _detect_anomalies_mad
    )

    forecast_bounds_suffixes = ("__yhat_lower", "__yhat_upper")

    def _should_process_column(col: str) -> bool:
        if col == index:
            return False
        if not pd.to_numeric(df[col], errors="coerce").notnull().all():
            return False
        # Always skip confidence bound columns
        if col.endswith(forecast_bounds_suffixes):
            return False
        # Always process __yhat and original data columns
        return True

    for column in [col for col in df.columns if _should_process_column(col)]:
        series = df[column].astype(float)
        if method == "prophet":
            is_anomaly = _detect_anomalies_prophet(
                df=df,
                column=column,
                index=index,
                confidence_interval=confidence_interval,
                yearly_seasonality=_parse_seasonality(yearly_seasonality),
                weekly_seasonality=_parse_seasonality(weekly_seasonality),
                daily_seasonality=_parse_seasonality(daily_seasonality),
            )
        else:
            is_anomaly = detect_fn(series, rolling_window, sensitivity)
        # Store the original value where anomaly is detected, NaN otherwise
        df[f"{column}__anomaly"] = series.where(is_anomaly, other=np.nan)

    return df
