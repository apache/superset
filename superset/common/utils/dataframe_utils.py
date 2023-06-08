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

import datetime
from typing import Any, TYPE_CHECKING

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from superset.common.query_object import QueryObject


def left_join_df(
    left_df: pd.DataFrame,
    right_df: pd.DataFrame,
    join_keys: list[str],
) -> pd.DataFrame:
    df = left_df.set_index(join_keys).join(right_df.set_index(join_keys))
    df.reset_index(inplace=True)
    return df


def df_metrics_to_num(df: pd.DataFrame, query_object: QueryObject) -> None:
    """Converting metrics to numeric when pandas.read_sql cannot"""
    for col, dtype in df.dtypes.items():
        if dtype.type == np.object_ and col in query_object.metric_names:
            # soft-convert a metric column to numeric
            # will stay as strings if conversion fails
            df[col] = df[col].infer_objects()


def is_datetime_series(series: Any) -> bool:
    if series is None or not isinstance(series, pd.Series):
        return False

    if series.isnull().all():
        return False

    return pd.api.types.is_datetime64_any_dtype(series) or (
        series.apply(lambda x: isinstance(x, datetime.date) or x is None).all()
    )


HELPER_COLUMN = "__SUPERSET__HELPER_COLUMN__"


def add_helper_column(
    df: pd.DataFrame,
    dttm_column: str,
    grain: str,
    drop_dttm_column: bool = False,
) -> pd.DataFrame:
    if grain not in ("P1W", "P1M", "P3M"):
        return df

    if grain == "P1W":
        # e.g. a series likes 2023-03-10T00:00:00 -> will generate a integer column:
        # this column used to join
        # 2023001
        # 2023002
        # ...
        # 2023052
        df[HELPER_COLUMN] = (
            df[dttm_column].dt.isocalendar().year * 1000
            + df[dttm_column].dt.isocalendar().week
        )
    if grain == "P1M":
        df[HELPER_COLUMN] = (
            df[dttm_column].dt.isocalendar().year * 1000 + df[dttm_column].dt.month
        )
    if grain == "P3M":
        df[HELPER_COLUMN] = (
            df[dttm_column].dt.isocalendar().year * 1000 + df[dttm_column].dt.quarter
        )

    if drop_dttm_column:
        df.drop(dttm_column, axis=1, inplace=True)
    return df


def drop_helper_column(
    df: pd.DataFrame,
) -> pd.DataFrame:
    df.drop(HELPER_COLUMN, axis=1, inplace=True)
    return df
