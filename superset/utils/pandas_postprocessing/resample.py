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
from typing import Optional, Tuple, Union

from pandas import DataFrame

from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("groupby_columns")
def resample(  # pylint: disable=too-many-arguments
    df: DataFrame,
    rule: str,
    method: str,
    time_column: str,
    groupby_columns: Optional[Tuple[Optional[str], ...]] = None,
    fill_value: Optional[Union[float, int]] = None,
) -> DataFrame:
    """
    support upsampling in resample

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param time_column: existing columns in DataFrame.
    :param groupby_columns: columns except time_column in dataframe
    :param fill_value: What values do fill missing.
    :return: DataFrame after resample
    :raises QueryObjectValidationError: If the request in incorrect
    """

    def _upsampling(_df: DataFrame) -> DataFrame:
        _df = _df.set_index(time_column)
        if method == "asfreq" and fill_value is not None:
            return _df.resample(rule).asfreq(fill_value=fill_value)
        return getattr(_df.resample(rule), method)()

    if groupby_columns:
        df = (
            df.set_index(keys=list(groupby_columns))
            .groupby(by=list(groupby_columns))
            .apply(_upsampling)
        )
        df = df.reset_index().set_index(time_column).sort_index()
    else:
        df = _upsampling(df)
    return df.reset_index()
