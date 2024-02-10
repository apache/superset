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
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.doris import (
    AggState,
    ARRAY,
    BITMAP,
    DOUBLE,
    HLL,
    LARGEINT,
    MAP,
    QuantileState,
    STRUCT,
    TINYINT,
)
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import assert_column_spec


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        # Numeric
        ("tinyint", TINYINT, None, GenericDataType.NUMERIC, False),
        ("largeint", LARGEINT, None, GenericDataType.NUMERIC, False),
        ("decimal(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("decimalv3(38,18)", types.DECIMAL, None, GenericDataType.NUMERIC, False),
        ("double", DOUBLE, None, GenericDataType.NUMERIC, False),
        # String
        ("char(10)", types.CHAR, None, GenericDataType.STRING, False),
        ("varchar(65533)", types.VARCHAR, None, GenericDataType.STRING, False),
        ("binary", types.BINARY, None, GenericDataType.STRING, False),
        ("text", types.TEXT, None, GenericDataType.STRING, False),
        ("string", types.String, None, GenericDataType.STRING, False),
        # Date
        ("datetimev2", types.DateTime, None, GenericDataType.STRING, False),
        ("datev2", types.Date, None, GenericDataType.STRING, False),
        # Complex type
        ("array<varchar(65533)>", ARRAY, None, GenericDataType.STRING, False),
        ("map<string,int>", MAP, None, GenericDataType.STRING, False),
        ("struct<int,string>", STRUCT, None, GenericDataType.STRING, False),
        ("json", JSON, None, GenericDataType.STRING, False),
        ("jsonb", JSON, None, GenericDataType.STRING, False),
        ("bitmap", BITMAP, None, GenericDataType.STRING, False),
        ("hll", HLL, None, GenericDataType.STRING, False),
        ("quantile_state", QuantileState, None, GenericDataType.STRING, False),
        ("agg_state", AggState, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.doris import DorisEngineSpec as spec

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


@pytest.mark.parametrize(
    "sqlalchemy_uri,connect_args,return_schema,return_connect_args",
    [
        (
            "doris://user:password@host/db1",
            {"param1": "some_value"},
            "db1",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/db1",
            {"param1": "some_value"},
            "db1",
            {"param1": "some_value"},
        ),
        (
            "doris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            "catalog1.db1",
            {"param1": "some_value"},
        ),
        (
            "pydoris://user:password@host/catalog1.db1",
            {"param1": "some_value"},
            "catalog1.db1",
            {"param1": "some_value"},
        ),
    ],
)
def test_adjust_engine_params(
    sqlalchemy_uri: str,
    connect_args: dict[str, Any],
    return_schema: str,
    return_connect_args: dict[str, Any],
) -> None:
    from superset.db_engine_specs.doris import DorisEngineSpec

    url = make_url(sqlalchemy_uri)
    returned_url, returned_connect_args = DorisEngineSpec.adjust_engine_params(
        url, connect_args
    )
    assert returned_url.database == return_schema
    assert returned_connect_args == return_connect_args


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.doris import DorisEngineSpec

    assert (
        DorisEngineSpec.get_schema_from_engine_params(
            make_url("doris://localhost:9030/hive.test"),
            {},
        )
        == "test"
    )

    assert (
        DorisEngineSpec.get_schema_from_engine_params(
            make_url("doris://localhost:9030/hive"),
            {},
        )
        is None
    )
