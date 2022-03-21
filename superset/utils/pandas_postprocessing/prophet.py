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
import logging
from typing import Optional, Union

from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import QueryObjectValidationError
from superset.utils.core import DTTM_ALIAS
from superset.utils.pandas_postprocessing.utils import PROPHET_TIME_GRAIN_MAP


def _prophet_parse_seasonality(
    input_value: Optional[Union[bool, int]]
) -> Union[bool, str, int]:
    if input_value is None:
        return "auto"
    if isinstance(input_value, bool):
        return input_value
    try:
        return int(input_value)
    except ValueError:
        return input_value


def _prophet_fit_and_predict(  # pylint: disable=too-many-arguments
    df: DataFrame,
    confidence_interval: float,
    yearly_seasonality: Union[bool, str, int],
    weekly_seasonality: Union[bool, str, int],
    daily_seasonality: Union[bool, str, int],
    periods: int,
    freq: str,
) -> DataFrame:
    """
    Fit a prophet model and return a DataFrame with predicted results.
    """
    try:
        # pylint: disable=import-error,import-outside-toplevel
        from prophet import Prophet

        prophet_logger = logging.getLogger("prophet.plot")
        prophet_logger.setLevel(logging.CRITICAL)
        prophet_logger.setLevel(logging.NOTSET)
    except ModuleNotFoundError as ex:
        raise QueryObjectValidationError(_("`prophet` package not installed")) from ex
    model = Prophet(
        interval_width=confidence_interval,
        yearly_seasonality=yearly_seasonality,
        weekly_seasonality=weekly_seasonality,
        daily_seasonality=daily_seasonality,
    )
    if df["ds"].dt.tz:
        df["ds"] = df["ds"].dt.tz_convert(None)
    model.fit(df)
    future = model.make_future_dataframe(periods=periods, freq=freq)
    forecast = model.predict(future)[["ds", "yhat", "yhat_lower", "yhat_upper"]]
    return forecast.join(df.set_index("ds"), on="ds").set_index(["ds"])


def prophet(  # pylint: disable=too-many-arguments
    df: DataFrame,
    time_grain: str,
    periods: int,
    confidence_interval: float,
    yearly_seasonality: Optional[Union[bool, int]] = None,
    weekly_seasonality: Optional[Union[bool, int]] = None,
    daily_seasonality: Optional[Union[bool, int]] = None,
    index: Optional[str] = None,
) -> DataFrame:
    """
    Add forecasts to each series in a timeseries dataframe, along with confidence
    intervals for the prediction. For each series, the operation creates three
    new columns with the column name suffixed with the following values:

    - `__yhat`: the forecast for the given date
    - `__yhat_lower`: the lower bound of the forecast for the given date
    - `__yhat_upper`: the upper bound of the forecast for the given date


    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param time_grain: Time grain used to specify time period increments in prediction
    :param periods: Time periods (in units of `time_grain`) to predict into the future
    :param confidence_interval: Width of predicted confidence interval
    :param yearly_seasonality: Should yearly seasonality be applied.
           An integer value will specify Fourier order of seasonality.
    :param weekly_seasonality: Should weekly seasonality be applied.
           An integer value will specify Fourier order of seasonality, `None` will
           automatically detect seasonality.
    :param daily_seasonality: Should daily seasonality be applied.
           An integer value will specify Fourier order of seasonality, `None` will
           automatically detect seasonality.
    :param index: the name of the column containing the x-axis data
    :return: DataFrame with contributions, with temporal column at beginning if present
    """
    index = index or DTTM_ALIAS
    # validate inputs
    if not time_grain:
        raise QueryObjectValidationError(_("Time grain missing"))
    if time_grain not in PROPHET_TIME_GRAIN_MAP:
        raise QueryObjectValidationError(
            _("Unsupported time grain: %(time_grain)s", time_grain=time_grain,)
        )
    freq = PROPHET_TIME_GRAIN_MAP[time_grain]
    # check type at runtime due to marhsmallow schema not being able to handle
    # union types
    if not isinstance(periods, int) or periods < 0:
        raise QueryObjectValidationError(_("Periods must be a whole number"))
    if not confidence_interval or confidence_interval <= 0 or confidence_interval >= 1:
        raise QueryObjectValidationError(
            _("Confidence interval must be between 0 and 1 (exclusive)")
        )
    if index not in df.columns:
        raise QueryObjectValidationError(_("DataFrame must include temporal column"))
    if len(df.columns) < 2:
        raise QueryObjectValidationError(_("DataFrame include at least one series"))

    target_df = DataFrame()
    for column in [column for column in df.columns if column != index]:
        fit_df = _prophet_fit_and_predict(
            df=df[[index, column]].rename(columns={index: "ds", column: "y"}),
            confidence_interval=confidence_interval,
            yearly_seasonality=_prophet_parse_seasonality(yearly_seasonality),
            weekly_seasonality=_prophet_parse_seasonality(weekly_seasonality),
            daily_seasonality=_prophet_parse_seasonality(daily_seasonality),
            periods=periods,
            freq=freq,
        )
        new_columns = [
            f"{column}__yhat",
            f"{column}__yhat_lower",
            f"{column}__yhat_upper",
            f"{column}",
        ]
        fit_df.columns = new_columns
        if target_df.empty:
            target_df = fit_df
        else:
            for new_column in new_columns:
                target_df = target_df.assign(**{new_column: fit_df[new_column]})
    target_df.reset_index(level=0, inplace=True)
    return target_df.rename(columns={"ds": index})
