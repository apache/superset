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
        ("text", "'2019-01-02 03:04:05'"),
        ("dateTime", "'2019-01-02 03:04:05'"),
        ("unknowntype", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_dynamodb_properties() -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert DynamoDBEngineSpec.engine == "dynamodb"
    assert DynamoDBEngineSpec.engine_name == "Amazon DynamoDB"


def test_dynamodb_metadata() -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    metadata = DynamoDBEngineSpec.metadata
    assert "Amazon DynamoDB is a serverless NoSQL database" in metadata["description"]
    assert metadata["logo"] == "aws.png"
    assert "pydynamodb" in metadata["pypi_packages"]


def test_epoch_to_dttm() -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert (
        DynamoDBEngineSpec.epoch_to_dttm().format(col="ts")
        == "datetime(ts, 'unixepoch')"
    )


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        ("PT1S", "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', ts))"),
        ("PT1M", "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', ts))"),
        ("PT1H", "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', ts))"),
        ("P1D", "DATETIME(ts, 'start of day')"),
        ("P1M", "DATETIME(ts, 'start of month')"),
        ("P1Y", "DATETIME(ts, 'start of year')"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert DynamoDBEngineSpec._time_grain_expressions[time_grain].format(col="ts") == expected

