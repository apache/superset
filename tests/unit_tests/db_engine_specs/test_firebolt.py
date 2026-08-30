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
        (
            "DateTime",
            "CAST('2019-01-02T03:04:05' AS DATETIME)",
        ),
        (
            "TimeStamp",
            "CAST('2019-01-02T03:04:05' AS TIMESTAMP)",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.firebolt import (
        FireboltEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_epoch_to_dttm() -> None:
    from superset.db_engine_specs.firebolt import FireboltEngineSpec

    assert (
        FireboltEngineSpec.epoch_to_dttm().format(col="timestamp_column")
        == "from_unixtime(timestamp_column)"
    )


def test_firebolt_properties() -> None:
    from superset.db_engine_specs.firebolt import FireboltEngineSpec

    assert FireboltEngineSpec.engine == "firebolt"
    assert FireboltEngineSpec.engine_name == "Firebolt"
    assert FireboltEngineSpec.default_driver == "firebolt"


def test_firebolt_metadata() -> None:
    from superset.db_engine_specs.firebolt import FireboltEngineSpec

    metadata = FireboltEngineSpec.metadata
    assert "Firebolt is a cloud data warehouse" in metadata["description"]
    assert metadata["logo"] == "firebolt.png"
    assert "firebolt-sqlalchemy" in metadata["pypi_packages"]


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "date_trunc('second', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.MINUTE, "date_trunc('minute', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.HOUR, "date_trunc('hour', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.DAY, "date_trunc('day', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.WEEK, "date_trunc('week', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.MONTH, "date_trunc('month', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.QUARTER, "date_trunc('quarter', CAST(ts AS TIMESTAMP))"),
        (TimeGrain.YEAR, "date_trunc('year', CAST(ts AS TIMESTAMP))"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    from superset.db_engine_specs.firebolt import FireboltEngineSpec

    assert FireboltEngineSpec._time_grain_expressions[time_grain].format(col="ts") == expected

