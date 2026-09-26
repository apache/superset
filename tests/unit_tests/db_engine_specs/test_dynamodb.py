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

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("text", "'2019-01-02T03:04:05'"),
        ("dateTime", "'2019-01-02T03:04:05'"),
        ("unknowntype", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_convert_dttm_bounds_compare_with_iso_8601_strings() -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    low = spec.convert_dttm("text", datetime(2019, 1, 2, 4, 0, 0)).strip("'")
    high = spec.convert_dttm("text", datetime(2019, 1, 2, 6, 0, 0)).strip("'")
    stored = ["2019-01-02T03:30:00", "2019-01-02T04:15:00", "2019-01-02T06:00:00"]
    assert [value for value in stored if low <= value < high] == [
        "2019-01-02T04:15:00"
    ]
