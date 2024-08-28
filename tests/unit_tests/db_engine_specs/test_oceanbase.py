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

from typing import Any, Optional

import pytest
from sqlalchemy import JSON, types

from superset.db_engine_specs.oceanbase import ARRAY, MAP, NUMBER, NUMERIC
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("tinyint", types.SMALLINT, None, GenericDataType.NUMERIC, False),
        ("largeint", types.BIGINT, None, GenericDataType.NUMERIC, False),
        ("decimal(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("number(38,18)", NUMBER, None, GenericDataType.NUMERIC, False),
        ("numeric(38,18)", NUMERIC, None, GenericDataType.NUMERIC, False),
        ("double", types.FLOAT, None, GenericDataType.NUMERIC, False),
        # String
        ("char(10)", types.CHAR, None, GenericDataType.STRING, False),
        ("varchar(65533)", types.VARCHAR, None, GenericDataType.STRING, False),
        ("binary", types.BINARY, None, GenericDataType.STRING, False),
        ("text", types.TEXT, None, GenericDataType.STRING, False),
        # Complex type
        ("array<varchar(65533)>", ARRAY, None, GenericDataType.STRING, False),
        ("map<string,int>", MAP, None, GenericDataType.STRING, False),
        ("json", JSON, None, GenericDataType.STRING, False),
        ("jsonb", JSON, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.oceanbase import OceanBaseEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)
