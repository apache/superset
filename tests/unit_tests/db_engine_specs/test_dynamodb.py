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

from datetime import datetime, timezone
from typing import Optional

import pytest
from sqlalchemy import types

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("text", "'2019-01-02T03:04:05.678900'"),
        ("dateTime", "'2019-01-02T03:04:05.678900'"),
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


def test_convert_dttm_bounds_compare_with_iso_8601_strings() -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    low_literal = spec.convert_dttm("text", datetime(2019, 1, 2, 4, 0, 0))
    high_literal = spec.convert_dttm("text", datetime(2019, 1, 2, 6, 0, 0))
    assert low_literal is not None
    assert high_literal is not None
    low, high = low_literal.strip("'"), high_literal.strip("'")
    stored = ["2019-01-02T03:30:00", "2019-01-02T04:15:00", "2019-01-02T06:00:00"]
    assert [value for value in stored if low <= value < high] == ["2019-01-02T04:15:00"]


def test_convert_dttm_keeps_fractional_seconds() -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    low_literal = spec.convert_dttm("text", datetime(2019, 1, 2, 4, 0, 0, 500000))
    assert low_literal == "'2019-01-02T04:00:00.500000'"
    low = low_literal.strip("'")
    stored = [
        "2019-01-02T04:00:00",
        "2019-01-02T04:00:00.123",
        "2019-01-02T04:00:00.750",
    ]
    assert [value for value in stored if value >= low] == ["2019-01-02T04:00:00.750"]


@pytest.mark.parametrize(
    "native_type,sqla_type,generic_type",
    [
        ("NUMBER", types.Numeric, GenericDataType.NUMERIC),
        ("number", types.Numeric, GenericDataType.NUMERIC),
        ("STRING", types.String, GenericDataType.STRING),
        ("DATETIME", types.DateTime, GenericDataType.TEMPORAL),
        ("DATE", types.Date, GenericDataType.TEMPORAL),
        ("BOOL", types.Boolean, GenericDataType.BOOLEAN),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    generic_type: GenericDataType,
) -> None:
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    column_spec = spec.get_column_spec(native_type)
    assert column_spec is not None
    assert isinstance(column_spec.sqla_type, sqla_type)
    assert column_spec.generic_type == generic_type


def test_orders_by_expression_not_alias() -> None:
    """
    The PyDynamoDB dialect drops top-level aliases, so ORDER BY must not
    reference one.
    """
    from superset.db_engine_specs.dynamodb import (
        DynamoDBEngineSpec as spec,  # noqa: N813
    )

    assert spec.allows_alias_in_orderby is False


def test_convert_dttm_preserves_timezone_offset() -> None:
    """Aware bounds retain their explicit timezone offset."""
    from superset.db_engine_specs.dynamodb import DynamoDBEngineSpec

    assert (
        DynamoDBEngineSpec.convert_dttm(
            "text", datetime(2019, 1, 2, 4, tzinfo=timezone.utc)
        )
        == "'2019-01-02T04:00:00+00:00'"
    )
