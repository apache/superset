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
from typing import Any, Optional

import pytest
from sqlalchemy import types

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_epoch_to_dttm() -> None:
    """
    DB Eng Specs (couchbase): Test epoch to dttm
    """
    from superset.db_engine_specs.couchbase import CouchbaseEngineSpec

    assert CouchbaseEngineSpec.epoch_to_dttm() == "MILLIS_TO_STR({col} * 1000)"


def test_epoch_ms_to_dttm() -> None:
    """
    DB Eng Specs (couchbase): Test epoch ms to dttm
    """
    from superset.db_engine_specs.couchbase import CouchbaseEngineSpec

    assert CouchbaseEngineSpec.epoch_ms_to_dttm() == "MILLIS_TO_STR({col})"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "DATETIME(DATE_FORMAT_STR(STR_TO_UTC('2019-01-02'), 'iso8601'))"),
        (
            "DateTime",
            "DATETIME(DATE_FORMAT_STR(STR_TO_UTC('2019-01-02T03:04:05'), 'iso8601'))",
        ),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.couchbase import CouchbaseEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMERIC", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        ("BOOLEAN", types.Boolean, None, GenericDataType.BOOLEAN, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: dict[str, Any] | None,
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.couchbase import CouchbaseEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)
