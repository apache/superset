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

from datetime import datetime, timezone

import pandas as pd

from superset.utils.excel import df_to_excel


def test_timezone_conversion() -> None:
    """
    Test that columns with timezones are converted to a string.
    """
    df = pd.DataFrame({"dt": [datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc)]})
    contents = df_to_excel(df)
    assert pd.read_excel(contents)["dt"][0] == "2023-01-01 00:00:00+00:00"
