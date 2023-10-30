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
from unittest.mock import Mock

import pytest
from sqlalchemy.types import (
    Boolean,
    Date,
    DateTime,
    DECIMAL,
    Float,
    Integer,
    String,
    TypeEngine,
)
from urllib3.connection import HTTPConnection

from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "to_date('2019-01-02')"),
        ("DateTime", "to_dateTime('2019-01-02 03:04:05')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str, expected_result: Optional[str], dttm: datetime
) -> None:
    from superset.db_engine_specs.databend import DatabendEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_execute_connection_error() -> None:
    from urllib3.exceptions import NewConnectionError

    from superset.db_engine_specs.databend import DatabendEngineSpec
    from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError

    cursor = Mock()
    cursor.execute.side_effect = NewConnectionError(
        HTTPConnection("Dummypool"), "Exception with sensitive data"
    )
    with pytest.raises(SupersetDBAPIDatabaseError) as ex:
        DatabendEngineSpec.execute(cursor, "SELECT col1 from table1")


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("Varchar", String, None, GenericDataType.STRING, False),
        ("Nullable(Varchar)", String, None, GenericDataType.STRING, False),
        ("Array(UInt8)", String, None, GenericDataType.STRING, False),
        ("Int8", Integer, None, GenericDataType.NUMERIC, False),
        ("Int16", Integer, None, GenericDataType.NUMERIC, False),
        ("Int32", Integer, None, GenericDataType.NUMERIC, False),
        ("Int64", Integer, None, GenericDataType.NUMERIC, False),
        ("Int128", Integer, None, GenericDataType.NUMERIC, False),
        ("Int256", Integer, None, GenericDataType.NUMERIC, False),
        ("Nullable(Int64)", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt8", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt16", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt32", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt64", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt128", Integer, None, GenericDataType.NUMERIC, False),
        ("UInt256", Integer, None, GenericDataType.NUMERIC, False),
        ("Float", Float, None, GenericDataType.NUMERIC, False),
        ("Double", Float, None, GenericDataType.NUMERIC, False),
        ("Decimal(1, 2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal32(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal64(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal128(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Decimal256(2)", DECIMAL, None, GenericDataType.NUMERIC, False),
        ("Bool", Boolean, None, GenericDataType.BOOLEAN, False),
        ("Nullable(Bool)", Boolean, None, GenericDataType.BOOLEAN, False),
        ("Date", Date, None, GenericDataType.TEMPORAL, True),
        ("Nullable(Date)", Date, None, GenericDataType.TEMPORAL, True),
        ("Datetime", DateTime, None, GenericDataType.TEMPORAL, True),
        ("Nullable(Datetime)", DateTime, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.databend import DatabendConnectEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "column_name,expected_result",
    [
        ("time", "time_07cc69"),
        ("count", "count_e2942a"),
    ],
)
def test_make_label_compatible(column_name: str, expected_result: str) -> None:
    from superset.db_engine_specs.databend import DatabendConnectEngineSpec as spec

    label = spec.make_label_compatible(column_name)
    assert label == expected_result
