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
"""Superset utilities for pandas.DataFrame."""

import logging
import math
from decimal import Decimal
from typing import Any

import numpy as np
import pandas as pd

from superset.utils.core import JS_MAX_INTEGER

logger = logging.getLogger(__name__)

_NUMPY_FLOAT_TYPES = frozenset(
    type(value)
    for value in (np.float16(0), np.float32(0), np.float64(0), np.longdouble(0))
)
_PANDAS_MISSING_TYPES = frozenset({type(pd.NA), type(pd.NaT)})


def _convert_big_integers(val: Any) -> Any:
    """
    Cast integers larger than ``JS_MAX_INTEGER`` to strings.

    :param val: the value to process
    :returns: the same value but recast as a string if it was an integer over
        ``JS_MAX_INTEGER``
    """
    return str(val) if type(val) is int and abs(val) > JS_MAX_INTEGER else val


def _is_trusted_missing_or_nonfinite(value: Any) -> bool:
    """Recognize producer nulls without consulting object-column hooks."""
    value_type = type(value)
    if value_type in _PANDAS_MISSING_TYPES:
        return True
    if value_type is Decimal:
        return not Decimal.is_finite(value)
    if value_type is float:
        return not math.isfinite(value)
    if value_type in _NUMPY_FLOAT_TYPES:
        return not math.isfinite(float(value))
    return False


def df_to_records(
    dframe: pd.DataFrame, *, convert_big_integers: bool = True
) -> list[dict[str, Any]]:
    """
    Convert a DataFrame to a set of records.

    Missing and non-finite values are converted to None for JSON compatibility.
    This includes infinities produced by trusted pandas post-processing.

    :param dframe: the DataFrame to convert
    :param convert_big_integers: whether integers outside JavaScript's safe range
        should be represented as strings
    :returns: a list of dictionaries reflecting each single row of the DataFrame
    """
    if not dframe.columns.is_unique:
        logger.warning(
            "DataFrame columns are not unique, some columns will be omitted."
        )
    # Materialize first, then inspect only exact trusted scalar types. DataFrame
    # replacement and generic missing-value checks compare object-column values;
    # an injected value could run ``__eq__`` before the MCP envelope validator.
    records = dframe.to_dict(orient="records")

    for record in records:
        for key, value in dict.items(record):
            dict.__setitem__(
                record,
                key,
                None
                if _is_trusted_missing_or_nonfinite(value)
                else (_convert_big_integers(value) if convert_big_integers else value),
            )

    return records
