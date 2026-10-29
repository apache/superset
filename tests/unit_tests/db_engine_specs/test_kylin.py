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
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("TimeStamp", "CAST('2019-01-02 03:04:05' AS TIMESTAMP)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.kylin import KylinEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "grain,expected",
    [
        (
            "PT1S",
            "TIMESTAMPADD(SECOND, HOUR(ts) * 3600 + MINUTE(ts) * 60 + SECOND(ts), "
            "CAST(CAST(ts AS DATE) AS TIMESTAMP))",
        ),
        (
            "PT1M",
            "TIMESTAMPADD(MINUTE, HOUR(ts) * 60 + MINUTE(ts), "
            "CAST(CAST(ts AS DATE) AS TIMESTAMP))",
        ),
        (
            "PT1H",
            "TIMESTAMPADD(HOUR, HOUR(ts), CAST(CAST(ts AS DATE) AS TIMESTAMP))",
        ),
        ("P1D", "CAST(ts AS DATE)"),
        ("P1W", "TIMESTAMPADD(DAY, 1 - DAYOFWEEK(ts), CAST(ts AS DATE))"),
        ("P1M", "TIMESTAMPADD(DAY, 1 - DAYOFMONTH(ts), CAST(ts AS DATE))"),
        (
            "P3M",
            "TIMESTAMPADD(MONTH, 3 * QUARTER(ts) - 3, "
            "TIMESTAMPADD(DAY, 1 - DAYOFYEAR(ts), CAST(ts AS DATE)))",
        ),
        ("P1Y", "TIMESTAMPADD(DAY, 1 - DAYOFYEAR(ts), CAST(ts AS DATE))"),
    ],
)
def test_time_grain_expressions(grain: str, expected: str) -> None:
    """
    Grains avoid FLOOR(... TO ...), which Kylin's Spark SQL pushdown cannot parse.
    """
    from superset.db_engine_specs.kylin import KylinEngineSpec

    expression = KylinEngineSpec._time_grain_expressions[grain].format(col="ts")
    assert expression == expected
    assert "FLOOR" not in expression


def test_labels_do_not_shadow_source_columns() -> None:
    """
    Kylin's Calcite resolves GROUP BY identifiers to SELECT aliases first, so a
    label must not equal the column it is derived from.
    """
    from superset.db_engine_specs.kylin import KylinEngineSpec

    assert KylinEngineSpec.make_label_compatible("ts") == "ts__"
    assert KylinEngineSpec.make_label_compatible("COUNT(*)") == "COUNT(*)__"
