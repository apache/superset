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

from collections.abc import Sequence
from typing import Any

import numpy as np
import pandas as pd
from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError


def _present(series: pd.Series) -> pd.Series:
    """Identify rows with a non-null, nonempty ID."""
    return series.notna() & (series.astype(str) != "")


def _times(series: pd.Series) -> pd.Series:
    """Normalize child timestamps for comparison with UTC bounds."""
    if pd.api.types.is_datetime64_any_dtype(series):
        times = pd.to_datetime(series, utc=True)
    else:
        times = pd.to_datetime(series, errors="coerce", utc=True, format="mixed")
    return times.dt.tz_localize(None)


def _in_bounds(times: pd.Series, bounds: Sequence[Sequence[str | None]]) -> pd.Series:
    """Identify timestamps within every active range."""
    inside = times.notna()
    for since, until in bounds:
        if since is not None:
            inside &= times >= pd.Timestamp(since)
        if until is not None:
            inside &= times < pd.Timestamp(until)
    return inside


def _integer_children(df: DataFrame, columns: Sequence[str]) -> DataFrame:
    """Restore integral child values promoted to floats by missing children."""
    df = df.copy()
    for column in columns:
        if (
            column in df.columns
            and pd.api.types.is_float_dtype(df[column])
            and df[column].isna().any()
        ):
            converted = df[column].convert_dtypes(
                convert_string=False,
                convert_boolean=False,
                convert_floating=False,
            )
            if pd.api.types.is_integer_dtype(converted):
                df[column] = converted.astype(object).where(converted.notna(), None)
    return df


def _nested_key(value: Any) -> Any:
    """Make nested database values hashable without changing the exported cells."""
    if isinstance(value, dict):
        return frozenset((key, _nested_key(item)) for key, item in value.items())
    if isinstance(value, (list, tuple, np.ndarray)):
        return tuple(_nested_key(item) for item in value)
    return value


def _first_distinct(rows: DataFrame) -> pd.Series:
    """Keep the first row for each distinct ancestor projection."""
    try:
        return ~rows.duplicated()
    except TypeError:
        return ~rows.map(_nested_key).duplicated()


def tree_rows(
    df: DataFrame,
    levels: list[dict[str, Any]],
    bounds: Sequence[Sequence[str | None]] | None = None,
) -> DataFrame:
    """
    Fold a Tree table's flat export rows: one row per deepest-level row, and
    one row with empty child columns for a parent that has no child rows.

    For each level below level 1, a row belongs to it when every ancestor ID
    is neither NULL nor empty, its own ID is not NULL and, when the level has
    a ``time_column`` and ``bounds`` are set, its time is inside every bound.
    A group of rows with the same ancestor IDs keeps its member rows, or else
    one row per distinct set of ancestor columns with the columns of that
    level and the levels below empty.

    :param df: DataFrame, already sorted by the query.
    :param levels: One entry per level: ``id_column``, ``columns`` (the
        columns the level owns) and an optional ``time_column``.
    :param bounds: ``[since, until]`` pairs as ISO strings; ``None`` is open.
    :return: The folded rows, in the original order, with a ``RangeIndex``.
    :raises InvalidPostProcessingError: If the options are incorrect
    """
    if not levels or any(not level.get("id_column") for level in levels):
        raise InvalidPostProcessingError(_("Each level needs an id_column"))
    for level in levels:
        for column in [level["id_column"], level.get("time_column")]:
            if column and column not in df.columns:
                raise InvalidPostProcessingError(
                    _(
                        "Referenced columns not available in DataFrame: %(columns)s",
                        columns=column,
                    )
                )
    if df.empty:
        return df.reset_index(drop=True)

    df = _integer_children(
        df, [column for level in levels[1:] for column in level.get("columns", [])]
    )

    for j in range(1, len(levels)):
        path = [level["id_column"] for level in levels[:j]]
        member = df[levels[j]["id_column"]].notna()
        for column in path:
            member &= _present(df[column])
        time_column = levels[j].get("time_column")
        if time_column and bounds:
            member &= _in_bounds(_times(df[time_column]), bounds)

        group_keys = df.groupby(path, sort=False, dropna=False).ngroup()
        has_member = member.groupby(group_keys).transform("any")
        ancestor_columns = path + [
            column
            for level in levels[:j]
            for column in level.get("columns", [])
            if column in df.columns and column not in path
        ]
        blank = ~has_member
        blank.loc[blank] = _first_distinct(df.loc[blank, ancestor_columns])
        keep = member | blank

        child_columns = [
            column
            for level in levels[j:]
            for column in level.get("columns", [])
            if column in df.columns
        ]
        df = df.copy()
        if blank.any():
            df[child_columns] = df[child_columns].astype(object)
            df.loc[blank, child_columns] = None
        df = df[keep]

    return df.reset_index(drop=True)
