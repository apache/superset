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
import re
from typing import Any

import pandas as pd


def escape_value(value: str) -> str:
    """
    Escapes a set of special characters.

    Taken from: https://github.com/raphaelm/defusedcsv/blob/5911a6ae54a82e71fad4db5eb8769738e9620e31/defusedcsv/csv.py#L15-L23 # pylint: disable=line-too-long
    """
    if (
        value
        and value[0] in ("@", "+", "-", "=", "|", "%")
        and not re.match("^-?[0-9,\\.]+$", value)
    ):
        value = value.replace("|", "\\|")
        value = "'" + value
    return value


def df_to_escaped_csv(df: pd.DataFrame, **kwargs: Any) -> Any:
    escape_values = lambda v: escape_value(v) if isinstance(v, str) else v
    return df.applymap(escape_values).to_csv(**kwargs)
