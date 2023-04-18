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
from typing import Any, Dict, Optional, Type

import pytest
import pytz
from sqlalchemy import types
from sqlalchemy.engine.url import make_url

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)


@pytest.mark.parametrize(
    "target_type,dttm,expected_result",
    [
        ("VARCHAR", datetime(2022, 1, 1), None),
        ("DATE", datetime(2022, 1, 1), "DATE '2022-01-01'"),
        (
            "TIMESTAMP",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600000'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600000'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000, tzinfo=pytz.UTC),
            "TIMESTAMP '2022-01-01 01:23:45.600000+00:00'",
        ),
    ],
)
def test_convert_dttm(
    target_type: str,
    dttm: datetime,
    expected_result: Optional[str],
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("varchar(255)", types.VARCHAR, {"length": 255}, GenericDataType.STRING, False),
        ("varchar", types.String, None, GenericDataType.STRING, False),
        ("char(255)", types.CHAR, {"length": 255}, GenericDataType.STRING, False),
        ("char", types.String, None, GenericDataType.STRING, False),
        ("integer", types.Integer, None, GenericDataType.NUMERIC, False),
        ("time", types.Time, None, GenericDataType.TEMPORAL, True),
        ("timestamp", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: Type[types.TypeEngine],
    attrs: Optional[Dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive/default"),
            {},
        )
        == "default"
    )

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive"),
            {},
        )
        is None
    )
