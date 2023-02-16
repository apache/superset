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
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

import numpy as np
from flask_babel import gettext as _
from pandas import DataFrame, Series, to_numeric

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import PostProcessingBoxplotWhiskerType
from superset.utils.pandas_postprocessing.aggregate import aggregate


def boxplot(
    df: DataFrame,
    groupby: List[str],
    metrics: List[str],
    whisker_type: PostProcessingBoxplotWhiskerType,
    percentiles: Optional[
        Union[List[Union[int, float]], Tuple[Union[int, float], Union[int, float]]]
    ] = None,
) -> DataFrame:
    """
    Calculate boxplot statistics. For each metric, the operation creates eight
    new columns with the column name suffixed with the following values:

    - `__mean`: the mean
    - `__median`: the median
    - `__max`: the maximum value excluding outliers (see whisker type)
    - `__min`: the minimum value excluding outliers (see whisker type)
    - `__q1`: the median
    - `__q1`: the first quartile (25th percentile)
    - `__q3`: the third quartile (75th percentile)
    - `__count`: count of observations
    - `__outliers`: the values that fall outside the minimum/maximum value
                    (see whisker type)

    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param groupby: The categories to group by (x-axis)
    :param metrics: The metrics for which to calculate the distribution
    :param whisker_type: The confidence level type
    :return: DataFrame with boxplot statistics per groupby
    """

    def quartile1(series: Series) -> float:
        return np.nanpercentile(series, 25, method="midpoint")

    def quartile3(series: Series) -> float:
        return np.nanpercentile(series, 75, method="midpoint")

    if whisker_type == PostProcessingBoxplotWhiskerType.TUKEY:

        def whisker_high(series: Series) -> float:
            upper_outer_lim = quartile3(series) + 1.5 * (
                quartile3(series) - quartile1(series)
            )
            return series[series <= upper_outer_lim].max()

        def whisker_low(series: Series) -> float:
            lower_outer_lim = quartile1(series) - 1.5 * (
                quartile3(series) - quartile1(series)
            )
            return series[series >= lower_outer_lim].min()

    elif whisker_type == PostProcessingBoxplotWhiskerType.PERCENTILE:
        if (
            not isinstance(percentiles, (list, tuple))
            or len(percentiles) != 2
            or not isinstance(percentiles[0], (int, float))
            or not isinstance(percentiles[1], (int, float))
            or percentiles[0] >= percentiles[1]
        ):
            raise InvalidPostProcessingError(
                _(
                    "percentiles must be a list or tuple with two numeric values, "
                    "of which the first is lower than the second value"
                )
            )
        low, high = percentiles[0], percentiles[1]

        def whisker_high(series: Series) -> float:
            return np.nanpercentile(series, high)

        def whisker_low(series: Series) -> float:
            return np.nanpercentile(series, low)

    else:
        whisker_high = np.max  # type: ignore
        whisker_low = np.min  # type: ignore

    def outliers(series: Series) -> Set[float]:
        above = series[series > whisker_high(series)]
        below = series[series < whisker_low(series)]
        return above.tolist() + below.tolist()

    operators: Dict[str, Callable[[Any], Any]] = {
        "mean": np.mean,
        "median": np.median,
        "max": whisker_high,
        "min": whisker_low,
        "q1": quartile1,
        "q3": quartile3,
        "count": np.ma.count,
        "outliers": outliers,
    }
    aggregates: Dict[str, Dict[str, Union[str, Callable[..., Any]]]] = {
        f"{metric}__{operator_name}": {"column": metric, "operator": operator}
        for operator_name, operator in operators.items()
        for metric in metrics
    }

    # nanpercentile needs numeric values, otherwise the isnan function
    # that's used in the underlying function will fail
    for column in metrics:
        if df.dtypes[column] == np.object_:
            df[column] = to_numeric(df[column], errors="coerce")

    return aggregate(df, groupby=groupby, aggregates=aggregates)
