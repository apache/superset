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

from superset.constants import TimeGrain
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("text", "'2019-01-02 03:04:05'"),
        ("TEXT", "'2019-01-02 03:04:05'"),
        ("dateTime", "'2019-01-02 03:04:05'"),
        ("DateTime", "'2019-01-02 03:04:05'"),
        ("DATETIME", "'2019-01-02 03:04:05'"),
        ("string", "'2019-01-02 03:04:05'"),
        ("String", "'2019-01-02 03:04:05'"),
        ("STRING", "'2019-01-02 03:04:05'"),
        ("integer", None),
        ("number", None),
        ("unknowntype", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    """Test datetime conversion for various MongoDB column types.
    """
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_epoch_to_dttm() -> None:
    """Test epoch to datetime conversion."""
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    # MongoDB engine just passes through the column expression
    assert spec.epoch_to_dttm() == "datetime({col}, 'unixepoch')"


@pytest.mark.parametrize(
    "grain,expected_expression",
    [
        (None, "{col}"),
        (TimeGrain.SECOND, "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', {col}))"),
        (TimeGrain.MINUTE, "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}))"),
        (TimeGrain.HOUR, "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))"),
        (TimeGrain.DAY, "DATETIME({col}, 'start of day')"),
        (
            TimeGrain.WEEK,
            "DATETIME({col}, 'start of day', -strftime('%w', {col}) || ' days')",
        ),
        (TimeGrain.MONTH, "DATETIME({col}, 'start of month')"),
        (
            TimeGrain.QUARTER,
            "DATETIME({col}, 'start of month', "
            "printf('-%d month', (strftime('%m', {col}) - 1) % 3))",
        ),
        (TimeGrain.YEAR, "DATETIME({col}, 'start of year')"),
        (
            TimeGrain.WEEK_ENDING_SATURDAY,
            "DATETIME({col}, 'start of day', 'weekday 6')",
        ),
        (
            TimeGrain.WEEK_ENDING_SUNDAY,
            "DATETIME({col}, 'start of day', 'weekday 0')",
        ),
        (
            TimeGrain.WEEK_STARTING_SUNDAY,
            "DATETIME({col}, 'start of day', 'weekday 0', '-7 days')",
        ),
        (
            TimeGrain.WEEK_STARTING_MONDAY,
            "DATETIME({col}, 'start of day', 'weekday 1', '-7 days')",
        ),
    ],
)
def test_time_grain_expressions(
    grain: Optional[TimeGrain],
    expected_expression: str,
) -> None:
    """Test time grain expressions for MongoDB.
    """
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    # pylint: disable=protected-access
    actual = spec._time_grain_expressions.get(grain)
    assert actual == expected_expression


def test_engine_metadata() -> None:
    """Test MongoDB engine specification metadata."""
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    assert spec.engine == "mongodb"
    assert spec.engine_name == "MongoDB"
    assert spec.force_column_alias_quotes is False
