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
import logging
import urllib.request
from contextlib import closing
from decimal import Decimal
from typing import Any, Optional, Union
from urllib.error import URLError

import pandas as pd

from superset.utils import json
from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)

PROBLEMATIC_CSV_PREFIXES: str = "-@+|=%"


def _starts_with_formula_prefix(value: str) -> bool:
    first = value[0]
    if first in PROBLEMATIC_CSV_PREFIXES:
        return True
    if first == '"' and len(value) > 2:
        return value[1] == '"' and value[2] in PROBLEMATIC_CSV_PREFIXES
    return False


def _starts_like_spreadsheet_formula(value: str) -> bool:
    # A leading tab or carriage return is treated as dangerous on its own
    # because some spreadsheet software trims that leading whitespace and
    # then evaluates the remaining cell content as a formula.
    first = value[0]
    if first in ("\t", "\r"):
        return True
    if first.isspace():
        stripped = value.lstrip()
        return bool(stripped) and _starts_with_formula_prefix(stripped)
    return _starts_with_formula_prefix(value)


def _is_negative_number(value: str) -> bool:
    return (
        len(value) > 1
        and value[0] == "-"
        and all("0" <= character <= "9" or character == "." for character in value[1:])
    )


def escape_value(value: str) -> str:
    """
    Escapes a set of special characters.

    http://georgemauer.net/2017/10/07/csv-injection.html
    """
    if not value:
        return value

    if _starts_like_spreadsheet_formula(value) and not _is_negative_number(value):
        # Escape pipe to be extra safe as this
        # can lead to remote code execution
        value = value.replace("|", "\\|")

        # Precede the line with a single quote. This prevents
        # evaluation of commands and some spreadsheet software
        # will hide this visually from the user. Many articles
        # claim a preceding space will work here too, however,
        # when uploading a csv file in Google sheets, a leading
        # space was ignored and code was still evaluated.
        value = "'" + value

    return value


def format_decimal(value: Any) -> Any:
    """Return finite decimals as exact fixed-point text; preserve other values."""
    return (
        format(value, "f")
        if isinstance(value, Decimal) and value.is_finite()
        else value
    )


def df_to_escaped_csv(df: pd.DataFrame, **kwargs: Any) -> Any:
    def escape_values(v: Any) -> Union[str, Any]:
        return escape_value(v) if isinstance(v, str) else v

    def needs_escaping(level: pd.Index) -> bool:
        return any(
            isinstance(value, str) and escape_value(value) != value for value in level
        )

    def escape_axis_level(level: pd.Index) -> pd.Index:
        # Rebuilding a level can cost it its dtype, and the dtype is what
        # ``to_csv`` writes through: a ``float32`` row dimension widens to
        # ``float64`` and prints its binary expansion (``1.1`` as
        # ``1.100000023841858``), and a ``datetime64`` one turns into object,
        # which leaves the ``date_format`` from ``CSV_EXPORT`` inert. A level
        # holding nothing to escape is handed back as it is, so only a level
        # that really carries a formula label is rebuilt. A flat index may hold
        # the same label twice, so two labels escaping to one need no
        # factorizing here, unlike the levels of a MultiIndex.
        return level.map(escape_values) if needs_escaping(level) else level

    # Escape csv headers
    df = df.rename(columns=escape_values)

    # Escape csv values. Iterate by index label (via ``items``) rather than by
    # positional offset so the escaped value is written back to the correct row
    # even when the DataFrame has a non-default index (e.g. the flattened
    # MultiIndex produced by pivot_table_v2 post-processing). Pairing positional
    # indices with the label-based ``.at`` accessor would otherwise create
    # phantom rows and corrupt the output. Only string cells are reassigned, so
    # the dtype of mixed object columns (e.g. nullable integers) is preserved.
    for name, column in df.items():
        if pd.api.types.is_string_dtype(column.dtype):
            for label, value in column.items():
                if isinstance(value, str):
                    df.at[label, name] = escape_value(value)

    # Row labels and axis names are written out whenever the caller asks for the
    # index, which both export paths do once post-processing has replaced the
    # range index: pivot_table_v2 promotes the row dimension's warehouse values
    # into index labels and the dimension name into ``index.name``. Escaping
    # happens after the cell loop so the labels ``.at`` addresses stay the ones
    # the frame was handed over with. Every level of a MultiIndex is covered;
    # the axis names are a separate attribute, hence the ``set_names``. This
    # mirrors the four places ``superset.utils.excel.quote_formulas`` covers
    # for the xlsx writer.
    index = df.index
    if isinstance(index, pd.MultiIndex):
        # Every row label is one of its level's distinct values, so a frame with
        # nothing to escape is recognised from ``levels`` without a pass over
        # the rows. The reverse does not hold: ``levels`` keeps values no row
        # uses any more, which a filter or a slice leaves behind.
        if any(needs_escaping(level) for level in index.levels):
            # Only a level carrying a formula label among its row labels is
            # rebuilt, and that is decided from the row labels rather than from
            # ``levels``, because the rebuild costs a level its dtype:
            # ``Index.map`` re-infers it, so a level of integers and nulls comes
            # back ``float64``, which writes an integer id as ``5.0`` and rounds
            # one past 2**53 to a different number. A stale ``levels`` entry
            # would pay that for a label the export does not contain, while a
            # level that does need rebuilding holds a string among its rows,
            # which keeps the re-inferred dtype ``object``.
            #
            # A sibling keeps its own values and codes, and with them its dtype.
            # ``escape_value`` prepends a quote, so two distinct labels can
            # escape to the same text. Mapping ``levels`` in place would keep
            # every label on its own row, since the mapping runs position for
            # position and the original codes go on pointing at the right
            # entries, but it can leave a level holding the same value twice,
            # and the levels of a ``MultiIndex`` have to be unique. Reading the
            # row values and factorizing folds a collision onto one code.
            rebuilt = [
                pd.factorize(values.map(escape_values))
                if needs_escaping(values := index.get_level_values(position))
                else (index.codes[position], level)
                for position, level in enumerate(index.levels)
            ]
            index = pd.MultiIndex(
                levels=[level for _, level in rebuilt],
                codes=[level_codes for level_codes, _ in rebuilt],
                names=index.names,
            )
    else:
        index = escape_axis_level(index)
    # Assigned onto the frame rather than through ``set_axis`` and
    # ``rename_axis``, which each return a copy of the data while
    # copy-on-write is off, for a change that only touches the axes. ``df`` is
    # already private, the ``rename`` above having copied it, so there is
    # nothing of the caller's to protect. ``set_names`` takes a list for a flat
    # index and a MultiIndex alike, so both branches converge on one assignment.
    df.index = index.set_names([escape_values(name) for name in index.names])
    df.columns = df.columns.set_names(
        [escape_values(name) for name in df.columns.names]
    )

    return df.to_csv(escapechar="\\", **kwargs)


