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

from typing import Sequence, Union

import pandas as pd
from numpy.distutils.misc_util import is_sequence

from superset.utils.pandas_postprocessing.utils import (
    _is_multi_index_on_columns,
    escape_separator,
    FLAT_COLUMN_SEPARATOR,
)


def flatten(
    df: pd.DataFrame,
    reset_index: bool = True,
    drop_levels: Union[Sequence[int], Sequence[str]] = (),
) -> pd.DataFrame:
    """
    Convert N-dimensional DataFrame to a flat DataFrame

    :param df: N-dimensional DataFrame.
    :param reset_index: Convert index to column when df.index isn't RangeIndex
    :param drop_levels: index of level or names of level might be dropped
                        if df is N-dimensional
    :return: a flat DataFrame

    Examples
    -----------

    Convert DatetimeIndex into columns.

    >>> index = pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03",])
    >>> index.name = "__timestamp"
    >>> df = pd.DataFrame(index=index, data={"metric": [1, 2, 3]})
    >>> df
                 metric
    __timestamp
    2021-01-01        1
    2021-01-02        2
    2021-01-03        3
    >>> df = flatten(df)
    >>> df
      __timestamp  metric
    0  2021-01-01       1
    1  2021-01-02       2
    2  2021-01-03       3

    Convert DatetimeIndex and MultipleIndex into columns

    >>> iterables = [["foo", "bar"], ["one", "two"]]
    >>> columns = pd.MultiIndex.from_product(iterables, names=["level1", "level2"])
    >>> df = pd.DataFrame(index=index, columns=columns, data=1)
    >>> df
    level1      foo     bar
    level2      one two one two
    __timestamp
    2021-01-01    1   1   1   1
    2021-01-02    1   1   1   1
    2021-01-03    1   1   1   1
    >>> flatten(df)
      __timestamp foo, one foo, two bar, one bar, two
    0  2021-01-01        1        1        1        1
    1  2021-01-02        1        1        1        1
    2  2021-01-03        1        1        1        1
    """
    if _is_multi_index_on_columns(df):
        df.columns = df.columns.droplevel(drop_levels)
        _columns = []
        for series in df.columns.to_flat_index():
            _cells = []
            for cell in series if is_sequence(series) else [series]:
                if pd.notnull(cell):
                    # every cell should be converted to string and escape comma
                    _cells.append(escape_separator(str(cell)))
            _columns.append(FLAT_COLUMN_SEPARATOR.join(_cells))

        df.columns = _columns

    if reset_index and not isinstance(df.index, pd.RangeIndex):
        df = df.reset_index(level=0)
    return df
