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


def df_to_escaped_csv(df: pd.DataFrame, **kwargs: Any) -> Any:
    def escape_values(v: Any) -> Union[str, Any]:
        return escape_value(v) if isinstance(v, str) else v

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
        response = opener.open(chart_url, timeout=timeout)
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
    # Disable all the unnecessary-lambda violations in this function
    # pylint: disable=unnecessary-lambda
    content = get_chart_csv_data(chart_url, auth_cookies, timeout)
    if content is None:
        return None

    result = json.loads(content.decode("utf-8"))
    # need to convert float value to string to show full long number
    pd.set_option("display.float_format", lambda x: str(x))
    df = pd.DataFrame.from_dict(result["result"][0]["data"])

    if df.empty:
        return None

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