def get_chart_csv_data(
    chart_url: str,
    auth_cookies: Optional[dict[str, str]] = None,
    timeout: Optional[float] = None,
) -> Optional[bytes]:
    content = None
    if auth_cookies:
        opener = urllib.request.build_opener()
        cookie_str = ";".join([f"{key}={val}" for key, val in auth_cookies.items()])
        opener.addheaders.append(("Cookie", cookie_str))
        # A missing timeout means the socket blocks forever when the Superset
        # webserver is unreachable, wedging the report schedule in WORKING.
        with closing(opener.open(chart_url, timeout=timeout)) as response:
            content = response.read()
            if response.getcode() != 200:
                raise URLError(response.getcode())
    if content:
        return content
    return None


def get_chart_dataframe(
    chart_url: str,
    auth_cookies: Optional[dict[str, str]] = None,
    timeout: Optional[float] = None,
) -> Optional[pd.DataFrame]:
    """Fetch chart JSON over GET and convert it to a notification table."""
    return chart_data_to_dataframe(get_chart_csv_data(chart_url, auth_cookies, timeout))


def chart_data_to_dataframe(content: bytes | None) -> pd.DataFrame | None:
    """Convert chart-data JSON into the existing notification table representation."""
    # pylint: disable=unnecessary-lambda
    if content is None:
        return None

    result: dict[str, Any] = json.loads(content.decode("utf-8"))
    # need to convert float value to string to show full long number
    pd.set_option("display.float_format", lambda x: str(x))
    df: pd.DataFrame = pd.DataFrame.from_dict(result["result"][0]["data"])

    if df.empty:
        return None

    i: int
    err: BaseException
    try:
        # if any column type is equal to 2, need to convert data into
        # datetime timestamp for that column.
        if GenericDataType.TEMPORAL in result["result"][0]["coltypes"]:
            for i in range(len(result["result"][0]["coltypes"])):
                if result["result"][0]["coltypes"][i] == GenericDataType.TEMPORAL:
                    df[result["result"][0]["colnames"][i]] = df[
                        result["result"][0]["colnames"][i]
                    ].astype("datetime64[ms]")
    except BaseException as err:
        logger.error(err)

    # rebuild hierarchical columns and index
    df.columns = pd.MultiIndex.from_tuples(
        tuple(colname) if isinstance(colname, list) else (colname,)
        for colname in result["result"][0]["colnames"]
    )
    df.index = pd.MultiIndex.from_tuples(
        tuple(indexname) if isinstance(indexname, list) else (indexname,)
        for indexname in result["result"][0]["indexnames"]
    )
    return df
