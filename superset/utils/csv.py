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
import re
import urllib.request
from typing import Any, Optional, Union
from urllib.error import URLError

import pandas as pd

from superset.utils import json
from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)

negative_number_re = re.compile(r"^-[0-9.]+$")

# This regex will match if the string starts with:
#
#     1. one of -, @, +, |, =, %, a tab, or a carriage return
#     2. two double quotes immediately followed by one of -, @, +, |, =, %
#     3. one or more spaces immediately followed by one of -, @, +, |, =, %
#
# A leading tab or carriage return is treated as dangerous on its own because
# some spreadsheet software trims that leading whitespace and then evaluates
# the remaining cell content as a formula.
problematic_chars_re = re.compile(r'^(?:"{2}|\s{1,})(?=[\-@+|=%])|^[\-@+|=%\t\r]')


def escape_value(value: str) -> str:
    """
    Escapes a set of special characters.

    http://georgemauer.net/2017/10/07/csv-injection.html
    """
    needs_escaping = problematic_chars_re.match(value) is not None
    is_negative_number = negative_number_re.match(value) is not None

    if needs_escaping and not is_negative_number:
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
