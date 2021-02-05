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
""" Superset utilities for pandas.DataFrame.
"""
from typing import Any, Dict, List

import pandas as pd

from superset.utils.core import JS_MAX_INTEGER


def _convert_big_integers(row: List[Any]) -> List[Any]:
    """
    Cast all integers larger than ``JS_MAX_INTEGER`` in a row to strings.

    :param row: the DataFrame row to process
    :returns: the same DataFrame row, with all integer values over
        ``JS_MAX_INTEGER`` recast as strings
    """
    return [str(v) if isinstance(v, int) and v > JS_MAX_INTEGER else v for v in row]


def df_to_records(dframe: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert a DataFrame to a set of records.

    :param dframe: the DataFrame to convert
    :returns: a list of dictionaries reflecting each single row of the DataFrame
    """
    data: List[Dict[str, Any]] = list(
        dict(zip(dframe.columns, _convert_big_integers(row)))
        for row in dframe.itertuples(index=False, name=None)
    )

    return data
