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
from typing import Any, Dict, Optional
from urllib.error import URLError

import numpy as np
import pandas as pd
import simplejson
import io
from typing import Any

from superset.utils.core import GenericDataType

logger = logging.getLogger(__name__)

negative_number_re = re.compile(r"^-[0-9.]+$")

# This regex will match if the string starts with:
#
#     1. one of -, @, +, |, =, %
#     2. two double quotes immediately followed by one of -, @, +, |, =, %
#     3. one or more spaces immediately followed by one of -, @, +, |, =, %
#
problematic_chars_re = re.compile(r'^(?:"{2}|\s{1,})(?=[\-@+|=%])|^[\-@+|=%]')


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


def df_to_escaped_excel(df: pd.DataFrame, **kwargs: Any) -> Any:
    output = io.BytesIO()
    # pylint: disable=abstract-class-instantiated
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        df.to_excel(writer, **kwargs)

    return output.getvalue()
