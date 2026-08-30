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
from superset.db_engine_specs.arc import ArcEngineSpec


def test_arc_properties() -> None:
    assert ArcEngineSpec.engine == "arc"
    assert ArcEngineSpec.engine_name == "Arc"
    assert ArcEngineSpec.default_driver == "arrow"


def test_arc_metadata() -> None:
    metadata = ArcEngineSpec.metadata
    assert metadata["description"] == "Arc is a data platform with multiple connection options."
    assert metadata["logo"] == "arc.png"
    assert "arc-superset-arrow" in metadata["pypi_packages"]
    assert metadata["default_port"] == 443


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
    assert ArcEngineSpec._time_grain_expressions[time_grain].format(col="ts") == expected
