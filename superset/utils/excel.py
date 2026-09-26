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
from datetime import datetime
from typing import Any, Optional

import pandas as pd

from superset.utils.core import GenericDataType

# Fixed, neutral timestamp applied to workbook document properties so that
# exported files do not carry an environment-specific generation time.
NEUTRAL_TIMESTAMP = datetime(2000, 1, 1)

# Document properties that are reset to empty values on export so that
# exported workbooks do not carry identifying information.
NEUTRAL_DOCUMENT_PROPERTIES: dict[str, Any] = {
    "title": "",
    "subject": "",
    "author": "",
    "manager": "",
    "company": "",
    "category": "",
    "keywords": "",
    "comments": "",
    "status": "",
    "created": NEUTRAL_TIMESTAMP,
}

# Leading characters that turn a cell into a formula in spreadsheet apps. Shared
# with the streaming writer (superset.utils.excel_streaming) so both export paths
# guard against the same formula-injection vectors.
FORMULA_PREFIXES = {"=", "+", "-", "@"}


def _quote_formula(value: Any) -> Any:
    """Prefix a string with a quote when it would parse as a formula."""
    return (
        f"'{value}"
        if isinstance(value, str) and len(value) and value[0] in FORMULA_PREFIXES
        else value
    )


def _drop_timezone(value: Any) -> Any:
    """
    Convert one tz-aware timestamp to a naive wall-clock value.

    Excel cannot store timezone offsets. ``tz_localize(None)`` keeps the
    calendar date and time shown in Explore; ``tz_convert(None)`` would shift
    the instant to UTC and can move the date by a day.
    """
    if isinstance(value, pd.Timestamp):
        return value.tz_localize(None) if value.tz is not None else value
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.replace(tzinfo=None)
    if isinstance(value, tuple):
        return tuple(_drop_timezone(item) for item in value)
    return value


def _naive_index(index: pd.Index) -> pd.Index:
    """Return ``index`` with timezone-aware timestamps made naive."""
    if isinstance(index, pd.RangeIndex):
        return index
    if isinstance(index, pd.DatetimeIndex) and index.tz is not None:
        return index.tz_localize(None)
    if isinstance(index, pd.MultiIndex):
        levels = [
            level.tz_localize(None)
            if isinstance(level, pd.DatetimeIndex) and level.tz is not None
            else level
            for level in index.levels
        ]
        index = index.set_levels(levels)
        return index.map(_drop_timezone)
    if not any(
        isinstance(label, (datetime, pd.Timestamp))
        and getattr(label, "tzinfo", None) is not None
        for label in index
    ):
        return index
    return index.map(_drop_timezone)


def strip_timezones_for_excel(df: pd.DataFrame) -> pd.DataFrame:
    """
    Make timestamps timezone-naive so ``DataFrame.to_excel`` can write them.

    Applied to values, column labels, and the row index (pivot exports place
    temporal group-bys on the index). The frame is copied so callers can reuse
    the original.
    """
    df = df.copy()
    df.index = _naive_index(df.index)
    if isinstance(df.columns, pd.MultiIndex) or any(
        isinstance(label, (datetime, pd.Timestamp)) for label in df.columns
    ):
        df.columns = _naive_index(df.columns)
    for position in range(len(df.columns)):
        series = df.iloc[:, position]
        if isinstance(series.dtype, pd.DatetimeTZDtype):
            df.isetitem(position, series.dt.tz_localize(None))
        elif pd.api.types.is_object_dtype(series.dtype):
            df.isetitem(position, series.map(_drop_timezone))
    return df


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
        # ``is_string_dtype`` rather than an ``object`` comparison: pandas 3
        # gives string columns a dedicated ``str`` dtype, which an object-only
        # check (as the ``select_dtypes(include="object")`` this replaced) would
        # skip, silently leaving formulas unquoted.
        if pd.api.types.is_object_dtype(series.dtype) or pd.api.types.is_string_dtype(
            series.dtype
        ):
            df.isetitem(idx, series.map(_quote_formula))

    # Column headers and index labels are written to the sheet as well, and
    # pivot exports promote data values into both (a hostile warehouse string
    # can become a header or row label), so quote them like the CSV writer
    # quotes its headers. ``rename`` applies the mapper to every level of a
    # MultiIndex.
    df = df.rename(columns=_quote_formula, index=_quote_formula)

    # ``rename`` above only touches axis *labels*. The axis *names* (e.g. a
    # pivoted group-by column promoted to ``df.index.name``, or per-level
    # names on a MultiIndex) are a separate attribute that pandas still
    # writes into the sheet as header cells, so quote those too.
    return df.rename_axis(index=_quote_formula, columns=_quote_formula)


def df_to_excel(
    df: pd.DataFrame, number_format: Optional[str] = None, **kwargs: Any
) -> Any:
    """
    Serialize a DataFrame to an xlsx workbook.

    :param number_format: optional Excel format code applied to the data
           columns, e.g. ``"0.0%"``. Applying it as a cell format rather than
           writing formatted text keeps the underlying value numeric, so the
           spreadsheet still sums and charts it.
    """
    output = io.BytesIO()

    # make sure formulas are quoted, to prevent malicious injections
    df = quote_formulas(strip_timezones_for_excel(df))

    # pylint: disable=abstract-class-instantiated
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, **kwargs)

        if number_format and writer.sheets:
            worksheet = next(iter(writer.sheets.values()))
            # The sheet may start past column A, and the index occupies the
            # leading columns when it is written out.
            first_data_column = kwargs.get("startcol", 0) + (
                df.index.nlevels if kwargs.get("index", True) else 0
            )
            worksheet.set_column(
                first_data_column,
                first_data_column + len(df.columns) - 1,
                None,
                writer.book.add_format({"num_format": number_format}),
            )

        # Reset workbook document properties so the exported file does not
        # carry identifying details (authoring info, generation timestamps).
        writer.book.set_properties(NEUTRAL_DOCUMENT_PROPERTIES)

    return output.getvalue()


def apply_column_types(
    df: pd.DataFrame, column_types: list[GenericDataType]
) -> pd.DataFrame:
    """
    Applies the column types to the dataframe to prepare for an excel export.

    Timezone-aware ``datetime64`` columns are made naive here so Excel stores
    them as dates rather than strings. Object-dtype timestamps, indexes, and
    headers are stripped later by ``strip_timezones_for_excel`` inside
    ``df_to_excel``.

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
                    lambda x: (
                        str(x) if isinstance(x, (int, float)) and abs(x) > 10**15 else x
                    )
                )
            except ValueError:
                series = series.astype(str)
        elif isinstance(series.dtype, pd.DatetimeTZDtype):
            # Excel has no timezone type. Keep the wall-clock components so
            # the cell stays a date/time instead of a formatted string.
            series = series.dt.tz_localize(None)
        else:
            # Object-dtype tz-aware values (e.g. mixed columns holding
            # individual Timestamp/datetime objects) are handled by
            # ``strip_timezones_for_excel``, which every ``df_to_excel`` call
            # already runs -- doing the same ``_drop_timezone`` scan here
            # would just walk every object column twice.
            continue
        # ``isetitem`` replaces the column at that position, which is both
        # unambiguous under duplicate labels and free of the in-place dtype
        # casting that ``iloc`` assignment attempts.
        df.isetitem(idx, series)
    return df
