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
from __future__ import annotations

import logging
from importlib import import_module
from typing import Union

import numpy as np
import pandas as pd

from .mixins import BootstrapUncertaintyMixin, TSFeatureTransformerMixin


class BaseForecaster:
    """Base class for all forecasters in superset.
    Notes
    -----
    All forecasters should specify all the parameters that can be set
    at the class level in their ``__init__`` as explicit keyword
    arguments (no ``*args`` or ``**kwargs``).
    """

    def __init__(  # pylint: disable=too-many-arguments,super-init-not-called
        self,
        model_name: str,
        confidence_interval: float,
        yearly_seasonality: Union[bool, int],
        monthly_seasonality: Union[bool, int],
        weekly_seasonality: Union[bool, int],
        daily_seasonality: Union[bool, int],
    ) -> None:
        raise NotImplementedError("Subclasses should implement this!")

    def fit(self, df: pd.DataFrame) -> BaseForecaster:
        """Fit the forecasting model.
        Parameters
        ----------
        df: Dataframe containing the history. Must have columns ds (date
            type) and y, the time series.
        Returns
        -------
        The fitted Forecaster object."""
        raise NotImplementedError("Subclasses should implement this!")

    def feature_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract features from dates.
        Parameters
        ----------
        df : Dataframe containing dates that will be transformed into features.
        Returns
        -------
        Dataframe of shape (n_samples, k_features)
        Transformed data."""
        raise NotImplementedError("Subclasses should implement this!")

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Predict using the model.
        Parameters
        ----------
        df: Dataframe with features for predictions
        Returns
        -------
        Dataframe with the forecast values.
        """
        raise NotImplementedError("Subclasses should implement this!")

    def predict_uncertainty(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prediction intervals for yhat.
        Parameters
        ----------
        df: Prediction dataframe.
        Returns
        -------
        Dataframe with uncertainty intervals.
        """
        raise NotImplementedError("Subclasses should implement this!")

    def make_future_dataframe(
        self, df: pd.DataFrame, periods: int, freq: str
    ) -> pd.DataFrame:
        """Creates dataframe that extends forward from the end of history for the
        requested number of periods.
        Parameters
        ----------
        df: Prediction dataframe.
        periods: Int number of periods to forecast forward.
        freq: Any valid frequency for pd.date_range, such as 'D' or 'M'.
        Returns
        -------
        Dataframe with extended periods.
        """
        self.history_dates = (  # pylint: disable=attribute-defined-outside-init
            pd.to_datetime(pd.Series(df["ds"].unique(), name="ds")).sort_values()
        )
        last_date = self.history_dates.max()
        dates = pd.date_range(
            start=last_date,
            periods=periods + 1,  # An extra in case we include start
            freq=freq,
        )
        dates = dates[dates > last_date]  # Drop start if equals last_date
        dates = dates[:periods]  # Return correct number of periods
        dates = np.concatenate((np.array(self.history_dates), dates))

        return pd.DataFrame({"ds": dates})

    def fit_transform(
        self,
        df: pd.DataFrame,
        periods: int,
        freq: str,
    ) -> pd.DataFrame:
        """Fit a regression model and return a DataFrame with predicted results.
        Parameters
        ----------
        df: Prediction dataframe.
        periods: Int number of periods to forecast forward.
        freq: Any valid frequency for pd.date_range, such as 'D' or 'M'.
        Returns
        -------
        Dataframe with prediction and uncertainty intervals.
        """
        if df["ds"].dt.tz:
            df["ds"] = df["ds"].dt.tz_convert(None)
        future = self.make_future_dataframe(df, periods, freq)
        # unique features
        feature_df = self.feature_transform(future)
        train_df = df.merge(feature_df, how="left", on="ds")
        self.fit(train_df)
        prediction = self.predict(feature_df)
        forecast = prediction.join(df.set_index("ds"), on="ds")
        forecast = self.predict_uncertainty(forecast)[
            ["ds", "yhat", "yhat_lower", "yhat_upper", "y"]
        ].set_index(["ds"])
        return forecast


class ProphetForecaster(BaseForecaster):
    """Class for forecasting in superset using Prophet."""

    def __init__(  # pylint: disable=too-many-arguments,super-init-not-called
        self,
        model_name: str,
        confidence_interval: float,
        yearly_seasonality: Union[bool, int],
        monthly_seasonality: Union[bool, int],
        weekly_seasonality: Union[bool, int],
        daily_seasonality: Union[bool, int],
    ) -> None:
        # pylint: disable=import-error,import-outside-toplevel
        from prophet import Prophet

        prophet_logger = logging.getLogger("prophet.plot")
        prophet_logger.setLevel(logging.CRITICAL)
        prophet_logger.setLevel(logging.NOTSET)
        self.model = Prophet(
            interval_width=confidence_interval,
            yearly_seasonality=yearly_seasonality,
            weekly_seasonality=weekly_seasonality,
            daily_seasonality=daily_seasonality,
        )
        self.model_name = model_name
        self.interval_width = confidence_interval
        self.yearly_seasonality = yearly_seasonality
        self.monthly_seasonality = monthly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.daily_seasonality = daily_seasonality
        self.history_dates = None
        self.fitted = False

    def fit(self, df: pd.DataFrame) -> ProphetForecaster:
        """Fit the prophet model.
        Parameters
        ----------
        df: Dataframe containing the history. Must have columns ds (date
            type) and y, the time series.
        Returns
        -------
        The fitted Forecaster object."""
        if ("ds" not in df) or ("y" not in df):
            raise ValueError(
                'Dataframe must have columns "ds" and "y" with the dates and '
                "values respectively."
            )
        history = df[df["y"].notnull()].copy()
        if history.shape[0] < 2:
            raise ValueError("Dataframe has less than 2 non-NaN rows.")
        self.model.fit(df)
        self.fitted = True
        return self

    def feature_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract features from dates.
        Parameters
        ----------
        df : Dataframe containing dates that will be transformed into features.
        Returns
        -------
        Dataframe of shape (n_samples, k_features)
        Transformed data."""
        return df

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Predict using the prophet model.
        Parameters
        ----------
        df: Dataframe with features for predictions
        Returns
        -------
        Dataframe with the forecast values.
        """
        if self.fitted is False:
            raise Exception("Model has not been fit.")
        return self.model.predict(df)

    def predict_uncertainty(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prediction intervals for yhat.
        Parameters
        ----------
        df: Prediction dataframe.
        Returns
        -------
        Dataframe with uncertainty intervals.
        """
        return df


class LeastSquaresForecaster(
    TSFeatureTransformerMixin, BootstrapUncertaintyMixin, BaseForecaster
):
    """Class for forecasting in superset using the numpy least-squares solver."""

    def __init__(  # pylint: disable=too-many-arguments,super-init-not-called
        self,
        model_name: str,
        confidence_interval: float,
        yearly_seasonality: Union[bool, int],
        monthly_seasonality: Union[bool, int],
        weekly_seasonality: Union[bool, int],
        daily_seasonality: Union[bool, int],
    ) -> None:
        self.weights = None
        self.model_name = model_name
        self.interval_width = confidence_interval
        self.yearly_seasonality = yearly_seasonality
        self.monthly_seasonality = monthly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.daily_seasonality = daily_seasonality
        self.history_dates = None
        self.fitted = False
        self.feature_value_map = {
            "day_name": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ],
            "month_name": [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ],
        }

    def fit(self, df: pd.DataFrame) -> LeastSquaresForecaster:
        """Solve for the least-squares solution.
        Parameters
        ----------
        df: Dataframe containing the history. Must have columns ds (date
            type) and y, the time series.
        Returns
        -------
        The fitted Forecaster object."""
        if ("ds" not in df) or ("y" not in df):
            raise ValueError(
                'Dataframe must have columns "ds" and "y" with the dates and '
                "values respectively."
            )
        history = df[df["y"].notnull()].copy()
        if history.shape[0] < 2:
            raise ValueError("Dataframe has less than 2 non-NaN rows.")
        X = df.drop(["ds", "y"], axis=1)  # pylint: disable=invalid-name
        y = df["y"]
        self.weights = np.linalg.lstsq(X, y, rcond=None)[0]
        self.fitted = True
        return self

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Predict using the least-squares solution.
        Parameters
        ----------
        df: Dataframe with features for predictions
        Returns
        -------
        Dataframe with the forecast values.
        """
        if self.fitted is False:
            raise Exception("Model has not been fit.")
        w = self.weights  # pylint: disable=invalid-name
        X = df.drop(["ds"], axis=1)  # pylint: disable=invalid-name
        df["yhat"] = X @ w
        return df


class ScikitLearnForecaster(
    TSFeatureTransformerMixin, BootstrapUncertaintyMixin, BaseForecaster
):
    """Class for forecasting in superset using the scikit-learn API implementation
    of any model. E.g. Scikit-learn, XGBoost, LightGBM, etc."""

    def __init__(  # pylint: disable=too-many-arguments,super-init-not-called
        self,
        model_name: str,
        confidence_interval: float,
        yearly_seasonality: Union[bool, int],
        monthly_seasonality: Union[bool, int],
        weekly_seasonality: Union[bool, int],
        daily_seasonality: Union[bool, int],
    ) -> None:
        module, cls = model_name.rsplit(".", 1)
        model_cls = getattr(import_module(module), cls)
        self.model = model_cls()
        self.model_name = model_name
        self.interval_width = confidence_interval
        self.yearly_seasonality = yearly_seasonality
        self.monthly_seasonality = monthly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.daily_seasonality = daily_seasonality
        self.history_dates = None
        self.fitted = False
        self.feature_value_map = {
            "day_name": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ],
            "month_name": [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            ],
        }

    def fit(self, df: pd.DataFrame) -> ScikitLearnForecaster:
        """Fit the forecasting model.
        Parameters
        ----------
        df: Dataframe containing the history. Must have columns ds (date
            type) and y, the time series.
        Returns
        -------
        The fitted Forecaster object."""
        if ("ds" not in df) or ("y" not in df):
            raise ValueError(
                'Dataframe must have columns "ds" and "y" with the dates and '
                "values respectively."
            )
        history = df[df["y"].notnull()].copy()
        if history.shape[0] < 2:
            raise ValueError("Dataframe has less than 2 non-NaN rows.")
        X = df.drop(["ds", "y"], axis=1)  # pylint: disable=invalid-name
        y = df["y"]
        self.model.fit(X, y)
        self.fitted = True
        return self

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Predict using the forecasting model.
        Parameters
        ----------
        df: Dataframe with features for predictions
        Returns
        -------
        Dataframe with the forecast values.
        """
        if self.fitted is False:
            raise Exception("Model has not been fit.")
        X = df.drop(["ds"], axis=1)  # pylint: disable=invalid-name
        df["yhat"] = self.model.predict(X)
        return df
