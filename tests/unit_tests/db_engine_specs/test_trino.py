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
from datetime import datetime
from typing import Optional

import pytest
import pytz
from flask.ctx import AppContext


@pytest.mark.parametrize(
    "target_type,dttm,result",
    [
        ("VARCHAR", datetime(2022, 1, 1), None),
        ("DATE", datetime(2022, 1, 1), "from_iso8601_date('2022-01-01')"),
        (
            "TIMESTAMP",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "from_iso8601_timestamp('2022-01-01T01:23:45.600000')",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "from_iso8601_timestamp('2022-01-01T01:23:45.600000')",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000, tzinfo=pytz.UTC),
            "from_iso8601_timestamp('2022-01-01T01:23:45.600000+00:00')",
        ),
    ],
)
def test_convert_dttm(
    app_context: AppContext, target_type: str, dttm: datetime, result: Optional[str],
) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    for case in (str.lower, str.upper):
        assert TrinoEngineSpec.convert_dttm(case(target_type), dttm) == result
