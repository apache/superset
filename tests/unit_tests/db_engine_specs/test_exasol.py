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
from superset.db_engine_specs.exasol import ExasolEngineSpec


def test_exasol_properties() -> None:
    assert ExasolEngineSpec.engine == "exa"
    assert ExasolEngineSpec.engine_name == "Exasol"
    assert ExasolEngineSpec.max_column_name_length == 128


def test_exasol_metadata() -> None:
    metadata = ExasolEngineSpec.metadata
    assert "Exasol is a high-performance" in metadata["description"]
    assert metadata["logo"] == "exasol.png"
    assert "sqlalchemy-exasol" in metadata["pypi_packages"]
    assert metadata["default_port"] == 8563


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
    assert ExasolEngineSpec._time_grain_expressions[time_grain].format(col="ts") == expected
