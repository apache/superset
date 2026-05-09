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
    assert DataFusionEngineSpec.epoch_to_dttm() == "from_unixtime({col})"


def test_time_grain_expressions() -> None:
    time_grains = DataFusionEngineSpec._time_grain_expressions
    assert time_grains is not None
    assert None in time_grains
    assert time_grains[None] == "{col}"
