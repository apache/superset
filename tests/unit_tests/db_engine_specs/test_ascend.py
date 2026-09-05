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
import pytest

from superset.constants import TimeGrain
from superset.db_engine_specs.ascend import AscendEngineSpec
from superset.db_engine_specs.impala import ImpalaEngineSpec


def test_ascend_properties() -> None:
    assert AscendEngineSpec.engine == "ascend"
    assert AscendEngineSpec.engine_name == "Ascend"
    assert issubclass(AscendEngineSpec, ImpalaEngineSpec)


def test_ascend_metadata() -> None:
    metadata = AscendEngineSpec.metadata
    assert "Ascend" in metadata["description"]
    assert metadata["logo"] == "ascend.webp"
    assert "impyla" in metadata["pypi_packages"]
    assert "ascend://" in metadata["connection_string"]


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "DATE_TRUNC('second', ts)"),
        (TimeGrain.MINUTE, "DATE_TRUNC('minute', ts)"),
        (TimeGrain.HOUR, "DATE_TRUNC('hour', ts)"),
        (TimeGrain.DAY, "DATE_TRUNC('day', ts)"),
        (TimeGrain.WEEK, "DATE_TRUNC('week', ts)"),
        (TimeGrain.MONTH, "DATE_TRUNC('month', ts)"),
        (TimeGrain.QUARTER, "DATE_TRUNC('quarter', ts)"),
        (TimeGrain.YEAR, "DATE_TRUNC('year', ts)"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        AscendEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )
