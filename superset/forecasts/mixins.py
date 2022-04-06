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
from typing import Any, Dict, List, Optional, Protocol, Union

import numpy as np
import pandas as pd


class DataFrameForecasterProto(Protocol):
    """Protocol for df processing methods."""

    df: pd.DataFrame
    yearly_seasonality: Union[bool, int]
    monthly_seasonality: Union[bool, int]
    weekly_seasonality: Union[bool, int]
    daily_seasonality: Union[bool, int]
    feature_value_map: Dict[str, List[str]]
    interval_width: float
    fit: Any
    predict: Any

    def feature_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        ...

    def get_dummies(
        self, pdf: pd.DataFrame, feature: str, values: Optional[List[str]]
    ) -> None:
        ...

    def predict_uncertainty(self, df: pd.DataFrame) -> pd.DataFrame:
        ...


class TSFeatureTransformerMixin:
    def feature_transform(
        self: DataFrameForecasterProto, df: pd.DataFrame
    ) -> pd.DataFrame:
        """Extract features from dates.
        Parameters
        ----------
        df : Dataframe containing dates that will be transformed into features.
        Returns
        -------
        Dataframe of shape (n_samples, k_features)
        Transformed data."""
        # convert date to numerical features
        ds = pd.to_datetime(df.ds)
        df["year"] = ds.dt.year
        df["month"] = ds.dt.month
        df["day"] = ds.dt.day

        # daily seasonality
        if self.daily_seasonality:
            df["dayofweek"] = ds.dt.dayofweek
            df["day_name"] = ds.dt.day_name
            self.get_dummies(df, "day_name", self.feature_value_map["day_name"])

        # weekly seasonality
        if self.weekly_seasonality:
            df["weekofyear"] = ds.dt.weekofyear

        # monthly seasonality
        if self.monthly_seasonality:
            df["month_name"] = ds.dt.month_name()
            # maybe add to feature value map
            self.get_dummies(df, "month_name", self.feature_value_map["month_name"])

        # yearly seasonality
        if self.yearly_seasonality:
            self.get_dummies(df, "year", self.feature_value_map.get("year"))

        # add constant term
        df["c"] = np.ones(len(df))

        return df

    def get_dummies(
        self: DataFrameForecasterProto,
        pdf: pd.DataFrame,
        feature: str,
        values: Optional[List[str]],
    ) -> None:

        if feature in pdf.columns:
            if values is not None:
                df_dummies = pd.get_dummies(pdf[feature], prefix=feature)
            else:
                df_dummies = pd.get_dummies(pdf[feature].astype(str), prefix=feature)
                values = list(pdf[feature].unique())
                self.feature_value_map[feature] = values

            # add missing value columns
            for value in values:
                col = "{}_{}".format(feature, value)
                if col not in df_dummies:
                    df_dummies[col] = 0

            pdf[df_dummies.columns] = df_dummies

            pdf.drop(feature, axis=1, inplace=True)


class BootstrapUncertaintyMixin:  # pylint: disable=too-few-public-methods
    def predict_uncertainty(
        self: DataFrameForecasterProto, df: pd.DataFrame
    ) -> pd.DataFrame:
        """Prediction intervals for yhat using the bootstrap method.
        Parameters
        ----------
        df: Prediction dataframe.
        Returns
        -------
        Dataframe with uncertainty intervals.
        """

        train_df = df[df["y"].notnull()]

        # Calculate 95% CI
        sim_values: Dict[str, List[pd.Series]] = {"yhat": []}
        for _ in range(300):
            bootstrap = train_df.sample(n=train_df.shape[0], replace=True).drop(
                ["yhat"], axis=1
            )
            # fit and predict
            self.fit(bootstrap)
            sim = self.predict(df.drop(["y", "yhat"], axis=1)).set_index(["ds"])

            for k, v in sim_values.items():
                v.append(sim[k])
        for k, v in sim_values.items():
            sim_values[k] = np.column_stack(v)

        lower_p = 100 * (1.0 - self.interval_width) / 2
        upper_p = 100 * (1.0 + self.interval_width) / 2

        series = {}
        for key in ["yhat"]:
            series["{}_lower".format(key)] = np.percentile(
                sim_values[key], lower_p, axis=1
            )
            series["{}_upper".format(key)] = np.percentile(
                sim_values[key], upper_p, axis=1
            )

        intervals = pd.DataFrame(series)
        return pd.concat((df, intervals), axis=1)
