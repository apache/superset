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
from collections.abc import Collection
from typing import Any, Literal, TYPE_CHECKING

import numpy as np
import pandas as pd
from pandas.api.types import infer_dtype

from superset.common.chart_data import ChartDataResultType
from superset.utils.core import get_metric_names, JS_MAX_INTEGER

if TYPE_CHECKING:
    from superset.common.query_object import QueryObject


def left_join_df(
    left_df: pd.DataFrame,
    right_df: pd.DataFrame,
    join_keys: list[str],
    lsuffix: str = "",
    rsuffix: str = "",
    how: Literal["left", "right", "inner", "outer"] = "left",
) -> pd.DataFrame:
    # `how` defaults to "left" so callers that only want the left frame's rows are
    # unaffected. Passing how="outer" keeps right-only rows, which is used by the
    # time-comparison "full range" option so historical series are not truncated to
    # the main series' time range. "cross" is intentionally excluded: the join is
    # implemented via `Index.join`, which doesn't support cross joins the way
    # `pd.merge` does, so passing "cross" here would silently drop the join keys
    # instead of producing a real cross join.
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
    df_columns_to_num(df, query_object.metric_names)


def df_columns_to_num(df: pd.DataFrame, columns: Collection[str]) -> None:
    """Soft-convert the named object columns to numeric, in place."""
    for col, dtype in df.dtypes.items():
        if dtype.type == np.object_ and col in columns:
            # soft-convert a metric column to numeric only if all
            # non-null values look numeric (e.g. ClickHouse returns
            # SUM() results as strings). Leaves truly non-numeric
            # columns unchanged.
            converted = pd.to_numeric(df[col], errors="coerce")
            if converted.notna().eq(df[col].notna()).all():
                df[col] = converted


INT64_RANGE = (-(2**63), 2**63 - 1)


def can_keep_exact_integers(query_object: QueryObject) -> bool:
    """
    Whether the result of ``query_object`` may carry exact large integers.

    Only plain chart queries qualify. Queries with Python-side post-processing or
    time offsets keep the float64 normalization (a precaution: that machinery is
    written for numeric columns), and so do requests that go through report
    client processing (``POST_PROCESSED``), which formats the rebuilt frame on
    numeric dtypes only. The decision reads only fields that are part of the query
    cache key (``post_processing``, ``time_offsets`` and the per-query
    ``result_type``), so a cached frame always has the shape its key implies.
    """
    return not (
        query_object.post_processing
        or query_object.time_offsets
        or query_object.result_type == ChartDataResultType.POST_PROCESSED
    )


def lossy_integer_columns(df: pd.DataFrame, query_object: QueryObject) -> list[str]:
    """
    Dimension columns that ``infer_objects`` would round to float64.

    These are object columns of Python integers and nulls (how
    ``SupersetResultSet`` hands back a nullable BIGINT) holding a value beyond
    ``JS_MAX_INTEGER`` where every value fits int64. Without nulls pandas
    already yields an exact int64, and values outside int64 stay exact objects
    or are left to the float64 normalization (the uint64-only range).

    Only columns selected as ``columns`` and not named as a metric qualify, using
    the labels the dataframe carries (no verbose-name mapping): a saved metric
    comes back under its raw ``metric_name``, and metrics-only queries have none.
    """
    if not df.columns.is_unique:
        return []
    candidates = set(query_object.column_names) - set(
        get_metric_names(query_object.metrics)
    )
    columns: list[str] = []
    for col in df.columns:
        series = df[col]
        if (
            col not in candidates
            or series.dtype != object
            or infer_dtype(series, skipna=True) != "integer"
            or not series.isna().any()
        ):
            continue
        present = [int(value) for value in series.dropna()]
        low, high = min(present), max(present)
        if (low < -JS_MAX_INTEGER or high > JS_MAX_INTEGER) and (
            INT64_RANGE[0] <= low and high <= INT64_RANGE[1]
        ):
            columns.append(col)
    return columns


def is_datetime_series(series: Any) -> bool:
    if series is None or not isinstance(series, pd.Series):
        return False

    if series.isnull().all():
        return False

    return pd.api.types.is_datetime64_any_dtype(series) or (
        series.apply(lambda x: isinstance(x, datetime.date) or x is None).all()
    )
