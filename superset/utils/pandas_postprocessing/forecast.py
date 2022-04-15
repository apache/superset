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

from superset import forecasts
from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import DTTM_ALIAS
from superset.utils.pandas_postprocessing.utils import FORECAST_TIME_GRAIN_MAP


def _parse_seasonality(  # pylint: disable=invalid-name
    input_value: Optional[Union[bool, int]],
    seasonality_type: str,
    ds: pd.Series,
) -> Union[bool, int]:
    if isinstance(input_value, bool):
        return input_value

    if input_value is not None:
        try:
            return int(input_value)  # type: ignore
        except ValueError:
            pass

    if ds.dt.tz:
        ds = ds.dt.tz_convert(None)
    first = ds.min()
    last = ds.max()
    dt = ds.diff()
    min_dt = dt.iloc[dt.values.nonzero()[0]].min()
    if seasonality_type == "yearly":
        # Turns on yearly seasonality if there is >=2 years of history.
        return 10 if last - first >= pd.Timedelta(days=730) else 0
    if seasonality_type == "monthly":
        # Turns on monthly seasonality if there is >=2 months of history, and the
        #             # spacing between dates in the history is <1 month.
        return (
            1
            if (
                (last - first >= np.timedelta64(2, "M"))
                and (min_dt < np.timedelta64(1, "M"))
            )
            else 0
        )
    if seasonality_type == "weekly":
        # Turns on weekly seasonality if there is >=2 weeks of history, and the
        # spacing between dates in the history is <7 days.
        return (
            3
            if (
                (last - first >= pd.Timedelta(days=14))
                and (min_dt < pd.Timedelta(days=7))
            )
            else 0
        )
    if seasonality_type == "daily":
        # Turns on daily seasonality if there is >=2 days of history, and the
        # spacing between dates in the history is <1 day.
        return (
            4
            if (
                (last - first >= pd.Timedelta(days=2))
                and (min_dt < pd.Timedelta(days=1))
            )
            else 0
        )

    return 0


def forecast(  # pylint: disable=too-many-arguments, too-many-locals
    df: pd.DataFrame,
    time_grain: str,
    periods: int,
    confidence_interval: float,
    yearly_seasonality: Optional[Union[bool, int]] = None,
    monthly_seasonality: Optional[Union[bool, int]] = None,
    weekly_seasonality: Optional[Union[bool, int]] = None,
    daily_seasonality: Optional[Union[bool, int]] = None,
    model_name: str = "prophet.Prophet",
    index: Optional[str] = None,
) -> pd.DataFrame:
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
    :param monthly_seasonality: Should monthly seasonality be applied.
           An integer value will specify Fourier order of seasonality.
    :param weekly_seasonality: Should weekly seasonality be applied.
           An integer value will specify Fourier order of seasonality, `None` will
           automatically detect seasonality.
    :param daily_seasonality: Should daily seasonality be applied.
           An integer value will specify Fourier order of seasonality, `None` will
           automatically detect seasonality.
    :param model_name: name of model to be used for forecasting.
    :param index: the name of the column containing the x-axis data
    :return: DataFrame with contributions, with temporal column at beginning if present
    """
    index = index or DTTM_ALIAS
    # validate inputs
    if not time_grain:
        raise InvalidPostProcessingError(_("Time grain missing"))
    if time_grain not in FORECAST_TIME_GRAIN_MAP:
        raise InvalidPostProcessingError(
            _(
                "Unsupported time grain: %(time_grain)s",
                time_grain=time_grain,
            )
        )
    freq = FORECAST_TIME_GRAIN_MAP[time_grain]
    # check type at runtime due to marhsmallow schema not being able to handle
    # union types
    if not isinstance(periods, int) or periods < 0:
        raise InvalidPostProcessingError(_("Periods must be a whole number"))
    if not confidence_interval or confidence_interval <= 0 or confidence_interval >= 1:
        raise InvalidPostProcessingError(
            _("Confidence interval must be between 0 and 1 (exclusive)")
        )
    if index not in df.columns:
        raise InvalidPostProcessingError(_("DataFrame must include temporal column"))
    if len(df.columns) < 2:
        raise InvalidPostProcessingError(_("DataFrame include at least one series"))

    target_df = pd.DataFrame()
    ds = df[DTTM_ALIAS]
    for column in [column for column in df.columns if column != DTTM_ALIAS]:
        model = forecasts.get_model(
            model_name=model_name,
            confidence_interval=confidence_interval,
            yearly_seasonality=_parse_seasonality(yearly_seasonality, "yearly", ds),
            monthly_seasonality=_parse_seasonality(monthly_seasonality, "monthly", ds),
            weekly_seasonality=_parse_seasonality(weekly_seasonality, "weekly", ds),
            daily_seasonality=_parse_seasonality(daily_seasonality, "daily", ds),
        )
        fit_df = model.fit_transform(  # type: ignore
            df=df[[DTTM_ALIAS, column]].rename(columns={DTTM_ALIAS: "ds", column: "y"}),
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
    return target_df.rename(columns={"ds": DTTM_ALIAS})
