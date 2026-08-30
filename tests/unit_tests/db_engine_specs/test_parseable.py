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
from superset.db_engine_specs.parseable import ParseableEngineSpec
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_parseable_properties() -> None:
    assert ParseableEngineSpec.engine == "parseable"
    assert ParseableEngineSpec.engine_name == "Parseable"


def test_parseable_metadata() -> None:
    metadata = ParseableEngineSpec.metadata
    assert "Parseable is a distributed log analytics database" in metadata["description"]
    assert metadata["logo"] == "parseable.png"
    assert "sqlalchemy-parseable" in metadata["pypi_packages"]
    assert metadata["default_port"] == 8000


def test_epoch_to_dttm() -> None:
    assert ParseableEngineSpec.epoch_to_dttm().format(col="ts") == "to_timestamp(ts)"
    assert ParseableEngineSpec.epoch_ms_to_dttm().format(col="ts") == "to_timestamp(ts / 1000)"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("TIMESTAMP", "'2019-01-02T03:04:05.000'"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: str | None,
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(ParseableEngineSpec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "date_trunc('second', ts)"),
        (TimeGrain.MINUTE, "date_trunc('minute', ts)"),
        (TimeGrain.HOUR, "date_trunc('hour', ts)"),
        (TimeGrain.DAY, "date_trunc('day', ts)"),
        (TimeGrain.WEEK, "date_trunc('week', ts)"),
        (TimeGrain.MONTH, "date_trunc('month', ts)"),
        (TimeGrain.QUARTER, "date_trunc('quarter', ts)"),
        (TimeGrain.YEAR, "date_trunc('year', ts)"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert ParseableEngineSpec._time_grain_expressions[time_grain].format(col="ts") == expected
