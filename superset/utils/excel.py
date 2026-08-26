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
import io
from typing import Any

import pandas as pd

from superset.utils.core import GenericDataType

# Leading characters that turn a cell into a formula in spreadsheet apps.
FORMULA_PREFIXES = {"=", "+", "-", "@"}


def _quote_formula(value: Any) -> Any:
    """Prefix a string with a quote when it would parse as a formula."""
    return (
        f"'{value}"
        if isinstance(value, str) and len(value) and value[0] in FORMULA_PREFIXES
        else value
    )


def quote_formulas(df: pd.DataFrame) -> pd.DataFrame:
    """
    Make sure to quote any formulas for security reasons.
    """
    # Columns are addressed by position rather than by label: a dataframe can
    # carry duplicate column labels (the verbose_map rename in
    # QueryContextProcessor.get_data can collapse two columns onto the same
    # name), and ``df[label]`` then yields a DataFrame instead of a Series.
    # ``DataFrame.apply`` would hand whole columns to the mapper rather than
    # individual cells, silently leaving formulas unquoted.
    for idx in range(len(df.columns)):
        series = df.iloc[:, idx]
        if series.dtype == object:
            df.isetitem(idx, series.map(_quote_formula))

    return df


def df_to_excel(df: pd.DataFrame, **kwargs: Any) -> Any:
    output = io.BytesIO()

    # make sure formulas are quoted, to prevent malicious injections
    df = quote_formulas(df)

    # pylint: disable=abstract-class-instantiated
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, **kwargs)

    return output.getvalue()


def apply_column_types(
    df: pd.DataFrame, column_types: list[GenericDataType]
) -> pd.DataFrame:
    """
    Applies the column types to the dataframe to prepare for an excel export

    :param df: The dataframe to apply the column types to
    :param column_types: The types of the columns
    :return: The dataframe with the column types applied
    """
    # Columns are addressed by position for the same reason as in
    # ``quote_formulas``: duplicate column labels make ``df[label]`` return a
    # DataFrame, and ``DataFrame`` has no ``dtype``. Slicing column_types keeps
    # the lenient pairing the previous ``zip(..., strict=False)`` provided.
    for idx, column_type in enumerate(column_types[: len(df.columns)]):
        series = df.iloc[:, idx]
        if column_type == GenericDataType.NUMERIC:
            try:
                series = pd.to_numeric(series)
                # if the number is too large, convert it to a string
                # Excel does not support numbers larger than 10^15
                series = series.apply(
                    lambda x: str(x)
                    if isinstance(x, (int, float)) and abs(x) > 10**15
                    else x
                )
            except ValueError:
                series = series.astype(str)
        elif isinstance(series.dtype, pd.DatetimeTZDtype):
            # timezones are not supported
            series = series.astype(str)
        else:
            continue
        # ``isetitem`` replaces the column at that position, which is both
        # unambiguous under duplicate labels and free of the in-place dtype
        # casting that ``iloc`` assignment attempts.
        df.isetitem(idx, series)
    return df
