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

import pytest

from superset.db_engine_specs.datafusion import DataFusionEngineSpec
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02', 'YYYY-MM-DD')"),
        (
            "DateTime",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678', 'YYYY-MM-DD HH24:MI:SS.FFF')",
        ),
        (
            "TimeStamp",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678', 'YYYY-MM-DD HH24:MI:SS.FFF')",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(DataFusionEngineSpec, target_type, expected_result, dttm)


def test_epoch_to_dttm() -> None:
    assert DataFusionEngineSpec.epoch_to_dttm().format(col="ts") == "from_unixtime(ts)"


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        ("PT1S", "DATE_TRUNC('second', ts)"),
        (
            "PT5S",
            "DATE_TRUNC('minute', ts) + INTERVAL '5 seconds' * "
            "FLOOR(EXTRACT(SECOND FROM ts) / 5)",
        ),
        (
            "PT30S",
            "DATE_TRUNC('minute', ts) + INTERVAL '30 seconds' * "
            "FLOOR(EXTRACT(SECOND FROM ts) / 30)",
        ),
        ("PT1M", "DATE_TRUNC('minute', ts)"),
        (
            "PT5M",
            "DATE_TRUNC('hour', ts) + INTERVAL '5 minutes' * "
            "FLOOR(EXTRACT(MINUTE FROM ts) / 5)",
        ),
        (
            "PT10M",
            "DATE_TRUNC('hour', ts) + INTERVAL '10 minutes' * "
            "FLOOR(EXTRACT(MINUTE FROM ts) / 10)",
        ),
        (
            "PT15M",
            "DATE_TRUNC('hour', ts) + INTERVAL '15 minutes' * "
            "FLOOR(EXTRACT(MINUTE FROM ts) / 15)",
        ),
        (
            "PT30M",
            "DATE_TRUNC('hour', ts) + INTERVAL '30 minutes' * "
            "FLOOR(EXTRACT(MINUTE FROM ts) / 30)",
        ),
        ("PT1H", "DATE_TRUNC('hour', ts)"),
        ("P1D", "DATE_TRUNC('day', ts)"),
        ("P1W", "DATE_TRUNC('week', ts)"),
        ("P1M", "DATE_TRUNC('month', ts)"),
        ("P3M", "DATE_TRUNC('quarter', ts)"),
        ("P1Y", "DATE_TRUNC('year', ts)"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        DataFusionEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )
