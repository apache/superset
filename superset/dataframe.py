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


def df_to_records(dframe: pd.DataFrame) -> List[Dict[str, Any]]:
    data: List[Dict[str, Any]] = dframe.to_dict(orient="records")
    # TODO: refactor this
    for d in data:
        for k, v in list(d.items()):
            # if an int is too big for JavaScript to handle
            # convert it to a string
            if isinstance(v, int) and abs(v) > JS_MAX_INTEGER:
                d[k] = str(v)
    return data
