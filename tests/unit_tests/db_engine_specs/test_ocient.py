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
from superset.db_engine_specs.ocient import OcientEngineSpec


def test_ocient_properties() -> None:
    assert OcientEngineSpec.engine == "ocient"
    assert OcientEngineSpec.engine_name == "Ocient"
    assert OcientEngineSpec.force_column_alias_quotes is True
    assert OcientEngineSpec.max_column_name_length == 30
    assert OcientEngineSpec.cte_alias == "cte__"


def test_ocient_metadata() -> None:
    metadata = OcientEngineSpec.metadata
    assert metadata["description"] == "Ocient is a hyperscale data analytics database."
    assert metadata["logo"] == "ocient.png"
    assert "sqlalchemy-ocient" in metadata["pypi_packages"]
    assert metadata["default_port"] == 4050


def test_ocient_epoch_to_dttm() -> None:
    assert (
        OcientEngineSpec.epoch_to_dttm().format(col="ts")
        == "DATEADD(S, ts, '1970-01-01')"
    )
    assert (
        OcientEngineSpec.epoch_ms_to_dttm().format(col="ts")
        == "DATEADD(MS, ts, '1970-01-01')"
    )


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "ROUND(ts, 'SECOND')"),
        (TimeGrain.MINUTE, "ROUND(ts, 'MINUTE')"),
        (TimeGrain.HOUR, "ROUND(ts, 'HOUR')"),
        (TimeGrain.DAY, "ROUND(ts, 'DAY')"),
        (TimeGrain.WEEK, "ROUND(ts, 'WEEK')"),
        (TimeGrain.MONTH, "ROUND(ts, 'MONTH')"),
        (TimeGrain.QUARTER_YEAR, "ROUND(ts, 'QUARTER')"),
        (TimeGrain.YEAR, "ROUND(ts, 'YEAR')"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        OcientEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )
