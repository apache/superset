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

import numpy as np
from pandas import DataFrame, Series, to_numeric


# pylint: disable=too-many-arguments
def histogram(
    df: DataFrame,
    column: str,
    groupby: list[str] | None,
    bins: int = 5,
    cumulative: bool = False,
    normalize: bool = False,
) -> DataFrame:
    """
    Generate a histogram DataFrame from a given DataFrame.

    Parameters:
    df (DataFrame): The input DataFrame.
    column (str): The column of the DataFrame to calculate the histogram on.
    groupby (list[str]): The columns to group by. If empty, no grouping is performed.
    bins (int): The number of bins to use for the histogram. Default is 5.
    cumulative (bool): Whether to calculate a cumulative histogram. Default is False.
    normalize (bool): Whether to normalize the histogram. Default is False.

    Returns:
    DataFrame: A DataFrame where each row corresponds to a group (or the entire DataFrame if no grouping is performed),
               and each column corresponds to a histogram bin. The values are the counts in each bin.
    """  # noqa: E501

    if groupby is None:
        groupby = []

    # convert to numeric, coercing errors to NaN
    df[column] = to_numeric(df[column], errors="coerce")

    # check if the column contains non-numeric values
    if df[column].isna().any():
        raise ValueError(f"Column '{column}' contains non-numeric values")

    # calculate the histogram bin edges
    bin_edges = np.histogram_bin_edges(df[column], bins=bins)

    # convert the bin edges to strings
    bin_edges_str = [
        f"{bin_edges[i]} - {bin_edges[i + 1]}" for i in range(len(bin_edges) - 1)
    ]

    def hist_values(series: Series) -> np.ndarray:
        # we might have NaN values as the result of grouping so we need to drop them
        result = np.histogram(series.dropna(), bins=bin_edges)[0]
        return result if not cumulative else np.cumsum(result)

    if len(groupby) == 0:
        # without grouping
        hist_dict = dict(zip(bin_edges_str, hist_values(df[column]), strict=False))
        histogram_df = DataFrame(hist_dict, index=[0])
    else:
        # with grouping
        histogram_df = (
            df.groupby(groupby)[column]
            .apply(lambda x: Series(hist_values(x)))
            .unstack(fill_value=0)
        )
        histogram_df.columns = bin_edges_str

    if normalize:
        histogram_df = histogram_df / histogram_df.values.sum()

    # reorder the columns to have the groupby columns first
    histogram_df = histogram_df.reset_index().loc[:, groupby + bin_edges_str]

    return histogram_df
