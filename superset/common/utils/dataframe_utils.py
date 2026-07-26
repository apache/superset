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
from typing import Any, Literal, TYPE_CHECKING

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from superset.common.query_object import QueryObject


def left_join_df(
    left_df: pd.DataFrame,
    right_df: pd.DataFrame,
    join_keys: list[str],
    lsuffix: str = "",
    rsuffix: str = "",
    how: Literal["left", "right", "inner", "outer", "cross"] = "left",
) -> pd.DataFrame:
    # `how` defaults to "left" so callers that only want the left frame's rows are
    # unaffected. Passing how="outer" keeps right-only rows, which is used by the
    # time-comparison "full range" option so historical series are not truncated to
    # the main series' time range.
    df = left_df.set_index(join_keys).join(
        right_df.set_index(join_keys), how=how, lsuffix=lsuffix, rsuffix=rsuffix
    )
    df.reset_index(inplace=True)
    return df


def full_outer_join_df(
    left_df: pd.DataFrame,
    right_df: pd.DataFrame,
    lsuffix: str = "",
    rsuffix: str = "",
) -> pd.DataFrame:
    df = left_df.join(right_df, lsuffix=lsuffix, rsuffix=rsuffix, how="outer")
    df.reset_index(inplace=True)
    return df


def df_metrics_to_num(df: pd.DataFrame, query_object: QueryObject) -> None:
    """Converting metrics to numeric when pandas.read_sql cannot"""
    for col, dtype in df.dtypes.items():
        if dtype.type == np.object_ and col in query_object.metric_names:
            # soft-convert a metric column to numeric only if all
            # non-null values look numeric (e.g. ClickHouse returns
            # SUM() results as strings). Leaves truly non-numeric
            # columns unchanged.
            converted = pd.to_numeric(df[col], errors="coerce")
            if converted.notna().eq(df[col].notna()).all():
                df[col] = converted


def is_datetime_series(series: Any) -> bool:
    if series is None or not isinstance(series, pd.Series):
        return False

    if series.isnull().all():
        return False

    return pd.api.types.is_datetime64_any_dtype(series) or (
        series.apply(lambda x: isinstance(x, datetime.date) or x is None).all()
    )
