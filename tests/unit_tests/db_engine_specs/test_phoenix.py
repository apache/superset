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

from superset.constants import TimeGrain
from superset.db_engine_specs.phoenix import PhoenixEngineSpec
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_phoenix_properties() -> None:
    assert PhoenixEngineSpec.engine == "phoenix"
    assert PhoenixEngineSpec.engine_name == "Apache Phoenix"


def test_phoenix_metadata() -> None:
    metadata = PhoenixEngineSpec.metadata
    assert "Apache Phoenix is a relational database layer" in metadata["description"]
    assert metadata["logo"] == "apache-phoenix.png"
    assert "phoenixdb" in metadata["pypi_packages"]
    assert metadata["default_port"] == 8765


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02', 'yyyy-MM-dd')"),
        ("DateTime", "TO_TIMESTAMP('2019-01-02 03:04:05', 'yyyy-MM-dd HH:mm:ss')"),
        ("TIMESTAMP", "TO_TIMESTAMP('2019-01-02 03:04:05', 'yyyy-MM-dd HH:mm:ss')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(PhoenixEngineSpec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'SECOND') AS TIMESTAMP)"),
        (TimeGrain.MINUTE, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'MINUTE') AS TIMESTAMP)"),
        (TimeGrain.HOUR, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'HOUR') AS TIMESTAMP)"),
        (TimeGrain.DAY, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'DAY') AS DATE)"),
        (TimeGrain.WEEK, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'WEEK') AS DATE)"),
        (TimeGrain.MONTH, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'MONTH') AS DATE)"),
        (TimeGrain.QUARTER, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'QUARTER') AS DATE)"),
        (TimeGrain.YEAR, "CAST(TRUNC(CAST(ts AS TIMESTAMP), 'YEAR') AS DATE)"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        PhoenixEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )
