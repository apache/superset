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

from decimal import Decimal
from typing import Any

from flask_babel import gettext as _
from pandas import DataFrame, MultiIndex

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import PostProcessingContributionOrientation
from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("columns")
def contribution_with_totals(  # noqa: C901
    df: DataFrame,
    orientation: PostProcessingContributionOrientation = PostProcessingContributionOrientation.COLUMN,  # noqa: E501
    columns: list[str] | None = None,
    time_shifts: list[str] | None = None,
    rename_columns: list[str] | None = None,
    totals: dict[str, float] | None = None,
) -> DataFrame:
    """
    Contribution with totals from full dataset.

    Divides values in `columns` by totals provided externally (from auxiliary query),
    instead of computing totals from the current DataFrame.

    :param df: The input DataFrame
    :param orientation: Whether to calculate contribution per row or per column
    :param columns: Columns to calculate percentages on
    :param time_shifts: Optional time shift columns
    :param rename_columns: New column names
    :param totals: External totals per column (from full dataset)
    """
    if totals is None:
        raise InvalidPostProcessingError(
            "Missing `totals` for contribution_with_totals"
        )

    contribution_df = df.copy()
    numeric_df = contribution_df.select_dtypes(include=["number", Decimal])
    numeric_df.fillna(0, inplace=True)

    if columns:
        numeric_columns = numeric_df.columns.tolist()
        for col in columns:
            if col not in numeric_columns:
                raise InvalidPostProcessingError(
                    _(
                        'Column "%(column)s" does not exist in the query results.',  # noqa: F823
                        column=col,
                    )
                )
    actual_columns = columns or numeric_df.columns.tolist()
    rename_columns = rename_columns or [f"%{col}" for col in actual_columns]

    if len(rename_columns) != len(actual_columns):
        raise InvalidPostProcessingError(
            _("`rename_columns` must match length of `columns`.")
        )

    numeric_df_view = numeric_df[actual_columns]

    if orientation == PostProcessingContributionOrientation.COLUMN:
        for i, col in enumerate(actual_columns):
            total = totals.get(col)
            rename_col = rename_columns[i]
            if total is None:
                raise InvalidPostProcessingError(_(f"Missing total for column `{col}`"))
            if total == 0:
                contribution_df[rename_col] = 0
            else:
                contribution_df[rename_col] = numeric_df_view[col] / total
        return contribution_df

    result = get_column_groups(numeric_df_view, time_shifts, rename_columns)
    calculate_row_contribution(
        contribution_df, result["non_time_shift"][0], result["non_time_shift"][1]
    )
    for __, (cols, renames) in result["time_shifts"].items():
        calculate_row_contribution(contribution_df, cols, renames)

    return contribution_df


def get_column_groups(
    df: DataFrame, time_shifts: list[str] | None, rename_columns: list[str]
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "non_time_shift": ([], []),
        "time_shifts": {},
    }
    for i, col in enumerate(df.columns):
        col_0 = col[0] if isinstance(df.columns, MultiIndex) else col
        time_shift = None
        if time_shifts and isinstance(col_0, str):
            for ts in time_shifts:
                if col_0.endswith(ts):
                    time_shift = ts
                    break
        if time_shift:
            result["time_shifts"].setdefault(time_shift, ([], []))
            result["time_shifts"][time_shift][0].append(col)
            result["time_shifts"][time_shift][1].append(rename_columns[i])
        else:
            result["non_time_shift"][0].append(col)
            result["non_time_shift"][1].append(rename_columns[i])
    return result


def calculate_row_contribution(
    df: DataFrame, columns: list[str], rename_columns: list[str]
) -> None:
    row_sum = df.loc[:, columns].sum(axis=1).replace(0, None)
    df.loc[:, rename_columns] = df.loc[:, columns].div(row_sum, axis=0).fillna(0)
