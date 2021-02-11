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
import warnings
from typing import Any, Dict, List

import pandas as pd

from superset.utils.core import JS_MAX_INTEGER


def _convert_big_integers(val: Any) -> Any:
    """
    Cast integers larger than ``JS_MAX_INTEGER`` to strings.

    :param val: the value to process
    :returns: the same value but recast as a string if it was an integer over
        ``JS_MAX_INTEGER``
    """
    return str(val) if isinstance(val, int) and abs(val) > JS_MAX_INTEGER else val


def df_to_records(dframe: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert a DataFrame to a set of records.

    :param dframe: the DataFrame to convert
    :returns: a list of dictionaries reflecting each single row of the DataFrame
    """
    if not dframe.columns.is_unique:
        warnings.warn(
            "DataFrame columns are not unique, some columns will be omitted.",
            UserWarning,
            stacklevel=2,
        )
    columns = dframe.columns
    return list(
        dict(zip(columns, map(_convert_big_integers, row)))
        for row in zip(*[dframe[col] for col in columns])
    )
