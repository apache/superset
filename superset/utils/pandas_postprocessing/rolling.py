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
from typing import Any, Optional, Union

from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import (
    _append_columns,
    DENYLIST_ROLLING_FUNCTIONS,
    validate_column_args,
)


@validate_column_args("columns")
def rolling(  # pylint: disable=too-many-arguments
    df: DataFrame,
    rolling_type: str,
    columns: dict[str, str],
    window: Optional[int] = None,
    rolling_type_options: Optional[dict[str, Any]] = None,
    center: bool = False,
    win_type: Optional[str] = None,
    min_periods: Optional[int] = None,
) -> DataFrame:
    """
    Apply a rolling window on the dataset. See the Pandas docs for further details:
    https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.rolling.html

    :param df: DataFrame on which the rolling period will be based.
    :param columns: columns on which to perform rolling, mapping source column to
           target column. For instance, `{'y': 'y'}` will replace the column `y` with
           the rolling value in `y`, while `{'y': 'y2'}` will add a column `y2` based
           on rolling values calculated from `y`, leaving the original column `y`
           unchanged.
    :param rolling_type: Type of rolling window. Any numpy function will work.
    :param window: Size of the window.
    :param rolling_type_options: Optional options to pass to rolling method. Needed
           for e.g. quantile operation.
    :param center: Should the label be at the center of the window.
    :param win_type: Type of window function.
    :param min_periods: The minimum amount of periods required for a row to be included
                        in the result set.
    :return: DataFrame with the rolling columns
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    rolling_type_options = rolling_type_options or {}
    df_rolling = df.loc[:, columns.keys()]

    kwargs: dict[str, Union[str, int]] = {}
    if window is None:
        raise InvalidPostProcessingError(_("Undefined window for rolling operation"))
    if window == 0:
        raise InvalidPostProcessingError(_("Window must be > 0"))

    kwargs["window"] = window
    if min_periods is not None:
        kwargs["min_periods"] = min_periods
    if center is not None:
        kwargs["center"] = center
    if win_type is not None:
        kwargs["win_type"] = win_type

    df_rolling = df_rolling.rolling(**kwargs)
    if rolling_type not in DENYLIST_ROLLING_FUNCTIONS or not hasattr(
        df_rolling, rolling_type
    ):
        raise InvalidPostProcessingError(
            _("Invalid rolling_type: %(type)s", type=rolling_type)
        )
    try:
        df_rolling = getattr(df_rolling, rolling_type)(**rolling_type_options)
    except TypeError as ex:
        raise InvalidPostProcessingError(
            _(
                "Invalid options for %(rolling_type)s: %(options)s",
                rolling_type=rolling_type,
                options=rolling_type_options,
            )
        ) from ex

    df_rolling = _append_columns(df, df_rolling, columns)

    if min_periods:
        df_rolling = df_rolling[min_periods - 1 :]
    return df_rolling
